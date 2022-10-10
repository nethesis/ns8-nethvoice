<?php
/**
* https://blogs.kent.ac.uk/webdev/2011/07/14/phpunit-and-unserialized-pdo-instances/
* @backupGlobals disabled
*/
class DevstateTest extends PHPUnit_Framework_TestCase {
	public static function setUpBeforeClass() {
		include dirname(__DIR__)."/operations/Devstate.php";
	}

	public function setUp() {
		$this->agi = $this->getMockBuilder('\AGI')->setMethods(array('verbose','get_variable','set_variable'))->getMock();
		$this->astman = $this->getMockBuilder('\Astman')->setMethods(array('send_request','database_show'))->getMock();
	}

	public function testLogOutSingleQueueMultipleMembers() {
		$showQueue = <<<EOF
Privilege: Command
default has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 0s
   No Members
   No Callers

8001 has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 60s
   Members:
      fdgdf (Local/2004@from-queue/n from hint:2004@ext-local) (ringinuse enabled) (Unavailable) has taken no calls yet
      D70 (Local/1000@from-queue/n from hint:1000@ext-local) (ringinuse enabled) (dynamic) (Not in use) has taken no calls yet
   Callers:
       1. PJSIP/4012-0000056e (wait: 0:04, prio: 0)
EOF;
		$argv = array(
			__FILE__,
			"getqueues",
			"1000"
		);

		$this->astman->method('send_request')->with('Command',array('Command' => 'queue show'))->will($this->returnValue(array('data' => $showQueue)));
		$this->agi->method('get_variable')->with('QUEUENO')->will($this->returnValue(array('result' => 1, 'data' => '8001')));
		$this->agi->method('set_variable')->with('QUEUESTAT','LOGGEDIN');

		$devstate = new \FreePBX\modules\Queues\operations\Devstate($this->agi,$this->astman,$argv);
		$devstate->run();
	}

	public function testLogOutSingleQueueSingleMember() {
		$showQueue = <<<EOF
Privilege: Command
default has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 0s
	 No Members
	 No Callers

8001 has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 60s
	 Members:
			D70 (Local/1000@from-queue/n from hint:1000@ext-local) (ringinuse enabled) (dynamic) (Not in use) has taken no calls yet
	 Callers:
			1. PJSIP/4012-0000056e (wait: 0:04, prio: 0)
EOF;
		$argv = array(
			__FILE__,
			"getqueues",
			"1000"
		);

		$this->astman->method('send_request')->with('Command',array('Command' => 'queue show'))->will($this->returnValue(array('data' => $showQueue)));
		$this->agi->method('get_variable')->with('QUEUENO')->will($this->returnValue(array('result' => 1, 'data' => '8001')));
		$this->agi->method('set_variable')->with('QUEUESTAT','LOGGEDIN');

		$devstate = new \FreePBX\modules\Queues\operations\Devstate($this->agi,$this->astman,$argv);
		$devstate->run();
	}

	public function testLogInSingleQueueMultipleMembers() {
		$showQueue = <<<EOF
Privilege: Command
default has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 0s
   No Members
   No Callers

8001 has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 60s
   Members:
      fdgdf (Local/2004@from-queue/n from hint:2004@ext-local) (ringinuse enabled) (Unavailable) has taken no calls yet
   Callers:
      1. PJSIP/4012-0000056e (wait: 0:04, prio: 0)
EOF;
		$argv = array(
			__FILE__,
			"getqueues",
			"1000"
		);

		$this->astman->method('send_request')->with('Command',array('Command' => 'queue show'))->will($this->returnValue(array('data' => $showQueue)));
		$this->agi->method('get_variable')->with('QUEUENO')->will($this->returnValue(array('result' => 1, 'data' => '8001')));
		$this->agi->method('set_variable')->with('QUEUESTAT','LOGGEDOUT');

		$devstate = new \FreePBX\modules\Queues\operations\Devstate($this->agi,$this->astman,$argv);
		$devstate->run();
	}

	public function testLogOutInSingleQueueSingleMember() {
		$showQueue = <<<EOF
Privilege: Command
default has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 0s
   No Members
   No Callers

8001 has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 60s
   No Members
   No Callers
EOF;
		$argv = array(
			__FILE__,
			"getqueues",
			"1000"
		);

		$this->astman->method('send_request')->with('Command',array('Command' => 'queue show'))->will($this->returnValue(array('data' => $showQueue)));
		$this->agi->method('get_variable')->with('QUEUENO')->will($this->returnValue(array('result' => 1, 'data' => '8001')));
		$this->agi->method('set_variable')->with('QUEUESTAT','LOGGEDOUT');

		$devstate = new \FreePBX\modules\Queues\operations\Devstate($this->agi,$this->astman,$argv);
		$devstate->run();
	}

