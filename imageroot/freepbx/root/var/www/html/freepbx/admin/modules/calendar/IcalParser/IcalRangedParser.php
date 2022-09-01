<?php

namespace FreePBX\modules\Calendar\IcalParser;
use om\Freq;
use om\Recurrence;
use om\IcalParser;
use Carbon\CarbonPeriod;
class IcalRangedParser extends IcalParser {
	private $ranges = [
		'start' => null,
		'end' => null
	];
	public function __construct() {
		parent::__construct();
		$this->ranges['start'] = new \DateTime('now', new \DateTimeZone('UTC'));
		$this->ranges['start']->sub(new \DateInterval('P6M'));
		$this->ranges['end'] = new \DateTime('now', new \DateTimeZone('UTC'));
		$this->ranges['end']->add(new \DateInterval('P6M'));
	}

	public function setStartRange(\DateTime $start) {
		$this->ranges['start'] = $start;
	}

	public function setEndRange(\DateTime $end) {
		$this->ranges['end'] = $end;
	}

	/**
	 * @param $event
	 * @return array
	 * @throws \Exception
	 */
	public function parseRecurrences($event) {
		$recurring = new Recurrence($event['RRULE']);
		$exclusions = [];
		$additions = [];

		if (!empty($event['EXDATES'])) {
			foreach ($event['EXDATES'] as $exDate) {
				if (is_array($exDate)) {
					foreach ($exDate as $singleExDate) {
						if($this->eventDateInCalendarRange($singleExDate)) {
							$exclusions[] = $singleExDate->getTimestamp();
						}
					}
				} else {
					if($this->eventDateInCalendarRange($exDate)) {
						$exclusions[] = $exDate->getTimestamp();
					}
				}
			}
		}

		if (!empty($event['RDATES'])) {
			foreach ($event['RDATES'] as $rDate) {
				if (is_array($rDate)) {
					foreach ($rDate as $singleRDate) {
						if($this->eventDateInCalendarRange($singleRDate)) {
							$additions[] = $singleRDate->getTimestamp();
						}
					}
				} else {
					if($this->eventDateInCalendarRange($rDate)) {
						$additions[] = $rDate->getTimestamp();
					}
				}
			}
		}

		date_default_timezone_set($event['DTSTART']->getTimezone()->getName());

		$until = $recurring->getUntil();
		if ($until === false) {
			//forever... limit to 15 years
			$end = clone($event['DTSTART']);
			$end->add(new \DateInterval('P15Y')); // + 15 years
			$recurring->setUntil($end);
		}

		$byKeys = [
			'BYWEEKNO',
			'BYYEARDAY',
			'BYMONTHDAY',
			'BYDAY',
			'BYHOUR',
			'BYMINUTE',
			'BYSECOND'
		];
		foreach($byKeys as $key) {
			if(isset($recurring->rrule[$key])) {
				$recurring->rrule[$key] = str_replace('"','',$recurring->rrule[$key]);
			}
		}

		if(!isset($recurring->rrule['COUNT'])) {
			$frequency = new Freq($recurring->rrule, $event['DTSTART']->getTimestamp(), $exclusions, $additions);
			$nextTimestamp = ($event['DTSTART']->getTimestamp() > $this->ranges['start']->getTimestamp()) ? $event['DTSTART']->getTimestamp() : $this->ranges['start']->getTimestamp();

			$out = $frequency->previousOccurrence($nextTimestamp);
			$start = clone($event['DTSTART']);
			$start->setTimestamp($out);

			$d1 = $this->ranges['start'];

			$end = $until !== false && $until->getTimestamp() < $this->ranges['end']->getTimestamp() ? $until : $this->ranges['end'];

			$diff = $start->diff($end);
			if ($until === false) {
				$end = clone($start);
				$end->add($diff);
				$recurring->setUntil($end);
			}

			$frequency = new Freq($recurring->rrule, $start->getTimestamp(), $exclusions, $additions);
			$recurrenceTimestamps = $frequency->getAllOccurrences();
		} elseif(class_exists('FreePBX')) {
			\FreePBX::Notifications()->add_warning('calendar', 'RRULECOUNT', _('Calendar using COUNT'), _('A calendar you have added has an event that has a reoccuring rule of COUNT. When COUNT is used this slows down Calendar drastically. Please change your rule to another format'), "", true, true);
			/*
			$period = CarbonPeriod::between($event['DTSTART'],$this->ranges['end']);
			switch ($event['RRULE']['FREQ']) {
				case 'DAILY':
					$period->setDateInterval(new \DateInterval("P1D"));
					break;
				case 'WEEKLY':
					$period->setDateInterval(new \DateInterval("P1W"));
					break;
				case 'MONTHLY':
					$period->setDateInterval(new \DateInterval("P1M"));
					break;
				case 'YEARLY':
					$period->setDateInterval(new \DateInterval("P1Y"));
					break;
				default:
					// We don't know how to handle anything else.
					throw new Exception("Cannot handle rrule frequency ".$event['RRULE']['FREQ']);
			}
			if(isset($event['RRULE']['COUNT'])) {
				$period->setRecurrences($event['RRULE']['COUNT']);
			}
			$period->filter(function($date) use ($event, $exclusions) {
				if(in_array($date->getTimestamp(),$exclusions)) {
					return false;
				}
				if($date->between($this->ranges['start'],$this->ranges['end'])) {
					return true;
				}
				return false;
			},'RRULE');

			$recurrenceTimestamps = [];
			foreach ($period as $date) {
				$recurrenceTimestamps[] = $date->format('U');
			}

			$recurrenceTimestamps = array_merge($recurrenceTimestamps,$additions);
			*/
			$frequency = new Freq($recurring->rrule, $event['DTSTART']->getTimestamp(), $exclusions, $additions);
			$recurrenceTimestamps = $frequency->getAllOccurrences();
		}

		$recurrences = [];
		foreach ($recurrenceTimestamps as $recurrenceTimestamp) {
			$tmp = new \DateTime('now', $event['DTSTART']->getTimezone());
			$tmp->setTimestamp($recurrenceTimestamp);

			$recurrenceIDDate = $tmp->format('Ymd');
			$recurrenceIDDateTime = $tmp->format('Ymd\THis');
			if (empty($this->data['_RECURRENCE_IDS'][$recurrenceIDDate]) &&
				empty($this->data['_RECURRENCE_IDS'][$recurrenceIDDateTime])) {
				$gmtCheck = new \DateTime("now", new \DateTimeZone('UTC'));
				$gmtCheck->setTimestamp($recurrenceTimestamp);
				$recurrenceIDDateTimeZ = $gmtCheck->format('Ymd\THis\Z');
				if (empty($this->data['_RECURRENCE_IDS'][$recurrenceIDDateTimeZ])) {
					$recurrences[] = $tmp;
				}
			}
		}

		return $recurrences;
	}

