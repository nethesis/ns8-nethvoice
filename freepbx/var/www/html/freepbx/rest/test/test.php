<?php

include_once('/etc/freepbx.conf');
include_once('/var/www/html/freepbx/rest/config.inc.php');
include_once('vendor/autoload.php');

$secretkey = $config['settings']['secretkey'];
$password_sha1 = $db->getOne("select password_sha1 from ampusers where username = 'admin'");
$user = 'admin';

$secretkey = sha1($user . $password_sha1 . $secretkey);
$errors = array();
$verbose = false;
foreach ($argv as $arg) {
    if ($arg == '-v') {
        $verbose = true;
    } 
}

/*
Doing curl with php curl class
https://github.com/php-curl-class/php-curl-class
*/
use \Curl\Curl;

/* Test login*/
$test = 'Login';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->get('https://localhost/freepbx/rest/login');

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/* Set unified communication mode*/
$test = 'Set UC mode';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->post('https://localhost/freepbx/rest/configuration/mode',array('mode' => 'uc'));

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
        echo 'Response:' . "\n";
        print_r($curl->response);
    }
    echo "\n################################\n";
}

$rand_ext = rand(1000,9999);
$rand_user_name = 'testuser' . $rand_ext;

/* Create user*/
$test = 'Create user';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->post('https://localhost/freepbx/rest/users',array('fullname' => 'Test User '.$rand_user_name, 'username' => $rand_user_name));

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/* Set password to user */
$test = 'Set password';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->post('https://localhost/freepbx/rest/users/'.$rand_user_name.'/password',array('password' => 'testpassword'));

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/* Check user has been created */
$test = 'User created';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->get('https://localhost/freepbx/rest/users/true');

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    $t = false;
    foreach ($curl->response as $u) {
        if ($u->username == $rand_user_name) {
            $t = true;
        }
    }
    if ($t) {
        echo "$test OK!" . "\n";
        if ($verbose) {
            echo 'Response:' . "\n";
            print_r($curl->response);
        }
        echo "\n################################\n";
    } else {
        $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
        echo "$error\n";
        $errors[] = $error;
    }
}

/* count users */
$test = 'Count users';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->get('https://localhost/freepbx/rest/users/count');

if ($curl->error || $curl->response < 1 ) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}


/* Main extension for user */
$test = 'Add mainextension';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->post('https://localhost/freepbx/rest/mainextensions', array('extension' => $rand_ext, 'username' => $rand_user_name));

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/* Go on with wizard steps*/
$test = 'go on with wizard steps';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->post('https://localhost/freepbx/rest/configuration/wizard', array('status'=>true,'step',2));

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

$rand_group_name = 'Group ' . rand(0,99999);
/* Create NethCTI group */
$test = 'Create NethCTI group';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->post('https://localhost/freepbx/rest/cti/groups', array('name'=>$rand_group_name));

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/* Check group has been created */
$test = 'Group created';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->get('https://localhost/freepbx/rest/cti/groups');

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    $t = false;
    foreach ($curl->response as $g) {
        if ($g->name == $rand_group_name) {
            $t = true;
        }
    }
    if ($t) {
        echo "$test OK!" . "\n";
        if ($verbose) {
            echo 'Response:' . "\n";
            print_r($curl->response);
        }
        echo "\n################################\n";
    } else {
        $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
        echo "$error\n";
        $errors[] = $error;
    }
}

/*TODO add CTI profiles test here*/

/*TODO add scan test here*/

/* Enable WebRTC extension for user */
$test = 'Enable WebRTC extension for user';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->post('https://localhost/freepbx/rest/webrtc', array('extension'=>$rand_ext));

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/* Get created WebRTC extension */
$test = 'get webrtc extension';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->get('https://localhost/freepbx/rest/webrtc/'.$rand_ext);

