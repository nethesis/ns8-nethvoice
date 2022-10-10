<?php
// vim: set ai ts=4 sw=4 ft=php:
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2014 Schmooze Com Inc.
//
namespace FreePBX\modules\Certman;

/**
 * Implements a trivial API for use with Certman
 */
class FirewallAPI {

	/** Is firewall available on this machine? */
	private $fw = false;

	/** Firewall object */
	private $fwobj;

	/** Default hosts to allow in to the 'internal' zone */
	private $knownhosts = array ("outbound1.letsencrypt.org", "outbound2.letsencrypt.org", "mirror1.freepbx.org", "mirror2.freepbx.org");

	public function __construct() {
		// Is firewall enabled and active?
		try {
			$this->fwobj = \FreePBX::Firewall();
			$this->fw = $this->fwobj->isEnabled();
		} catch (\Exception $e) {
			// Firewall not active, or not enabled, don't do anything
			return;
		}
	}

	/**
	 * Is firewall available on this machine?
	 *
	 * @return bool
	 */
	public function isAvailable() {
		return $this->fw;
	}

	/**
	 * Are all the LE hosts correctly set up in firewall?
	 *
	 * Note this doesn't check the zone. It assumes that
	 * if you've changed it, you know what your'e doing.
	 * This may be a bad decision.
	 *
	 * @return bool
	 */
	public function hostsConfigured() {
		// Just in case..
		if (!$this->fw) {
			return true;
		}

		// Get our lists of hosts and zones.
		$fwhosts = $this->fwobj->getConfig("hostmaps");
		if (!is_array($fwhosts)) {
			$fwhosts = array();
		}

		// Now loop through the ones we know about, and
		// if they're NOT in the list - ignoring the zone,
		// because people may change that - return false.
		foreach ($this->knownhosts as $knownhost) {
			if (!isset($fwhosts[$knownhost])) {
				return false;
			}
		}

		// Made it through, all hosts are known
		return true;
	}

	/**
	 * Add any missing hosts to the 'internal' zone.
	 *
	 * @return void
	 */
	public function addMissingHosts() {
		// Just in case..
		if (!$this->fw) {
			return true;
		}
		// Get our lists of hosts and zones.
		$fwhosts = $this->fwobj->getConfig("hostmaps");
		if (!is_array($fwhosts)) {
			$fwhosts = array();
		}

		// Now loop through the ones we know about, and
		// if they're NOT in the list, add them to 'internal'
		foreach ($this->knownhosts as $knownhost) {
			if (!isset($fwhosts[$knownhost])) {
				$this->fwobj->addHostToZone($knownhost, 'internal');
			}
		}
	}

	/**
	 * Return the hosts that require inbound access
	 *
	 * @return array
	 */
	public function getRequiredHosts() {
		return $this->knownhosts;
	}

}



