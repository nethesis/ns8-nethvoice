<?php
require_once 'config.inc.php';

//require_once utilities function
require_once 'utils.inc.php';

function getGraficiCarico()
{
    global $dbcdr;
    ob_start();

    //## Start filter
    $where = filter();

    $select_field = select();
    $group_by = ' GROUP BY qdescr,period ';

    $query_totali = "SELECT $select_field, qdescr, count(id) as count from report_queue $where true $group_by ORDER BY timestamp_in";
    //evita warning sul tipo
    $queues = array();
    $periods = array();

    foreach ($dbcdr->getAll($query_totali, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $totali[$row[1]][$row[0]] = $row[2]; //numero totali per periodo/coda
        if ($row[1] != '' && !in_array($row[1], $queues)) {
            $queues[] = $row[1];
        }
        if ($row[0] != '' && !in_array($row[0], $periods)) {
            $periods[] = $row[0];
        }
    }
    //nessun grafico
    if (sizeof($totali) == 0) {
        $html = ob_get_contents();
        ob_end_clean();

        return $html;
    }

    $to_draw = array();
    foreach ($queues as $queue) {
        // Create the graph
        $to_draw[] = array('id' => "totali$queue", 'label' => $queue, 'title' => '', 'data' => $totali[$queue]);
    }
    drawMultiLine("$queue$period", _('Call distribution over time'), $to_draw); //Distribuzione chiamate nel tempo
    echo '<br/><br/>';
    echo '<br/><br/>';?>
<div class='zone_filter'>
    <label for='zone_filter'><?php echo _('View by:');?><!--Visualizza per:--></label>
    <select class="ui dropdown" name='zone_filter' id='zone_filter'>
      <option value='regione'><?php echo _('Region');?><!--Regione--></option>
      <option value='siglaprov'><?php echo _('Area');?><!--Provincia--></option>
    </select>
    <input type='button' class="ui button" id='zone_submit' value="<?php echo _('Apply');?>"/><!--Applica-->
    <div class="ui divider"></div>
</div>

<?php
$zona = selectZone();
    $limit = 5;
    $queues = array();
    $zones = array();
    $totali = array();
    $query = "select $select_field,qdescr,replace($zona,'\'',' ') as $zona,count(*) as count from report_queue_callers $where true GROUP BY period,$zona,qdescr ORDER BY timestamp_in,count,qdescr;";
    //echo "$query<br/>";
    foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $zone = str_replace(' ', '_', $row[2]);
        $totali[$zone][$row[1]][$row[0]] = $row[3];
        if ($row[1] != '' && !in_array($row[1], $queues)) {
            $queues[] = $row[1];
        }
        if ($zone != '' && !in_array($zone, $zones)) {
            $zones[] = $zone;
        }
    }

    foreach ($zones as $zone) {
        $to_draw = array();
        foreach ($queues as $queue) {
            // Create the graph
            if (!isset($totali[$zone][$queue])) {
                continue;
            }
            $to_draw[] = array('id' => "totali$zone$queue", 'label' => $queue, 'title' => "$zone$queue", 'data' => $totali[$zone][$queue]);
        }
        drawMultiLine("totali$zone", _('Call distribution by area: ') . str_replace('_', ' ', $zone), $to_draw); //Distribuzione chiamate per zona:
        echo '<br/><br/>';
    }

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getGraficiCode()
{
    global $dbcdr;
    ob_start();

    //## Start filter
    $where = filter();
    $where_evase = $where . " true AND action='ANSWER' ";

    $where_inevase = $where . " true AND ((action='EXITWITHTIMEOUT') or (action='FULL') or (action='JOINEMPTY') or (action='EXITWITHKEY') or (action='EXITEMPTY') or (action='ABANDON' and hold>" . SEC_IGNORE . ')) ';

    $where_nongestite = $where . " true AND ((action='FULL') or (action='JOINEMPTY')) ";

    $where_nulle = $where . " true AND ((action='ABANDON' and hold<" . SEC_IGNORE . ')) ';

    $where_totali = $where . ' true ';

    $select_field = select();
    $group_by = ' GROUP BY qdescr,hour ';

    $query_evase = "SELECT qdescr, hour(from_unixtime(timestamp_in)) as hour, count(id) as count from report_queue $where_evase $group_by ORDER BY hour";
    $query_inevase = "SELECT qdescr, hour(from_unixtime(timestamp_in)) as hour, count(id) as count from report_queue $where_inevase $group_by ORDER BY hour";
    $query_nongestite = "SELECT qdescr, hour(from_unixtime(timestamp_in)) as hour, count(id) as count from report_queue $where_nongestite $group_by ORDER BY hour";
    $query_nulle = "SELECT qdescr, hour(from_unixtime(timestamp_in)) as hour, count(id) as count from report_queue $where_nulle $group_by ORDER BY hour";
    $query_totali = "SELECT qdescr, hour(from_unixtime(timestamp_in)) as hour, count(id) as count from report_queue $where_totali $group_by ORDER BY hour";

    //evita warning sul tipo
    $queues = array();

    foreach ($dbcdr->getAll($query_evase, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $evase[$row[0]][$row[1]] = $row[2]; //numer evase per coda
        if ($row[0] != '' && !in_array($row[0], $queues)) {
            $queues[] = $row[0];
        }
    }

    foreach ($dbcdr->getAll($query_inevase, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $inevase[$row[0]][$row[1]] = $row[2];
        if ($row[0] != '' && !in_array($row[0], $queues)) {
            $queues[] = $row[0];
        }
    }
  
    foreach ($dbcdr->getAll($query_nongestite, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $nongestite[$row[0]][$row[1]] = $row[2];
        if ($row[0] != '' && !in_array($row[0], $queues)) {
            $queues[] = $row[0];
        }
    }

    foreach ($dbcdr->getAll($query_nulle, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $nulle[$row[0]][$row[1]] = $row[2];
        if ($row[0] != '' && !in_array($row[0], $queues)) {
            $queues[] = $row[0];
        }
    }

    foreach ($dbcdr->getAll($query_totali, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $totali[$row[0]][$row[1]] = $row[2]; //numer evase per coda
        if ($row[0] != '' && !in_array($row[0], $queues)) {
            $queues[] = $row[0];
        }
    }

    //nessun grafico
    if (sizeof($evase) == 0 && sizeof($totali) == 0 && sizeof($inevase) == 0 && sizeof($nongestite) == 0 && sizeof($nulle) == 0) {
        echo _('No graphic to display'); //Nessun grafico da visualizzare
        $html = ob_get_contents();
        ob_end_clean();

        return $html;
    }

    //Ack per evitare errori nel grafico: si aggiungono le ore mancanti con valore pari a 0
    foreach ($queues as $queue) {
        $tmod = false;
        $emod = false;
        $imod = false;
        for ($i = ORA_INIZIO; $i <= ORA_FINE; ++$i) {
            if (!isset($totali[$queue][$i])) {
                $totali[$queue][$i] = 0;
                $tmod = true;
            }

            if (!isset($evase[$queue][$i])) {
                $evase[$queue][$i] = 0;
                $emod = true;
            }

            if (!isset($inevase[$queue][$i])) {
                $inevase[$queue][$i] = 0;
                $imod = true;
            }
          
            if (!isset($nongestite[$queue][$i])) {
                $nongestite[$queue][$i] = 0;
                $gmod = true;
            }

            if (!isset($nulle[$queue][$i])) {
                $nulle[$queue][$i] = 0;
                $nmod = true;
            }
        }
        //Se sono state aggiunte delle ore, è necessario riordinare l'array
        if ($imod) {
            ksort($inevase[$queue]);
        }
        if ($tmod) {
            ksort($totali[$queue]);
        }
        if ($emod) {
            ksort($evase[$queue]);
        }
        if ($gmod) {
            ksort($nongestite[$queue]);
        }
        if ($nmod) {
            ksort($nulle[$queue]);
        }
    }

    foreach ($queues as $queue) {
        $to_draw = array();
        // Create the graph
        //notifica che tutte le chiamate sono state evase
        if ($totali[$queue] == $evase[$queue]) {
            //  $g->subtitle->Set("Tutte le chiamate sono state evase");
        }

        if ($totali[$queue] && $totali[$queue] != $evase[$queue]) { //evitiamo di fare due linee sovrapposte
            unset($totali[$queue]['']); //eliminiamo le ore non valide
            if (sizeof($totali[$queue]) > 0) {
                $to_draw[] = array('id' => "totali$queue", 'label' => 'Totali', 'title' => _('Total calls'), 'data' => $totali[$queue]); //Chiamate totali
            }
        }
        if ($evase[$queue]) {
            unset($evase[$queue]['']); //eliminiamo le ore non valide
            if (sizeof($evase[$queue]) > 0) {
                $to_draw[] = array('id' => "evase$queue", 'label' => 'Evase', 'title' => _('Calls handled'), 'data' => $evase[$queue]); //Chiamate evase
            }
        }
        if ($inevase[$queue]) {
            unset($inevase[$queue]['']); //eliminiamo le ore non valide
            if (sizeof($inevase[$queue]) > 0) {
                $to_draw[] = array('id' => "inevase$queue", 'label' => 'Inevase', 'title' => _('Unanswered calls'), 'data' => $inevase[$queue]); //Chiamate inevasi
            }
        }
        if ($nongestite[$queue]) {
            unset($nongestite[$queue]['']); //eliminiamo le ore non valide
            if (sizeof($nongestite[$queue]) > 0) {
                $to_draw[] = array('id' => "nongestite$queue", 'label' => 'Nongestite', 'title' => _('Unmanaged calls'), 'data' => $nongestite[$queue]); //Chiamate nongestite
            }
        }

        if ($nulle[$queue]) {
            unset($nulle[$queue]['']); //eliminiamo le ore non valide
            if (sizeof($nulle[$queue]) > 0) {
                $to_draw[] = array('id' => "nulle$queue", 'label' => 'Nulle', 'title' => _('Null calls'), 'data' => $nulle[$queue]); //Chiamate nulle
            }
        }
        //visualizzazione delle immagine generate
        if (sizeof($inevase[$queue]) == 0 && sizeof($totali[$queue]) == 0 && sizeof($evase[$queue]) == 0 && sizeof($nongestite[$queue]) == 0 && sizeof($nulle[$queue]) == 0) {
            echo _('No graphic to display');
        } //Nessun grafico da visualizzare
        else {
            if ($_SESSION['filter'][1] == '') {
                drawMultiLine("$queue", sprintf(_('Distribution hourly calls - Queue: %s '), $queue), $to_draw);
            } else {
                drawMultiLine("$queue", sprintf(_('Distribution hourly calls - Queue: %s Date: : from '), $queue) . $_SESSION['filter'][1] . _(' to ') . $_SESSION['filter'][2], $to_draw);
            }
//Distribuzione oraria chiamate - Coda: $queue Data: : dal
        }
    }

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getGraficiAgente()
{
    global $dbcdr;
    ob_start();

    //## Start filter
    $where = filter();
    $where_evase = $where . " true AND action='ANSWER' ";

    $select_field = select();
    $group_by = ' GROUP BY qdescr,' . STR_AGENT . ' ';

    $query_evase = 'SELECT qdescr, ' . STR_AGENT . ", count(id) as count from report_queue $where_evase $group_by ORDER BY " . STR_AGENT;

    //evita warning sul tipo
    $queues = array();
    $agents = array();

    foreach ($dbcdr->getAll($query_evase, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $evase[$row[0]][$row[1]] = $row[2]; //numer evase per periodo/coda
        if ($row[0] != '' && !in_array($row[0], $queues)) {
            $queues[] = $row[0];
        }
        if ($row[1] != '' && !in_array($row[1], $agents)) {
            $agents[] = $row[1];
        }
    }

    //nessun grafico
    if (sizeof($evase) == 0) {
        echo _('No graphic to display'); //Nessun grafico da visualizzare
        $html = ob_get_contents();
        ob_end_clean();

        return $html;
    }

    foreach ($queues as $queue) {
        $to_draw = array();
        // Create the graph
        if (sizeof($evase[$queue] > 0)) {
            if ($_SESSION['filter'][1] == '') {
                drawBar("$queue", sprintf(_('Calls handled per agent - Queue: %s '), $queue), $evase[$queue]);
            } else {
                drawBar("$queue", sprintf(_('Calls handled per agent - Queue: %s Date: from '), $queue) . $_SESSION['filter'][1] . _(' to ') . $_SESSION['filter'][2], $evase[$queue]);
            }
        }
//chiamate evase per agente - Coda: $queue Data: dal
    }

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getGraficiPosCoda()
{
    global $dbcdr;
    ob_start();

    //## Start filter
    $where = filter();
    $where_totali = $where . ' true AND NOT action="FULL" ';

    $select_field = select();
    $group_by = ' GROUP BY qdescr,hour ';

    $query_totali = "SELECT qdescr, hour(from_unixtime(timestamp_in)) as hour, avg(position) as avg_position from report_queue $where_totali $group_by ORDER BY hour";

    //evita warning sul tipo
    $queues = array();

    foreach ($dbcdr->getAll($query_totali, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $totali[$row[0]][$row[1]] = $row[2];
        if ($row[0] != '' && !in_array($row[0], $queues)) {
            $queues[] = $row[0];
        }
    }

    //nessun grafico
    if (sizeof($queues) == 0) {
        echo _('No graphic to display'); //Nessun grafico da visualizzare
        $html = ob_get_contents();
        ob_end_clean();

        return $html;
    }

    //Ack per evitare errori nel grafico: si aggiungono le ore mancanti con valore pari a 0
    foreach ($queues as $queue) {
        $imod = false;
        $tmod = false;
        for ($i = ORA_INIZIO; $i <= ORA_FINE; ++$i) {
            if (!isset($totali[$queue][$i])) {
                $totali[$queue][$i] = 0;
                $tmod = true;
            }
        }
        //Se sono state aggiunte delle ore, è necessario riordinare l'array
        if ($tmod) {
            ksort($totali[$queue]);
        }
    }

    for ($i = ORA_INIZIO; $i <= ORA_FINE; ++$i) {
        $hours[] = $i;
    }

    foreach ($queues as $queue) {
        if ($totali[$queue]) {
            unset($totali[$queue]['']); //eliminiamo le ore non valide
            if (sizeof($totali[$queue]) > 0) {
                if ($_SESSION['filter'][1] == '') {
                    drawLine("$queue", sprintf(_('Hourly distribution queue access time - Queue: %s '), $queue), $totali[$queue]);
                } else {
                    drawLine("$queue", sprintf(_('Hourly distribution queue access time - Queue: %s - Date: from '), $queue) . $_SESSION['filter'][1] . _(' to ') . $_SESSION['filter'][2], $totali[$queue]);
                }
            } //Distribuzione oraria posizione di entrata in coda - Coda: $queue - Data: dal
        }
    }

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getGraficiAttesa()
{
    global $dbcdr;
    ob_start();

    //## Start filter
    $where = filter();
    $where_totali = $where . ' true AND NOT action="EXITWITHKEY" ';

    $group_by = ' GROUP BY qdescr,hour ';

    //prendo l aposizione di tutte
    $query_totali = "SELECT qdescr, hour(from_unixtime(timestamp_in)) as hour, avg(hold) as avg_hold from report_queue $where_totali $group_by ORDER BY hour";

    //evita warning sul tipo
    $queues = array();

    foreach ($dbcdr->getAll($query_totali, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $totali[$row[0]][$row[1]] = $row[2];
        if ($row[0] != '' && !in_array($row[0], $queues)) {
            $queues[] = $row[0];
        }
    }

    //nessun grafico
    if (sizeof($queues) == 0) {
        echo _('No graphic to display'); //Nessun grafico da visualizzare
        $html = ob_get_contents();
        ob_end_clean();

        return $html;
    }

    //Ack per evitare errori nel grafico: si aggiungono le ore mancanti con valore pari a 0
    foreach ($queues as $queue) {
        $imod = false;
        $tmod = false;
        for ($i = ORA_INIZIO; $i <= ORA_FINE; ++$i) {
            if (!isset($totali[$queue][$i])) {
                $totali[$queue][$i] = 0;
                $tmod = true;
            }
        }
        //Se sono state aggiunte delle ore, è necessario riordinare l'array
        if ($tmod) {
            ksort($totali[$queue]);
        }
    }

    for ($i = ORA_INIZIO; $i <= ORA_FINE; ++$i) {
        $hours[] = $i;
    }

    foreach ($queues as $queue) {
        if ($totali[$queue]) {
            unset($totali[$queue]['']); //eliminiamo le ore non valide
            if (sizeof($totali[$queue]) > 0) {
                if ($_SESSION['filter'][1] == '') {
                    drawLine("$queue", sprintf(_('Average wait hourly distribution - Queue: %s '), $queue), $totali[$queue]);
                } else {
                    drawLine("$queue", sprintf(_('Average wait hourly distribution - Queue: %s - Date: from '), $queue) . $_SESSION['filter'][1] . _(' to ') . $_SESSION['filter'][2], $totali[$queue]);
                }
            } //Distribuzione oraria attesa media - Coda: $queue - Data: dal
        }
    }

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getGraficiDurata()
{
    global $dbcdr;
    ob_start();

    //## Start filter
    $where = filter();
    $where_totali = $where . ' true AND NOT action="EXITWITHKEY" ';

    $select_field = select();
    $group_by = ' GROUP BY qdescr,hour ';

    //prendo l aposizione di tutte
    $query_totali = "SELECT qdescr, hour(from_unixtime(timestamp_in)) as hour, avg(duration) as avg_duration from report_queue $where_totali $group_by ORDER BY hour";

    //evita warning sul tipo
    $queues = array();

    foreach ($dbcdr->getAll($query_totali, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $totali[$row[0]][$row[1]] = $row[2];
        if ($row[0] != '' && !in_array($row[0], $queues)) {
            $queues[] = $row[0];
        }
    }

    //nessun grafico
    if (sizeof($queues) == 0) {
        echo _('No graphic to display'); //Nessun grafico da visualizzare
        $html = ob_get_contents();
        ob_end_clean();

        return $html;
    }

    //Ack per evitare errori nel grafico: si aggiungono le ore mancanti con valore pari a 0
    foreach ($queues as $queue) {
        $imod = false;
        $tmod = false;
        for ($i = ORA_INIZIO; $i <= ORA_FINE; ++$i) {
            if (!isset($totali[$queue][$i])) {
                $totali[$queue][$i] = 0;
                $tmod = true;
            }
        }
        //Se sono state aggiunte delle ore, è necessario riordinare l'array
        if ($tmod) {
            ksort($totali[$queue]);
        }
    }

    for ($i = ORA_INIZIO; $i <= ORA_FINE; ++$i) {
        $hours[] = $i;
    }

    foreach ($queues as $queue) {
        if ($totali[$queue]) {
            unset($totali[$queue]['']); //eliminiamo le ore non valide
            if (sizeof($totali[$queue]) > 0) {
                if ($_SESSION['filter'][1] == '') {
                    drawLine($queue, sprintf(_('Average duration hourly distribution Queue: %s '), $queue), $totali[$queue]);
                } else {
                    drawLine($queue, sprintf(_('Average duration hourly distribution Queue: %s - Date: from '), $queue) . $_SESSION['filter'][1] . _(' to ') . $_SESSION['filter'][2], $totali[$queue]);
                }
            } //Distribuzione oraria durata media Coda: $queue - Data: dal
        }
    }

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getGraficiZona()
{
    global $dbcdr;
    ob_start();

    //## Start filter
    $where = filter();
    $where .= ' true ';

    $select_field = select();
    $zona = selectZone();
    $limit = selectLimit();
    $queues = array();
    $totali = array();
    $query = "select qdescr,$zona,count(*) as count from report_queue_callers GROUP BY $zona,qdescr ORDER BY count,qdescr;";
    //echo "$query<br/>";
    foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $totali[$row[0]][$row[1]] = $row[2];
        if ($row[0] != '' && !in_array($row[0], $queues)) {
            $queues[] = $row[0];
        }
    }
    if ($limit > 0) {
        foreach ($queues as $queue) {
            if (!isset($totali[$queue])) {
                continue;
            }
            arsort($totali[$queue]);
            $i = 0;
            foreach ($totali[$queue] as $key => $value) {
                if ($i >= $limit) {
                    $totali[$queue]['Altro'] = $totali[$queue]['Altro'] + $value;
                    unset($totali[$queue][$key]);
                }
                ++$i;
            }
        }
    }

    foreach ($queues as $queue) {
        if (!isset($totali[$queue])) {
            continue;
        }
        // Create the graph
        if (sizeof($totali[$queue]) == 0) {
            echo _('No graphic to display');
        } //Nessun grafico da visualizzare
        else {
            if ($_SESSION['filter'][1] == '') {
                $title = "$queue";
            } else {
                $title = _('Date from ') . $_SESSION['filter'][1] . _(' to ') . $_SESSION['filter'][2] . " - $queue";
            }
            drawPie("zona$queue", $title, $totali[$queue]);
        }
    }

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function __fetchAll($query)
{
    global $dbcdr;
    foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $ret[$row[0]] = $row[1];
    }

    return $ret;
}

function getDashboard1()
{
    $start = time() - (360 * 24 * 60 * 60); //last year
    $end = time(); //today
    $time_filter = " AND timestamp_out>='$start' AND timestamp_out<='$end' ";
    $query_all = "select qdescr,  log10(count(id)) as count from report_queue where true $time_filter group by qdescr";
    drawPie('total_all', _('Total Calls for queue'), __fetchAll($query_all), 'inside'); //Chiamate totali per coda
    $query_all_agent = 'select ' . STR_AGENT . ", log10(count(id)) as count from report_queue where true and NOT agent ='NONE' $time_filter group by " . STR_AGENT;
    drawPie('agent_all', _('Total calls for agents'), __fetchAll($query_all_agent), 'inside'); //Chiamate totali per agenti
    echo "<script type='text/javascript'>
      $(function() {
        $('#dashboard2').html(loading);
        $('#dashboard2').load('../queue-report/modules/dashboard.php?type=2');
     });
  </script>";
}

function getDashboard2()
{
    $start = time() - (360 * 24 * 60 * 60); //last year
    $end = time(); //today
    $time_filter = " AND timestamp_out>='$start' AND timestamp_out<='$end' ";
    $query_avg_duration = "SELECT qdescr, avg(duration) as avg_duration from report_queue WHERE true AND NOT action='EXITWITHKEY' $time_filter GROUP BY qdescr";
    drawBar('avg_duration', _('Average length for the queue'), __fetchAll($query_avg_duration), 'inside'); //Durata media per coda
    $query_avg_hold = "SELECT qdescr, avg(hold) as avg_hold from report_queue WHERE true AND NOT action='EXITWITHKEY' $time_filter GROUP BY qdescr";
    drawBar('avg_hold', _('Average wait for the queue'), __fetchAll($query_avg_hold), 'inside'); //Attesa media per coda
    echo "<script type='text/javascript'>
      $(function() {
        $('#dashboard3').html(loading);
        $('#dashboard3').load('../queue-report/modules/dashboard.php?type=3');
     });
  </script>";
}

function getDashboard3()
{
    global $dbcdr;
    $start = time() - (360 * 24 * 60 * 60); //last year
    $end = time(); //today
    $time_filter = " AND timestamp_out>='$start' AND timestamp_out<='$end' ";
    $query_hour = "SELECT qdescr, hour(from_unixtime(timestamp_in)) as hour, count(id) as count from report_queue WHERE true $time_filter AND hour(from_unixtime(timestamp_in))>=" . ORA_INIZIO . ' AND hour(from_unixtime(timestamp_in))<=' . ORA_FINE . ' GROUP BY qdescr,hour ORDER BY hour';
    foreach ($dbcdr->getAll($query_hour, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $results[$row[0]][$row[1]] = $row[2];
    }
    foreach ($results as $queue => $values) {
        for ($i = ORA_INIZIO; $i <= ORA_FINE; ++$i) { //fill empty hours: not so efficient...
            if (!isset($values[$i])) {
                $values[$i] = 0;
            }
        }
        ksort($values);
        $to_draw[] = array('id' => "hour$queue", 'label' => $queue, 'title' => _('Distribution hourly'), 'data' => $values);
    }
    drawMultiLine('all_hours', _('Hourly distribution'), $to_draw, 'inside'); //Distribuzione oraria
    echo "<script type='text/javascript'>
      $(function() {
        $('#dashboard4').html(loading);
        $('#dashboard4').load('../queue-report/modules/dashboard.php?type=4');
     });
  </script>";
}

function getDashboard4()
{
    $start = time() - (360 * 24 * 60 * 60); //last year
    $end = time(); //today
    $time_filter = " AND timestamp_out>='$start' AND timestamp_out<='$end' ";
    $query_reg = "select replace(regione,'\'',' '),log10(count(*)) as count from report_queue_callers  where true $time_filter group by regione order by count desc limit 10";
    drawPie('reg_all', _('Total Calls by region'), __fetchAll($query_reg), 'inside'); //Chiamate totali per regione
    $query_prov = "select replace(provincia,'\'',' '),log10(count(*)) as count from report_queue_callers  where true $time_filter group by provincia  order by count desc limit 10";
    drawPie('prov_all', _('Total Calls by area'), __fetchAll($query_prov), 'inside'); //Chiamate totali per provincia
    echo "<script type='text/javascript'>
      $(function() {
        $('#dashboard5').html(loading);
        $('#dashboard5').load('../queue-report/modules/dashboard.php?type=5');
     });
  </script>";
}

function getDashboard5()
{
    $start = time() - (360 * 24 * 60 * 60); //last year
    $end = time(); //today
    $time_filter = " AND timestamp_out>='$start' AND timestamp_out<='$end' ";
    $query = " SELECT DATE_FORMAT(from_unixtime(timestamp_in),'%m') as month , count(id) as count from report_queue WHERE true $time_filter GROUP BY month ORDER BY month;";
    drawLine('distr_mens', _('Monthly distribution'), __fetchAll($query)); //Distribuzione mensile
}

function drawPie($id, $title, $results, $legend_placement = 'outside')
{
    $id = md5($id);
    $data = "var data_$id=[";
    foreach ($results as $k => $v) {
        if ($v < 0) {
            continue;
        } //skip negative values
        $k = addslashes($k);
        $data .= "['$k',$v],";
    }
    $data = substr($data, 0, -1);
    $data .= '];';
    echo "<div id='jplot_$id' class='jplot_graph' ></div>\n";
    echo "<script type='text/javascript'>\n";
    echo "$data\n";
    echo "var jplot_graph_$id = jQuery.jqplot ('jplot_$id', [data_$id],
   {
      title: '$title',
      seriesDefaults: {
        renderer: jQuery.jqplot.PieRenderer,
        rendererOptions: {
          showDataLabels: true,
          sliceMargin: 2,
        }
      },
      legend: { show:true, location: 'e', placement: '$legend_placement' }
    }
  );
  jplot_graph_$id.themeEngine.newTheme('pie', pie);
  jplot_graph_$id.activateTheme('pie');
  \n";
    echo "</script>\n";
}

function drawMultiLine($id, $title, $results, $legend_placement = 'outside')
{
    $id = md5($id);
    $series = '[';
    $param_data = '[ ';
    foreach ($results as $res) {
        $series .= "{label: '{$res['label']}'},";
        $param_data .= 'data_' . md5($res['id']) . ',';
        $data .= 'var data_' . md5($res['id']) . '=[';
        foreach ($res['data'] as $k => $v) {
            $data .= "['$k',$v],";
        }
        $data = substr($data, 0, -1);
        $data .= '];';
    }
    $param_data = substr($param_data, 0, -1);
    $param_data .= ' ]';
    $series = substr($series, 0, -1);
    $series .= ' ]';
    echo "<div id='jplot_$id' class='jplot_graph' style='width: 95%;'></div>\n";
    echo "<script type='text/javascript'>\n";
    echo "$data\n";
    echo "var jplot_graph_$id = jQuery.jqplot ('jplot_$id', $param_data,
   {
      title: '$title',
      series: $series,
      axes:{
        xaxis:{
          renderer: $.jqplot.CategoryAxisRenderer
        },
        yaxis:{
          tickOptions:{
            }
        }
      },
      highlighter: {
        show: true,
        sizeAdjust: 7.5
      },
      cursor: {
        show: false
      },
       legend: { show:true, location: 'e', placement: '$legend_placement'}
  });
  jplot_graph_$id.themeEngine.newTheme('line', line);
  jplot_graph_$id.activateTheme('line');
  \n";
    echo "</script>\n";
}

function drawLine($id, $title, $results)
{
    $id = md5($id);
    $data = "var data_$id=[";
    foreach ($results as $k => $v) {
        $data .= "['$k',$v],";
    }
    $data = substr($data, 0, -1);
    $data .= '];';
    echo "<div id='dashboard_$id' class='jplot_graph' style='width: 95%;'></div>\n";
    echo "<script type='text/javascript'>\n";
    echo "$data\n";
    echo "var jplot_graph_$id = jQuery.jqplot ('dashboard_$id', [data_$id],
   {
      title: '$title',
      axes:{
        xaxis:{
          renderer: $.jqplot.CategoryAxisRenderer
        },
        yaxis:{
          tickOptions:{
            }
        }
      },
      highlighter: {
        show: true,
        sizeAdjust: 7.5
      },
      cursor: {
        show: false
      }
    }
  );
  jplot_graph_$id.themeEngine.newTheme('line', line);
  jplot_graph_$id.activateTheme('line');
  \n";
    echo "</script>\n";
}

function drawBar($id, $title, $results)
{
    $id = md5($id);
    if (sizeof(array_values($results)) <= 0) {
        return;
    }
    echo "<div id='dashboard_$id' class='jplot_graph' style='width: 95%;'></div>\n";
    echo "<script type='text/javascript'>\n";
    echo "var data_$id = [" . implode(',', array_values($results)) . "];\n";
    echo 'var ticks = ["' . implode('","', array_keys($results)) . "\"];\n";
    echo "var jplot_graph_$id = jQuery.jqplot ('dashboard_$id', [data_$id],
   {
      title: '$title',
      seriesDefaults:{
            renderer:$.jqplot.BarRenderer,
            rendererOptions: {fillToZero: true},
            pointLabels: { show: true },
      },
      axes:{
        xaxis:{
          renderer: $.jqplot.CategoryAxisRenderer,
          ticks: ticks
        },
        yaxis:{
          padMin: 0
        }
      },
      highlighter: {
        show: true,
        sizeAdjust: 7.5
      },
      cursor: {
        show: false
      }
    }
  );
  jplot_graph_$id.themeEngine.newTheme('bar', bar);
  jplot_graph_$id.activateTheme('bar');
  \n";
    echo "</script>\n";
}

?>
