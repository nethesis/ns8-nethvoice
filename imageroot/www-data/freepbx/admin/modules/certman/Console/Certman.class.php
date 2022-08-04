<?php
// vim: set ai ts=4 sw=4 ft=php:

// Namespace should be FreePBX\Console\Command
namespace FreePBX\Console\Command;

// Symfony stuff all needed add these
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
// Tables
use Symfony\Component\Console\Helper\Table;
// Process
use Symfony\Component\Process\Process;

use Symfony\Component\Console\Command\HelpCommand;

class Certman extends Command {
	protected function configure(){
		$pkcs = \FreePBX::create()->PKCS;
		$loc = $pkcs->getKeysLocation();
		$this->setName('certificates')
			->setDescription(_('Certificate Management'))
			->setDefinition(array(
				new InputOption('list', null, InputOption::VALUE_NONE, _('List Certificates')),
				new InputOption('updateall', null, InputOption::VALUE_NONE, _('Check and Update all Certificates')),
				new InputOption('import', null, InputOption::VALUE_NONE, sprintf(_('Import any unmanaged certificates in %s'),$loc)),
				new InputOption('generate', null, InputOption::VALUE_NONE, _('Generate Certificate')),
				new InputOption('type', 'default', InputOption::VALUE_REQUIRED, _('Certificate Type')),
				new InputOption('default', null, InputOption::VALUE_REQUIRED, _('Set certificate default by id'))));
	}
	protected function execute(InputInterface $input, OutputInterface $output){
		$certman = \FreePBX::create()->Certman;
		$pkcs = \FreePBX::create()->PKCS;

		if($input->getOption('generate')) {
			$type = $input->getOption('type');
			switch($type) {
				case 'ss':
				case 'le':
					$output->writeln("<error>".sprintf(_("%s is not supported at this time"),$type)."</error>");
				break;
				case 'up':
					$output->writeln("<error>"._("Use --import instead")."</error>");
				break;
				case 'default':
				default:
					$certs = $certman->getAllManagedCertificates();
					if(empty($certs)) {
						$output->writeln(_("No Certificates exist"));

						if(!$certman->checkCAexists()) {
							$output->write(_("Generating default CA..."));
							$hostname = gethostname();
							$hostname = !empty($hostname) ? $hostname : 'localhost';
							$caid = $certman->generateCA('ca', $hostname, $hostname);
							$output->writeln(_("Done!"));
						} else {
							$dat = $certman->getAllManagedCAs();
							$caid = $dat[0]['uid'];
						}

						$output->write(_("Generating default certificate..."));
						// Do not i18n the NAME of the cert, it is 'default'.
						try {
							$cid = $certman->generateCertificate($caid,"default",_("Default Self-Signed certificate"));
							$certman->makeCertDefault($cid);
							$output->writeln(_("Done!"));
						} catch(\Exception $e) {
							$output->writeln("<error>".sprintf(_("Failed! [%s]"),$e->getMessage())."</error>");
							//return false;
						}
					} else {
						$output->writeln(_("Certificates already exist, no need to generate another one"));
					}
				break;
			}
			return;
		}

		if($input->getOption('updateall')) {
			$messages = $certman->checkUpdateCertificates();
			foreach($messages as $message) {
				$m = $message['message'];
				switch($message['type']) {
					case "danger":
						$output->writeln("<error>".$m."</error>");
					break;
					case "warning":
						$output->writeln("<info>".$m."</info>");
					break;
					case "success":
						$output->writeln($m);
					break;
				}
			}
			return;
		}

		if($input->getOption('list')) {
			$certs = $certman->getAllManagedCertificates();
			$rows = array();
			foreach ($certs as $key => $c) {
				$type = '';
				switch($c['type']) {
					case 'ss':
						$type = _("Self Signed");
					break;
					case 'le':
						$type = _("Let's Encrypt");
					break;
					case 'up':
						$type = _('Uploaded');
					break;
				}
				$default = !empty($c['default']) ? 'X' : '';
				$rows[] = array($key, $c['basename'], $c['description'], $type, $default);
			}
			$table = new Table($output);
			$table->setHeaders(array("ID", _("Base Name"),_("Description"), _("Type"), _("Default")));
			$table->setRows($rows);
			$table->render($output);
			return;
		}

		if($input->getOption('import')) {
			$list = $certman->importLocalCertificates();
			if(empty($list)) {
				$loc = $pkcs->getKeysLocation();
				$output->writeln(_("<info>".sprintf(_("No Certificates to import. Try placing a certificate (<name>.crt) and its key (<name>.key) into %s"),$loc)."</info>"));
				exit(4);
			}
			$err = false;
			foreach($list as $i) {
				if($i['status']) {
					$output->writeln(_("<info>".sprintf(_("Successfully imported %s"),basename($i['file']))."</info>"));
				} else {
					$err = true;
					$output->writeln("<error>".sprintf(_("There was an error importing %s. The error was: %s"),basename($i['file']),$i['error'])."</error>");
				}
			}
			if($err) {
				exit(4);
			}
			return;
		}

		if($input->getOption('default') !== null) {
			$certs = $certman->getAllManagedCertificates();
			$id = $input->getOption('default');
			if(!isset($certs[$id])) {
				$output->writeln("<error>"._("That is not a valid ID")."</error>");
				exit(4);
			}
			$certman->makeCertDefault($certs[$id]['cid']);
			$output->writeln(sprintf(_("Successfully set '%s' as the default certificate"),$certs[$id]['basename']));
			return;
		}

		if($input->getOption('generate')) {
		}


		$this->outputHelp($input,$output);
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
