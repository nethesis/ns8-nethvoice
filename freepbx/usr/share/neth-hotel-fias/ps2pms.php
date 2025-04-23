#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  PS - Posting Simple
 *  DA          Date
 *  DD          Dialed Digit
 *  DU          Duration
 *  MA          Minibar Article
 *  M#          Number of Articles
 *  MP          Meter or Tax Pulse
 *  PT          Posting Type
 *  RN          Room Number
 *  SO          Sales Outlet
 *  TA          Total Posting Amount
 *  TI          Time
 *  C#          Check Number
 *  CO          Credit Limit Override Flag
 *  CT          Clear Text
 *  CV          Covers
 *  D1 -D9      Discount 1-9
 *  ID          User ID
 *  P#          Posting Sequence Number
 *  PC          Posting Call Type
 *  PM          Payment Method
 *  PX          Posting Route
 *  S1 -S9      Subtotal 1-9
 *  SC          Service Charge
 *  ST          Serving Time
 *  T#          Table Number
 *  T1 -T9      Tax 1-9
 *  TP          Tip
 *  WS          Workstation ID
 *  X1          Cross Reference Data -additional Posting information
*/

if (!insertMessageIntoDB($section,$arguments)) {
    exit(1);
}
