# FreePBX container

FreePBX container for NethServer 8


FreePBX and nethvoice-wizard-ui files are imported from NethVoice14 for NS7, nethvoice-wizard-restapi is taken from https://github.com/nethesis/nethvoice-wizard-restapi/tree/ns8 and phonebook update scripts are from https://github.com/nethesis/nethserver-phonebook-mysql/tree/ns8 .
This container also hosts push-proxy script for Flexisip.

## Environment variables

- `APACHE_RUN_USER` user Apache is run with (Asterisk)
- `APACHE_RUN_GROUP` group Apache is run with (Asterisk)
- `ASTMANAGERHOST` is the ip where AMI , Asterisk Manager Interface is exposed. 127.0.0.1 in network=host configuration
- `ASTMANAGERPORT` port of AMI, Asterisk Manager Interface
- `AMPMGRUSER` User automatically configured to access ti AMI
- `AMPMGRPASS` Password of AMI user
- `AMPDBUSER` FreePBX MariaDB database user (default: freepbxuser)
- `AMPDBPASS` FreePBX MariaDB database password
- `AMPDBHOST` FreePBX MariaDB database host (default: 127.0.0.1)
- `AMPDBNAME` FreePBX MariaDB database name (default: asterisk)
- `CDRDBUSER` CDR MariaDB database user (default: freepbxuser)
- `CDRDBPASS` CDR MariaDB database pass
- `NETHCTI*`
    - `NETHCTI_DB_USER` NethCTI MariaDB database user (default: nethcti3)
    - `NETHCTI_DB_PASSWORD` NethCTI MariaDB database password
    - `NETHCTI_AMI_PASSWORD` NethCTI AMI password 
- `NETHVOICE_MARIADB_PORT` port of MariaDB phonebook database
- `PHONEBOOK_DB_NAME` name of phonebook database
- `PHONEBOOK_DB_USER` user of phonebook database
- `PHONEBOOK_DB_PASS` password of phonebook database
- `PHONEBOOK_DB_HOST` host of phonebook database
- `PHONEBOOK_LDAP_LIMIT` limit of LDAP results. Default is 500
- `PHONEBOOK_LDAP_PORT` port of LDAP server
- `PHONEBOOK_LDAP_USER` user of LDAP server
- `PHONEBOOK_LDAP_PASS` password of LDAP server
- `APACHE_PORT` Port used for httpd
- `TANCREDIPORT` Port used bt Tancredi
- `BRAND_NAME` Name for branding (default: NethVoice)
- `BRAND_SITE` Site or branding (default: www.nethesis.it)
- `BRAND_DOCS` Site or documentation (default: ?)
- `SUBSCRIPTION_SYSTEMID` my.nethesis.it server SystemID
- `SUBSCRIPTION_SECRET` my.nethesis.it server secret

Patches used after import:
```diff
--- imageroot/freepbx/root/var/www/html/freepbx/admin/libraries/BMO/PKCS.class.php.ori	2022-09-16 10:13:24.195498228 +0200
+++ imageroot/freepbx/root/var/www/html/freepbx/admin/libraries/BMO/PKCS.class.php	2022-09-16 10:12:58.523530475 +0200
@@ -478,14 +478,8 @@
 				throw new \Exception(sprintf(_("Could Not Create the Asterisk Keys Folder: %s"),$keyloc));
 			}
 		}
-
-		if (is_writable($keyloc)) {
-			// This is a good Directory, and we're happy.
-			$this->keylocation = $keyloc;
-			return $keyloc;
-		} else {
-			throw new \Exception(sprintf(_("Don't have permission/can't write to: %s"),$keyloc));
-		}
+		$this->keylocation = $keyloc;
+		return $keyloc;
 	}
 
 	private function validateName($name) {
--- imageroot/freepbx/root/var/www/html/freepbx/admin/libraries/php-asmanager.php.ori	2022-09-16 10:13:45.319471792 +0200
+++ imageroot/freepbx/root/var/www/html/freepbx/admin/libraries/php-asmanager.php	2022-09-16 10:12:34.739560437 +0200
@@ -1826,11 +1826,7 @@
 			$parameters['Module'] = $module;
 			return $this->send_request('Reload', $parameters);
 		} else {
-			//Until https://issues.asterisk.org/jira/browse/ASTERISK-25996 is fixed
-			$a = function_exists("fpbx_which") ? fpbx_which("asterisk") : "asterisk";
-			if(!empty($a)) {
-				return exec($a . " -rx 'core reload'");
-			}
+			return $this->send_request('Reload', $parameters);
 		}
 
 	}
--- imageroot/freepbx/root/var/www/html/freepbx/admin/modules/nethcti3/functions.inc.php.ori	2022-10-10 16:54:14.781108751 +0200
+++ imageroot/freepbx/root/var/www/html/freepbx/admin/modules/nethcti3/functions.inc.php	2022-10-10 17:00:32.984459476 +0200
@@ -379,7 +379,13 @@
         nethvoice_report_config();
 
         //Move provisioning files from /var/lib/tftpnethvoice to /var/lib/tftpboot
-        system("/usr/bin/sudo /usr/bin/scl enable rh-php56 -- php /var/www/html/freepbx/rest/lib/moveProvisionFiles.php");
+	system("/usr/bin/sudo /usr/bin/scl enable rh-php56 -- php /var/www/html/freepbx/rest/lib/moveProvisionFiles.php");
+
+	// Convert /etc/asterisk symlinks to file copied
+	if (file_exists('/var/lib/asterisk/bin/symlink2copies.sh')) {
+	        system("/var/lib/asterisk/bin/symlink2copies.sh");
+	}
+
         //Reload CTI
         system("/var/www/html/freepbx/rest/lib/ctiReloadHelper.sh > /dev/null 2>&1 &");
     } catch (Exception $e) {
```
