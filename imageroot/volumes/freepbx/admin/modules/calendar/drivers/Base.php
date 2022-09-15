<?php
namespace FreePBX\modules\Calendar\drivers;

use Ramsey\Uuid\Uuid;
use Ramsey\Uuid\Exception\UnsatisfiedDependencyException;
use Carbon\Carbon;
use Carbon\CarbonInterval;
use FreePBX\modules\Calendar\IcalParser\IcalRangedParser;
use om\IcalParser;
use Eluceo\iCal\Component\Calendar as iCalendar;
use Eluceo\iCal\Component\Event;
use Eluceo\iCal\Property\Event\RecurrenceRule;

abstract class Base {
	protected $freepbx;
	protected $calendarClass;
	protected $calendar;
	protected $now;

	public function __construct($calendarClass,$calendar) {
		if(empty($calendar)) {
			throw new \Exception("Calendar is empty!");
		}
		$this->freepbx = $calendarClass->FreePBX;
		$this->calendarClass = $calendarClass;
		$this->setTimezone(!empty($calendar['timezone']) ? $calendar['timezone'] : $this->freepbx->View()->getTimezone());
		$this->calendar = $calendar;
	}

	/**
	 * Get Information about this driver
	 * @method getInfo
	 * @return array  array of information
	 */
	public static function getInfo() {
		return array(
			"name" => _("Unknown Calendar")
		);
	}

	/**
	 * Get the "Add" display
	 * @method getAddDisplay
	 * @return string              HTML to display
	 */
	public static function getAddDisplay() {
		return '';
	}

	/**
	 * Get the "update" display
	 * @method getEditDisplay
	 * @param  array         $data Array of calendar information
	 * @return string               HTML to display
	 */
	public static function getEditDisplay($data) {
		return '';
	}

	/**
	 * Add new calendar of this type
	 * @method addCalendar
	 * @param  array      $data Array of data about this calendar
	 */
	public static function addCalendar($data) {
		$class = get_called_class();
		$uuid = Uuid::uuid4()->toString();
		$data['id'] = $uuid;
		$self = new $class(\FreePBX::create()->Calendar, $data);
		$self->updateCalendar($data);
		return $self;
	}

	public function setCalendar($calendar) {
		$self = clone $this;
		$self->calendar = $calendar;
		return $self;
	}

	/**
	 * Set Timezone
	 * This will also set or update now
	 * @method setTimezone
	 * @param  [type]      $timezone [description]
	 */
	public function setTimezone($timezone) {
		if(empty($timezone)) {
			return false;
		}
		$this->timezone = $timezone;
		if(isset($this->now)) {
			$this->now =  Carbon::createFromTimestamp($this->now->getTimestamp(), $this->timezone);
		} else {
			$this->setNow(time());
		}
	}

	/**
	 * Get Timezone
	 * @method getTimezone
	 * @return [type]      Timezone
	 */
	public function getTimezone() {
		return $this->timezone;
	}

	/**
	 * Set NOW
	 *
	 * This should only be called during debugging
	 *
	 * @method setNow
	 * @param  [type] $timestamp [description]
	 */
	public function setNow($timestamp) {
		if(empty($timestamp)) {
			return;
		}
		$this->now = Carbon::createFromTimestamp($timestamp, $this->timezone);
	}

	/**
	 * Get NOW
	 * @method getNow
	 * @return [type] [description]
	 */
	public function getNow() {
		return $this->now;
	}

	/**
	 * Update calendar by uuid
	 * @method updateCalendar
	 * @param  string         $id   The uuid to update
	 * @param  array         $data Array of data about this calendar
	 * @return boolean               true or false
	 */
	public function updateCalendar($data) {
		if(empty($this->calendar['id'])) {
			throw new \Exception("Calendar ID is empty");
		}

		$this->calendarClass->setConfig($this->calendar['id'],$data,'calendars');
		$data['id'] = $this->calendar['id'];
		$this->calendar = $data;
		return true;
	}

	public function deleteiCal() {
		$this->calendarClass->setConfig($this->calendar['id'],false,'calendar-raw');
	}

	/**
	 * Save full raw calendar ical
	 * @method saveiCal
	 * @param  string   $ical The calendar ical
	 */
	public function saveiCal($ical) {
		$this->calendarClass->setConfig($this->calendar['id'],$ical,'calendar-raw');
	}

	/**
	 * Get full raw calendar ical
	 * @method getIcal
	 * @return string  The calendar ical
	 */
	public function getIcal() {
		return $this->calendarClass->getConfig($this->calendar['id'],'calendar-raw');
	}

	/**
	 * Get all the Categories by Calendar ID
	 * @return array             Array of Categories with their respective events
	 */
	public function getCategories(\DateTime $start, \DateTime $end) {
		$raw = $this->getIcal();
		if(empty($raw)) {
			return [];
		}
		$cal = new IcalRangedParser();
		$cal->setStartRange($start);
		$cal->setEndRange($end);
		$cal->parseString($raw);
		$events = $cal->getSortedEvents();
		$categories = [];
		foreach($events as $event) {
			if(!empty($event['CATEGORIES']) && is_array($event['CATEGORIES'])) {
				$categories = array_merge($categories,$event['CATEGORIES']);
			}
		}
		return array_unique($categories);
	}