if ($curl->error || $curl->response != $rand_ext ) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/* Set CTI profile */
$test = 'Set CTI profile';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->post('https://localhost/freepbx/rest/cti/profiles/users/'.$rand_ext, array('profile_id'=>3));

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/* Set CTI group*/
$test = 'Set CTI profile';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->post('https://localhost/freepbx/rest/cti/groups/users/'.$rand_ext, array('0'=>1));

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/* Add custom physical extension */
$test = 'Add custom physical extension';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->post('https://localhost/freepbx/rest/physicalextensions', array(
        'line' => null,
        'mac' => null,
        'mainextension' => $rand_ext,
        'model' => null,
        'web_password' => 'admin',
        'web_user' => 'admin'
    ));

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/*Check custom physical extension has been created*/
$test = 'Check custom physical extension has been created';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->get('https://localhost/freepbx/rest/devices/phones/list');

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    $t = false;
    foreach ($curl->response as $p) {
        if ($p->model == 'custom' && $p->lines[0]->mainextension == $rand_ext) {
            $t = true;
            $custom_created_extension = $p->lines[0]->extension;
        }
    }
    if ($t) {
        echo "$test OK!" . "\n";
        if ($verbose) {
            echo 'Response:' . "\n";
            print_r($curl->response);
        }
        echo "\n################################\n";
    } else {
        $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
        echo "$error\n";
        $errors[] = $error;
    }
}

/*Delete physical extension*/
$test = 'Delete physical extension';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->delete('https://localhost/freepbx/rest/physicalextensions/'.$custom_created_extension);

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/*Check custom physical extension has been deleted*/
$test = 'Check custom physical extension has been deleted';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->get('https://localhost/freepbx/rest/devices/phones/list');

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    $t = false;
    foreach ($curl->response as $p) {
        if ($p->model == 'custom' && $p->lines[0]->mainextension == $rand_ext) {
            $t = true;
            $custom_created_extension = $p->lines[0]->extension;
        }
    }
    if (!$t) {
        echo "$test OK!" . "\n";
        if ($verbose) {
            echo 'Response:' . "\n";
            print_r($curl->response);
        }
        echo "\n################################\n";
    } else {
        $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
        echo "$error\n";
        $errors[] = $error;
    }
}

/* TODO create and provision physical extension */

$rand_mac = rand(10,99).":".rand(10,99).":".rand(10,99).":".rand(10,99).":".rand(10,99).":".rand(10,99);
/* Add gateway*/
$test = 'Add gateway';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);

//get gateway id from name
$sql = 'SELECT id FROM `gateway_models` WHERE `manufacturer` = "Sangoma" AND `model` = "Vega_60_2isdn"';
$model_id = \FreePBX::Database()->sql($sql, 'getAll')[0][0];

$curl->post('https://localhost/freepbx/rest/devices/gateways', array(
        "network_key" => "eth0",
        "network" => "192.168.122.0",
        "ipv4_new" => "192.168.122.123",
        "ipv4_green" => "192.168.122.74",
        "gateway" => "192.168.122.1",
        "netmask_green" => "255.255.255.0",
        "manufacturer" => "Sangoma",
        "name" => "Sangoma-Vega 60 2 Porte ISDN",
        "model" => $model_id,
        "trunks_isdn" => array(array("name"=>1,"type" => "pp"),array("name"=>2,"type" => "pp")),
        "trunks_pri" => array(),
        "trunks_fxo" => array(),
        "trunks_fxs" => array(),
        "mac" => $rand_mac,
        "ipv4" => "192.168.122.123"
    ));

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/*Check that gateway has been created.*/
$test = 'Check gateway has been created';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->get('https://localhost/freepbx/rest/devices/gateways/list/foo');

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    $t = false;
    foreach ($curl->response as $gw) {
        if ($gw->model_id == $model_id && $gw->mac == $rand_mac) {
            $gateway_id = $gw->id; //Save gateway id for delete
            $t = true;
        }
    }
    if ($t) {
        echo "$test OK!" . "\n";
        if ($verbose) {
            echo 'Response:' . "\n";
            print_r($curl->response);
        }
        echo "\n################################\n";
    } else {
        $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
        echo "$error\n";
        $errors[] = $error;
    }
}

