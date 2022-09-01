<?php
// vim: set ai ts=4 sw=4 ft=php:
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Schmooze Com Inc.
//
namespace FreePBX\modules;
include(__DIR__."/vendor/autoload.php");
use splitbrain\PHPArchive\Tar;
use splitbrain\PHPArchive\Zip;
class Soundlang extends \FreePBX_Helpers implements \BMO {
	private $message = '';
	private $maxTimeLimit = 250;
	private $temp;
	private $path;
	/** Extensions to show in the convert to section
	 * Limited on purpose because there are far too many,
	 * Most of which are not supported by asterisk
	 */
	private $convert = array(
		"wav",
		"sln",
		"sln16",
		"sln48",
		"g722",
		"ulaw",
		"alaw",
		"g729",
		"gsm"
	);

	public function __construct($freepbx = null) {
		$this->db = $freepbx->Database;
		$this->FreePBX = $freepbx;
		$this->temp = $this->FreePBX->Config->get("ASTSPOOLDIR") . "/tmp";
		if(!file_exists($this->temp)) {
			mkdir($this->temp,0777,true);
		}
		$this->path = $this->FreePBX->Config->get("ASTVARLIBDIR")."/sounds";
	}

	public function install() {

	}
	public function uninstall() {

	}
	public function backup(){

	}
	public function restore($backup){

	}

	public function oobeHook() {
		include __DIR__.'/Oobe.class.php';
		$o = new Soundlang\OOBE($this);
		return $o->oobeRequest();
	}

	public function doDialplanHook(&$ext, $engine, $priority) {
		global $core_conf;
		$language = $this->getLanguage();
		if ($language != "") {
			$ext->addGlobal('SIPLANG',$language);
			$core_conf->addSipGeneral('language', $language);
			$core_conf->addIaxGeneral('language', $language);
		}
	}

	public static function myDialplanHooks() {
		return 500;
	}

	/**
	 * Function used in page.soundlang.php
	 */
	public function myShowPage() {
		$request = $_REQUEST;
		$action = !empty($request['action']) ? $request['action'] : '';

		$html = load_view(dirname(__FILE__).'/views/main.php', array('message' => $this->message));

		switch ($action) {
		case 'settings':
		case 'savesettings':
			$languages = $this->getLanguages();
			$language = $this->getLanguage();
			$formatpref = $this->getFormatPref();

			$packages = $this->getPackages();
			if (empty($packages)) {
				$formatlist = $formatpref;
			} else {
				$formatlist = array();
				foreach ($packages as $package) {
					$formatlist[$package['format']] = $package['format'];
				}
			}

			$displayvars = array(
				'languages' => $languages,
				'language' => $language,
				'formatpref' => $formatpref,
				'formatlist' => $formatlist
			);
			$html .= load_view(dirname(__FILE__).'/views/settings.php', $displayvars);
			break;
		case '':
		case 'packages':
			try {
				$online = $this->getOnlinePackages();
			} catch(\Exception $e) {
				$html .= '<div class="alert alert-danger text-center">'.sprintf(_("Unable to get online sound packages. Error was: [%s] %s"),$e->getCode(), $e->getMessage()).'</div>';
			}

			$packages = $this->getPackages();

			$formats = $this->getFormatPref();

			$languages = array();
			foreach ($packages as $package) {
				if (isset($languages[$package['language']])) {
					$language = $languages[$package['language']];
				} else {
					$language = array(
						'author' => $package['author'],
						'authorlink' => $package['authorlink'],
						'license' => $package['license'],
						'installed' => true,
					);
				}

				if (in_array($package['format'], $formats)) {
					if (empty($package['installed']) || $package['installed'] < $package['version']) {
						$language['installed'] = false;
					}
				}
				$languages[$package['language']] = $language;
			}

			ksort($languages);

			$languagenames = $this->getLanguageNames();
			$languagelocations = $this->getLocationNames();
			$html .= load_view(dirname(__FILE__).'/views/packages.php', array('languages' => $languages, 'languagenames' => $languagenames, 'languagelocations' => $languagelocations));
			break;
		case 'language':
			$language = $request['lang'];

			$packages = $this->getPackages();
			if (empty($packages)) {
				break;
			}

			$langpacks = array();
			foreach ($packages as $package) {
				if ($package['language'] == $language) {
					$langpacks[] = $package;
				}
			}
			$html .= load_view(dirname(__FILE__).'/views/language.php', array('packages' => $langpacks));
			break;
		case 'customlangs':
		case 'delcustomlang':
			$customlangs = $this->getCustomLanguages();
			$html .= load_view(dirname(__FILE__).'/views/customlangs.php', array('customlangs' => $customlangs));
			break;
		case 'addcustomlang':
		case 'showcustomlang':
			if ($action == 'showcustomlang' && !empty($request['customlang'])) {
				$customlang = $this->getCustomLanguage($request['customlang']);
			}

			$media = $this->FreePBX->Media();
			$supported = $media->getSupportedFormats();
			ksort($supported['in']);
			ksort($supported['out']);
			$supported['in']['tgz'] = 'tgz';
			$supported['in']['gz'] = 'gz';
			$supported['in']['tar'] = 'tar';
			$supported['in']['zip'] = 'zip';
			$convertto = array_intersect($supported['out'], $this->convert);

			$html .= load_view(dirname(__FILE__).'/views/customlang.php', array('customlang' => $customlang, 'convertto' => $convertto, 'supported' => $supported));
		}

		return $html;
	}