	public function testLogAllInQueueMultipleMembers() {
		$showQueue = <<<EOF
Privilege: Command
default has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 0s
   No Members
   No Callers

8001 has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 60s
   Members:
      fdgdf (Local/2004@from-queue/n from hint:2004@ext-local) (ringinuse enabled) (Unavailable) has taken no calls yet
   Callers:
      1. PJSIP/4012-0000056e (wait: 0:04, prio: 0)
EOF;
		$argv = array(
			__FILE__,
			"getall",
			"1000"
		);

		$map = array();

		$this->astman->method('send_request')->with('Command',array('Command' => 'queue show'))->will($this->returnValue(array('data' => $showQueue)));
		$this->astman->method('database_show')->with('QPENALTY')->will($this->returnValue(array('/QPENALTY/8001/agents/1000' => 0, '/QPENALTY/8001/dynmemberonly' => 'no')));
		$this->agi->method('set_variable')->will($this->returnCallback(function($variable,$value) use(&$map){
			$map[$variable] = $value;
			return true;
		}));

		$devstate = new \FreePBX\modules\Queues\operations\Devstate($this->agi,$this->astman,$argv);
		$devstate->run();

		$this->assertEquals($map['QUEUESTAT'],'LOGGEDOUT');
		$this->assertEquals($map['USERQUEUES'],'8001');
	}

	public function testLogAllInQueueSingleMembers() {
		$showQueue = <<<EOF
Privilege: Command
default has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 0s
	 No Members
	 No Callers

8001 has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 60s
	 No Members
	 No Callers
EOF;
		$argv = array(
			__FILE__,
			"getall",
			"1000"
		);

		$map = array();

		$this->astman->method('send_request')->with('Command',array('Command' => 'queue show'))->will($this->returnValue(array('data' => $showQueue)));
		$this->astman->method('database_show')->with('QPENALTY')->will($this->returnValue(array('/QPENALTY/8001/agents/1000' => 0, '/QPENALTY/8001/dynmemberonly' => 'no')));
		$this->agi->method('set_variable')->will($this->returnCallback(function($variable,$value) use(&$map){
			$map[$variable] = $value;
			return true;
		}));

		$devstate = new \FreePBX\modules\Queues\operations\Devstate($this->agi,$this->astman,$argv);
		$devstate->run();

		$this->assertEquals($map['QUEUESTAT'],'LOGGEDOUT');
		$this->assertEquals($map['USERQUEUES'],'8001');
	}

	public function testPauseAllMultipleMembers() {
		$showQueue = <<<EOF
default has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 0s
   No Members
   No Callers

8001 has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 60s
   Members:
      fdgdf (Local/2004@from-queue/n from hint:2004@ext-local) (ringinuse enabled) (Unavailable) has taken no calls yet
      D70 (Local/1000@from-queue/n from hint:1000@ext-local) (ringinuse enabled) (dynamic) (Not in use) has taken no calls yet
   Callers:
       1. PJSIP/4012-0000056e (wait: 0:04, prio: 0)
EOF;

		$argv = array(
			__FILE__,
			"toggle-pause-all",
			"1000"
		);

		$map = array();

		$this->astman->method('send_request')->with('Command',array('Command' => 'queue show'))->will($this->returnValue(array('data' => $showQueue)));
		$this->agi->method('get_variable')->with('QUEUE_MEMBER(8001,paused,Local/1000@from-queue/n)')->will($this->returnValue(array('result' => 1, 'data' => '0')));
		$this->agi->method('set_variable')->will($this->returnCallback(function($variable,$value) use(&$map){
			$map[$variable] = $value;
			return true;
		}));

		$devstate = new \FreePBX\modules\Queues\operations\Devstate($this->agi,$this->astman,$argv);
		$devstate->run();

		$this->assertEquals($map['QUEUE_MEMBER(8001,paused,Local/1000@from-queue/n)'],'1');
		$this->assertEquals($map['TOGGLEPAUSED'],'1');
	}

