<?php
//Namespace should be FreePBX\Console\Command
namespace FreePBX\Console\Command;

//Symfony stuff all needed add these
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
//la mesa
use Symfony\Component\Console\Helper\Table;
//Process
use Symfony\Component\Process\Process;
use Symfony\Component\Console\Command\HelpCommand;
class Userman extends Command {
	protected function configure() {
		$this->setName('userman')
			->setDescription(_('User Manager'))
			->setDefinition(array(
				new InputOption('syncall', null, InputOption::VALUE_NONE, _('Syncronize all directories')),
				new InputOption('sync', null, InputOption::VALUE_REQUIRED, _('Syncronize a single directory by id (obtained from --list)')),
				new InputOption('force', null, InputOption::VALUE_NONE, _('Force syncronization')),
				new InputOption('list', null, InputOption::VALUE_NONE, _('List directories'))
			));
	}
	protected function execute(InputInterface $input, OutputInterface $output){
		$force = $input->getOption('force');
		$sync = $input->getOption('sync');
		$userman = \FreePBX::create()->Userman;
		if($input->getOption('list')) {
			$table = new Table($output);
			$table->setHeaders(array(_('ID'),_('Name')));
			$rows = array();
			$directories = $userman->getAllDirectories();
			foreach($directories as $directory) {
				$rows[] = array(
					$directory['id'],
					$directory['name']
				);
			}
			$table->setRows($rows);
			$table->render();
		}
		if($input->getOption('syncall') && $input->getOption('sync')) {
			$output->writeln("<error>Can not sync and syncall at the same time!</error>");
			exit(-1);
		}
		if($input->getOption('syncall')) {
			$this->setLock();
			$directories = $userman->getAllDirectories();
			foreach($directories as $directory) {
				$this->syncDirectory($directory,$output,$force);
			}
			$this->removeLock();
		}
		if($input->getOption('sync')) {
			$this->setLock();
			$id = $input->getOption('sync');
			$directory = $userman->getDirectoryByID($id);
			$this->syncDirectory($directory,$output,$force);
			$this->removeLock();
		}
		if(!$input->getOption('syncall') && !$input->getOption('sync') && !$input->getOption('list')) {
			$this->outputHelp($input,$output);
			exit(4);
		}
	}

	private function syncDirectory($directory,$output,$force=false) {
		$userman = \FreePBX::create()->Userman;
		if(!$directory['active']) {
			$output->writeln("Directory '".$directory['name']."' is not active. Skipping");
			return;
		}
		$dir = $userman->getDirectoryObjectByID($directory['id']);
		if(method_exists($dir,"sync")) {
			if(!$force && empty($directory['config']['sync'])) {
				$output->writeln("Directory '".$directory['name']."' sync is None. Skipping (Unless --force flag is set)");
				return;
			}
			$timeSince = $userman->getConfig("directory-last-sync-time");
			$timeSince = !empty($timeSince) ? $timeSince : 0;
			$timeNow = time();
			$secondsSince = 0;
			switch($directory['config']['sync']) {
				case "*/15 * * * *":
					$secondsSince = 900;
				break;
				case "*/30 * * * *":
					$secondsSince = 1800;
				break;
				case "0 * * * *":
					$secondsSince = 3600;
				break;
				case "0 */6 * * *":
					$secondsSince = 7200;
				break;
				case "0 0 * * *":
					$secondsSince = 14400;
				break;
			}
			if($force || ($timeNow > ($timeSince + $secondsSince))) {
				$userman->setConfig("directory-last-sync-time", $timeNow);
				$output->writeln("Starting Sync on directory '".$directory['name']."'...");
				$userman->lockDirectory($directory['id']);
				try {
					$dir->sync($output);
				} catch(\Exception $e) {
					$output->writeln("\t<error>".$e->getMessage()."</error>");
				}
				$userman->unlockDirectory($directory['id']);
				$output->writeln("Finished");
			} else {
				$output->writeln("Not syncing directory for another ".(($timeSince + $secondsSince)-$timeNow)." seconds");
			}

		} else {
			$output->writeln("Directory '".$directory['name']."' does not support syncing");
		}
	}

	private function setLock() {
		$ASTRUNDIR = \FreePBX::Config()->get("ASTRUNDIR");
		$lock = $ASTRUNDIR."/userman.lock";

		if(!$this->checkLock()) {
			$pid = getmypid();
			file_put_contents($lock,$pid);
			return true;
		} else {
			$pid = file_get_contents($lock);
			throw new \Exception("User Manager is already syncing (Process: ".$pid.")");
		}
		return false;
	}

	private function checkLock() {
		$ASTRUNDIR = \FreePBX::Config()->get("ASTRUNDIR");
		$lock = $ASTRUNDIR."/userman.lock";
		if(file_exists($lock)) {
			$pid = file_get_contents($lock);
			if(posix_getpgid($pid) !== false) {
				return true;
			} else {
				$this->removeLock();
			}
		}
		return false;
	}

	private function removeLock() {
		$ASTRUNDIR = \FreePBX::Config()->get("ASTRUNDIR");
		$lock = $ASTRUNDIR."/userman.lock";
		if(file_exists($lock)) {
			unlink($lock);
		}
		return true;
	}

	/**
	 * @param InputInterface $input
	 * @param OutputInterface $output
	 * @return int
	 * @throws \Symfony\Component\Console\Exception\ExceptionInterface
	 */
	protected function outputHelp(InputInterface $input, OutputInterface $output)	 {
		$help = new HelpCommand();
		$help->setCommand($this);
		return $help->run($input, $output);
	}
}
