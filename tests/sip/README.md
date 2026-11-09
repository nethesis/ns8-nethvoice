Run `lazy_members.py` with the installed `nethvoice-admin` skill's scripts on `PYTHONPATH`, inside the authorized module context. It imports the skill's SIP clients, fixtures, AMI controls, assertions and cleanup; it adds only Queue Options/VisualPlan scenarios. Read the installed skill's automated SIP reference before use.

Pass the same required arguments as `queue_test.py`. To distinguish Lazy Members from ordinary strategy rotation, use `--strategy ringall --penalties 0 1 --lazy --ring-timeout 4 --retry 1`. With this configuration, normal Asterisk retries A; Lazy Members must offer B after A times out. Three unused extensions, an unused queue and unused SIP/RTP ports must be supplied/discovered as documented by the skill. Use a new workdir for every run. Reports are private and must be sanitized before publication.

The PHP adapter invokes installed Queue Options and VisualPlan save code for the owned fixture. It never edits generated configuration or directly writes SQL. The regression asserts that a VisualPlan save preserves the stored/generated option and actual SIP INVITE order. Before the fix, the option disappears and the same call assertion reports `A -> A`.

Extra Lazy Members scenarios run after the harness's final successful baseline scenario (`queue-live-behavior-{repeat}`). Cleanup uses the harness's inherited teardown. A failed baseline, cancellation or uncleared calls prevent additional calls and configuration saves.

Run the local lifecycle regressions against the installed harness without SIP traffic:

```sh
PYTHONPATH=/path/to/nethvoice-admin/scripts python3 -m unittest discover -s tests/sip -v
```
