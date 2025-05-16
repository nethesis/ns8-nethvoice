#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  WA - Wakeup answer
 *  AS          Answer Status
 *  DA          Date
 *  RN          Room Number
 *  TI          Wake up Time
*/

/*  Available Answer Statuses
 *  AA          Virtual Number already assigned
 *  AN          Virtual Number not found
 *  BM          Balance mismatch
 *  BY          Telephone / Encoder Busy
 *  CD          Check-out date is not today
 *  CO          Posting denied because overwriting the CreditLimit is not allowed 
 *  DE          Wakeup/Key has been deleted
 *  DM          Sum of subtotals doesn't match TotalAmount
 *  DN          Request denied
 *  FX          Guest not allowed this feature
 *  IA          Invalid account
 *  NA          Night Audit
 *  NF          Feature not enabled or Check-out process not running
 *  NG          Guest not found
 *  NM          Message/Locator not found
 *  NP          Posting denied for this guest (NoPost flag has been set)
 *  NR          No Response
 *  OK          Command or request completed successfully
 *  RY          Retry
 *  UR          Unprocessable request, this request cannot be carried out , no retry
 */

if (!insertMessageIntoDB($section,$arguments)) {
    exit(1);
}
