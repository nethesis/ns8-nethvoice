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

        // Delete from phonebook db contacts imported from this source
        $phonebookdb = new PDO(
            'mysql:host='.$ENV['PHONEBOOK_DB_HOST'].';port='.$ENV['PHONEBOOK_DB_PORT'].';dbname='.$ENV['PHONEBOOK_DB_NAME'],
            $ENV['PHONEBOOK_DB_USER'],
            $ENV['PHONEBOOK_DB_PASS']);

        $sth = $phonebookdb->prepare('DELETE FROM phonebook WHERE sid_imported = ?');
        $sth->execute([$id]);

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

        # launch import of the source now
        exec("/usr/share/phonebooks/phonebook-import /etc/phonebook/sources.d/$id.json",$output,$return);

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
        $configuration['ldaps'] = array();
        $configuration['ldaps']['enabled'] = true;
        $configuration['ldaps']['port'] = $ENV['PHONEBOOK_LDAP_PORT'];
        $configuration['ldaps']['user'] = 'cn='.$ENV['PHONEBOOK_LDAP_USER'].',dc=phonebook,dc=nh';
        $configuration['ldaps']['password'] = $ENV['PHONEBOOK_LDAP_PASS'];
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
	// TODO remove this API
    try {
        $sources = array();
        $sources['extensions'] = true;
        $sources['nethcti'] = true;
        $sources['speeddial'] = true;

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
	// TODO remove this API
    return $response->withStatus(200);
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

