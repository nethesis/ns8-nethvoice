<?php

namespace FreePBX\modules\Calendar\drivers\Ews;

class Autodiscover extends \jamesiarmes\PhpEws\Autodiscover {

	/**
	 * Static method may fail if there are issues surrounding SSL certificates.
	 * In such cases, set up the object as needed, and then call newEWS().
	 *
	 * @param string $email
	 * @param string $password
	 * @param string $username If left blank, the email provided will be used.
	 * @return mixed
	 */
	public static function getEWS($email, $password, $username = null)
	{
			$auto = new Autodiscover($email, $password, $username);
			return $auto->newEWS();
	}
	/**
	 * Perform the NTLM authenticated post against one of the chosen
	 * endpoints.
	 *
	 * @param string $url URL to try posting to
	 * @param integer $timeout Overall cURL timeout for this request
	 * @return boolean
	 */
	public function doNTLMPost($url, $timeout = 6)
	{
		$out = $this->doPOST($url, $timeout, CURLAUTH_NTLM);
		if($out === false) {
			$out = $this->doPOST($url, $timeout, CURLAUTH_BASIC);
		}
		return $out;
	}

	/**
	 * Perform the authenticated post against one of the chosen
	 * endpoints.
	 *
	 * @param string $url URL to try posting to
	 * @param integer $timeout Overall cURL timeout for this request
	 * @param integer cURL Auth Type https://curl.haxx.se/libcurl/c/CURLOPT_HTTPAUTH.html
	 * @return boolean
	 */
	public function doPOST($url, $timeout = 6, $authType = CURLAUTH_NTLM)
	{
		$this->reset();

		$ch = curl_init();
		$opts = array(
				CURLOPT_URL             => $url,
				CURLOPT_HTTPAUTH        => $authType,
				CURLOPT_CUSTOMREQUEST   => 'POST',
				CURLOPT_POSTFIELDS      => $this->getAutoDiscoverRequest(),
				CURLOPT_RETURNTRANSFER  => true,
				CURLOPT_USERPWD         => $this->username.':'.$this->password,
				CURLOPT_TIMEOUT         => $timeout,
				CURLOPT_CONNECTTIMEOUT  => $this->connection_timeout,
				CURLOPT_FOLLOWLOCATION  => true,
				CURLOPT_HEADER          => false,
				CURLOPT_HEADERFUNCTION  => array($this, 'readHeaders'),
				CURLOPT_IPRESOLVE       => CURL_IPRESOLVE_V4,
				CURLOPT_SSL_VERIFYPEER  => true,
				CURLOPT_SSL_VERIFYHOST  => 2,
		);

		// Set the appropriate content-type.
		curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: text/xml; charset=utf-8'));

		if (! empty($this->cainfo)) {
				$opts[CURLOPT_CAINFO] = $this->cainfo;
		}

		if (! empty($this->capath)) {
				$opts[CURLOPT_CAPATH] = $this->capath;
		}

		if ($this->skip_ssl_verification) {
				$opts[CURLOPT_SSL_VERIFYPEER] = false;
				$opts[CURLOPT_SSL_VERIFYHOST] = false;
		}

		curl_setopt_array($ch, $opts);
		$this->last_response    = curl_exec($ch);
		$this->last_info        = curl_getinfo($ch);
		$this->last_curl_errno  = curl_errno($ch);
		$this->last_curl_error  = curl_error($ch);

		if ($this->last_curl_errno != CURLE_OK) {
				return false;
		}

		if($this->last_info['http_code'] !== 200) {
			return false;
		}

		$discovered = $this->parseAutodiscoverResponse();

		return $discovered;
	}
}