/*Check trunks has been created. Two trunks should have been created*/
$test = 'Check trunks has been created';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->get('https://localhost/freepbx/rest/trunks');

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    $t = 0;
    foreach ($curl->response as $trunk) {
        if ($trunk->channelid == 'Sangoma_'.substr(str_replace(':','',$rand_mac),-6,6).'_isdn_1' || $trunk->channelid == 'Sangoma_'.substr(str_replace(':','',$rand_mac),-6,6).'_isdn_2') {
            $t += 1;
        }
    }
    if ($t == 2) {
        echo "$test OK!" . "\n";
        if ($verbose) {
            echo 'Response:' . "\n";
            print_r($curl->response);
        }
        echo "\n################################\n";
    } else {
        $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
        echo "$error\n";
        $errors[] = $error;
    }
}

/*Check gw file creation*/
$test = 'Check gw file creation';
if (file_exists('/var/lib/tftpboot/'.str_replace(':','',$rand_mac).'config.txt') && file_exists('/var/lib/tftpboot/'.str_replace(':','',$rand_mac).'script.txt')) {
    echo "$test OK!" . "\n";
    echo "\n################################\n";
} else {
    echo system('ls -l /var/lib/tftpboot/');
    $error = "$test FAIL! " . 'Error: ' . "Can't find gateway configuration files" . "\n";
    echo "$error\n";
    $errors[] = $error;
}

/*Delete gateway*/
$test = 'Delete gateway';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->delete('https://localhost/freepbx/rest/devices/gateways/'.$gateway_id);

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    echo "$test OK!" . "\n";
    if ($verbose) {
            echo 'Response:' . "\n";
        print_r($curl->response);
        }
    echo "\n################################\n";
}

/*Check trunks has been deleted*/
$test = 'Check trunks has been deleted';
$curl = new Curl();
$curl->setOpt(CURLOPT_SSL_VERIFYPEER, false);
$curl->setHeader('SecretKey', $secretkey);
$curl->setHeader('User', $user);
$curl->get('https://localhost/freepbx/rest/trunks');

if ($curl->error) {
    $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
    echo "$error\n";
    $errors[] = $error;
} else {
    $t = 0;
    foreach ($curl->response as $trunk) {
        if ($trunk->channelid == 'Sangoma_'.substr(str_replace(':','',$rand_mac),-6,6).'_isdn_1' || $trunk->channelid == 'Sangoma_'.substr(str_replace(':','',$rand_mac),-6,6).'_isdn_2') {
            $t += 1;
        }
    }
    if ($t == 0) {
        echo "$test OK!" . "\n";
        if ($verbose) {
            echo 'Response:' . "\n";
            print_r($curl->response);
        }
        echo "\n################################\n";
    } else {
        $error = "$test FAIL! " . 'Error: ' . $curl->errorCode . ': ' . $curl->errorMessage . "\n";
        echo "$error\n";
        $errors[] = $error;
    }
}

/*TODO Create VoIP trunk*/

/*TODO Create outbound routes*/

/*TODO Check report*/


/*
Check VisualPlan functions
*/

// TODO announcement_add
// TODO announcement_edit
// TODO announcement_get

// conferences_add
// conferences_get
// conferences_del
$test = 'Conferences add/get/del';
try {
    conferences_add(333, 'FoooConference','','','');

    $conference = conferences_get(333);

    if (empty($conference)) {
        throw new Exception('Error getting created conference');
    }

    conferences_del(333);

    $conference = conferences_get(333);
    if (!empty($conference)) {
        throw new Exception('Conference is still here after delete');
    }

    echo "$test OK!" . "\n";
    echo "\n################################\n";
} catch (Exception $e) {
    $error = "$test FAIL! " . 'Error: ' . $e->getMessage() . "\n";
    echo "$error\n";
    $errors[] = $error;
}