	/**
	 * Get the Private ical mapping token
	 * @method getMappingToken
	 * @return [type]          Mapping Token
	 */
	public function getMappingToken() {
		$mapping = $this->calendarClass->getConfig('ical-mapping');
		return isset($mapping[$this->calendar['id']]) ? $mapping[$this->calendar['id']] : null;
	}

	/**
	 * [updateiCalMapping description]
	 * @method updateiCalMapping
	 * @param  [type]            $token [description]
	 * @return [type]                   [description]
	 */
	public function updateiCalMapping($token) {
		$mapping = $this->calendarClass->getConfig('ical-mapping');
		$mapping = !empty($mapping) ? $mapping : array();
		$mapping[$this->calendar['id']] = $token;
		$this->calendarClass->setConfig('ical-mapping',$mapping);
		return true;
	}

	/**
	 * Get all events based on NOW
	 * @method getEventsNow
	 * @return array       Array of Events
	 */
	public function getEventsNow() {
		$start = $this->getNow()->copy()->subWeek();
		$stop = $this->getNow()->copy()->addWeek();
		return $this->getEventsBetween($start, $end, true, true);
	}

	/**
	 * Get Events Between date range
	 * @method getEventsBetween
	 * @param  DateTime         $start           DateTime Starting Date
	 * @param  DateTime         $end             DateTime Ending Date
	 * @param  boolean          $expandRecurring Whether to expand all recurring dates into individual events
	 * @param  boolean          $nowOnly         Only return events that are marked as NOW
	 * @return array                            Array of Events
	 */
	public function getEventsBetween(\DateTime $start, \DateTime $end, $expandRecurring = true, $nowOnly = false) {
		$raw = $this->getIcal();
		if(empty($raw)) {
			return [];
		}
		$cal = new IcalRangedParser();
		$cal->setStartRange($start);
		$cal->setEndRange($end);
		$cal->parseString($raw);
		$events = $cal->getSortedEvents();
		$parsedEvents = [];
		$i = 0;
		//set timezone to null to use event specific timezones.
		//Not recommended though
		$calendarTimezone = new \DateTimeZone($this->timezone);
		foreach($events as $event) {
			if(!$expandRecurring && isset($event['ORIGINAL_VEVENT'])) {
				continue;
			}
			$event['UID'] = isset($event['UID']) ? $event['UID'] : $i;

			// If there is no end event, set it to the start time
			if (!isset($event['DTEND']) || !is_object($event['DTEND'])) {
				$event['DTEND'] = clone $event['DTSTART'];
			}

			if($event['DTSTART']->getTimezone() != $event['DTEND']->getTimezone()) {
				throw new \Exception("Start timezone and end timezone are different! Not sure what to do here".json_encode($event));
			}

			$event['DTSTART'] = Carbon::instance($event['DTSTART']);
			$event['DTEND'] = Carbon::instance($event['DTEND']);

			if(!empty($calendarTimezone) && $this->calendar['type'] != "local") {
				$event['DTSTART']->setTimezone($calendarTimezone);
				$event['DTEND']->setTimezone($calendarTimezone);
			}

			if(isset($event['ORIGINAL_VEVENT'])) {
				$event['ORIGINAL_VEVENT']['DTSTART'] = Carbon::instance($event['ORIGINAL_VEVENT']['DTSTART']);
				$event['ORIGINAL_VEVENT']['DTEND'] = Carbon::instance($event['ORIGINAL_VEVENT']['DTEND']);
				if(!empty($calendarTimezone)) {
					$event['ORIGINAL_VEVENT']['DTSTART']->setTimezone($calendarTimezone);
					$event['ORIGINAL_VEVENT']['DTEND']->setTimezone($calendarTimezone);
				}
			}

			if($nowOnly && !$this->now->between($event['DTSTART'], $event['DTEND'])) {
				continue;
			}

			$event['RECURRENCE_INSTANCE'] = isset($event['RECURRENCE_INSTANCE']) ? $event['RECURRENCE_INSTANCE'] : 0;

			$e = [
				'name' => $event['SUMMARY'],
				'description' => isset($event['DESCRIPTION']) ? $event['DESCRIPTION'] : '',
				'recurring' => isset($event['RECURRING']) ? $event['RECURRING'] : false,
				'rrules' => [],
				'categories' => (!empty($event['CATEGORIES']) && is_array($event['CATEGORIES'])) ? $event['CATEGORIES'] : [],
				'timezone' => null,
				'starttime' => $event['DTSTART']->format('H:i:s'),
				'endtime' => $event['DTEND']->format('H:i:s'),
				'linkedid' => $event['UID'],
				'uid' => $expandRecurring ? $event['UID'].'_'.$event['RECURRENCE_INSTANCE'] : $event['UID'],
				'rstartdate' => isset($event['ORIGINAL_VEVENT']) ? $event['ORIGINAL_VEVENT']['DTSTART']->getTimestamp() : null,
				'renddate' => isset($event['ORIGINAL_VEVENT']) ? $event['ORIGINAL_VEVENT']['DTEND']->getTimestamp() : null,
				'ustarttime' => $event['DTSTART']->getTimestamp(),
				'uendtime' => $event['DTEND']->getTimestamp(),
				'title' => $event['SUMMARY'],
				'startdate' => $event['DTSTART']->format('Y-m-d'),
				'enddate' => $event['DTEND']->format('Y-m-d'),
				'start' => sprintf('%sT%s',$event['DTSTART']->format('Y-m-d'),$event['DTSTART']->format('H:i:s')),
				'end' => sprintf('%sT%s',$event['DTEND']->format('Y-m-d'),$event['DTEND']->format('H:i:s')),
				'now' => $this->now->between($event['DTSTART'], $event['DTEND']),
				'allDay' => false
			];

			$tz = $event['DTSTART']->getTimezone();
			$timezone = $tz->getName();
			$e['timezone'] = ($timezone === 'Z') ? null : $timezone;

			if(!empty($event['RECURRING'])) {
				$e['rrules'] = [
					"frequency" => $event['RRULE']['FREQ'],
					"days" => !empty($event['RRULE']['BYDAY']) ? explode(",",$event['RRULE']['BYDAY']) : [],
					"byday" => !empty($event['RRULE']['BYDAY']) ? $event['RRULE']['BYDAY'] : [],
					"interval" => !empty($event['RRULE']['INTERVAL']) ? $event['RRULE']['INTERVAL'] : "",
					"count" => !empty($event['RRULE']['COUNT']) ? $event['RRULE']['COUNT'] : "",
					"until" => !empty($event['RRULE']['UNTIL']) ? $event['RRULE']['UNTIL']->format('U') : ""
				];
			}

			//Check for all day
			if($e['ustarttime'] === $e['enddate'] || ($e['starttime'] === $e['endtime']) && ($e['startdate'] !== $e['enddate'])) {
				$e['allDay'] = true;
			}

			//FREEPBX-17710 Google and others use the same UID when events are split.
			//Since we dont allow editing of remote events just add $i to the list
			//http://thomas.apestaart.org/log/?p=579
			if(isset($event['RECURRENCE-ID'])) {
				$parsedEvents[$e['uid'].'_'.$event['RECURRENCE-ID']] = $e;
			} else {
				$parsedEvents[$e['uid']] = $e;
			}
			$i++;
		}
		return $parsedEvents;
	}

