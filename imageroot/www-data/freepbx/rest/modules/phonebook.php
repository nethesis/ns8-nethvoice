<?php
#
# Copyright (C) 2019 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#
#
use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

$app->get('/phonebook/fields', function (Request $request, Response $response, $args) {
    $fields = array(
       'cellphone',
       'company',
       'fax',
       'homecity',
       'homecountry',
       'homeemail',
       'homephone',
       'homepob',
       'homepostalcode',
       'homeprovince',
       'homestreet',
       'name',
       'notes',
       'owner_id',
       'title',
       'url',
       'workcity',
       'workcountry',
       'workemail',
       'workphone',
       'workpob',
       'workpostalcode',
       'workprovince',
       'workstreet'
    );
    return $response->withJson($fields, 200);
});

$app->get('/phonebook/config', function (Request $request, Response $response, $args) {
    try {
        $config_dir = '/etc/phonebook/sources.d';
        $handle = opendir($config_dir);
        $config = array();
        while (false !== ($entry = readdir($handle))) {
            if (strpos($entry,'.json') !== false) {
                $c = (array) json_decode(file_get_contents($config_dir.'/'.$entry));
                foreach ($c as $sid => $conf) {
                    $config[$sid] = $conf;
                }
            }
        }
        closedir($handle);
        return $response->withJson($config, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson(array("status"=>$e->getMessage()), 500);
    }
});

$app->post('/phonebook/config[/{id}]', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');
        $data = $request->getParsedBody();
        $config_dir = '/etc/phonebook/sources.d';

        if (!isset($id) || empty($id)) {
            // Create a new id
            $i = 1;
            while (file_exists($config_dir.'/custom_'.$i.'.json')) {
                $i ++ ;
            }
            $id = 'custom_'.$i;
            $new = true;
        }
        if(!isset($data['dbtype'])) {
            return $response->withJson(array("status"=>"Missing value: dbtype"), 400);
        } else if($data['dbtype'] == 'mysql') {
            $mandatory_params = array('host','port','user','password','dbname','query','mapping');
        } else if($data['dbtype'] == 'csv') {
            $mandatory_params = array('url','mapping');
        } else {
            return $response->withJson(array("status"=>"Bad dbtype value"), 400);
        }
        // validate mandatory parameters
        foreach ($mandatory_params as $var) {
            if (!isset($data[$var]) || empty($data[$var])) {
                error_log("Missing value: $var");
                return $response->withJson(array("status"=>"Missing value: $var"), 400);
            }
            $newsource[$var] = $data[$var];
        }
        $newsource['dbtype'] = $data['dbtype'];
        // optional parameters
        $newsource['interval'] = empty($data['interval']) ? 1440 : $data['interval'];
        $newsource['type'] = empty($data['type']) ? $id : $data['type'];
        $newsource['enabled'] = empty($data['enabled']) ? false : $data['enabled'];

        $file = $config_dir.'/'.$id.'.json';
        $res = file_put_contents($file, json_encode(array($id => $newsource)));
        if ($res === false) {
           throw new Exception("Error writing $file"); 
        }

        if (!isset($data['interval']) || empty($data['interval']) || $data['interval'] < 1 || $data['interval'] >= 1440) {
            $cron_time_interval = '0 0 * * *' ;
        } elseif ($data['interval'] < 60) {
            $cron_time_interval = '*/'.$data['interval'].' * * * *';
        } elseif ($data['interval'] >= 60 || $data['interval'] < 1440 ) {
            $cron_time_interval = '0 */'.intval($data['interval']/60).' * * *';
        }

        // Delete interval in cron if it exists
        $res = delete_import_from_cron($id);
        if (!$res) {
            throw new Exception("Error deleting $file from crontab!");
        }

        if ($newsource['enabled']) {
            // Write new configuration in cron
            $res = write_import_in_cron($cron_time_interval, $id);
            if (!$res) {
                throw new Exception("Error adding $file to crontab!");
            }
        } else {
            # launch nethserver-phonebook-mysql-save to clean and reload phonebook
            exec("/usr/bin/sudo /sbin/e-smith/signal-event nethserver-phonebook-mysql-save $id");
        }

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson(array("status"=>$e->getMessage()), 500);
    }
});

