<?php
// vim: set ai ts=4 sw=4 ft=php:
namespace FreePBX\modules\Soundlang;

class OOBE {
	private $sl;
	public function __construct($sl = false) {
		$this->sl = $sl;
	}

	public function oobeRequest() {
		if(isset($_POST['oobeTimezone'])) {
			try {
				\FreePBX::Soundlang()->installLanguage($_POST['oobeSoundLang']);
				\FreePBX::Soundlang()->setLanguage($_POST['oobeSoundLang']);
			} catch(\Exception $e) {}

			\FreePBX::Config()->set_conf_values(array('UIDEFAULTLANG' => $_POST['oobeGuiLang'], 'PHPTIMEZONE' => $_POST['oobeTimezone'], 'SHOWLANGUAGE' => true), true, true);
			return true;
		} else {
			$idents = \DateTimeZone::listIdentifiers();
			$timezones = array_combine($idents, $idents);

			$locale = set_language();

			$langlist = array();
			$langlist['en_US'] = function_exists('locale_get_display_name') ? locale_get_display_name('en_US', $locale) : 'en_US';
			foreach(glob(\FreePBX::Config()->get("AMPWEBROOT")."/admin/i18n/*",GLOB_ONLYDIR) as $langDir) {
				$lang = basename($langDir);
				$langlist[$lang] = function_exists('locale_get_display_name') ? locale_get_display_name($lang, $locale) : $lang;
			}

			$langs = $this->sl->getAvailableLanguages();
			show_view(__DIR__."/views/oobe.php",array("langs" => $langs, "langlist" => $langlist, "timezones" => $timezones));
		}
		return false;
	}
}
