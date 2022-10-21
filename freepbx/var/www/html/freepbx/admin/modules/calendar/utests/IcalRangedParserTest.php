<?php
use Carbon\Carbon;
use Carbon\CarbonInterval;
use FreePBX\modules\Calendar\IcalParser\IcalRangedParser;

include dirname(__DIR__).'/vendor/autoload.php';
/**
* https://blogs.kent.ac.uk/webdev/2011/07/14/phpunit-and-unserialized-pdo-instances/
* @backupGlobals disabled
*/
class IcalRangedParserTest extends PHPUnit_Framework_TestCase {
	public static function setUpBeforeClass() {
		include dirname(__DIR__)."/IcalParser/IcalRangedParser.php";
	}

	public function testFREEPBX18903() {
		$cal = new IcalRangedParser();

		$cal->setStartRange(Carbon::parse("2019-01-27"));

		$cal->setEndRange(Carbon::parse("2019-03-10"));

		$raw = file_get_contents(__DIR__.'/icals/FREEPBX18903.ics');
		$cal->parseString($raw);

		$events = $cal->getSortedEvents();

		$this->assertNotEmpty($events, 'No events could be found');
	}

	public function testFREEPBX17873() {
		$cal = new IcalRangedParser();

		$cal->setStartRange(Carbon::parse("2018-07-01"));

		$cal->setEndRange(Carbon::parse("2018-07-31"));

		$raw = file_get_contents(__DIR__.'/icals/FREEPBX17873.ics');
		$cal->parseString($raw);

		$events = $cal->getSortedEvents();

		$this->assertNotEmpty($events, 'No events could be found');

		$this->assertFalse(Carbon::createFromDate('2018', '07', '03')->between(Carbon::instance($events[0]['DTSTART']),Carbon::instance($events[0]['DTEND'])));
		$this->assertTrue(Carbon::createFromDate('2018', '07', '04')->between(Carbon::instance($events[0]['DTSTART']),Carbon::instance($events[0]['DTEND'])));
		$this->assertFalse(Carbon::createFromDate('2018', '07', '05')->between(Carbon::instance($events[0]['DTSTART']),Carbon::instance($events[0]['DTEND'])));
	}

	public function testFREEPBX17809() {
		$cal = new IcalRangedParser();

		$cal->setStartRange(Carbon::parse("2018-07-01"));

		$cal->setEndRange(Carbon::parse("2018-07-31"));

		$raw = file_get_contents(__DIR__.'/icals/FREEPBX17809.ics');
		$cal->parseString($raw);

		$events = $cal->getSortedEvents();

		$this->assertNotEmpty($events, 'No events could be found');
	}

	public function testFREEPBX17403() {
		$raw = file_get_contents(__DIR__.'/icals/FREEPBX17403.ics');

		$cal = new IcalRangedParser();
		$cal->setStartRange(Carbon::parse("2018-07-01"));
		$cal->setEndRange(Carbon::parse("2018-07-31"));
		$cal->parseString($raw);
		$events = $cal->getSortedEvents();
		$this->assertNotEmpty($events, 'No events could be found');
		$this->assertEquals(count($events), 2);

		$assertEvents = [
			[
				'2018', '07', '23','10','5','0'
			],
			[
				'2018', '07', '30','10','5','0'
			]
		];

		$this->assertEvents($assertEvents, $events);

		$cal = new IcalRangedParser();
		$cal->setStartRange(Carbon::parse("2018-09-01"));
		$cal->setEndRange(Carbon::parse("2018-09-31"));
		$cal->parseString($raw);
		$events = $cal->getSortedEvents();

		$this->assertNotEmpty($events, 'No events could be found');

		$assertEvents = [
			[
				'2018',
				'09',
				'3',
				'10',
				'5',
				'0'
			],
			[
				'2018',
				'09',
				'10',
				'10',
				'5',
				'0'
			],
			[
				'2018',
				'09',
				'11',
				'10',
				'5',
				'0'
			],
			[
				'2018',
				'09',
				'13',
				'14',
				'35',
				'0'
			],
			[
				'2018',
				'09',
				'17',
				'10',
				'5',
				'0'
			],
			[
				'2018',
				'09',
				'18',
				'10',
				'5',
				'0'
			],
			[
				'2018',
				'09',
				'20',
				'14',
				'35',
				'0'
			],
			[
				'2018',
				'09',
				'24',
				'10',
				'5',
				'0'
			],
			[
				'2018',
				'09',
				'25',
				'10',
				'5',
				'0'
			],
			[
				'2018',
				'09',
				'27',
				'14',
				'35',
				'0'
			],
		];

		$this->assertEvents($assertEvents, $events);

		$cal = new IcalRangedParser();
		$cal->setStartRange(Carbon::parse("2019-03-01"));
		$cal->setEndRange(Carbon::parse("2019-03-31"));
		$cal->parseString($raw);
		$events = $cal->getSortedEvents();

		$this->assertNotEmpty($events, 'No events could be found');

				$assertEvents = [
			[
				'2019',
				'03',
				'4',
				'10',
				'5',
				'0'
			],
			[
				'2019',
				'03',
				'5',
				'10',
				'5',
				'0'
			],
			[
				'2019',
				'03',
				'7',
				'14',
				'35',
				'0'
			],
			[
				'2019',
				'03',
				'11',
				'10',
				'5',
				'0'
			],
			[
				'2019',
				'03',
				'14',
				'14',
				'35',
				'0'
			],
			[
				'2019',
				'03',
				'18',
				'10',
				'5',
				'0'
			],
			[
				'2019',
				'03',
				'21',
				'14',
				'35',
				'0'
			],
			[
				'2019',
				'03',
				'25',
				'10',
				'5',
				'0'
			],
			[
				'2019',
				'03',
				'28',
				'14',
				'35',
				'0'
			],
		];

		$this->assertEvents($assertEvents, $events);
	}

	function testCountLimit() {
		$raw = file_get_contents(__DIR__.'/icals/countlimit.ics');
		$cal = new IcalRangedParser();
		$cal->setStartRange(Carbon::parse("2019-03-01"));
		$cal->setEndRange(Carbon::parse("2019-03-31"));
		$cal->parseString($raw);
		$events = $cal->getSortedEvents();

		$assertEvents = [
			[
				'2019',
				'03',
				'5',
				'12',
				'5',
				'0'
			],
		];

		$this->assertEvents($assertEvents, $events);
	}

	function testFREEPBX18919() {
		$raw = file_get_contents(__DIR__.'/icals/FREEPBX18919.ics');
		$cal = new IcalRangedParser();
		$cal->setStartRange(Carbon::parse("2019-03-03"));
		$cal->setEndRange(Carbon::parse("2019-03-05"));
		$cal->parseString($raw);
		$events = $cal->getSortedEvents();

		$assertEvents = [
			[
				'2019',
				'03',
				'4',
				'15',
				'46',
				'30'
			],
		];

		$this->assertEvents($assertEvents, $events);
	}

	function assertEvents($assertEvents, $events) {
		$this->assertEquals(count($events), count($assertEvents));
		foreach($assertEvents as $k => $args) {
			$msg = 'Failed asserting that '.$k.'('.implode(",",$args).") is between ".Carbon::instance($events[$k]['DTSTART'])->format('c')." and ".Carbon::instance($events[$k]['DTEND'])->format('c');
			$this->assertTrue(call_user_func_array('Carbon\Carbon::create',$args)->between(Carbon::instance($events[$k]['DTSTART']),Carbon::instance($events[$k]['DTEND'])),$msg);
		}
	}
}