	/**
	 * Get Inital Display
	 * @param {string} $display The Page name
	 */
	public function doConfigPageInit($display) {
		$request = $_REQUEST;
		$action = !empty($request['action']) ? $request['action'] : '';

		switch ($action) {
		case 'savesettings':
			$language = $request['language'];
			$this->setLanguage($language);

			$formats = $request['formats'];
			$this->setFormatPref($formats);

			$languages = array();
			$packages = $this->getPackages();
			if (!empty($packages)) {
				foreach ($packages as $package) {
					if (!empty($package['installed'])) {
						if (!in_array($package['format'], $formats)) {
							/* Remove packages for unused formats. */
							$this->uninstallPackage($package['id']);
						}
						$languages[$package['language']] = true;
					}
				}
			}

			if (!empty($languages)) {
				foreach ($languages as $key => $val) {
					/* Install any missing formats. */
					$this->installLanguage($key);
				}
			}
			break;
		case 'customlangs':
		case 'showcustomlang':
			$save = $request['save'];

			if ($save == 'customlang') {
				$id = $request['customlang'];
				$language = $request['language'];
				$description = $request['description'];

				if (empty($id)) {
					$this->addCustomLanguage($language, $description);
				} else {
					$this->updateCustomLanguage($id, $language, $description);
				}
			}
			break;
		case 'delcustomlang':
			$id = $request['customlang'];
			$this->delCustomLanguage($id);
			break;
		}
	}

	/**
	 * Generate floating action bar
	 * @param  array $request the $_REQUEST
	 * @return array          Finalized button array
	 */
	public function getActionBar($request) {
		$action = !empty($request['action']) ? $request['action'] : '';

		$buttons = array();

		switch ($action) {
		case 'settings':
		case 'savesettings':
			$buttons['reset'] = array(
				'name' => 'reset',
				'id' => 'reset',
				'value' => _('Reset')
			);
			$buttons['submit'] = array(
				'name' => 'submit',
				'id' => 'submit',
				'value' => _('Submit')
			);
			break;
		case 'showcustomlang':
			$buttons['delete'] = array(
				'name' => 'delete',
				'id' => 'delete',
				'value' => _('Delete')
			);
			$buttons['reset'] = array(
				'name' => 'reset',
				'id' => 'reset',
				'value' => _('Reset')
			);
			$buttons['submit'] = array(
				'name' => 'submit',
				'id' => 'submit',
				'value' => _('Submit')
			);
			break;
		case 'addcustomlang':
			$buttons['reset'] = array(
				'name' => 'reset',
				'id' => 'reset',
				'value' => _('Reset')
			);
			$buttons['submit'] = array(
				'name' => 'submit',
				'id' => 'submit',
				'value' => _('Submit')
			);
			break;
		}

		return $buttons;
	}

	/**
	 * Ajax Request
	 * @param string $req     The request type
	 * @param string $setting Settings to return back
	 */
	public function ajaxRequest($req, $setting){
		switch($req){
			case "convert":
			case "upload":
			case "delete":
			case "saveCustomLang":
			case "install":
			case "uninstall":
			case "licenseText":
			case "deletetemps":
			case "oobe":
				return true;
			break;
			default:
				return false;
			break;
		}
	}

