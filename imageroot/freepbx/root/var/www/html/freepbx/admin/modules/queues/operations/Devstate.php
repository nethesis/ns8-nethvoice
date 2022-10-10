<?php
namespace FreePBX\modules\Queues\operations;
class Devstate {
	private $agi = null;
	private $action = null;
	private $user = null;
	private $astman = null;

	private $staticAgents = array();
	private $allAgents = array();

	public function __construct($agi,$astman,$argv) {
		$this->astman = $astman;
		$this->agi = $agi;
		$this->action = strtolower(trim($argv['1']));
		$this->user = trim($argv['2']);
		$this->queue = isset($argv['3']) ? trim($argv['3']) : '';
	}

	public function run() {
		$this->action = str_replace("-","_",$this->action);
		if(!method_exists($this, $this->action)) {
			$this->debug("Got unknown action: {$this->action}, exiting");
			exit(-1);
		}
		$this->parseQueues();
		$this->{$this->action}();
	}

	private function getqueues() {
		$queue = $this->getVar("QUEUENO");
		$this->debug("Getting Queue Status for user {$this->user} in queue $queue");
		$loggedvar = (!empty($this->allAgents[$queue]) && in_array($this->user,$this->allAgents[$queue])) ? 'LOGGEDIN' : 'LOGGEDOUT';
		$queuestat = (!empty($this->staticAgents[$queue]) && in_array($this->user,$this->staticAgents[$queue])) ? 'STATIC' : $loggedvar;
		$this->debug("Agent {$this->user} is $queuestat");
		$this->agi->set_variable('QUEUESTAT',$queuestat);
	}

	private function getall() {
		$this->debug("Looking up queues for agent: {$this->user}");
		$agent_queues = $this->getAgentQueues($this->user);
		foreach ($agent_queues as $q) {
			$this->debug("Agent is in: $q");
		}
		$all_queues_state = $this->getAgentAllQueuesState($this->user, $agent_queues);
		$this->debug("Agent {$this->user} is $all_queues_state for at least one of their queues");
		$this->putAgentOverallStatus($all_queues_state, $agent_queues);
	}

	private function toggle_pause_all() {
		$this->debug("Looking up queues for agent: {$this->user}");
		$agent_queues = $this->getCurrentQueues($this->user);
		$this->debug("got queues from logged in of: " . implode('-',$agent_queues));

		$user_interface = "Local/{$this->user}@from-queue/n";
		$paused_state = 0;
		foreach ($agent_queues as $q) {
			$state = $this->getVar("QUEUE_MEMBER($q,paused,$user_interface)");
			$paused_state |= $state;
		}
		// If one was paused then treat as all paused and unpause all, otherwise pause all
		// in all queues
		$new_state = $paused_state ? '0' : '1';
		foreach ($agent_queues as $q) {
			$this->agi->set_variable("QUEUE_MEMBER($q,paused,$user_interface)", $new_state);
			$this->debug("QUEUE_MEMBER($q,paused,$user_interface)=$new_state");
		}
		$this->agi->set_variable("TOGGLEPAUSED", $new_state);
	}

	private function getCurrentQueues($user) {
		$queues = array();
		foreach ($this->allAgents as $q => $m) {
			if (in_array($user,$this->allAgents[$q])) {
				$queues[] = $q;
			}
		}
		return $queues;
	}
/* this function used for playback queue caller count */
	private function getuserQueues() {
		$user = $this->user;
		if(is_numeric($this ->queue)){
		// need to check varify the caller is a member of this queue
			if(in_array($user,$this->allAgents[$this->queue])) {
				$this->agi->set_variable("QUEUES", $this->queue);
			}else{
				$this->agi->set_variable("QUEUES", 0);
			}
		return;
		}
		$queues = array();
		foreach ($this->allAgents as $q => $m) {
			if(in_array($user,$this->allAgents[$q])) {
				$queues[] = $q;
			}
		}
		 if(count($queues) ==0){
			$this->agi->set_variable("QUEUES", 0);
			return;
		 }
		 $queuenums = implode('&',$queues);
		 $this->agi->set_variable("QUEUES", $queuenums);
		  return;
        }

