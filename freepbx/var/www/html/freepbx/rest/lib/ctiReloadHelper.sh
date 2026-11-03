#!/bin/bash
while (ps aux | grep -q [r]etrieve_conf); do
    sleep 1
done
sleep 2

touch /notify/reload_nethcti-server
# Mark configuration reloads separately from explicit restart requests.
printf 'config\n' > /notify/restart_reports-api