// core_did_add
// core_did_get
// core_did_del
$test = "Core DID add/get/del";
try {
    core_did_add(array(
        "extension" => 192837465,
        "cidnum" => 192837465,
        "alertinfo" => "<http://www.notused >\;info=ring2",
        "description" => 'Test DID',
        "destination" => 'app-blackhole,hangup,1',
        "mohclass" => "default"
    ), 'app-blackhole,hangup,1');

    $results = core_did_get(192837465,192837465);

    if (empty($results)) {
        throw new Exception('Can\'t get just created DID');
    }

    core_did_del(192837465,192837465);

    $results2 = core_did_get(192837465,192837465);

    if (!empty($results2)) {
        throw new Exception('Failed to remove DID');
    }

    echo "$test OK!" . "\n";
    if ($verbose) {
        echo 'Response:' . "\n";
        print_r($results);
    }

    echo "\n################################\n";
} catch (Exception $e) {
    $error = "$test FAIL! " . 'Error: ' . $e->getMessage() . "\n";
    echo "$error\n";
    $errors[] = $error;
}

// ivr_save_details
// ivr_save_entries
// ivr_get_details
// ivr_get_entries
$test = "IVR save/get details/entries";
try {
    $idIVR = ivr_save_details(array(
                        "name" => 'testIVR',
                        "description" => "Test IVR",
                        "announcement" => '',

                        "directdial" => 0,
                        "invalid_loops" => 0,
                        "invalid_retry_recording" => 0,

                        "invalid_destination" => 'app-blackhole,hangup,1',

                        "invalid_recording" => 0,
                        "retvm" => 0,
                        "timeout_time" => 10,
                        "timeout_recording" => 0,
                        "timeout_retry_recording" => 0,

                        "timeout_destination" => 'app-blackhole,hangup,1',

                        "timeout_loops" => 0,
                        "timeout_append_announce" => 0,
                        "invalid_append_announce" => 0,
                    ));
    $created = false;
    foreach (ivr_get_details() as $r) {
        if ($r['name'] === 'testIVR') {
            $created = true;
            break;
        }
    }

    if (!$created) {
        throw new Exception('Can\'t get just created IVR');
    }

    foreach (FreePBX::Ivr()->getDetails() as $ivr){
        if ($ivr['name'] == 'testIVR');
        $id = $ivr['id'];
        break;
    }

    # add IVR entries
    $ivrArray = array();
    $ivrArray['ivr_ret'] = array();
    $ivrArray['ext'] = array(1,2);
    $ivrArray['goto'] = array('app-blackhole,hangup,1','app-blackhole,hangup,1');

    ivr_save_entries($id,$ivrArray);

    $entries = ivr_get_entries($id);

    if (empty($entries)) {
        throw new Exception('Failed to get entries');
    }

    ivr_delete($id);

    echo "$test OK!" . "\n";
    if ($verbose) {
        echo 'Response:' . "\n";
        print_r($results);
        print_r($entries);
    }

    echo "\n################################\n";
} catch (Exception $e) {
    $error = "$test FAIL! " . 'Error: ' . $e->getMessage() . "\n";
    echo "$error\n";
    $errors[] = $error;
}

