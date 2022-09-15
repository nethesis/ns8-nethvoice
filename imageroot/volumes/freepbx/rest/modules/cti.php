<?php
#
# Copyright (C) 2017 Nethesis S.r.l.
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

include_once('lib/libCTI.php');

/* GET /cti/profiles
Return: [{id:1, name: admin, macro_permissions [ oppanel: {value: true, permissions [ {name: "foo", description: "descrizione...", value: false},{..} ]}
*/
$app->get('/cti/profiles', function (Request $request, Response $response, $args) {
    $results = getCTIPermissionProfiles(false,false,true);
    if (!$results) {
        return $response->withStatus(500);
    }
    return $response->withJson($results,200);
});


/* GET /cti/profiles/{id}
Return: {id:1, name: admin, macro_permissions [ oppanel: {value: true, permissions [ {name: "foo", description: "descrizione...", value: false}
*/
$app->get('/cti/profiles/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');
        $results = getCTIPermissionProfiles($id,false,true);
        if (!$results) {
            return $response->withStatus(500);
        }
        return $response->withJson($results,200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});


/* GET /cti/permissions
Return: [{"cdr": {"permissions": [{"description": "descrizione...", "id": "2", "name": "sms", "value": true  },  { ...}]},{"phonebook": {"permissions": [{"description": "descrizione...", "id": "2", "name": "sms", "value": true  },  { ...}]}]
*/
$app->get('/cti/permissions', function (Request $request, Response $response, $args) {
    try {
       	$results = getCTIPermissions();
        if (!$results) {
            return $response->withStatus(500);
        }
        return $response->withJson($results,200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});


/* POST /cti/profiles/{id} {"id":"1","name":"base","macro_permissions":{"phonebook":{"value":false,"permissions":[]},"oppanel":{"value":true,"permissions":[{"id":"1","name":"intrude","description":"descrizione...","value":false}
*/
$app->post('/cti/profiles/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');
        $profile = $request->getParsedBody();

        $sharedLock = '/var/run/nethvoice/contextLock';
        $timeoutSeconds = 5;

        // Check and create lock file
        if ( !file_exists(dirname($sharedLock))
            || !is_writable(dirname($sharedLock))
            || ( file_exists($sharedLock) && filemtime($sharedLock) > time()-$timeoutSeconds )
            || !touch($sharedLock))
        {
            throw new Exception('Can\'t acquire lock');
        }

        $res = postCTIProfile($profile,$id);

        // Release lock
        unlink($sharedLock);

        if ($res) {
            system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
            return $response->withJson(array('status' => true), 200);
        } else {
            throw new Exception('Error editing profile');
        }
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});