	/**
	 * @return array
	 */
	public function getEvents() {
		$events = [];
		if (isset($this->data['VEVENT'])) {
			for ($i = 0; $i < count($this->data['VEVENT']); $i++) {
				$event = $this->data['VEVENT'][$i];

				if (empty($event['RECURRENCES'])) {
					if (!empty($event['RECURRENCE-ID']) && !empty($event['UID']) && isset($event['SEQUENCE'])) {
						$modifiedEventUID = $event['UID'];
						$modifiedEventRecurID = $event['RECURRENCE-ID'];
						$modifiedEventSeq = intval($event['SEQUENCE'], 10);

						if (isset($this->data["_RECURRENCE_COUNTERS_BY_UID"][$modifiedEventUID])) {
							$counter = $this->data["_RECURRENCE_COUNTERS_BY_UID"][$modifiedEventUID];

							$originalEvent = $this->data["VEVENT"][$counter];
							if (isset($originalEvent['SEQUENCE'])) {
								$originalEventSeq = intval($originalEvent['SEQUENCE'], 10);
								$originalEventFormattedStartDate = $originalEvent['DTSTART']->format('Ymd\THis');
								if ($modifiedEventRecurID === $originalEventFormattedStartDate && $modifiedEventSeq > $originalEventSeq) {
									// this modifies the original event
									$modifiedEvent = array_replace_recursive($originalEvent, $event);
									$this->data["VEVENT"][$counter] = $modifiedEvent;
									foreach ($events as $z => $event) {
										if ($events[$z]['UID'] === $originalEvent['UID'] &&
											$events[$z]['SEQUENCE'] === $originalEvent['SEQUENCE']) {
											// replace the original event with the modified event
											$events[$z] = $modifiedEvent;
											break;
										}
									}
									$event = null; // don't add this to the $events[] array again
								} else if (!empty($originalEvent['RECURRENCES'])) {
									for ($j = 0; $j < count($originalEvent['RECURRENCES']); $j++) {
										$recurDate = $originalEvent['RECURRENCES'][$j];
										$formattedStartDate = $recurDate->format('Ymd\THis');
										if ($formattedStartDate === $modifiedEventRecurID) {
											unset($this->data["VEVENT"][$counter]['RECURRENCES'][$j]);
											$this->data["VEVENT"][$counter]['RECURRENCES'] = array_values($this->data["VEVENT"][$counter]['RECURRENCES']);
											break;
										}
									}
								}
							}
						}
					} else {
						//neither start nor end is within range so skip it
						if(!$this->eventRangeInCalendarRange($event['DTSTART'],$event['DTEND'])) {
							$event = null;
						}
					}

					if (!empty($event)) {
						$events[] = $event;
					}
				} else {
					$recurrences = $event['RECURRENCES'];
					$event['RECURRING'] = true;
					$event['DTEND'] = !empty($event['DTEND']) ? $event['DTEND'] : $event['DTSTART'];
					$eventInterval = $event['DTSTART']->diff($event['DTEND']);

					//TODO: at some point make the first event ALWAYS the earliest event as thats our starter
					//$event['RECURRENCE_INSTANCE'] = 0;
					//$events[] = $event;

					$firstEvent = true;
					foreach ($recurrences as $j => $recurDate) {
						$newEvent = $event;
						if (!$firstEvent) {
							$newEvent['ORIGINAL_VEVENT'] = [
								'DTSTART' => $newEvent['DTSTART'],
								'DTEND' => $newEvent['DTEND']
							];
							unset($newEvent['RECURRENCES']);
							$newEvent['DTSTART'] = $recurDate;
							$newEvent['DTEND'] = clone($recurDate);
							$newEvent['DTEND']->add($eventInterval);
						}

						if($this->eventRangeInCalendarRange($newEvent['DTSTART'],$newEvent['DTEND'])) {
							$newEvent['RECURRENCE_INSTANCE'] = $j;
							$events[] = $newEvent;
						}

						$firstEvent = false;
					}
				}
			}
		}
		return $events;
	}

	public function eventDateInCalendarRange(\DateTime $timestamp) {
		return ($timestamp->getTimestamp() > $this->ranges['start']->getTimestamp() && $timestamp->getTimestamp() < $this->ranges['end']->getTimestamp());
	}

	public function eventRangeInCalendarRange(\DateTime $eventStart, \DateTime $eventEnd) {
		$event = CarbonPeriod::between($eventStart, $eventEnd);
		foreach ($event as $date) {
			if($date->between($this->ranges['start'], $this->ranges['end'])) {
				return true;
			}
		}
		return false;
	}
}