$app->delete('/phonebook/config/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');
        $file = '/etc/phonebook/sources.d/' . $id . '.json';
        $res = delete_import_from_cron($id);
        if (!$res) {
            throw new Exception("Error deleting $file from crontab!");
        }

        // delete from phonebook
        $cmd = "/usr/share/phonebooks/phonebook-import --deleteonly ".escapeshellarg($file);
        exec($cmd,$output,$return);
        if ($return !== 0 ) {
            throw new Exception("Error deleting $id entries from phonebook");
        }

        // Erase related local CSV file, if necessary:
        $config = json_decode(file_get_contents($file), true);
        unlink_local_csv($config[$id]);

        $res = unlink($file);
        if (!$res) {
            throw new Exception("Error deleting $file");
        }
        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson(array("status"=>$e->getMessage()), 500);
    }
});

/* Test connection and query and get first 3 results*/
$app->post('/phonebook/test', function (Request $request, Response $response, $args) {
    try {
        $data = $request->getParsedBody();
        // write a temporary configuration file
        $id = uniqid('phonebook_test_');
        $file = '/tmp/'.$id.'.json';
        $newsource = array();
        if(!isset($data['dbtype'])) {
            return $response->withJson(array("status"=>"Missing value: dbtype"), 400);
        } else if($data['dbtype'] == 'mysql') {
            $mandatory_params = array('host','port','user','password','dbname','query');
        } else if($data['dbtype'] == 'csv') {
            $mandatory_params = array('url');
        } else {
            return $response->withJson(array("status"=>"Bad dbtype value"), 400);
        }
        // validate mandatory parameters
        foreach ($mandatory_params as $var) {
            if (!isset($data[$var]) || empty($data[$var])) {
                error_log("Missing value: $var");
                return $response->withJson(array("status"=>"Missing value: $var"), 400);
            }
            $newsource[$id][$var] = $data[$var];
        }
        $newsource[$id]['dbtype'] = $data['dbtype'];
        $newsource[$id]['enabled'] = true;
        $res = file_put_contents($file, json_encode($newsource, JSON_UNESCAPED_SLASHES));
        if ($res === false) {
           throw new Exception("Error writing $file");
        }

        $cmd = "/usr/share/phonebooks/phonebook-import --check ".escapeshellarg($file);
        exec($cmd,$output,$return);

        // remove temporary file
        unlink($file);

        if ($return!=0) {
            unlink_local_csv($newsource[$id]);
            return $response->withJson(array("status"=>false),200);
        }
        $res = json_decode($output[0]);
        return $response->withJson(array_slice($res, 0, 3),200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson(array("status"=>$e->getMessage()), 500);
    }
});

/* Sync now one configuration */
$app->post('/phonebook/syncnow/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');

        # launch nethserver-phonebook-mysql-save to clean and reload phonebook
        exec("/usr/bin/sudo /sbin/e-smith/signal-event nethserver-phonebook-mysql-save $id",$output,$return);

        if ($return!=0) {
            return $response->withJson(array("status"=>false),500);
        }
        return $response->withJson(array("status"=>true),200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson(array("status"=>$e->getMessage()), 500);
    }
});

/* Upload a local CSV file source */
$app->post('/phonebook/uploadfile', function (Request $request, Response $response, $args) {
    $upload_dest = sprintf('/var/lib/nethserver/nethvoice/phonebook/uploads/%s.csv', uniqid());
    try {
        $file = array_pop($request->getUploadedFiles());
        if ($file->getError() != UPLOAD_ERR_OK) {
            return $response->withJson(array("status"=>"File upload error"), 500);
        }
        $file->moveTo($upload_dest);
        return $response->withJson(array(
            "status" => true,
            "uri" => "file://" . $upload_dest,
        ), 200);
    } catch (Exception $e) {
        unlink($upload_dest);
        error_log($e->getMessage());
        return $response->withJson(array("status"=>$e->getMessage()), 500);
    }
});