	/**
	 * Checks if any event in a category matches the current time
	 *
	 * @param string $category
	 * @return boolean          True if match, False if no match
	 */
	public function matchCategory($category) {
		$start = $this->now->copy()->subWeek();
		$stop = $this->now->copy()->addWeek();
		$events = $this->getEventsBetween($start, $stop);
		foreach($events as $event) {
			if($event['now'] && in_array($category, $event['categories'])) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Checks if any event matches the current time
	 * @return boolean          True if match, False if no match
	 */
	public function matchCalendar() {
		$start = $this->now->copy()->subWeek();
		$stop = $this->now->copy()->addWeek();
		$events = $this->getEventsBetween($start, $stop);
		foreach($events as $event) {
			if($event['now']) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Checks if a specific event matches the current time
	 * @param  string $eventID    The Event ID
	 * @return boolean          True if match, False if no match
	 */
	public function matchEvent($eventID) {
		$start = $this->now->copy()->subWeek();
		$stop = $this->now->copy()->addWeek();
		$events = $this->getEventsBetween($start, $stop);
		foreach($events as $event) {
			if($event['now'] && ($event['uid'] === $eventID || $event['linkedid'] === $eventID)) {
				return true;
			}
		}
	}

	/**
	 * Gets the next event
	 * @return array  the Found event or empty
	 */
	public function getNextEvent(){
		$dates = array(
			$this->now->copy()->endOfWeek(),
			$this->now->copy()->endOfMonth(),
			$this->now->copy()->addMonth(),
			$this->now->copy()->addMonths(2),
			$this->now->copy()->addMonths(4),
			$this->now->copy()->addMonths(6),
			$this->now->copy()->addYear(),
			$this->now->copy()->addYears(2),
			$this->now->copy()->addYears(4),
			$this->now->copy()->addYears(6),
			$this->now->copy()->addYears(10)
		);
		foreach($dates as $date){
			$events = $this->getEventsBetween($this->now, $date);
			if(!empty($events)){
				return reset($events);
			}
		}
		return array();
	}

	/**
	 * Update Calendar By ID
	 *
	 * For remote calendars, updates the local calendar to match
	 * the remote.
	 *
	 * @param string $calendarid
	 *
	 * @return void
	 */
	public function refreshCalendar() {
		return $this->processCalendar();
	}

	/**
	 * Process calendar
	 * @method processCalendar
	 * @return void
	 */
	public function processCalendar() {
		return false;
	}
}
