<?php

/**
* https://blogs.kent.ac.uk/webdev/2011/07/14/phpunit-and-unserialized-pdo-instances/
* @backupGlobals disabled
*/

class timeconditionsTest extends PHPUnit_Framework_TestCase{

	//Will be FreePBX BMO object
	protected static $f;

	//Will become your Class object
	protected static $o;

	public static function setUpBeforeClass() {
			self::$f = FreePBX::create();
			self::$o = self::$f->Timeconditions;
	}

	public function testTimegroups(){
			$description = "UnitTest";
		$times = json_decode('{times":{"2":{"hour_start":"9","minute_start":"0","hour_finish":"17","minute_finish":"0","wday_start":"-","wday_finish":"-","mday_start":"-","mday_finish":"-","month_start":"-","month_finish":"-"}}}',true);
		$id = self::$o->addTimeGroup($description, $times);
		$this->assertNotFalse($id, "ID was false, Timegroup did not add");
		$tg = self::$o->getTimeGroup($id);
		$this->assertEquals($description, $tg[1], "Description is NOT as expected");
		$this->assertFalse(self::$o->addTimeGroup($description, $times), "Tried adding a duplicate timegroup should have returned false");
		$this->assertTrue(self::$o->delTimeGroup($id), "Could not delete the test timegroup");
	}

	public function testCheckTimeAnytime() {
		$out = self::$o->checkTime('*|*|*|*');
		$this->assertTrue($out,"Failed to assert that NOW is between ANYTIME");
	}

	public function testCheckTimeNormal() {
		$dtNow = new DateTime();
		$sub1Hour = clone $dtNow;
		$sub1Hour->modify('-1 hour');
		$add1Hour = clone $dtNow;
		$add1Hour->modify('+1 hour');
		$sub1Day = clone $dtNow;
		$sub1Day->modify('-1 day');
		$add1Day = clone $dtNow;
		$add1Day->modify('+1 day');
		$add3Days = clone $dtNow;
		$add3Days->modify('+3 days');

		// DOW
		$out = self::$o->checkTime('*|'.strtolower($sub1Day->format('D')).'-'.strtolower($add1Day->format('D')).'|*|*');
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format('D')."] is between ".$sub1Day->format('D')." and ".$add1Day->format('D'));

		$out = self::$o->checkTime('*|'.strtolower(date('D')).'|*|*');
		$this->assertTrue($out,"Failed to assert that TODAY[".date('D')."] is ".strtolower(date('D')));

