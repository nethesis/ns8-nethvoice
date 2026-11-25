#!/usr/bin/env python3
"""Run real NethVoice agent calls using disposable SIP identities."""
import argparse
import fcntl
from contextlib import ExitStack
import importlib.util
import json
import os
from pathlib import Path
import signal
import sys
import tempfile
import time

from history import History
from lab import Lab
from latency import latency_summary, measure_greeting
from media import RemotePhone
from phone_cleanup import recover_phones
from scenarios import Call, matrix, require
from speech import SatelliteSpeech, prepare


def helper_path(selected):
    if selected:
        path = Path(selected).resolve(strict=True)
    else:
        spec = importlib.util.find_spec("sip_endpoint")
        if spec and spec.origin:
            return Path(spec.origin)
        root = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
        candidates = list((root / "plugins/cache/nethserver").glob(
            "nethserver-skills/*/skills/nethvoice-admin/scripts/sip_endpoint.py"))
        if len(candidates) != 1:
            raise RuntimeError("Select the installed nethvoice-admin scripts/sip_endpoint.py with --sip-helper")
        path = candidates[0]
    return path


def disconnect(phones):
    errors = []
    for role, phone in phones.items():
        try:
            phone.hangup()
        except Exception as exc:
            errors.append(f"{role} {exc}")
    if errors:
        raise RuntimeError("SIP teardown failed: " + ", ".join(errors))


def calibration(phones, fixture, clips, speech):
    caller, peer = phones["caller"], phones["colleague"]
    caller.dial(fixture["endpoints"]["colleague"]["username"])
    peer.wait("RINGING", 25)
    peer.answer()
    caller.wait("CONFIRMED", 15)
    peer.wait("CONFIRMED", 15)
    for sender, receiver, phrase, word in ((caller, peer, "caller_marker", "tulipano"),
                                            (peer, caller, "colleague_marker", "castagna")):
        mark = receiver.mark()
        sender.play(clips[phrase])
        text = speech.transcribe(receiver.listen(mark, 12), "it")
        require(word in text.casefold(), "SIP calibration failed for received marker " + word)
    disconnect(phones)


def save_report(path, report):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    tmp.replace(path)


def claim_run(work):
    lock = (work / "controller.lock").open("a")
    try:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock.close()
        raise RuntimeError("A controller is still active for this run") from None
    return lock


