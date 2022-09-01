<?php

require_once 'config.inc.php';
require_once 'utils.inc.php';

class QueueParamsEvent
{
    public $queue;
    public $max;
    public $calls;
    public $holdtime;
    public $completed;
    public $abandoned;
    public $serviceLevel;
    public $servicelevelPerf;
    public $weight;
}

class QueueMemberEvent
{
    public $queue;
    public $location;
    public $membership;
    public $penalty;
    public $callsTaken;
    public $lastCall;
    public $status;
    public $paused;
}

//estrae da una stringa il valore della variabile
function getValue($str)
{
    $tmp = explode(':', $str);

    return trim($tmp[1]);
}

function read_file($filename)
{
    $fd = fopen($filename, 'r');
    if (!$fd) {
        return null;
    }

    while (!feof($fd)) {
        $str = fgets($fd, 512);
        if (trim($str) == '') { //quando incontriamo una riga vuota, sinigfica che e' una nuova risposta
            $responses[] = trim($response);
            $response = '';
        } else {
            $response .= $str;
        }
    }
    fclose($fd);

    return $responses;
}

function print_nome($nome)
{
    echo '<td>';
    $i = strpos($nome, '/');
    $j = strpos($nome, '@');
    if ($i > 0 && $j > 0) {
        ++$i;
        echo substr($nome, $i, $j - $i);
    } else {
        echo $nome;
    }
    echo '</td>';
}

function print_last_call($time)
{
    echo '<td>';
    if ($time) {
        echo date('H:m:s', $time);
    } else {
        echo '-';
    }
    echo '</td>';
}

function print_status($status)
{
    echo '<td ';
    switch ($status) {
        case '0':
        case '1':
            echo " class='available'>Disponibile"; //agente statico disponbile -> verde
            break;
        case '2':
            echo " class='occupied'>Occupato"; //agente dinamico non disponibile -> rosso
            break;
        case AGENT_NOT_LOGGED:
            echo "  class='nologged'>Non disponibile"; //non loggato -> grigio
            break;
        case '6':
            echo "  class='ringing'>Squillando"; //blinking
            break;
        default:
        case '3':
        case '4':
            echo '>-';
    }
    echo '</td>';
}