	public function testUnPauseAllMultipleMembers() {
		$showQueue = <<<EOF
Privilege: Command
default has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 0s
   No Members
   No Callers

8001 has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 60s
   Members:
      fdgdf (Local/2004@from-queue/n from hint:2004@ext-local) (ringinuse enabled) (Unavailable) has taken no calls yet
      D70 (Local/1000@from-queue/n from hint:1000@ext-local) (ringinuse enabled) (dynamic) (paused) (Not in use) has taken no calls yet
   Callers:
      1. PJSIP/4012-0000056e (wait: 0:04, prio: 0)
EOF;

		$argv = array(
			__FILE__,
			"toggle-pause-all",
			"1000"
		);

		$map = array();

		$this->astman->method('send_request')->with('Command',array('Command' => 'queue show'))->will($this->returnValue(array('data' => $showQueue)));
		$this->agi->method('get_variable')->with('QUEUE_MEMBER(8001,paused,Local/1000@from-queue/n)')->will($this->returnValue(array('result' => 1, 'data' => '1')));
		$this->agi->method('set_variable')->will($this->returnCallback(function($variable,$value) use(&$map){
			$map[$variable] = $value;
			return true;
		}));

		$devstate = new \FreePBX\modules\Queues\operations\Devstate($this->agi,$this->astman,$argv);
		$devstate->run();

		$this->assertEquals($map['QUEUE_MEMBER(8001,paused,Local/1000@from-queue/n)'],'0');
		$this->assertEquals($map['TOGGLEPAUSED'],'0');
	}

	public function testPauseAllSingleMember() {
		$showQueue = <<<EOF
default has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 0s
	 No Members
	 No Callers

8001 has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 60s
	 Members:
			D70 (Local/1000@from-queue/n from hint:1000@ext-local) (ringinuse enabled) (dynamic) (Not in use) has taken no calls yet
	 Callers:
			1. PJSIP/4012-0000056e (wait: 0:04, prio: 0)
EOF;

		$argv = array(
			__FILE__,
			"toggle-pause-all",
			"1000"
		);

		$map = array();

		$this->astman->method('send_request')->with('Command',array('Command' => 'queue show'))->will($this->returnValue(array('data' => $showQueue)));
		$this->agi->method('get_variable')->with('QUEUE_MEMBER(8001,paused,Local/1000@from-queue/n)')->will($this->returnValue(array('result' => 1, 'data' => '0')));
		$this->agi->method('set_variable')->will($this->returnCallback(function($variable,$value) use(&$map){
			$map[$variable] = $value;
			return true;
		}));

		$devstate = new \FreePBX\modules\Queues\operations\Devstate($this->agi,$this->astman,$argv);
		$devstate->run();

		$this->assertEquals($map['QUEUE_MEMBER(8001,paused,Local/1000@from-queue/n)'],'1');
		$this->assertEquals($map['TOGGLEPAUSED'],'1');
	}

	public function testUnPauseAllSingleMember() {
		$showQueue = <<<EOF
Privilege: Command
default has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 0s
	 No Members
	 No Callers

8001 has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 60s
	 Members:
			D70 (Local/1000@from-queue/n from hint:1000@ext-local) (ringinuse enabled) (dynamic) (paused) (Not in use) has taken no calls yet
	 Callers:
			1. PJSIP/4012-0000056e (wait: 0:04, prio: 0)
EOF;

		$argv = array(
			__FILE__,
			"toggle-pause-all",
			"1000"
		);

		$map = array();

		$this->astman->method('send_request')->with('Command',array('Command' => 'queue show'))->will($this->returnValue(array('data' => $showQueue)));
		$this->agi->method('get_variable')->with('QUEUE_MEMBER(8001,paused,Local/1000@from-queue/n)')->will($this->returnValue(array('result' => 1, 'data' => '1')));
		$this->agi->method('set_variable')->will($this->returnCallback(function($variable,$value) use(&$map){
			$map[$variable] = $value;
			return true;
		}));

		$devstate = new \FreePBX\modules\Queues\operations\Devstate($this->agi,$this->astman,$argv);
		$devstate->run();

		$this->assertEquals($map['QUEUE_MEMBER(8001,paused,Local/1000@from-queue/n)'],'0');
		$this->assertEquals($map['TOGGLEPAUSED'],'0');
	}

	public function testPauseAllLoggedOut() {
		$showQueue = <<<EOF
default has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 0s
   No Members
   No Callers

8001 has 0 calls (max unlimited) in 'ringall' strategy (0s holdtime, 0s talktime), W:0, C:0, A:0, SL:0.0% within 60s
   No Members
   No Callers
EOF;

		$argv = array(
			__FILE__,
			"toggle-pause-all",
			"1000"
		);

		$map = array();

		$this->astman->method('send_request')->with('Command',array('Command' => 'queue show'))->will($this->returnValue(array('data' => $showQueue)));
		$this->agi->method('get_variable')->with('QUEUE_MEMBER(8001,paused,Local/1000@from-queue/n)')->will($this->returnValue(array('result' => 1, 'data' => '0')));
		$this->agi->method('set_variable')->will($this->returnCallback(function($variable,$value) use(&$map){
			$map[$variable] = $value;
			return true;
		}));

		$devstate = new \FreePBX\modules\Queues\operations\Devstate($this->agi,$this->astman,$argv);
		$devstate->run();

		$this->assertEquals($map['TOGGLEPAUSED'],'1');
	}

}
