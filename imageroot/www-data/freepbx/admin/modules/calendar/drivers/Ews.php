<?php
namespace FreePBX\modules\Calendar\drivers;
use FreePBX\modules\Calendar\drivers\Ews\Calendar as EWSCalendar;
use FreePBX\modules\Calendar\IcalParser\IcalRangedParser;
use Ramsey\Uuid\Uuid;
class Ews extends Base {
	public $driver = 'Ews';

	/**
	 * Get Information about this driver
	 * @method getInfo
	 * @return array  array of information
	 */
	public static function getInfo() {
		return array(
			"name" => _("Remote Outlook Calendar")
		);
	}

	/**
	 * Get the "update" display
	 * @method getEditDisplay
	 * @param  array         $data Array of calendar information
	 * @return string               HTML to display
	 */
	public static function getEditDisplay($data) {
		if(!class_exists('SoapClient')) {
			return _("You are missing the PHP SoapClient library. Please install to continue");
		}
		$message = [];
		$server = $data['url'];
		$username = $data['username'];
		$password = $data['password'];
		$version = constant('\jamesiarmes\PhpEws\Client::'.$data['version']);
		$ews = new EWSCalendar($server, $username, $password, $version);
		$calendars = [];
		try {
			foreach($ews->getAllCalendars() as $calendar) {
				$id = $calendar['id'];
				$calendars[$id] = array(
					"id" => $id,
					"name" => $calendar['name'],
					"selected" => in_array($id,$data['calendars'])
				);
			}
		} catch(\Exception $e) {
			$message = [
				'type' => 'danger',
				'message' => $e->getMessage()
			];
		}

		return load_view(dirname(__DIR__)."/views/remote_ews_settings.php",array('action' => 'edit', 'data' => $data, 'calendars' => $calendars, 'message' => $message));
	}

	/**
	 * Get the "Add" display
	 * @method getAddDisplay
	 * @return string              HTML to display
	 */
	public static function getAddDisplay() {
		if(!class_exists('SoapClient')) {
			return _("You are missing the PHP SoapClient library. Please install to continue");
		}
		return load_view(dirname(__DIR__)."/views/remote_ews_settings.php",array('action' => 'add', 'calendars' => array(), 'data' => array('next' => 86400)));
	}

	/**
	 * Update calendar by uuid
	 * @method updateCalendar
	 * @param  string         $id   The uuid to update
	 * @param  array         $data Array of data about this calendar
	 * @return boolean               true or false
	 */
	public function updateCalendar($data) {
		if(!class_exists('SoapClient')) {
			return false;
		}
		$calendar = array(
			"name" => $data['name'],
			"description" => $data['description'],
			"type" => "ews",
			"email" => $data['email'],
			"version" => $data['version'],
			"url" => $data['url'],
			"username" => $data['username'],
			"password" => $data['password'],
			"calendars" => !empty($data['calendars']) ? $data['calendars'] : array(),
			"next" => !empty($data['next']) ? $data['next'] : 300
		);
		$ret = parent::updateCalendar($calendar);
		$this->processCalendar();
		return $ret;
	}

	public function processCalendar() {
		$version = constant('\jamesiarmes\PhpEws\Client::'.$this->calendar['version']);
		$ews = new EWSCalendar($this->calendar['url'], $this->calendar['username'], $this->calendar['password'], $version);
		$cals = $ews->getAllCalendars();
		foreach($this->calendar['calendars'] as $c) {
			if(isset($cals[$c])) {
				$events = $ews->getAllEventsByCalendarID($c);
				$finalical = $ews->formatiCal($events);
				$this->saveiCal($finalical);
			}
		}
	}
}