	// if they are logged into any of the queues provided, they are considered logged in and we will log them out of all
	//
	private function getAgentAllQueuesState($user, $queues) {
		if (empty($queues)) {
			$this->debug("no queues for this agent");
			return 'NOQUEUES';
		}
		foreach ($queues as $q) {
			$this->debug("checking if logged into queue: $q");
			if (!empty($this->allAgents[$q]) && in_array($user,$this->allAgents[$q]) && !in_array($user,$this->staticAgents[$q])) {
				$this->debug("Yes logged into queue: $q");
				return 'LOGGEDIN';
			}
		}
		$this->debug("Nothing found so logged out");
		return 'LOGGEDOUT';
	}

	private function putAgentOverallStatus($status, $queues) {
		$this->agi->set_variable('QUEUESTAT',$status);
		$queues_string = implode('-',$queues);
		$this->agi->set_variable('USERQUEUES',$queues_string);
	}

	private function debug($string, $level=3) {
		$this->agi->verbose($string, $level);
	}

	private function getVar($value) {
		$r = $this->agi->get_variable($value);
		if ($r['result'] == 1) {
			$result = $r['data'];
			return trim($result);
		}
		return '';
	}

	private function getAgentQueues($user) {
		$this_agents_queues = array();
		$get = $this->astman->database_show('QPENALTY');
		if ($get) foreach($get as $key => $value) {
			//  0: QPENALTY
			//  1: QueueNum
			//  2: agents (or dynmembers)
			//  3: AgentNum (if agents)
			//
			$key = explode('/',trim($key,'/')); // get rid of leading '/'
			if ($key[2] == 'agents' && $key[3] == $user) {
				$this_agents_queues[] = $key[1];
			}
		}
		return $this_agents_queues;
	}

	private function parseQueues() {
		$response = $this->astman->send_request('Command',array('Command'=>"queue show"));
		$response1=explode("\n",trim($response['data']));
		// Lets try and process our results here.
		$inqueue='false';
		$callers_list = false;
		foreach ($response1 as $item) {
			$item1 = trim($item);
			if ($callers_list) {
				if (preg_match('/^\d+\./',$item1)) {
					$this->debug("Skipping caller $item1 in queue $inqueue");
					continue;
				} else {
					$this->debug("Finished processing callers for $inqueue");
					$callers_list = false;
					$inqueue='false';
				}
			}
			if ($inqueue == 'false') {
				if (preg_match('/^(\d+)/',$item1,$matches)) {
					$this->queues[] = $matches[1];
					$inqueue = $matches[1];
					$this->debug("Initiating queue: $inqueue");
					continue;
				}
			} else {
				// We should test to see if the item is an Agent description
				if (strstr($item1,'Local/') !== false) {
					preg_match_all ("/(Local).*?(\\d+)/is", $item1, $matches);
					$loggedagent = $matches[2][0];
					$item1 = 'ADD';
				}

				switch ($item1) {
					case 'No Members':
						$this->debug("Queue $inqueue has no one logged in");
						$inqueue='false';
					break;
					case 'No Callers':
						$this->debug("Finished processing members for $inqueue");
						$inqueue='false';
					break;
					case 'Callers':
					case 'Callers:':
						$this->debug("Getting ready to skip callers in $inqueue");
						$callers_list = true;
					break;
					case 'ADD':
						$this->allAgents[$inqueue][] = $loggedagent;
						if (strstr($item,'(dynamic)') !== false) {
							$this->debug("Agent $loggedagent is dynamic");
						}else{
							$this->debug("Agent $loggedagent is static");
							$this->staticAgents[$inqueue][] = $loggedagent;
						}
					$this->debug("Agent $loggedagent is assigned to queue $inqueue");
					break;
				}
			}
		}
		$this->debug("Finished parsing queues");
	}
}