	/**
	 * Handle AJAX
	 */
	public function ajaxHandler(){
		$request = $_REQUEST;
		switch($request['command']){
			case "oobe":
				set_time_limit(0);
				return array("status" => true);
			break;
			case "install":
				$this->installLanguage($request['lang']);
				return array("status" => true);
			case "uninstall":
				$this->uninstallLanguage($request['lang']);
				return array("status" => true);
			case "licenseText":
				$out = $this->getLanguageLicense($request['lang']);
				if(is_string($out)) {
					return array("status" => true, "license" => $out);
				}
				return array("status" => $out);
			case "saveCustomLang":
				if (empty($_POST['id'])) {
					$this->addCustomLanguage($_POST['language'], $_POST['description']);
				} else {
					$this->updateCustomLanguage($_POST['id'], $_POST['language'], $_POST['description']);
				}
				return array("status" => true);
			break;
			case "deletetemps":
				$temps = $_POST['temps'];
				foreach($temps as $temporary) {
					$temporary = str_replace("..","",$temporary);
					$temporary = $this->temp."/".$temporary;
					if(!file_exists($temporary)) {
						@unlink($temporary);
					}
				}
				return array("status" => true);
			break;
			case "convert":
				set_time_limit(0);
				$media = $this->FreePBX->Media;
				$temporary = $_POST['temporary'];
				$temporary = str_replace("..","",$temporary);
				$temporary = $this->temp."/".$temporary;
				$name = basename($_POST['name']);
				$codec = $_POST['codec'];
				$lang = $_POST['language'];
				$directory = $_POST['directory'];
				$path = $this->path . "/" . $lang;
				if(!empty($directory)) {
					$path = $path ."/".$directory;
				}
				if(!file_exists($path)) {
					if(!@mkdir($path)){
						$error = error_get_last();
						return array("status" => false, "message" => _("The file is not formatted correctly. Please try again..."));
					}
				}
				$name = preg_replace("/\s+|'+|`+|\"+|<+|>+|\?+|\*|\.+|&+/","-",$name);
				if(!empty($codec)) {
					$media->load($temporary);
					try {
						$media->convert($path."/".$name.".".$codec);
						//unlink($temporary);
					} catch(\Exception $e) {
						return array("status" => false, "message" => $e->getMessage()." [".$path."/".$name.".".$codec."]");
					}
					return array("status" => true, "name" => $name);
				} else {
					$ext = pathinfo($temporary,PATHINFO_EXTENSION);
					if($temporary && file_exists($temporary)) {
						rename($temporary, $path."/".$name.".".$ext);
						return array("status" => true, "name" => $name);
					} else {
						return array("status" => true, "name" => $name);
					}
				}
			break;
			case 'delete':
				switch ($request['type']) {
					case 'customlangs':
						$ret = array();
						foreach($request['customlangs'] as $language){
							$ret[$language] = $this->delCustomLanguage($language);
						}
						return array('status' => true, 'message' => $ret);
					break;
				}
			break;
			case "upload":
				if(empty($_FILES["files"])) {
					return array("status" => false, "message" => _("No files were sent to the server"));
				}
				foreach ($_FILES["files"]["error"] as $key => $error) {
					switch($error) {
						case UPLOAD_ERR_OK:
							$extension = pathinfo($_FILES["files"]["name"][$key], PATHINFO_EXTENSION);
							$extension = strtolower($extension);
							$supported = $this->FreePBX->Media->getSupportedFormats();
							$archives = array("tgz","gz","tar","zip");
							if(in_array($extension,$supported['in']) || in_array($extension,$archives)) {
								$tmp_name = $_FILES["files"]["tmp_name"][$key];
								$dname = \Media\Media::cleanFileName($_FILES["files"]["name"][$key]);
								$dname = pathinfo($dname,PATHINFO_FILENAME);
								$id = time().rand(1,1000);
								$name = $dname . '-' . $id . '.' . $extension;
								move_uploaded_file($tmp_name, $this->temp."/".$name);
								$gfiles = $bfiles = array();
								if(in_array($extension,$archives)) {
									//this is an archive
									if($extension == "zip") {
										$tar = new Zip();
									} else {
										$tar = new Tar();
									}
									$archive = $this->temp."/".$name;
									$tar->open($archive);
									$path = $this->temp."/".$id;
									if(!file_exists($path)) {
										mkdir($path);
									}
									$tar->extract($path);
									$objects = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path));
									foreach($objects as $name => $object){
										if($object->isDir()) {
											continue;
										}
										$file = (string)$object;
										$extension = pathinfo($file, PATHINFO_EXTENSION);
										$extension = strtolower($extension);
										$dir = dirname(str_replace($path."/","",$file));
										$dir = ($dir != ".") ? $dir : "";
										$dname = \Media\Media::cleanFileName(pathinfo($file,PATHINFO_FILENAME));
										if(!in_array($extension,$supported['in'])) {
											$bfiles[] = array(
												"directory" => $dir,
												"filename" => (!empty($dir) ? $dir."/" : "").$dname,
												"localfilename" => str_replace($this->temp,"",$file),
												"id" => ""
											);
											continue;
										}
										$gfiles[] = array(
											"directory" => $dir,
											"filename" => (!empty($dir) ? $dir."/" : "").$dname,
											"localfilename" => str_replace($this->temp,"",$file),
											"id" => ""
										);
									}
									unlink($archive);
								} else {
									$gfiles[] = array(
										"directory" => "",
										"filename" => pathinfo($dname,PATHINFO_FILENAME),
										"localfilename" => $name,
										"id" => $id
									);
								}
								return array("status" => true, "gfiles" => $gfiles, "bfiles" => $bfiles);
							} else {
								return array("status" => false, "message" => _("Unsupported file format"));
								break;
							}
						break;
						case UPLOAD_ERR_INI_SIZE:
							return array("status" => false, "message" => _("The uploaded file exceeds the upload_max_filesize directive in php.ini"));
						break;
						case UPLOAD_ERR_FORM_SIZE:
							return array("status" => false, "message" => _("The uploaded file exceeds the MAX_FILE_SIZE directive that was specified in the HTML form"));
						break;
						case UPLOAD_ERR_PARTIAL:
							return array("status" => false, "message" => _("The uploaded file was only partially uploaded"));
						break;
						case UPLOAD_ERR_NO_FILE:
							return array("status" => false, "message" => _("No file was uploaded"));
						break;
						case UPLOAD_ERR_NO_TMP_DIR:
							return array("status" => false, "message" => _("Missing a temporary folder"));
						break;
						case UPLOAD_ERR_CANT_WRITE:
							return array("status" => false, "message" => _("Failed to write file to disk"));
						break;
						case UPLOAD_ERR_EXTENSION:
							return array("status" => false, "message" => _("A PHP extension stopped the file upload"));
						break;
					}
				}
			break;
			default:
				echo json_encode(_("Error: You should never see this"));
			break;
		}
	}

	public function getLanguageLicense($lang) {
		$packages = $this->getPackages();
		if (empty($packages)) {
			return false;
		}

		foreach ($packages as $package) {
			if ($package['language'] == $lang) {
				$filename = $package['type'] . '-' . $package['module'] . '-' . $package['language'] . '-license.txt';
				try {
					$filedata = $this->getRemoteFile("/sounds/" . $filename);
					if (!empty($filedata)) {
						return $filedata;
					} else {
						return true;
					}
				} catch(\Exception $e) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Get Language Names
	 * @return array Array of language keys to Names
	 */
	public function getLanguageNames() {
		$names = array(
			'cs' => _('Czech'),
			'de' => _('German'),
			'en' => _('English'),
			'es' => _('Spanish'),
			'fa' => _('Persian'),
			'fi' => _('Finish'),
			'fr' => _('French'),
			'he' => _('Hebrew'),
			'it' => _('Italian'),
			'ja' => _('Japanese'),
			'nl' => _('Dutch'),
			'no' => _('Norwegian'),
			'pl' => _('Polish'),
			'pt' => _('Portuguese'),
			'ru' => _('Russian'),
			'sv' => _('Swedish'),
			'tr' => _('Turkish'),
			'zh' => _('Chinese'),
		);

		return $names;
	}

	/**
	 * Get language Locales
	 * @return array Array of Language locales
	 */
	public function getLocationNames() {
		$names = array(
			'AU' => _('Australia'),
			'BE' => _('Belgium'),
			'BR' => _('Brazil'),
			'CA' => _('Canada'),
			'CH' => _('Switzerland'),
			'CN' => _('China'),
			'CO' => _('Colombia'),
			'CZ' => _('Czech Republic'),
			'DE' => _('Germany'),
			'ES' => _('Spain'),
			'FI' => _('Finland'),
			'FR' => _('France'),
			'GB' => _('United Kingdom'),
			'HK' => _('Hong Kong'),
			'IE' => _('Ireland'),
			'IL' => _('Israel'),
			'IN' => _('India'),
			'IR' => _('Iran'),
			'IT' => _('Italy'),
			'JA' => _('Japan'),
			'NL' => _('Netherlands'),
			'NO' => _('Norway'),
			'NZ' => _('New Zealand'),
			'MX' => _('Mexico'),
			'PL' => _('Poland'),
			'PT' => _('Portugal'),
			'SE' => _('Sweden'),
			'TR' => _('Turkey'),
			'TW' => _('Taiwan'),
			'US' => _('United States'),
			'ZA' => _('South Africa'),
		);

		return $names;
	}

	public function getDefaultLocations() {
		$defaults = array(
			'cs' => 'CZ',
			'de' => 'DE',
			'en' => 'US',
			'es' => 'ES',
			'fa' => 'IR',
			'fi' => 'FI',
			'fr' => 'FR',
			'he' => 'IL',
			'it' => 'IT',
			'ja' => 'JA',
			'nl' => 'NL',
			'no' => 'NO',
			'pl' => 'PL',
			'pt' => 'PT',
			'ru' => 'RU',
			'sv' => 'SE',
			'tr' => 'TR',
			'zh' => 'CN',
		);

		return $defaults;
	}

	/**
	 * Get Languages
	 *
	 * This gets unique languges:
	 * OUT > Array
	 * (
	 * 	[en] => English
	 * 	[en_GB] => English (United Kingdom)
	 * )
	 * @return [type] [description]
	 */
	public function getAvailableLanguages() {
		$names = $this->getLanguageNames();
		$locations = $this->getLocationNames();

		$packagelangs = array();
		$packages = $this->getPackages();
		if (!empty($packages)) {
			foreach ($packages as $package) {
				//Try to use locale_get_display_name if it's installed
				if(function_exists('locale_get_display_name')) {
					$language = \FreePBX::View()->setLanguage();
					$name = locale_get_display_name($package['language'], $language);
				} else {
					$lang = explode('_', $package['language'], 2);
					if ((count($lang) == 2) && !empty($locations[$lang[1]]) && !empty($names[$lang[0]])) {
						$name = $names[$lang[0]] . ' - ' . $locations[$lang[1]];
					} else if (!empty($names[$lang[0]])) {
						$name = $names[$lang[0]];
					} else {
						$name = $lang[0];
					}
				}
				$packagelangs[$package['language']] = $name;
			}
		}

		$languages = $packagelangs;
		if (empty($languages)) {
			$languages = array('en' => $names['en']);
		}

		asort($languages);

		return $languages;
	}

	public function getLanguages() {
		$installed = array();

		$languages = $this->getAvailableLanguages();
		$packages = $this->getPackages();
		if (!empty($packages)) {
			foreach ($packages as $package) {
				if (!empty($package['installed'])) {
					$installed[$package['language']] = $languages[$package['language']];
				}
			}
		}

		$customs = $this->getCustomLanguages();
		if (!empty($customs)) {
			foreach ($customs as $customlang) {
				$installed[$customlang['language']] = $customlang['description'];
			}
		}

		return $installed;
	}

	/**
	 * Get the default global language
	 * @return string The language ID
	 */
	public function getLanguage() {
		$sql = "SELECT value FROM soundlang_settings WHERE keyword = 'language';";
		$language = $this->db->getOne($sql);

		if (empty($language)) {
			$language = 'en';
		}

		return $language;
	}

	/**
	 * Set the default language
	 * @param string $language The Language ID
	 */
	public function setLanguage($language) {
		$sql = "UPDATE soundlang_settings SET value = :language WHERE keyword = 'language';";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':language' => $language));

		needreload();
	}

	/**
	 * Get the format preference
	 * @return array List of format preferences
	 */
	public function getFormatPref() {
		$sql = "SELECT value FROM soundlang_settings WHERE keyword = 'formats';";
		$data = $this->db->getOne($sql);

		if (empty($data)) {
			$formats = array('g722', 'ulaw');
		} else {
			$formats = explode(',', $data);
		}

		return $formats;
	}

	/**
	 * Set the format preferences
	 * @param array $formats List of format preferences
	 */
	public function setFormatPref($formats) {
		$sql = "REPLACE INTO soundlang_settings (keyword, value) VALUES('formats', :formats);";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':formats' => !empty($formats) ? implode(',', $formats) : 'g722,ulaw'));
	}

	/**
	 * Get all Custom Languages
	 * @return array Array of custom languages
	 */
	private function getCustomLanguages() {
		$customlangs = array();

		$sql = "SELECT id, language, description FROM soundlang_customlangs;";
		$sth = $this->db->prepare($sql);
		$sth->execute();
		$languages = $sth->fetchAll(\PDO::FETCH_ASSOC);

		if (!empty($languages)) {
			foreach ($languages as $language) {
				$customlangs[] = array(
					'id' => $language['id'],
					'language' => $language['language'],
					'description' => $language['description'],
				);
			}
		}

		return $customlangs;
	}

	/**
	 * Get a custom language
	 * @param  int $id The language ID
	 * @return array     Array of information about language
	 */
	private function getCustomLanguage($id) {
		$sql = "SELECT id, language, description FROM soundlang_customlangs WHERE id = :id;";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(
			':id' => $id,
		));
		$customlang = $sth->fetch(\PDO::FETCH_ASSOC);

		return $customlang;
	}

	/**
	 * Update Custom Language information
	 * @param  int $id          The language ID
	 * @param  string $language    The language type
	 * @param  string $description The language description
	 */
	private function updateCustomLanguage($id, $language, $description = '') {
		global $amp_conf;

		$sql = "UPDATE soundlang_customlangs SET language = :language, description = :description WHERE id = :id";
		$sth = $this->db->prepare($sql);
		$res = $sth->execute(array(
			':id' => $id,
			':language' => $language,
			':description' => $description,
		));

		$destdir = $amp_conf['ASTVARLIBDIR'] . "/sounds/" . str_replace('/', '_', $language) . "/";
		@mkdir($destdir);
	}

	/**
	 * Add a new custom language
	 * @param string $language    The language type
	 * @param string $description The language description
	 */
	private function addCustomLanguage($language, $description = '') {
		global $amp_conf;

		$sql = "INSERT INTO soundlang_customlangs (language, description) VALUES (:language, :description)";
		$sth = $this->db->prepare($sql);
		$res = $sth->execute(array(
			':language' => $language,
			':description' => $description,
		));

		$destdir = $amp_conf['ASTVARLIBDIR'] . "/sounds/" . str_replace('/', '_', $language) . "/";
		@mkdir($destdir);
	}

	/**
	 * Delete custom language
	 * @param  int $id The language ID
	 */
	private function delCustomLanguage($id) {
		global $amp_conf;

		$language = $this->getCustomLanguage($id);
		if ($language['language'] == $this->getLanguage()) {
			/* Our current language was removed.  Fall back to default. */
			$this->setLanguage('en');
		}

		$sql = "DELETE FROM soundlang_customlangs WHERE id = :id;";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(
			':id' => $id,
		));

		$destdir = $amp_conf['ASTVARLIBDIR'] . "/sounds/" . str_replace('/', '_', $language['language']) . "/";
		@rmdir($destdir);
	}

	/**
	 * Get information about an installed package
	 * @param  array $package Array of information about package
	 * @return mixed          The installed version or null
	 */
	private function getPackageInstalled($package) {
		$sql = "SELECT * FROM soundlang_packages WHERE id = :id";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(
			':id' => $package['id'],
		));
		$installed = $sth->fetch(\PDO::FETCH_ASSOC);

		return !empty($installed) ? $installed['installed'] : NULL;
	}

	/**
	 * Set package installed information
	 * @param array $package   Array of information about the package
	 * @param string $installed the new version to set
	 */
	private function setPackageInstalled($package, $installed) {
		$sql = "UPDATE soundlang_packages SET installed = :installed WHERE id = :id";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(
			':installed' => $installed,
			':id' => $package['id'],
		));
	}

	/**
	 * Get list of all locally known packages
	 * @return array Array of package information(s)
	 */
	public function getPackages() {
		$sql = "SELECT * FROM soundlang_packages";
		$sth = $this->db->prepare($sql);
		$sth->execute();

		$data = $sth->fetchAll(\PDO::FETCH_ASSOC);
		$packages = array();
		foreach ($data as $package) {
			$packages[$package['id']] = $package;
		}

		return $packages;
	}

	public function getPackageById($id) {
		$sql = "SELECT * FROM soundlang_packages WHERE `id` = :id";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(
			':id' => $id,
		));

		$package = $sth->fetch(\PDO::FETCH_ASSOC);
		return $package;
	}

	/**
	 * Get online packages
	 * @return array Array of packages
	 */
	public function getOnlinePackages() {
		$version = getversion();
		// we need to know the freepbx major version we have running (ie: 12.0.1 is 12.0)
		preg_match('/(\d+\.\d+)/',$version,$matches);
		$base_version = $matches[1];

		$packages = $this->getPackages();
		$xml = $this->getRemoteFile("/sounds-" . $base_version . ".xml");
		if(!empty($xml)) {
			libxml_use_internal_errors(true);
			$soundsobj = simplexml_load_string($xml);
			if($soundsobj === false){
				foreach(libxml_get_errors() as $error) {
					dbug(sprintf("Soundlang Response: %s",$error->message));
				}
				$soundsobj = json_encode(array());
			}
			/* Convert to an associative array */
			$sounds = json_decode(json_encode($soundsobj), true);
			if (empty($sounds) || empty($sounds['sounds']) || empty($sounds['sounds']['package'])) {
				return false;
			}

			$available = $sounds['sounds']['package'];

			/* Delete packages that aren't installed */
			$sql = "DELETE FROM soundlang_packages WHERE installed IS NULL";
			$sth = $this->db->prepare($sql);
			$sth->execute();

			/* Add / Update package versions */
			$sql = "REPLACE INTO soundlang_packages (id, type, module, language, license, author, authorlink, format, version, installed) VALUES (:id, :type, :module, :language, :license, :author, :authorlink, :format, :version, :installed)";
			$sth = $this->db->prepare($sql);
			foreach ($available as $package) {
				$id = NULL;
				$package['installed'] = NULL;
				foreach ($packages as $k => $v) {
					if ($package['type'] == $v['type'] && $package['module'] == $v['module'] && $package['language'] == $v['language'] && $package['format'] == $v['format']) {
						/* Package already exists.  Use existing id/installed version. */
						$id = $k;
						$package['installed'] = $v['installed'];
					}
				}

				$res = $sth->execute(array(
					':id' => $id,
					':type' => $package['type'],
					':module' => $package['module'],
					':language' => $package['language'],
					':license' => isset($package['license'])?$package['license']:'',
					':author' => isset($package['author'])?$package['author']:'',
					':authorlink' => isset($package['authorlink'])?$package['authorlink']:'',
					':format' => $package['format'],
					':version' => $package['version'],
					':installed' => $package['installed'],
				));
			}
			return true;
		} else {
			return false;
		}
	}

	public function installLanguage($language) {
		$packages = $this->getPackages();
		if (empty($packages)) {
			return false;
		}

		foreach ($packages as $package) {
			if ($package['language'] == $language) {
				if (empty($package['installed']) || version_compare($package['version'], $package['installed'], 'gt')) {
					$formats = $this->getFormatPref();
					if (in_array($package['format'], $formats)) {
						$this->installPackage($package['id']);
					}
				}
			}
		}
	}

	public function uninstallLanguage($language) {
		$packages = $this->getPackages();
		if (empty($packages)) {
			return false;
		}

		foreach ($packages as $package) {
			if ($package['language'] == $language) {
				/* We don't check the format here.  Just delete everything. */
				$this->uninstallPackage($package['id']);
			}
		}
	}

	/**
	 * Install Package from online servers
	 * @param  array $package Array of information about the package
	 * @param bool $force Force redownload, even if it exists.
	 * @return mixed          return a string of the installed package or null
	 */
	public function installPackage($id, $force = false) {
		global $amp_conf;

		$package = $this->getPackageById($id);
		if (empty($package)) {
			return;
		}

		//var_dump($package);

		$basename = $package['type'].'-'.$package['module'].'-'.$package['language'].'-'.$package['format'] .'-'.$package['version'];
		$soundsdir = $amp_conf['ASTVARLIBDIR'] . "/sounds";

		// Does this sound language package already exist on this machine?
		$txtfile = $soundsdir.'/'.$package['language'].'/'.$package['module'].'-'.$package['language'].'.txt';

		if ($force || !file_exists("$soundsdir/.$basename") || !file_exists($txtfile)) {
			// No. We need to fetch it.

			$tmpdir = "$soundsdir/tmp";
			if (!is_dir($tmpdir)) {
				mkdir($tmpdir);
			}

			// This is the file we want to download
			$filename = $basename . '.tar.gz';
			$filedata = $this->getRemoteFile("/sounds/" . $filename);
			file_put_contents($tmpdir . "/" . $filename, $filedata);

			// Extract it to the correct location
			$destdir = "$soundsdir/".$package['language']."/";
			@mkdir($destdir);
			exec("tar zxf " . $tmpdir . "/" . escapeshellarg($filename) . " -C " . escapeshellarg($destdir), $output, $exitcode);

			if ($exitcode != 0) {
				freepbx_log(FPBX_LOG_ERROR, sprintf(_("failed to open %s sounds archive."), $filename));
				return array(sprintf(_('Could not untar %s to %s'), $filename, $destdir));
			}

			//https://issues.freepbx.org/browse/FREEPBX-14426
			$txtfilenoext = $soundsdir.'/'.$package['language'].'/'.$package['module'].'-'.$package['language'];
			if(!file_exists($txtfile) && file_exists($txtfilenoext)) {
				//missing .txt
				rename($txtfilenoext, $txtfile);
			}

			// If the txt file doesn't exist, there's something wrong with the package.
			if (!file_exists($txtfile)) {
				throw new \Exception("Couldn't find $txtfile - not in archive $filename?");
			}
			// Create our version file so we know it exists in the future.
			touch ("$soundsdir/.$basename");
		}

		// Get a list of sounds in this package.
		$prompts = file($txtfile, \FILE_SKIP_EMPTY_LINES);
		$files = array();
		foreach ($prompts as $prompt) {
			// If it's a comment, skip
			if ($prompt[0] == ";") {
				continue;
			}
			// Ignore the description
			$tmparr = explode(":", $prompt);
			$files[] = $tmparr[0];
		}

		if (!$files) {
			throw new \Exception("Unable to find any soundfiles in $basename package");
		}

		$row = array(
			':type' => $package['type'],
			':module' => $package['module'],
			':language' => $package['language'],
			':format' => $package['format']
		);

		// Delete any prompts from this package previously
		$sql = "DELETE FROM `soundlang_prompts` WHERE `type`=:type AND `module`=:module AND `language`=:language AND `format`=:format";
		$del = $this->db->prepare($sql);
		$del->execute($row);

		// Now load in the new files
		$sql = "INSERT INTO soundlang_prompts (type, module, language, format, filename) VALUES (:type, :module, :language, :format, :filename)";
		$sth = $this->db->prepare($sql);
		foreach ($files as $file) {
			$row['filename'] = $file.'.'.$package['format'];
			$res = $sth->execute($row);
		}

		$this->setPackageInstalled($package, $package['version']);
	}

	public function recursivermdir($dir) {
		if (is_dir($dir)) {
			$objs = scandir($dir);
			foreach ($objs as $obj) {
				if ($obj != "." && $obj != "..") {
					$name = $dir . "/" . $obj;
					if (filetype($name) == "dir") {
						$this->recursivermdir($name);
					} else {
						unlink($name);
					}
				}
				reset($objs);
			}
			rmdir($dir);
		}
	}

	/**
	 * Uninstall a package
	 * @param  array $package Information about the package
	 */
	public function uninstallPackage($id) {
		global $amp_conf;

		$package = $this->getPackageById($id);
		if (empty($package)) {
			return;
		}

		$soundsdir = $amp_conf['ASTVARLIBDIR'] . "/sounds";
		$tmpname = $package['type'].'-'.$package['module'].'-'.$package['language'].'-'.$package['format'] .'-';

		// Figure out which one we have, if any
		$installed = glob("$soundsdir/.$tmpname*");
		if ($installed) {
			foreach ($installed as $file) {
				unlink($file);
			}
		}

		$this->setPackageInstalled($package, NULL);

		$sql = "SELECT * FROM soundlang_prompts WHERE type = :type AND module = :module AND language = :language AND format = :format";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(
			':type' => $package['type'],
			':module' => $package['module'],
			':language' => $package['language'],
			':format' => $package['format'],
		));
		$files = $sth->fetchAll(\PDO::FETCH_ASSOC);

		if ($files) {
			$destdir = "$soundsdir/" . $package['language'] . "/";

			// Delete the soundfiles from this pack
			foreach ($files as $file) {
				@unlink($destdir . $file['filename']);
			}

			/* Purge installed prompts */
			$sql = "DELETE FROM soundlang_prompts WHERE type = :type AND module = :module AND language = :language AND format = :format";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(
				':type' => $package['type'],
				':module' => $package['module'],
				':language' => $package['language'],
				':format' => $package['format'],
			));

			needreload();
		}
	}

	/**
	 * Retrieve a remote file
	 * Stores file into memory
	 * @param  string $path The full path to said file
	 * @return string       binary representation of file
	 */
	private function getRemoteFile($path) {
		$modulef = \module_functions::create();

		$contents = null;

		$mirrors = $modulef->generate_remote_urls($path, true);

		$params = $mirrors['options'];
		$params['sv'] = 2; // Stats version
		$params['soundlangver'] = 2;
		$params['canredirect'] = 1;

		$exceptions = array();
		foreach($mirrors['mirrors'] as $url) {
			set_time_limit($this->maxTimeLimit);

			$pest = \FreePBX::Curl()->pest($url);
			$pest->curl_opts[\CURLOPT_TIMEOUT] = $this->maxTimeLimit;
			try {
				$contents = $pest->post($url . $path, $params);
				// If we were redirected to a different CDN, use that instead.
				if (!$contents && !empty($pest->last_response['meta']['redirect_url'])) {
					$newurl = $pest->last_response['meta']['redirect_url'];
					$urlarr = parse_url($newurl);

					$host = $urlarr['scheme']."://".$urlarr['host'];
					if (!empty($urlarr['port'])) {
						$host .= ":".$urlarr['port'];
					}

					$path = $urlarr['path'];

					$pest = \FreePBX::Curl()->pest($host);
					$pest->curl_opts[\CURLOPT_TIMEOUT] = $this->maxTimeLimit;
					$contents = $pest->get($path);
				}
			} catch(\Exception $e) {
				$exceptions[] = $e;
			}
			if (!empty($contents)) {
				return $contents;
			}
		}
		if(!empty($exceptions)) {
			$message = '';
			$code = '';
			foreach($exceptions as $e) {
				if($this->FreePBX->Config->get('MODULE_REPO') !== $this->FreePBX->Config->get_conf_default_setting('MODULE_REPO')) {
					$this->FreePBX->Config->reset_conf_settings(array('MODULE_REPO'),true);
					$code = 500;
					$message = _("The mirror server did not return the correct response and had been previously changed from the default server(s), it has now been reset back to the standard default. Please try again");
				} else {
					$code = $e->getCode();
					$msg = $e->getMessage();
					$message .= !empty($msg) ? $msg : sprintf(_("Error %s returned from remote servers %s"),$code,json_encode($mirrors['mirrors']));
					$message .= ", ";
				}

			}
			$message = rtrim(trim($message),",");

			throw new \Exception($message,$code);
		} else {
			throw new \Exception(sprintf(_("Unknown Error. Response was empty from %s"),json_encode($mirrors['mirrors'])),0);
		}
	}
	public function getRightNav($request) {
		return load_view(dirname(__FILE__).'/views/rnav.php',array());
	}
}