		// Day-Day includes both
		// I.e. Mon-Fri is [Mon,Fri]
		$out = self::$o->checkTime('*|'.strtolower($dtNow->format('D')).'-'.strtolower($add3Days->format('D')).'|*|*');
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format('D')."] is between ".$dtNow->format('D')." and ".$add3Days->format('D'));

		// DOM
		$out = self::$o->checkTime('*|*|'.strtolower($sub1Day->format('j')).'-'.strtolower($add1Day->format('j')).'|*');
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format('j')."] is between ".$sub1Day->format('j')." and ".$add1Day->format('j'));

		$out = self::$o->checkTime('*|*|'.strtolower(date('j')).'|*');
		$this->assertTrue($out,"Failed to assert that TODAY[".date('j')."] is ".strtolower(date('j')));

		// Day-Day includes both
		// I.e. 17-23 is [17,23]
		$out = self::$o->checkTime('*|*|'.strtolower($dtNow->format('j')).'-'.strtolower($add3Days->format('j')).'|*');
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format('j')."] is between ".$dtNow->format('j')." and ".$add3Days->format('j'));

		// Time
		$out = self::$o->checkTime(strtolower($sub1Hour->format('H:i')).'-'.strtolower($add1Hour->format('H:i')).'|*|*|*');
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format("H:i")."] is between ".$sub1Hour->format('H:i')." and ".$add1Hour->format('H:i'));

		$out = self::$o->checkTime('00:01-23:59|*|*|*');
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format("H:i")."] is between 00:01 and 23:59");

			// With TZ
		$tzname = "America/Vancouver";
		$tz = new DateTimeZone($tzname); // Time zone = PST-08PDT+01,M3.2.0/02:00,M11.1.0/02:00
		$dtNow->setTimezone($tz);
		$sub1Hour->setTimezone($tz);
		$add1Hour->setTimezone($tz);

		$out = self::$o->checkTime(strtolower($sub1Hour->format('H:i')).'-'.strtolower($add1Hour->format('H:i')).'|*|*|*|' . $tzname);
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format("H:i")."] in " . $tzname . " is between ".$sub1Hour->format('H:i')." and ".$add1Hour->format('H:i'));

	}

	public function testCheckTimeInverted() {
		$dtNow = new DateTime();
		$sub1Hour = clone $dtNow;
		$sub1Hour->modify('-1 hour');
		$add1Hour = clone $dtNow;
		$add1Hour->modify('+1 hour');
		$sub1Day = clone $dtNow;
		$sub1Day->modify('-1 day');
		$add1Day = clone $dtNow;
		$add1Day->modify('+1 day');
		$add3Days = clone $dtNow;
		$add3Days->modify('+3 days');


		// DOW
		$out = self::$o->checkTime('*|'.strtolower($add1Day->format('D')).'-'.strtolower($sub1Day->format('D')).'|*|*');
		$this->assertFalse($out,"Failed to assert that NOW[".$dtNow->format('D')."] is NOT between ".$add1Day->format('D')." and ".$sub1Day->format('D'));

		$out = self::$o->checkTime('*|'.strtolower($add1Day->format('D')).'-'.strtolower($dtNow->format('D')).'|*|*');
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format('D')."] is between ".$add1Day->format('D')." and ".$dtNow->format("D"));

		$out = self::$o->checkTime('*|mon-sun|*|*');
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format('D')."] is between Mon and Sun");

		// Day-Day includes both
		// I.e. Fri-Mon is [Fri,Mon]
		$out = self::$o->checkTime('*|'.strtolower($add3Days->format('D')).'-'.strtolower($dtNow->format('D')).'|*|*');
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format('D')."] is between ".$add3Days->format('D')." and ".$dtNow->format('D'));

		// DOM
		$out = self::$o->checkTime('*|*|'.strtolower($add1Day->format('j')).'-'.strtolower($sub1Day->format('j')).'|*');
		$this->assertFalse($out,"Failed to assert that NOW[".$dtNow->format("j")."] is NOT between ".$add1Day->format('j')." and ".$sub1Day->format('j'));

		$out = self::$o->checkTime('*|*|'.strtolower($add1Day->format('j')).'-'.strtolower($dtNow->format("j")).'|*');
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format("j")."] is between ".$add1Day->format('j')." and ".$dtNow->format("j"));

		// Day-Day includes both
		// I.e. 23-17 is [23,17]
		$out = self::$o->checkTime('*|*|'.strtolower($add3Days->format('j')).'-'.strtolower($dtNow->format('j')).'|*');
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format('j')."] is between ".$add3Days->format('j')." and ".$dtNow->format('j'));

		// Time
		$out = self::$o->checkTime(strtolower($add1Hour->format('H:i')).'-'.strtolower($sub1Hour->format('H:i')).'|*|*|*');
		$this->assertFalse($out,"Failed to assert that NOW[".$dtNow->format("H:i")."] is NOT between ".$add1Hour->format('H:i')." and ".$sub1Hour->format('H:i'));

		$out = self::$o->checkTime(strtolower($add1Hour->format('H:i')).'-'.strtolower($dtNow->format("H:i")).'|*|*|*');
		$this->assertTrue($out,"Failed to assert that NOW[".$dtNow->format("H:i")."] is between ".$add1Hour->format('H:i')." and ".$dtNow->format("H:i"));

		// With TZ
		$tzname = "America/Vancouver";
		$tz = new DateTimeZone($tzname); // Time zone = PST-08PDT+01,M3.2.0/02:00,M11.1.0/02:00
		$dtNow->setTimezone($tz);
		$sub1Hour->setTimezone($tz);
		$add1Hour->setTimezone($tz);

		$out = self::$o->checkTime(strtolower($add1Hour->format('H:i')).'-'.strtolower($sub1Hour->format('H:i')).'|*|*|*|' . $tzname);
		$this->assertFalse($out,"Failed to assert that NOW[".$dtNow->format("H:i")."] is NOT between ".$add1Hour->format('H:i')." and ".$sub1Hour->format('H:i'));

	}

}