// nethcqr_get_details
// nethcqr_get_entries
// nethcqr_save_details
// nethcqr_save_entries
$test = "NethCQR save/get details/entries";
try {

    $idCQR = nethcqr_save_details(array(
        "name" => 'testCQR',
        "description" => 'Test CQR created by automatic testing',
        "announcement" => '',
        "use_code" => "on",
        "use_workphone" => "on",
        "manual_code" => "on",
        "cod_cli_announcement" => "",
        "err_announcement" => "",
        "code_length" => 5,
        "code_retries" => 3,
        "default_destination" => 'app-blackhole,hangup,1',
        "db_type" => "mysql",
        "db_url" => "localhost",
        "db_name" => "",
        "db_user" => "",
        "db_pass" => "",
        "query" => "",
        "cc_db_type" => "mysql",
        "cc_db_url" => "localhost",
        "cc_db_name" => "",
        "cc_db_user" => "",
        "cc_db_pass" => "",
        "cc_query" => "",
        "ccc_query" => ""
    ));

    $cqr = nethcqr_get_details($idCQR);
    if (!is_array($cqr) || !is_array($cqr[0]) || $cqr[0]['name'] != 'testCQR' ) {
        throw new Exception('Can\'t get just created CQR');
    }


    # add CQR entries
    $cqrArray['position'] = array(1,2,3);
    $cqrArray['condition'] = array(1,2,3);
    $cqrArray['goto'] = array('app-blackhole,hangup,1','app-blackhole,hangup,1','app-blackhole,hangup,1');
    nethcqr_save_entries($idCQR,$cqrArray);

    $entries = nethcqr_get_entries($idCQR);

    if (empty($entries)) {
        throw new Exception('Failed to get entries');
    }

    nethcqr_delete($idCQR);

    echo "$test OK!" . "\n";
    if ($verbose) {
        echo 'Response:' . "\n";
        print_r($cqr);
        print_r($entries);
    }

    echo "\n################################\n";
} catch (Exception $e) {
    $error = "$test FAIL! " . 'Error: ' . $e->getMessage() . "\n";
    echo "$error\n";
    $errors[] = $error;
}

// queues_add
// queues_get
// queues_del
$test = 'Queues add/get/del';
try {
    queues_add(900, 'testQueue', "", "", 'app-blackhole,hangup,1', "", array(), "", 30, "", "", "", "", "0", array(), "", "", "", "", "", "", "", "", "");
    $queue = queues_get(900);

    if (empty($queue)) {
        throw new Exception('Error getting created queue');
    }

    queues_del(900);

    $res = queues_get(900);
    if (!empty($res)) {
        throw new Exception('Queue is still here after delete');
    }

    echo "$test OK!" . "\n";
    if ($verbose) {
        echo 'Response:' . "\n";
        print_r($queue);
    }
    echo "\n################################\n";
} catch (Exception $e) {
    $error = "$test FAIL! " . 'Error: ' . $e->getMessage() . "\n";
    echo "$error\n";
    $errors[] = $error;
}


// TODO recordings_get

// ringgroups_add
// ringgroups_get
// ringgroups_del
$test = 'Ringgroups add/get/del';
try {
    ringgroups_add(999, 'random', 420, array($rand_ext), 'app-blackhole,hangup,1', 'testgroup', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '');

    $group = ringgroups_get(999);

    if (empty($group)) {
        throw new Exception('Error getting created group');
    }

    ringgroups_del(999);

    $res = ringgroups_get(999);
    if (isset($res['grpnum'])) {
        throw new Exception('Group is still here after delete');
    }

    echo "$test OK!" . "\n";
    if ($verbose) {
        echo 'Response:' . "\n";
        print_r($group);
    }
    echo "\n################################\n";
} catch (Exception $e) {
    $error = "$test FAIL! " . 'Error: ' . $e->getMessage() . "\n";
    echo "$error\n";
    $errors[] = $error;
}



// TODO timeconditions_add
// TODO timeconditions_edit
// TODO timeconditions_get
// TODO voicemail_mailbox_add
// TODO voicemail_mailbox_get
// TODO FreePBX::Announcement()->getAnnouncements()
// TODO FreePBX::Conferences()->listConferences()
// TODO FreePBX::Core()->listUsers(false)
// TODO FreePBX::Ivr()->getDetails()
// TODO FreePBX::Queues()->listQueues(false)
// TODO FreePBX::Recordings()->getAllRecordings(true)
// TODO FreePBX::Ringgroups()->listRinggroups(false)
// TODO FreePBX::Timeconditions()->listTimeconditions(false)
// TODO FreePBX::Timeconditions()->listTimegroups()










/*
Output errors
*/

if (empty($errors)) {
    echo "\nAll tests succesful!\n";
    exit (0);
} else {
    echo "Some tests failed:\n";
    foreach ($errors as $error) {
        echo "$error\n";
    }
    exit (255);
}



