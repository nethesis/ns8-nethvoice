#!/usr/bin/env php
<?php

/*
This is a sample script that is executed by Asterisk when NETHCTI_CDR_SCRIPT variable is set to /var/lib/asterisk/agi-bin/cdrscript.sample.php

Arguments:
1   source
2   channel
3   endtime
4   duration
5   amaflags
6   uniqueid
7   callerid
8   starttime
9   answertime
10  destination
11  disposition
12  lastapplication
13  billableseconds
14  destinationcontext
15  destinationchannel
16  accountcode
17  caller name
18  called number
19  called name
*/

//set_time_limit(10);
//define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
//include(AGIBIN_DIR."/phpagi.php");
//include_once('/etc/freepbx_db.conf')
//$agi = new AGI();
error_log($argv); // Log the arguments to the system log