/*
* GET /phonebook/ldap
* Get configuration of ldap and ldaps system phonebooks
*/
$app->get('/phonebook/ldap', function (Request $request, Response $response, $args) {
    try {
        $configuration = array();
        exec("/usr/bin/sudo /sbin/e-smith/config getjson phonebookjs", $out);
        $tmp = json_decode($out[0]);
        $configuration['ldap'] = array();
        $configuration['ldap']['enabled'] = ($tmp->props->status == 'enabled') ? true : false;
        $configuration['ldap']['port'] = $tmp->props->TCPPort;
        $configuration['ldap']['user'] = '';
        $configuration['ldap']['password'] = '';
        $configuration['ldap']['tls'] = 'none';
        $configuration['ldap']['base'] = 'dc=phonebook,dc=nh';
        $configuration['ldap']['name_display'] = '%cn %o';
        $configuration['ldap']['mainphone_number_attr'] = 'telephoneNumber';
        $configuration['ldap']['mobilephone_number_attr'] = 'mobile';
        $configuration['ldap']['otherphone_number_attr'] = 'homePhone';
        $configuration['ldap']['name_attr'] = 'cn o';
        $configuration['ldap']['number_filter'] = '(|(telephoneNumber=%)(mobile=%)(homePhone=%))';
        $configuration['ldap']['name_filter'] = '(|(cn=%)(o=%))';
        unset ($out);
        exec("/usr/bin/sudo /sbin/e-smith/config getjson phonebookjss", $out);
        $tmp = json_decode($out[0]);
        $configuration['ldaps'] = array();
        $configuration['ldaps']['enabled'] = ($tmp->props->status == 'enabled') ? true : false;
        $configuration['ldaps']['port'] = $tmp->props->TCPPort;
        $configuration['ldaps']['user'] = 'cn=ldapuser,dc=phonebook,dc=nh';
        $configuration['ldaps']['password'] = exec('/usr/bin/sudo /usr/bin/cat /var/lib/nethserver/secrets/LDAPPhonebookPasswd');
        $configuration['ldaps']['tls'] = 'ldaps';
        $configuration['ldaps']['base'] = 'dc=phonebook,dc=nh';
        $configuration['ldaps']['name_display'] = '%cn %o';
        $configuration['ldaps']['mainphone_number_attr'] = 'telephoneNumber';
        $configuration['ldaps']['mobilephone_number_attr'] = 'mobile';
        $configuration['ldaps']['otherphone_number_attr'] = 'homePhone';
        $configuration['ldaps']['name_attr'] = 'cn o';
        $configuration['ldaps']['number_filter'] = '(|(telephoneNumber=%)(mobile=%)(homePhone=%))';
        $configuration['ldaps']['name_filter'] = '(|(cn=%)(o=%))';

        return $response->withJson($configuration, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
* GET /phonebook/sources
* Get additional sources configuration of system phonebooks
*/
$app->get('/phonebook/sources', function (Request $request, Response $response, $args) {
    try {
        $sources = array();
        exec("/usr/bin/sudo /sbin/e-smith/config getjson phonebook", $out);
        $tmp = json_decode($out[0]);
        $sources['extensions'] = ($tmp->props->extensions == 'enabled') ? true : false;
        $sources['nethcti'] = ($tmp->props->nethcti == 'enabled') ? true : false;
        $sources['speeddial'] = ($tmp->props->speeddial == 'enabled') ? true : false;
        unset($out);

        return $response->withJson($sources, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
* POST /phonebook/sources/[speeddial|extensions|nethcti]/[enabled|disabled]
* Set phonebook additional sources status [enabled|disabled]
*/
$app->post('/phonebook/sources/{prop:speeddial|extensions|nethcti}/{status:enabled|disabled}', function (Request $request, Response $response, $args) {
    $route = $request->getAttribute('route');
    $status = $route->getArgument('status');
    $prop = $route->getArgument('prop');
    exec("/usr/bin/sudo /sbin/e-smith/config setprop phonebook $prop $status", $out, $ret);

    if ( $ret === 0 ) {
        exec("/usr/bin/sudo /sbin/e-smith/signal-event nethserver-phonebook-mysql-save", $out, $ret);
        if ( $ret === 0 ) {
            return $response->withStatus(200);
        }
    }
    return $response->withStatus(500);
});

/*
* POST /phonebook/[ldap|ldaps]/status/[enabled|disabled]
* Set phonebookjs(s) service status [enabled|disabled]
*/
$app->post('/phonebook/{service:ldap|ldaps}/status/{status:enabled|disabled}', function (Request $request, Response $response, $args) {
    $route = $request->getAttribute('route');
    $service = $route->getArgument('service');
    $status = $route->getArgument('status');
    if ($service === 'ldap') {
        exec("/usr/bin/sudo /sbin/e-smith/config setprop phonebookjs status $status", $out, $ret);
    } elseif ($service === 'ldaps') {
        exec("/usr/bin/sudo /sbin/e-smith/config setprop phonebookjss status $status", $out, $ret);
    }
    if ( $ret === 0 ) {
        exec("/usr/bin/sudo /sbin/e-smith/signal-event nethserver-phonebook-mysql-fwsave", $out, $ret);
        if ( $ret === 0 ) {
            return $response->withStatus(200);
        }
    }
    return $response->withStatus(500);
});

function unlink_local_csv($config)
{
    if(isset($config['dbtype'], $config['url'])
        && $config['dbtype'] == 'csv'
        && substr($config['url'], 0, 55) == 'file:///var/lib/nethserver/nethvoice/phonebook/uploads/'
    ) {
        unlink(substr($config['url'], 7));
    }
}

function delete_import_from_cron($id) {
    try {
        $file = '/etc/phonebook/sources.d/'.$id.'.json';

        // Read crontab content
        exec('/usr/bin/crontab -l 2>/dev/null', $output, $ret);
        if ($ret != 0) {
            throw new Exception("Error reading crontab");
        }

        // Open crontab in a pipe
        if(!file_exists('/var/log/pbx/www-error.log')) {
            touch('/var/log/pbx/www-error.log');
        }

        $descriptorspec = array(
            0 => array("pipe", "r"),  // stdin
            1 => array("pipe", "w"),  // stdout
            2 => array("file", "/var/log/pbx/www-error.log", "a") // stderr
        );

        $process = proc_open('/usr/bin/crontab -', $descriptorspec, $pipes);
        if (!is_resource($process)) {
            throw new Exception("Error opening crontab pipe");
        }

        foreach ($output as $row) {
            if (strpos( $row , '/usr/share/phonebooks/phonebook-import ') !== FALSE && strpos( $row , $file) !== FALSE ) {
                continue;
            }
            fwrite($pipes[0], $row."\n");
        }
        fclose($pipes[0]);

        # launch nethserver-phonebook-mysql-save to clean and reload phonebook
        exec("/usr/bin/sudo /sbin/e-smith/signal-event nethserver-phonebook-mysql-save $id");

        return true;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }
}


function write_import_in_cron($cron_time_interval, $id) {
     try {
        $file = '/etc/phonebook/sources.d/'.$id.'.json';

        // Read crontab content
        exec('/usr/bin/crontab -l 2>/dev/null', $output, $ret);
        if ($ret != 0) {
            throw new Exception("Error reading crontab");
        }

        // Open crontab in a pipe
        if(!file_exists('/var/log/pbx/www-error.log')) {
            touch('/var/log/pbx/www-error.log');
        }

        $descriptorspec = array(
            0 => array("pipe", "r"),  // stdin
            1 => array("pipe", "w"),  // stdout
            2 => array("file", "/var/log/pbx/www-error.log", "a") // stderr
        );

        $process = proc_open('/usr/bin/crontab -', $descriptorspec, $pipes);
        if (!is_resource($process)) {
            throw new Exception("Error opening crontab pipe");
        }

        $output[] = $cron_time_interval.' '.'/usr/share/phonebooks/phonebook-import '.escapeshellarg($file);

        fwrite($pipes[0], join("\n", $output)."\n");
        fclose($pipes[0]);
        return true;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }
}