def cleanup(lab, history):
    errors = []
    if history is not None:
        if history.phone is not None:
            try:
                history.phone.close()
            except Exception as exc:
                errors.append(f"carrier phone: {exc}")
        try:
            history.cleanup()
        except Exception as exc:
            errors.append(f"history trunk: {exc}")
    try:
        lab.cleanup(keep_manifest=bool(errors))
    except Exception as exc:
        errors.append(f"PBX: {exc}")
    if errors:
        raise RuntimeError(", ".join(errors))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", nargs="?", choices=["functional", "smoke", "recovery", "latency", "audio", "preflight", "list", "cleanup"],
                        default="functional")
    parser.add_argument("--host", default="root@makako.sf.nethserver.net")
    parser.add_argument("--domain", default="voice2.makako.sf.nethserver.net")
    parser.add_argument("--module", default="nethvoice70")
    parser.add_argument("--calls-per-mode", type=int, help="Fresh calls for each latency caller mode (default 20)")
    parser.add_argument("--case", dest="cases", action="append", help="Scenario name; repeat to select several")
    parser.add_argument("--transport", choices=["realtime", "live"])
    parser.add_argument("--sip-helper")
    parser.add_argument("--run-dir", type=Path, help="New private results directory, or existing directory for cleanup")
    args = parser.parse_args(argv)
    if args.calls_per_mode is not None and (args.profile != "latency" or not 1 <= args.calls_per_mode <= 20):
        parser.error("--calls-per-mode requires latency and a count between 1 and 20")
    launch = Path.cwd()
    if args.profile == "list":
        for profile in ("smoke", "functional", "recovery", "latency"):
            print(profile, " ".join(f"{t}/{c}" for t, c in matrix(profile)))
        return 0
    eligible = matrix(args.profile)
    if args.profile == "latency":
        if args.cases:
            parser.error("latency measures both caller modes; select the batch size with --calls-per-mode")
        eligible = [row for _ in range(args.calls_per_mode or 20) for row in eligible]
    eligible = [(t, c) for t, c in eligible if not args.transport or args.transport == t]
    missing = set(args.cases or ()) - {c for _, c in eligible}
    if missing:
        parser.error("cases unavailable for selected profile and transport: " + ", ".join(sorted(missing)))
    cases = [(t, c) for t, c in eligible if not args.cases or c in args.cases]
    if not cases:
        parser.error("no scenario matches this profile and selection")
    os.umask(0o077)
    speech = SatelliteSpeech(args.host, args.module, args.domain)
    if args.profile == "audio":
        clips = prepare(launch, speech.synthesize)
        print(f"{len(clips)} validated WAVs in {launch}")
        return 0
    if args.profile == "cleanup" and not args.run_dir:
        parser.error("cleanup requires the original --run-dir")
    if args.profile in ("cleanup", "preflight"):
        lab = Lab(args.host, args.module, domain=args.domain, workdir=args.run_dir or launch)
        if args.profile == "preflight":
            print(json.dumps(lab.preflight(), indent=2))
        else:
            if not lab.manifest.exists() and not (args.run_dir / "report.json").is_file():
                parser.error("run directory contains neither an ownership manifest nor a prior report")
            if lab.manifest.exists():
                state = json.loads(lab.manifest.read_text())
                if (state["host"], state["module"], state["domain"]) != (lab.host, lab.module, lab.domain):
                    parser.error("original run target and supplied cleanup target differ")
                lab.state = state
                with claim_run(args.run_dir):
                    recover_phones(lab, helper_path(args.sip_helper))
                    cleanup(lab, History(lab))
                    result = args.run_dir / "report.json"
                    if result.exists():
                        report = json.loads(result.read_text())
                        report["cleanup_recovery"] = "complete"
                        save_report(result, report)
        return 0
    if args.run_dir:
        args.run_dir.mkdir(mode=0o700, parents=True, exist_ok=False)
        work = args.run_dir.resolve()
    else:
        runs = launch / ".nvagent-e2e-runs"
        runs.mkdir(mode=0o700, exist_ok=True)
        work = Path(tempfile.mkdtemp(dir=runs))
    (work / ".gitignore").write_text("*\n")
    print(f"Run directory: {work}", flush=True)
    report = dict(profile=args.profile, target=args.domain, scenarios=[
        dict(transport=t, case=c, status="not_run") for t, c in cases])
    lock = claim_run(work)
    result = work / "report.json"
    save_report(result, report)
    lab = Lab(args.host, args.module, domain=args.domain, workdir=work)
    phones = {}
    history = None
    failed = False
    try:
        clips = prepare(launch, speech.synthesize)
        report["environment"] = lab.preflight()
        helper = helper_path(args.sip_helper)
        fixture = lab.provision()
        history = History(lab, helper)
        with ExitStack() as stack:
            for role, config in fixture["endpoints"].items():
                phone = RemotePhone(args.host, args.module, config, work,
                                    lab.state["owner"] + "-" + role, helper)
                stack.callback(phone.close)
                phone.start()
                phones[role] = phone
            calibration(phones, fixture, clips, speech)
            report["media_calibration"] = "passed"
            for row in report["scenarios"]:
                start = time.monotonic()
                row.update(status="running", evidence=[])
                save_report(result, report)
                case = Call(lab, phones, fixture, clips, speech, row["transport"], row["case"], row["evidence"])
                case.history = history
                try:
                    if args.profile == "latency":
                        measure_greeting(case, row)
                    else:
                        case.run()
                    row["status"] = "passed"
                except KeyboardInterrupt:
                    row.update(status="interrupted", error="Controller interrupted")
                    raise
                except Exception as exc:
                    failed = True
                    # A fixture or public-login failure before dialing cannot test the agent.
                    status = "failed" if case.dial_attempted else "blocked"
                    row.update(status=status, error=f"{type(exc).__name__}: {exc}")
                    try:
                        row["observed"] = case.diagnostic()
                    except Exception as diagnostic_error:
                        row["diagnostic_error"] = str(diagnostic_error)
                finally:
                    row["seconds"] = round(time.monotonic() - start, 2)
                    save_report(result, report)
                    print(f"{row['transport']}/{row['case']} {row['status']} {row.get('error','')}", flush=True)
                    if history.phone:
                        history.phone.hangup()
                    disconnect(phones)
                    for phone in phones.values():
                        phone.discard()
                    if history.phone:
                        history.phone.discard()
                    case.pending.clear()
    except (Exception, KeyboardInterrupt) as exc:
        failed = True
        report["run_error"] = f"{type(exc).__name__}: {exc}"
        print(report["run_error"], file=sys.stderr)
    finally:
        try:
            cleanup(lab, history)
            report["cleanup"] = "complete"
        except Exception as exc:
            failed = True
            report["cleanup"] = f"failed: {exc}"
        if args.profile == "latency":
            report["greeting_latency"] = latency_summary(report["scenarios"])
            report["greeting_latency"]["modes"] = {
                mode: latency_summary([r for r in report["scenarios"] if r["case"] == mode])
                for mode in ("vad", "continuous")}
            failed |= not report["greeting_latency"]["passed"]
            print(json.dumps(report["greeting_latency"]), flush=True)
        if failed and "run_error" not in report and report["cleanup"] != "complete":
            print(report["cleanup"], file=sys.stderr)
        save_report(result, report)
        lock.close()
    return int(failed)


if __name__ == "__main__":
    def interrupted(_signum, _frame):
        raise KeyboardInterrupt("run interrupted")
    signal.signal(signal.SIGTERM, interrupted)
    sys.exit(main())
