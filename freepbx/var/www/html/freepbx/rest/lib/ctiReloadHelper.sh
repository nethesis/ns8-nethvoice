#!/bin/bash
while (ps aux | grep -q [r]etrieve_conf); do
    sleep 1
done
sleep 2

touch /notify/reload_nethcti-server
touch /notify/restart_reports-api
