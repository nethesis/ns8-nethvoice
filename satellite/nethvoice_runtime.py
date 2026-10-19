"""Run voice agents and optional transcription in the NethVoice Satellite container."""
# SPDX-License-Identifier: GPL-3.0-or-later
import os
import signal
import subprocess
import sys
import time


def main():
    stopping = False

    def stop(*_):
        nonlocal stopping
        stopping = True

    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, stop)
    commands = [[sys.executable, '-m', 'voice_agent.runner']]
    if any(os.getenv(name, '').lower() == 'true' for name in (
            'SATELLITE_CALL_TRANSCRIPTION_ENABLED',
            'SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED')):
        commands.append([sys.executable, 'main.py'])

    children = []
    restart_at = [None] * len(commands)
    try:
        for command in commands:
            if stopping:
                return 0
            children.append(subprocess.Popen(command, start_new_session=True))
        while not stopping:
            for index, child in enumerate(children):
                if child.poll() is not None:
                    if restart_at[index] is None:
                        print(f'Satellite component {index} exited (status {child.returncode}); restarting component',
                              file=sys.stderr, flush=True)
                        try:
                            os.killpg(child.pid, signal.SIGTERM)
                        except ProcessLookupError:
                            pass
                        restart_at[index] = time.monotonic() + 5
                    elif time.monotonic() >= restart_at[index]:
                        # Stop orphaned workers before replacing this component.
                        try:
                            os.killpg(child.pid, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                        children[index] = subprocess.Popen(commands[index], start_new_session=True)
                        restart_at[index] = None
            time.sleep(0.1)
        return 0
    finally:
        # Each component owns a process group, including any transcription workers.
        for child in children:
            try:
                os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        deadline = time.monotonic() + 25
        for child in children:
            try:
                child.wait(timeout=max(0, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                pass
        for child in children:
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            child.wait()


if __name__ == '__main__':
    sys.exit(main())
