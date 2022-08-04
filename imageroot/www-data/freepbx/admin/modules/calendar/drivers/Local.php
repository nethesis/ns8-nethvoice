<?php
namespace FreePBX\modules\Calendar\drivers;
use Ramsey\Uuid\Uuid;
use Carbon\Carbon;
use Eluceo\iCal\Component\Calendar as iCalendar;
use Eluceo\iCal\Component\Event;
use Eluceo\iCal\Property\Event\RecurrenceRule;
use FreePBX\modules\Calendar\IcalParser\IcalRangedParser;
class Local extends Base {
	public $driver = 'Local';

	public static function getInfo() {
		return array(
			"name" => _("Local Calendar")
		);
	}

	public static function getEditDisplay($data) {
		return load_view(dirname(__DIR__)."/views/local_settings.php",array('action' => 'edit', 'data' => $data, 'timezone' => $data['timezone']));
	}

	public static function getAddDisplay() {
		return load_view(dirname(__DIR__)."/views/local_settings.php",array('action' => 'add', 'timezone' => \FreePBX::View()->getTimezone()));
	}

	public function deleteEvent($eventID) {
		$cal = $this->getICal();
		if(!empty($cal)) {
			$pos = strrpos($cal, "UID:$eventID");
			if($pos === false) {
				return false;
			}
			$startpos = strrpos(substr($cal,0,$pos), "BEGIN:VEVENT");
			$endpos = strpos($cal, 'END:VEVENT', $startpos)+strlen('END:VEVENT');
			$cal = substr_replace ($cal, "", $startpos, $endpos-$startpos);
			$cal = preg_replace("/(^[\r\n]*|[\r\n]+)[\s\t]*[\r\n]+/", "\n", $cal);

			$startpos = strrpos($cal, "BEGIN:VEVENT");
			if($startpos === false) {
				$this->deleteiCal();
			} else {
				$this->saveiCal($cal);
			}
			return true;
		}
		return false;
	}

	public function updateCalendar($data) {
		$calendar = array(
			"name" => $data['name'],
			"description" => $data['description'],
			"type" => 'local',
			"timezone" => $data['timezone']
		);
		return parent::updateCalendar($calendar);
	}

	public function updateEvent($event) {
		$timezone = !empty($event['timezone']) ? $event['timezone'] : $this->timezone;
		$vEvent = new Event();
		// Make sure there is a title
		if (!isset($event['title']) || !trim($event['title'])) {
			throw new \Exception("No title provided");
		}
		$vEvent->setSummary(trim($event['title']));
		if (!isset($event['description'])) {
			$vEvent->setDescription("");
		} else {
			$vEvent->setDescription(trim($event['description']));
		}

		if(!empty($event['categories'])) {
			$vEvent->setCategories(explode(",",$event['categories']));
		}

		$vEvent->setUseTimezone(true);
		$vEvent->setUseUtc(false);

		$vEvent->setDtStart(new Carbon($event['startdate']." ".$event['starttime'], $timezone));
		$vEvent->setDtEnd(new Carbon($event['enddate']." ".$event['endtime'], $timezone));
		if(!empty($event['allday']) && $event['allday'] == "yes") {
			$vEvent->setDtStart(new Carbon($event['startdate']." 00:00:00", $timezone));
			$vEvent->setDtEnd(new Carbon($event['enddate']." 00:00:00", $timezone));
			$vEvent->setNoTime(true);
		}
		if(!empty($event['reoccurring']) && $event['reoccurring'] == "yes") {
			if(!empty($event['rstartdate'])) {
				$vEvent->setDtStart(Carbon::createFromTimestamp($event['rstartdate'], $timezone));
				$vEvent->setDtEnd(Carbon::createFromTimestamp($event['renddate'], $timezone));
			}
			$recurrenceRule = new RecurrenceRule();
			switch($event['repeats']) {
				case "0":
					$recurrenceRule->setFreq(RecurrenceRule::FREQ_DAILY);
				break;
				case "1":
					$recurrenceRule->setByDay("MO,TU,WE,TH,FR");
					$recurrenceRule->setFreq(RecurrenceRule::FREQ_WEEKLY);
				break;
				case "2":
					$recurrenceRule->setByDay("MO,WE,FR");
					$recurrenceRule->setFreq(RecurrenceRule::FREQ_WEEKLY);
				break;
				case "3":
					$recurrenceRule->setByDay("TU,TH");
					$recurrenceRule->setFreq(RecurrenceRule::FREQ_WEEKLY);
				break;
				case "4":
					if(!empty($event['weekday']) && is_array($event['weekday'])) {
						$days = array();
						foreach($event['weekday'] as $day) {
							switch($day) {
								case "0":
									$days[] = 'MO';
								break;
								case "1":
									$days[] = 'TU';
								break;
								case "2":
									$days[] = 'WE';
								break;
								case "3":
									$days[] = 'TH';
								break;
								case "4":
									$days[] = 'FR';
								break;
								case "5":
									$days[] = 'SA';
								break;
								case "6":
									$days[] = 'SU';
								break;
								default:
								break;
							}
						}
						$recurrenceRule->setByDay(implode(",",$days));
					}
					$recurrenceRule->setFreq(RecurrenceRule::FREQ_WEEKLY);
				break;
				case "5":
					$recurrenceRule->setFreq(RecurrenceRule::FREQ_MONTHLY);
				break;
				case "6":
					$recurrenceRule->setFreq(RecurrenceRule::FREQ_YEARLY);
				break;
				default:
				break;
			}
			if(!empty($event['repeat-count'])) {
				$recurrenceRule->setInterval($event['repeat-count']);
			}
			if(!empty($event['occurrences'])) {
				$recurrenceRule->setCount($event['occurrences']);
			}
			if(!empty($event['afterdate'])) {
				$recurrenceRule->setUntil(new Carbon($event['afterdate'], $timezone));
			}

			$vEvent->setRecurrenceRule($recurrenceRule);
		}
		$uuid = ($event['eventid'] == 'new') ? (string)Uuid::uuid4() : $event['eventid'];
		$vEvent->setUniqueId($uuid);

		$this->deleteEvent($uuid);
		$event = $vEvent->render();

		$cal = $this->getICal();
		if(!empty($cal)) {
			$pos = strrpos($cal, 'END:VEVENT')+strlen('END:VEVENT');
			$cal = substr($cal, 0, $pos) ."\n". $event . substr($cal, $pos);
		} else {
			//tried to generate from iCalendar but stuff allDay event days get +1 day
			$cal = <<<CAL
BEGIN:VCALENDAR
VERSION:2.0
PRODID:{$this->calendar['id']}
X-WR-TIMEZONE:{$this->calendar['timezone']}
X-PUBLISHED-TTL:P1W
BEGIN:VTIMEZONE
TZID:{$this->calendar['timezone']}
X-LIC-LOCATION:{$this->calendar['timezone']}
END:VTIMEZONE
$event
END:VCALENDAR
CAL;
		}
		$this->saveiCal($cal);
	}
}