function getAsteriskQueue($show = '')
{
    if ($show != '') { //invocazione con click
        $display = explode('|', $show);
        $_SESSION['showLogged'] = $display[0];
        $_SESSION['showNoLogged'] = $display[1];
        qdebug($_SESSION);
    } else { //invocazione da timer
        $time = filemtime(ASTERISK_FILE);
        if (!$time) {
            return $_SESSION['queueStatus'];
        }
        //Se il file non è stato modificato, ritorniamo l'ultimo risultato disponibile
        if ($time <= $_SESSION['lastOpen']) {
            return $_SESSION['queueStatus'];
        }

        $_SESSION['lastOpen'] = $time;

        if (!isset($_SESSION['showLogged'])) {
            $_SESSION['showLogged'] = 'false';
        }
        if (!isset($_SESSION['showNoLogged'])) {
            $_SESSION['showNoLogged'] = 'false';
        }
    }

    $responses = read_file(ASTERISK_FILE);
    foreach ($responses as $response) {
        $resp = explode("\n", $response);
        if (strpos($resp[0], 'QueueMember') !== false) {
            $event = new QueueMemberEvent();
            $event->queue = getValue($resp[1]);
            $event->location = getValue($resp[2]);
            $event->membership = getValue($resp[3]);
            $event->penalty = getValue($resp[4]);
            $event->callsTaken = getValue($resp[5]);
            $event->lastCall = getValue($resp[6]);
            $event->status = getValue($resp[7]);
            $event->paused = getValue($resp[8]);

            if ($event->status == AGENT_NOT_LOGGED) {
                $QMeventsNL[] = $event;
            } else {
                $QMevents[] = $event;
            }
        } elseif (strpos($resp[0], 'QueueParams') !== false) {
            $event = new QueueParamsEvent();
            $event->queue = getValue($resp[1]);
            $event->max = getValue($resp[2]);
            $event->calls = getValue($resp[3]);
            $event->holdtime = getValue($resp[4]);
            $event->completed = getValue($resp[5]);
            $event->abandoned = getValue($resp[6]);
            $event->serviceLevel = getValue($resp[7]);
            $event->servicelevelPerf = getValue($resp[8]);
            $event->weight = getValue($resp[9]);
            $QPevents[] = $event;
        }
    }

    ob_start();

//   echo "<div style='text-align: right; color:#46510F;'>Ultimo aggiornamento: <span style='color: black'>".date("d-m-Y H:m:s",$_SESSION['lastOpen'])."</span></div>";
    echo '<br/>';

//   echo "<table class='coda'><caption  class='coda'>Code</caption><tr><th class='coda'>Coda</th><th class='coda'>In coda</th><th class='coda'>Abbandoni</th><th class='coda'>Completate</th></tr>";
    echo "<center><table class='coda'><caption  class='coda'>Code</caption><tr><th class='coda'>Coda</th><th class='coda'>In coda</th></tr>";
    $class = false;
    foreach ($QPevents as $QPevent) {
        echo "<tr class='coda'>";
        echo '<td >' . $QPevent->queue . '</td>';
        echo '<td >' . (int) $QPevent->calls . '</td>';
//     echo "<td>".(int)$QPevent->abandoned."</td>";
        //     echo "<td>".(int)$QMevent->completed."</td>";
        echo "</tr>\n";
        $class = !$class;
    }
    echo '</table></center>';

    if ($_SESSION['showLogged'] == 'false' || !(isset($_SESSION['showLogged']))) {
        echo "<center><br/><a class='showPopup' href=\"javascript:getAsteriskQueue('true|{$_SESSION['showNoLogged']}','target=status,preload=listing');\">Visualizza agenti collegati</a></center>";
    } else {
        echo "<center><br/><a class='showPopup' href=\"javascript:getAsteriskQueue('false|{$_SESSION['showNoLogged']}','target=status,preload=listing');\">Nascondi agenti collegati</a></center>";
    }

    if ($_SESSION['showLogged'] == 'true') {
        echo "<div id='logged'><table class='coda' ><caption class='coda'>Agenti collegati</caption><tr><th class='coda'>Nome</th><th class='coda'>Coda</th><th class='coda'>Stato</th><th class='coda'>Chiam. prese</th><th class='coda'>Ultima chiam.</th></tr>";
        foreach ($QMevents as $QMevent) {
            echo '<tr>';
            print_nome($QMevent->location);
            echo '<td>' . $QMevent->queue . '</td>';
            print_status($QMevent->status);
            echo '<td>' . (int) $QMevent->callsTaken . '</td>';
            print_last_call((int) $QMevent->lastCall);
            echo '</tr>';
            $class = !$class;
        }
        echo '</table></div>';
    }

    if ($_SESSION['showNoLogged'] == 'false' || !(isset($_SESSION['showNoLogged']))) {
        echo "<center><br/><a class='showPopup' href=\"javascript:getAsteriskQueue('{$_SESSION['showLogged']}|true','target=status,preload=listing');\">Visualizza agenti scollegati</a><br/></center>";
    } else {
        echo "<center><br/><a class='showPopup' href=\"javascript:getAsteriskQueue('{$_SESSION['showLogged']}|false','target=status,preload=listing');\">Nascondi agenti scollegati</a><br/></center>";
    }

    if ($_SESSION['showNoLogged'] == 'true') {
        echo "<div id='noLogged'><table class='coda'><caption class='coda'>Agenti scollegati</caption><tr><th class='coda'>Nome</th><th class='coda'>Coda</th><th class='coda'>Chiamate prese</th><th class='coda'>Ultima chiamata</th></tr>";
        foreach ($QMeventsNL as $QMevent) {
            echo '<tr>';
            print_nome($QMevent->location);
            echo '<td>' . $QMevent->queue . '</td>';
            //     print_status($QMevent->status);
            echo '<td>' . (int) $QMevent->callsTaken . '</td>';
            echo '<td>' . (int) $QMevent->lastCall . '</td>';
            echo '</tr>';
            $class = !$class;
        }
        echo '</table></div>';
    }

    $html = ob_get_contents();

    ob_end_clean();
    $_SESSION['queueStatus'] = $html;

    return $html;
}