/* POST /cti/profiles {name: admin, permissions: [{name: "foo", type: customer_card, value: false} return id */
$app->post('/cti/profiles', function (Request $request, Response $response, $args) {
    try {
        $profile = $request->getParsedBody();
        $id = postCTIProfile($profile);
        if ($id) {
            system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

            return $response->withJson(array('id' => $id ), 200);
        } else {
            throw new Exception('Error creating new profile');
        }
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/* GET /cti/profiles/users/{user_id} Return profile id of the user*/
$app->get('/cti/profiles/users/{user_id}', function (Request $request, Response $response, $args) {
    try {
        $dbh = FreePBX::Database();
        $route = $request->getAttribute('route');
        $user_id = $route->getArgument('user_id');
        $sql = 'SELECT `profile_id` FROM `rest_users` WHERE `user_id` = ?';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($user_id));
        $profile_id = $sth->fetchAll()[0][0];
        if (!$profile_id) {
            return $response->withStatus(404);
        }
        return $response->withJson(array('id' => $profile_id),200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});


/* POST /cti/profiles/users/{user_id} => {profile_id: <profile_id>} */
$app->post('/cti/profiles/users/{user_id}', function (Request $request, Response $response, $args) {
    try {
        $dbh = FreePBX::Database();
        $route = $request->getAttribute('route');
        $user_id = $route->getArgument('user_id');
        $data = $request->getParsedBody();
        $profile_id = $data['profile_id'];

        $res = setCTIUserProfile($user_id,$profile_id);
        if ($res !== TRUE) {
            throw new Exception($res['error']);
        }

        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withJson(array('status' => true), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/* DELETE /cti/profiles/{id} */
$app->delete('/cti/profiles/{id}', function (Request $request, Response $response, $args) {
    $route = $request->getAttribute('route');
    $id = $route->getArgument('id');
    if (deleteCTIProfile($id)) {
        return $response->withJson(array('status' => true), 200);
    } else {
        return $response->withStatus(500);
    }
});

/* GET /cti/groups
Return: [{id:1, name: support}, {id:2, name:development}]
*/
$app->get('/cti/groups', function (Request $request, Response $response, $args) {
    try {
        $dbh = FreePBX::Database();
        $sql = 'SELECT id, name FROM `rest_cti_groups`';
        $res = $dbh->sql($sql, 'getAll', \PDO::FETCH_ASSOC);

        return $response->withJson($res, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/* GET /cti/groups/users/:id
Return: {id:1, name: support}
*/
$app->get('/cti/groups/users/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');

        $dbh = FreePBX::Database();
        $sql = 'SELECT rest_cti_groups.id, rest_cti_groups.name'.
            ' FROM rest_cti_groups'.
            ' JOIN rest_cti_users_groups ON rest_cti_users_groups.group_id = rest_cti_groups.id'.
            ' WHERE rest_cti_users_groups.user_id = ?';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($id));

        $data = array();

        while ($res = $sth->fetchObject()) {
            $data[] = $res->id;
        }

        return $response->withJson($data, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/* GET /cti/users/groups/:id
Return [{"user_id":"14","name":"fooo"},{"user_id":"13","name":"fooo"}]
*/
$app->get('/cti/users/groups/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');

        $dbh = FreePBX::Database();
        $sql = 'SELECT rest_cti_users_groups.user_id, rest_cti_groups.name'.
            ' FROM rest_cti_groups'.
            ' JOIN rest_cti_users_groups ON rest_cti_users_groups.group_id = rest_cti_groups.id'.
            ' WHERE rest_cti_users_groups.user_id = ?';

        $sql = 'SELECT rest_cti_users_groups.user_id, rest_cti_groups.name'.
            ' FROM rest_cti_groups'.
            ' JOIN rest_cti_users_groups ON rest_cti_users_groups.group_id = rest_cti_groups.id'.
            ' WHERE rest_cti_users_groups.group_id = ?';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($id));
        $data = array();
        while ($res = $sth->fetchObject()) {
            $data[] = $res;
        }

        return $response->withJson($data, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});


/* POST /cti/groups {"name": "sviluppo"}
*/
$app->post('/cti/groups', function (Request $request, Response $response, $args) {
    try {
        $data = $request->getParsedBody();
        $res = ctiCreateGroup($data['name']);
        if ($res === false) {
            throw new Exception('Error creating group');
        }
        $group_id = $res;

        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withJson($group_id, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/* DELETE /cti/groups/{id} */
$app->delete('/cti/groups/{id}', function (Request $request, Response $response, $args) {
    try {
        $dbh = FreePBX::Database();
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');

        $query = 'SELECT name FROM rest_cti_groups WHERE id = ?';
        $sth = $dbh->prepare($query);
        $sth->execute(array($id));
        $group_name = $sth->fetchObject();

        $sql = 'DELETE FROM `rest_cti_groups` WHERE `id` = ?';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($id));

        $sql = 'DELETE FROM `rest_cti_permissions` WHERE `name` = ?';
        $sth = $dbh->prepare($sql);
        $sth->execute(array("grp_".trim(strtolower(preg_replace('/[^a-zA-Z0-9]/','',$group_name->name)))));
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withJson(array('status' => true), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * POST /cti/groups/users/3 groups: [1, 4, 5]
*/
$app->post('/cti/groups/users/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $user_id = $route->getArgument('id');
        $data = $request->getParsedBody();

        // Delete previous assignments
        $dbh = FreePBX::Database();
        $sql = 'DELETE FROM rest_cti_users_groups WHERE user_id = ?';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($user_id));

        // Add groups for user
        foreach ($data['groups'] as $group_id) {
            $sql = 'INSERT INTO rest_cti_users_groups VALUES (NULL, ?, ?)';
            $sth = $dbh->prepare($sql);
            $sth->execute(array($user_id, $group_id));
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * POST /cti/dbconn { host: string, port: numeric, type: string, user: string, pass: string, name: string }
*/
$app->post('/cti/dbconn', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $data = $request->getParsedBody();

        // Delete previous assignments
        $dbh = NethCTI::Database();
        $sql = 'INSERT INTO user_dbconn(host, port, type, user, pass, name, creation)'.
            ' VALUES (?, ?, ?, ?, ?, ?, NOW())';
        $sth = $dbh->prepare($sql);
        $res = $sth->execute(array(
            $data['host'],
            $data['port'],
            $data['type'],
            $data['user'],
            $data['pass'],
            $data['name']
        ));

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }

        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * PUT /cti/paramurl/:id { id: string, profiles: array, url: string, only_queues: boolean }
 */
$app->put('/cti/paramurl/{id}', function (Request $request, Response $response, $args) {
  try {
      $route = $request->getAttribute('route');
      $id = $route->getArgument('id');
      $data = $request->getParsedBody();
      $args = array();
      $fields = array();
      $dbh = FreePBX::Database();
      foreach ($data["profiles"] as $p) {
        $sql = 'INSERT INTO rest_cti_profiles_paramurl (profile_id, url, only_queues) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE profile_id=VALUES(profile_id), url=VALUES(url), only_queues=VALUES(only_queues)';
        $sth = $dbh->prepare($sql);
        $res = $sth->execute(array($p, $data["url"], $data["only_queues"]));
        if ($res === FALSE) {
          throw new Exception($sth->errorInfo()[2]);
        }
      }
      $sql = 'DELETE FROM rest_cti_profiles_paramurl WHERE url=? AND profile_id NOT IN ('.implode(",", $data["profiles"]).')';
      $sth = $dbh->prepare($sql);
      $res = $sth->execute(array($data["url"]));
      if ($res === FALSE) {
          throw new Exception($sth->errorInfo()[2]);
      }
      system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
      return $response->withStatus(200);
  } catch (Exception $e) {
      error_log($e->getMessage());
      return $response->withStatus(500);
  }
});

/*
 * PUT /cti/dbconn { host: string, port: numeric, type: string, user: string, pass: string, name: string }
*/
$app->put('/cti/dbconn/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');
        $data = $request->getParsedBody();
        $args = array();
        $fields = array();

        foreach ($data as $p=>$v) {
            $fields[] = $p. ' = ?';
            $args[] = $v;
        }

        $args[] = $id;

        $dbh = NethCTI::Database();
        $sql = 'UPDATE user_dbconn SET '. implode(', ', $fields). ' WHERE id = ?';
        $sth = $dbh->prepare($sql);
        $res = $sth->execute($args);

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * POST /cti/paramurl { "url": string, "profiles": array, "only_queues": boolean }
*/
$app->post('/cti/paramurl', function (Request $request, Response $response, $args) {
  try {
      $route = $request->getAttribute('route');
      $data = $request->getParsedBody();
      $url = $data['url'];
      $profiles = $data['profiles'];
      $only_queues = $data['only_queues'];
      $dbi = FreePBX::Database();
      foreach ($profiles as $profileId) {
        $sql = 'INSERT INTO rest_cti_profiles_paramurl(profile_id, url, only_queues) VALUES (?, ?, ?)';
        $sth = $dbi->prepare($sql);
        $res = $sth->execute(array($profileId, $url, $only_queues));
        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }
      }
      system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
      return $response->withStatus(200);
  } catch (Exception $e) {
      error_log($e->getMessage());
      return $response->withStatus(500);
  }
});

/*
 * POST /cti/paramurls/delete
*/
$app->post('/cti/paramurl/delete', function (Request $request, Response $response, $args) {
  try {
      $route = $request->getAttribute('route');
      $data = $request->getParsedBody();
      $url = $data['url'];
      $profiles = $data['profiles'];
      $dbi = FreePBX::Database();
      foreach ($profiles as $profileId) {
        $sql = 'DELETE FROM rest_cti_profiles_paramurl WHERE profile_id=? AND url=?';
        $sth = $dbi->prepare($sql);
        $res = $sth->execute(array($profileId, $url));
        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }
      }
      system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
      return $response->withStatus(200);
  } catch (Exception $e) {
      error_log($e->getMessage());
      return $response->withStatus(500);
  }
});

/*
 * GET /cti/dbconn { host: string, port: numeric, type: string, user: string, pass: string, name: string }
*/
$app->get('/cti/dbconn', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $data = $request->getParsedBody();

        // Delete previous assignments
        $dbh = NethCTI::Database();
        $sql = 'SELECT * FROM user_dbconn';
        $sth = $dbh->prepare($sql);
        $sth->execute();

        $res = $sth->fetchAll(PDO::FETCH_ASSOC);

        return $response->withJson($res);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * DELETE /cti/dbconn/:id
*/
$app->delete('/cti/dbconn/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');
        $data = $request->getParsedBody();

        // Delete previous assignments
        $dbh = NethCTI::Database();
        $sql = 'DELETE FROM user_dbconn WHERE id = ?';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($id));

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }

        return $response->withJson($res);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * GET /cti/dbconn/type
*/
$app->get('/cti/dbconn/type', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $data = $request->getParsedBody();

        return $response->withJson(array(
            'mysql' => 'MySQL',
            'postgres' => 'PostgreSQL',
            'mssql:7_4' => 'SQL Server 2012/2014',
            'mssql:7_3_A' => 'SQL Server 2008 R2',
            'mssql:7_3_B' => 'SQL Server 2008',
            'mssql:7_2' => 'SQL Server 2005',
            'mssql:7_1' =>  'SQL Server 2000'
        ));
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * GET /cti/template { name: string, custom: bool, html: string }
*/
$app->get('/cti/customer_card/template', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $data = $request->getParsedBody();

        $tpl_path = '/var/lib/nethserver/nethcti/templates/customer_card';

        $templates = array();

        if ($handle = opendir($tpl_path)) {
            while (false !== ($name = readdir($handle))) {
                if (preg_match('/^.+\.ejs$/', $name)) {
                    $content = file_get_contents($tpl_path. '/'. $name);
                    $matches = null;
                    preg_match('/<!-- color: (.+) -->/', $content, $matches);

                    $templates[] = array(
                        'name' => str_replace('.ejs', '', str_replace('_custom', '', $name)),
                        'custom' => (strpos($name, '_custom') !== FALSE),
                        'html' => base64_encode($content),
                        'color' => ($matches ? $matches[1] : null)
                    );
                }
            }
            closedir($handle);
        }

        return $response->withJson($templates);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * POST /cti/template { name: string, custom: bool, html: string }
*/
$app->post('/cti/customer_card/template', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $data = $request->getParsedBody();

        $custom = $data['custom'];
        $name = trim(strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $data['name']))).
            ($custom ? '_custom' : ''). '.ejs';
        $html = base64_decode($data['html']);
        $tpl_path = '/var/lib/nethserver/nethcti/templates/customer_card';

        if (!is_writable($tpl_path) || !file_put_contents($tpl_path. '/'. $name, $html)) {
            throw new Exception('template write error');
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * PUT /cti/customer_card/template/:name { name: string, custom: bool, html: string }
*/
$app->put('/cti/customer_card/template/{name}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $data = $request->getParsedBody();

        $tpl_path = '/var/lib/nethserver/nethcti/templates/customer_card';
        $custom = $data['custom'];
        $name = trim(strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $data['name']))).
            ($custom ? '_custom' : ''). '.ejs';

        if (file_exists($tpl_path. '/'. $name)) {
            $html = base64_decode($data['html']);
            if (!is_writable($tpl_path) || !file_put_contents($tpl_path. '/'. $name, $html)) {
                throw new Exception('template write error');
            }
        } else {
            return $response->withStatus(404);
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * DELETE /cti/template/:name
*/
$app->delete('/cti/customer_card/template/{name}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $name = $route->getArgument('name');

        $tpl_path = '/var/lib/nethserver/nethcti/templates/customer_card';

        if (file_exists($tpl_path. '/'. $name. '_custom'. '.ejs')) {
            unlink($tpl_path. '/'. $name. '_custom'. '.ejs');
        }
        else if (file_exists($tpl_path. '/'. $name. '.ejs')) {
            unlink($tpl_path. '/'. $name. '.ejs');
        }
        else {
            throw new Exception('template not found');
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * GET /cti/customer_card { id: numeric, query: string, template: string, dbconn_id: integer, creation: datetime }
*/
$app->get('/cti/customer_card', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $data = $request->getParsedBody();
        $params = $request->getQueryParams();
        $args = array();

        $dbh = NethCTI::Database();
        $sql = 'SELECT * FROM customer_card';

        if (count($params) > 0) {
            $sql .= ' WHERE';
            foreach ($params as $name => $val) {
                $sql .= ' '. $name. ' = ?';
                $args[] = $val;
            }
        }

        $sth = $dbh->prepare($sql);
        $sth->execute($args);
        $rows = $sth->fetchAll(PDO::FETCH_ASSOC);

        $dbi = FreePBX::Database();
        $sql = 'SELECT pp.profile_id FROM rest_cti_profiles_permissions pp'.
        ' JOIN rest_cti_permissions p ON p.id = pp.permission_id'.
        ' WHERE p.id = ?';
        $sth = $dbi->prepare($sql);

        $res = array();
        foreach ($rows as $r) {
            $sth->execute(array($r['permission_id']));
            $profiles = $sth->fetchAll(PDO::FETCH_COLUMN);

            $r['query'] = base64_encode($r['query']);
            $r['profiles'] = $profiles;
            $r['template'] = array(
                'name' => str_replace('_custom', '', $r['template']),
                'custom' => (strpos($r['template'], '_custom') !== FALSE)
            );

            $res[] = $r;
        }

        return $response->withJson($res);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * POST /cti/customer_card { name: string, query: string, template: string, dbconn_id: integer, profiles: [int, ...] }
*/
$app->post('/cti/customer_card', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $data = $request->getParsedBody();

        $name = $data['name'];
        $query = base64_decode($data['query']);
        $template = $data['template'];
        $dbconn_id = $data['dbconn_id'];
        $profiles = $data['profiles'];

        $dbi = FreePBX::Database();
        // Insert into cti permissions
        $permname = 'cc_'. strtolower(str_replace(' ', '_', preg_replace('/[^a-zA-Z0-9\s]/','',$name)));
        $sql = 'INSERT INTO rest_cti_permissions(name, displayname, description) VALUES (?, ?, ?)';
        $sth = $dbi->prepare($sql);
        $res = $sth->execute(array($permname, $name, 'Enable the customer card for this profile'));

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }

        $sql = 'SELECT id FROM rest_cti_permissions WHERE name = ?';
        $sth = $dbi->prepare($sql);
        $sth->execute(array($permname));
        $res = $sth->fetchObject();
        $permission_id = null;

        if ($res) {
            $permission_id = $res->id;
        } else {
            throw new Exception('no permission stored for customer card');
        }

        // Add permission to customer card macro permission
        $sql = 'INSERT INTO rest_cti_macro_permissions_permissions'.
            ' SELECT id, ? FROM rest_cti_macro_permissions WHERE name = ?';
        $sth = $dbi->prepare($sql);
        $res = $sth->execute(array($permission_id, 'customer_card'));

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }

        // Enable permission for profiles
        $sql = 'INSERT INTO rest_cti_profiles_permissions VALUES(?, ?)';
        $sth = $dbi->prepare($sql);
        foreach ($profiles as $p) {
            $res = $sth->execute(array($p, $permission_id));

            if ($res === FALSE) {
                throw new Exception($sth->errorInfo()[2]);
            }
        }

        $dbh = NethCTI::Database();
        $sql = 'INSERT INTO customer_card(name, creation, query, template, dbconn_id, permission_id)'.
            ' VALUES (?, NOW(), ?, ?, ?, ?)';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($name, $query, $template, $dbconn_id, $permission_id));

        if ($res === FALSE) {
            $sql = 'DELETE FROM rest_cti_permissions WHERE id = ?';
            $sth = $dbi->prepare($sql);
            $res = $sth->execute(array($permission_id));

            throw new Exception($sth->errorInfo()[2]);
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * PUT /cti/customer_card/:id { name: string, query: string, template: string, dbconn_id: integer, profiles: [int, ...] }
*/
$app->put('/cti/customer_card/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');
        $data = $request->getParsedBody();
        $args = array();
        $fields = array();

        $dbh = NethCTI::Database();
        $sql = 'SELECT name, permission_id FROM customer_card WHERE id = ?';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($id));
        $res = $sth->fetchAll(PDO::FETCH_ASSOC);

        if (count($res) != 1) {
            return $response->withStatus(404);
        }

        $name = $res[0]['name'];
        $permission_id = $res[0]['permission_id'];

        if(!$permission_id) {
            $dbi = FreePBX::Database();
            // Insert into cti permissions
            $permname = 'cc_'. strtolower(str_replace(' ', '_', preg_replace('/[^a-zA-Z0-9\s]/','',$name)));
            $sql = 'INSERT INTO rest_cti_permissions(name, displayname, description) VALUES (?, ?, ?)';
            $sth = $dbi->prepare($sql);
            $res = $sth->execute(array($permname, $name, 'Enable the customer card for this profile'));

            if ($res === FALSE) {
                throw new Exception($sth->errorInfo()[2]);
            }

            $sql = 'SELECT id FROM rest_cti_permissions WHERE name = ?';
            $sth = $dbi->prepare($sql);
            $sth->execute(array($permname));
            $res = $sth->fetchObject();
            $permission_id = null;

            if ($res) {
                $permission_id = $res->id;
                $data['permission_id'] = $permission_id;
                 // Add permission to customer card macro permission
                $sql = 'INSERT INTO rest_cti_macro_permissions_permissions'.
                    ' SELECT id, ? FROM rest_cti_macro_permissions WHERE name = ?';
                $sth = $dbi->prepare($sql);
                $res = $sth->execute(array($permission_id, 'customer_card'));

                if ($res === FALSE) {
                    throw new Exception($sth->errorInfo()[2]);
                }
            } else {
                throw new Exception('no permission stored for customer card');
            }
        }

        foreach ($data as $p=>$v) {
            // Exclude profiles from simple params updating
            if ($p === 'profiles') {
                continue;
            }

            $fields[] = $p. ' = ?';
            $args[] = ($p === 'query' ? base64_decode($v) : $v);
        }

        $args[] = $id;

        $sql = 'UPDATE customer_card SET '. implode(', ', $fields). ' WHERE id = ?';
        $sth = $dbh->prepare($sql);
        $res = $sth->execute($args);

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }

        if (array_key_exists('profiles', $data)) {
            // Enable permission for profiles
            $profiles = $data['profiles'];
            $dbi = FreePBX::Database();
            $sql = 'DELETE FROM rest_cti_profiles_permissions WHERE permission_id = ?';
            $sth = $dbi->prepare($sql);
            $res = $sth->execute(array($permission_id));

            if ($res === FALSE) {
                throw new Exception($sth->errorInfo()[2]);
            }

            $sql = 'INSERT INTO rest_cti_profiles_permissions VALUES(?, ?)';
            $sth = $dbi->prepare($sql);
            foreach ($profiles as $p) {
                $res = $sth->execute(array($p, $permission_id));

                if ($res === FALSE) {
                    throw new Exception($sth->errorInfo()[2]);
                }
            }
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * DELETE /cti/customer_card/:id
*/
$app->delete('/cti/customer_card/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');

        $dbh = NethCTI::Database();
        // Insert into cti permissions
        $sql = 'SELECT name, permission_id FROM customer_card WHERE id = ?';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($id));

        $obj = $sth->fetch(PDO::FETCH_ASSOC);

        if (!$obj) {
            throw new Exception('no customer card found');
        }

        $dbi = FreePBX::Database();
        $sql = 'DELETE FROM rest_cti_permissions WHERE id = ?';
        $sth = $dbi->prepare($sql);
        $sth->execute(array($obj['permission_id']));

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }

        $sql = 'DELETE FROM customer_card WHERE id = ?';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($id));

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * GET /cti/streaming { name: string, url: string, user: string, secret: string, framerate: integer, exten: integer, open: string, profiles: array }
 */
$app->get('/cti/streaming', function (Request $request, Response $response, $args) {
    try {
        $dbh = FreePBX::Database();
        $sql = 'SELECT * FROM rest_cti_streaming';
        $sth = $dbh->prepare($sql);
        $sth->execute();
        $res = $sth->fetchAll(PDO::FETCH_ASSOC);

        foreach ($res as $i => $s) {
            $res[$i]['profiles']=[];
            $descr=$s['descr'];

            $sql = 'SELECT id FROM rest_cti_permissions WHERE name=?';
            $sth = $dbh->prepare($sql);
            $sth->execute(array('vs_'.strtolower(str_replace(' ', '_', preg_replace('/[^a-zA-Z0-9\s]/','',$descr)))));
            $restemp = $sth->fetchAll(PDO::FETCH_ASSOC);
            $permission_id = null;

            if ($restemp) {
                $permission_id = $restemp[0]['id'];
                $sql = 'SELECT profile_id FROM rest_cti_profiles_permissions WHERE permission_id=?';
                $sth = $dbh->prepare($sql);
                $sth->execute(array($permission_id));
                $restemp = $sth->fetchAll(PDO::FETCH_ASSOC);
                if ($restemp) {
                    foreach($restemp as $pid) {
                        array_push($res[$i]['profiles'], $pid['profile_id']);
                    }
                }
            }
        }
        return $response->withJson($res);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * GET /cti/paramurls { url: string, profiles: array, only_queue: boolean }
 */
$app->get('/cti/paramurls', function (Request $request, Response $response, $args) {
  try {
      $dbh = FreePBX::Database();
      $sql = 'SELECT * FROM rest_cti_profiles_paramurl';
      $sth = $dbh->prepare($sql);
      $sth->execute();
      $res = $sth->fetchAll(PDO::FETCH_ASSOC);
      if (sizeof($res) == 0) {
        return $response->withJson($res);
      }
      $sql = 'SELECT id, url, group_concat(profile_id) AS profiles, only_queues FROM rest_cti_profiles_paramurl GROUP BY url';
      $sth = $dbh->prepare($sql);
      $sth->execute();
      $res = $sth->fetchAll(PDO::FETCH_ASSOC);
      for ($i = 0; $i < count($res); $i++) {
        if ($res[$i]["only_queues"] == "1") {
          $res[$i]["only_queues"] = true;
        } else {
          $res[$i]["only_queues"] = false;
        }
      }
      return $response->withJson($res);
  } catch (Exception $e) {
      error_log($e->getMessage());
      return $response->withStatus(500);
  }
});

/*
 * PUT /cti/streaming/:descr { descr: string, exten: string, frame-rate: string, open: string, secret: string, url: string, user: string }
 */
$app->put('/cti/streaming/{descr}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $data = $request->getParsedBody();
        $currentDescr = $data['currentDescr'];
        $name = $data['descr'];
        $url = $data['url'];
        $exten = $data['exten'];
        $open = $data['open'];
        $profiles = $data['profiles'];
        $dbi = FreePBX::Database();

        // update into cti permissions
        $permname = 'vs_'. strtolower(str_replace(' ', '_', preg_replace('/[^a-zA-Z0-9\s]/','',$name)));
        $sql = 'UPDATE rest_cti_permissions SET name=?, displayname=?, description=? WHERE displayname=?';
        $sth = $dbi->prepare($sql);
        $res = $sth->execute(array($permname, $name, 'Enable the video source for this profile', $currentDescr));

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }

        $sql = 'SELECT id FROM rest_cti_permissions WHERE name=?';
        $sth = $dbi->prepare($sql);
        $sth->execute(array($permname));
        $res = $sth->fetchObject();
        $permission_id = null;

        if ($res) {
            $permission_id = $res->id;
        } else {
            throw new Exception('no permission stored for customer card');
        }

        // skip the update permission to streaming macro permission: remain inaltered

        // update permission for profiles
        $sql = 'DELETE FROM rest_cti_profiles_permissions WHERE permission_id=?';
        $sth = $dbi->prepare($sql);
        $res = $sth->execute(array($permission_id));
        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }
        $sql = 'INSERT INTO rest_cti_profiles_permissions VALUES(?, ?)';
        $sth = $dbi->prepare($sql);
        foreach ($profiles as $p) {
            $res = $sth->execute(array($p, $permission_id));

            if ($res === FALSE) {
                throw new Exception($sth->errorInfo()[2]);
            }
        }

        $dbh = FreePBX::Database();
        $sql = 'UPDATE rest_cti_streaming SET descr=?, url=?, exten=?, open=? WHERE descr=?';
        $sth = $dbh->prepare($sql);
        $res = $sth->execute(array($name, $url, $exten, $open, $currentDescr));

        if ($res === FALSE) {
            $sql = 'DELETE FROM rest_cti_permissions WHERE id = ?';
            $sth = $dbi->prepare($sql);
            $res = $sth->execute(array($permission_id));

            throw new Exception($sth->errorInfo()[2]);
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return $response->withStatus(200);

    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * POST /cti/streaming {"name": string,"url": string, "user": string,"secret": string,"framerate": int,"exten": int,"open": string}
*/
$app->post('/cti/streaming', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $data = $request->getParsedBody();

        $name = $data['descr'];
        $url = $data['url'];
        $exten = $data['exten'];
        $open = $data['open'];
        $profiles = $data['profiles'];

        $dbi = FreePBX::Database();
        // Insert into cti permissions
        $permname = 'vs_'. strtolower(str_replace(' ', '_', preg_replace('/[^a-zA-Z0-9\s]/','',$name)));
        $sql = 'INSERT INTO rest_cti_permissions(name, displayname, description) VALUES (?, ?, ?)';
        $sth = $dbi->prepare($sql);
        $res = $sth->execute(array($permname, $name, 'Enable the video source for this profile'));

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }

        $sql = 'SELECT id FROM rest_cti_permissions WHERE name = ?';
        $sth = $dbi->prepare($sql);
        $sth->execute(array($permname));
        $res = $sth->fetchObject();
        $permission_id = null;

        if ($res) {
            $permission_id = $res->id;
        } else {
            throw new Exception('no permission stored for customer card');
        }

        // Add permission to streaming macro permission
        $sql = 'INSERT INTO rest_cti_macro_permissions_permissions'.
            ' SELECT id, ? FROM rest_cti_macro_permissions WHERE name = ?';
        $sth = $dbi->prepare($sql);
        $res = $sth->execute(array($permission_id, 'streaming'));

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }

        // Enable permission for profiles
        $sql = 'INSERT INTO rest_cti_profiles_permissions VALUES(?, ?)';
        $sth = $dbi->prepare($sql);
        foreach ($profiles as $p) {
            $res = $sth->execute(array($p, $permission_id));

            if ($res === FALSE) {
                throw new Exception($sth->errorInfo()[2]);
            }
        }

        $dbh = FreePBX::Database();
        $res = $sql = 'INSERT INTO rest_cti_streaming(descr, url, exten, open) VALUES (?, ?, ?, ?)';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($name, $url, $exten, $open));

        if ($res === FALSE) {
            $sql = 'DELETE FROM rest_cti_permissions WHERE id = ?';
            $sth = $dbi->prepare($sql);
            $res = $sth->execute(array($permission_id));

            throw new Exception($sth->errorInfo()[2]);
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

$app->post('/cti/sources/test', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $data = $request->getParsedBody();

        $url = $data['url'];

        $curl = curl_init($url);
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true );
        $ret_val = curl_exec($curl);

        if (strpos($ret_val, '<!DOCTYPE html PUBLIC') !== false || $ret_val === false) {
            return $response->withStatus(500);
        } else {
            $b64_image_data =  chunk_split(base64_encode($ret_val));
            curl_close($curl);
            return $response->withJson($b64_image_data);
        }
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
 * DELETE /cti/streaming/:name
*/
$app->delete('/cti/streaming/{name}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $name = $route->getArgument('name');

        $dbi = FreePBX::Database();
        $sql = 'DELETE FROM rest_cti_permissions WHERE name = ?';
        $sth = $dbi->prepare($sql);
        $sth->execute(array('vs_'. strtolower(str_replace(' ', '_', preg_replace('/[^a-zA-Z0-9\s]/','',$name)))));

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }

        $sql = 'DELETE FROM rest_cti_streaming WHERE descr = ?';
        $sth = $dbi->prepare($sql);
        $sth->execute(array($name));

        if ($res === FALSE) {
            throw new Exception($sth->errorInfo()[2]);
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

