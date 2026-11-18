#!/bin/bash
if [ $# -eq 0 ]; then
  echo "use: $0 <QUEUE_NUMBER>"
  exit 1
fi
QUEUE=$1
/usr/bin/echo -e "{\"type\":\"collectd_notify\", \"notification\": {\"type\":\"queuefewop\", \"type_instance\":\"$QUEUE\", \"status\":\"warning\", \"message\":\"foo bar\"}}" | nc -U /run/nethvoice/nethcti.sock
echo "alarm \"queuefewop\" alarm emitted with severity \"warning\" for QUEUE $QUEUE"