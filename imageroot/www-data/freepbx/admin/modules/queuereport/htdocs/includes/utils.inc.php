<?php

function connect_db()
{
    global $db;
    global $amp_conf;
    global $dbcdr;

    // Retrieve database and table name if defined, otherwise use FreePBX default
    $db_name = 'asteriskcdrdb';
    $db_type = 'mysql';
    $db_host = empty($amp_conf['CDRDBHOST']) ? $amp_conf['AMPDBHOST'] : $amp_conf['CDRDBHOST'];
    $db_port = empty($amp_conf['CDRDBPORT']) ? '' : ':' . $amp_conf['CDRDBPORT'];
    $db_user = empty($amp_conf['CDRDBUSER']) ? $amp_conf['AMPDBUSER'] : $amp_conf['CDRDBUSER'];
    $db_pass = empty($amp_conf['CDRDBPASS']) ? $amp_conf['AMPDBPASS'] : $amp_conf['CDRDBPASS'];
    $datasource = $db_type . '://' . $db_user . ':' . $db_pass . '@' . $db_host . $db_port . '/' . $db_name;
    $dbcdr = DB::connect($datasource); // attempt connection
    if (DB::isError($dbcdr)) {
        die_freepbx($dbcdr->getDebugInfo());
    }
}

function nround($number, $decimal)
{
    return number_format($number, $decimal, ',', '');
}

function FormatTime($time)
{
    //Format the time to human readable format
    $diff = $time;
    $hrsdiff = floor($diff / 60 / 60);
    $diff -= $hrsdiff * 60 * 60;
    $minsdiff = floor($diff / 60);
    $diff -= $minsdiff * 60;
    $secsdiff = $diff;
    if (strlen($hrsdiff) == 1) {
        $hrsdiff = '0' . $hrsdiff;
    }
    if (strlen($minsdiff) == 1) {
        $minsdiff = '0' . $minsdiff;
    }
    if (strlen($secsdiff) == 1) {
        $secsdiff = '0' . $secsdiff;
    }

    return $hrsdiff . ':' . $minsdiff . ':' . $secsdiff;
}

function percent($first, $second)
{
    //Format the time to human readable format
    $rapp = $first / $second;

    return nround($rapp * 100, 2);
}

function changePage($type, $func_name)
{
    if (!isset($_SESSION['page'])) {
        $_SESSION['page'] = 1;
    }
    if ($type == 'previous') {
        return $func_name($_SESSION['page'] - 1);
    } elseif ($type == 'next') {
        return $func_name($_SESSION['page'] + 1);
    }
}

function array_to_get($array)
{
    if (sizeof($array) == 0) {
        return '';
    }

    foreach ($array as $key => $val) {
        $ret .= $key . '=' . $val .= '&';
    }

    return $ret;
}

function filter()
{
    $_SESSION['group'] = $_SESSION['filter'][6];

    $where = ' WHERE ';
    if ($_SESSION['filter'][0] == 'true') {
        $d = explode('-', $_SESSION['filter'][1]);
        if ($_SESSION['filter'][1]) { //fromdate
            $where .= ' timestamp_in>=' . (strtotime($d[2] . '-' . $d[1] . '-' . $d[0])) . ' AND ';
        }
        $d = explode('-', $_SESSION['filter'][2]);
        if ($_SESSION['filter'][2]) { //todate
            $where .= ' timestamp_out<=' . (strtotime($d[2] . '-' . $d[1] . '-' . $d[0]) + 85000) . ' AND ';
        }
        if ($_SESSION['filter'][3] != '') { //chiamante
            $where .= " cid like '" . $_SESSION['filter'][3] . "%' AND ";
        }
        if ($_SESSION['filter'][4]) { //agente
            $where .= ' ' . STR_AGENT . "='" . $_SESSION['filter'][4] . "' AND ";
        }
        if ($_SESSION['filter'][5]) { //coda
            $where .= " qname='" . $_SESSION['filter'][5] . "' AND ";
        }
    }

    return $where;
}

function execFilter($params_str)
{
    $params = explode('|', $params_str);

    //Recupero il nome della funzione da invocare
    $func_name = $params[0];
    $params = array_slice($params, 1);
    //Parametri:
    //0 -> enable filter: true/false
    //1 -> fromdate
    //2 -> todate
    //3 -> chiamante
    //4 -> agente
    //5 -> coda
    //6 -> raggruppamento

    if ($params[0] == 'true') {
        //## Save filter
        $_SESSION['filter'] = $params;
    } else {
        unset($_SESSION['filter']);
    }

    //ogni volta che si applica il filtro, si ritorna alla pagina 1
    return $func_name(1, $_SESSION['order']);
}

//Stampa il filtro nella pagina
//functions: le funzioni php da chiamare quando si applica il filtro
//targets: i target dove i dati devono essere visualizzati
function print_filter($functions, $targets, $enableChiamante = true, $showExport = true)
{
    global $dbcdr;
    $js_functions = 'new Array(';
    foreach ($functions as $f) {
        $js_functions .= "'$f',";
    }
    $js_functions = substr($js_functions, 0, -1);
    $js_functions .= ')';

    $js_targets = 'new Array(';
    foreach ($targets as $t) {
        $js_targets .= "'$t',";
    }
    $js_targets = substr($js_targets, 0, -1);
    $js_targets .= ')';

    if ($_SESSION['filter'][1]) {
        $fromdate = $_SESSION['filter'][1];
    } else {
        if ($fromdate == '') {
            $fromdate = '01-' . date('m') . '-' . date('Y');
        }
    }
    if ($_SESSION['filter'][2]) {
        $todate = $_SESSION['filter'][2];
    } else {
        if (date('m') == 12) {
            $to_month = 1;
            $to_year = date('Y') + 1;
        } else {
            $to_year = date('Y');
            $to_month = date('m') + 1;
            $to_month = sprintf('%02d', $to_month);
        }
        if ($todate == '') {
            $todate = '01' . '-' . $to_month . '-' . $to_year;
        }
    }

    $export = explode('.', basename($_SERVER['PHP_SELF'])); //value array for export action

    $sql_agent = 'Select distinct ' . STR_AGENT . ' from report_queue where ' . STR_AGENT . "!='' order by " . STR_AGENT;
    $sql_queues = "Select distinct qname,qdescr from report_queue where qname!='' order by qname";?>
    <form action="main.php" method="GET" name="searchForm" id="searchForm">
        <div class="ui secondary fluid segment no-padding">
            <div id="filtermenu" class="ui secondary stackable borderless menu grid">

                <div class="item">
                    <label><?php echo _('From');?></label> <!--Dal--> &nbsp;
                    <div class="ui left icon input">
                        <input type="text" name="fromdate" id="fromdate" value="<?php echo $fromdate;?>" onChange="ExecAllFilter(<?php echo "$js_functions,$js_targets";?>)">
                        <i class="calendar icon"></i>
                    </div>&nbsp;

                    <label><?php echo _('to');?></label><!--al--> &nbsp;
                    <div class="ui left icon input">
                        <input type="text" name="todate" id="todate" value="<?php echo $todate;?>" onChange="ExecAllFilter(<?php echo "$js_functions,$js_targets";?>)">
                        <i class="calendar icon"></i>
                    </div>
                </div>
                <div class="item">
                    <label><?php echo _('Group by:');?></label> <!--Raggruppa per:--> &nbsp;
                     <select class="ui dropdown" name='gruppo' id='gruppo' onChange="ExecAllFilter(<?php echo "$js_functions,$js_targets";?>)">

                       <option value='<?php echo GROUP_YEAR;?>' <?php if ($_SESSION['group'] == GROUP_YEAR) {
                     echo "selected='selected'";
                 }
                 ?>><?php echo _('Year');?><!--Anno--></option>
                       <option value='<?php echo GROUP_MONTH;?>' <?php if ($_SESSION['group'] == GROUP_MONTH) {
                     echo "selected='selected'";
                 }
                 ?>><?php echo _('Month');?><!--Mese--></option>
                       <option value='<?php echo GROUP_WEEK;?>' <?php if ($_SESSION['group'] == GROUP_WEEK) {
                     echo "selected='selected'";
                 }
                 ?>><?php echo _('Week');?><!--Settimana--></option>
                       <option value='<?php echo GROUP_DAY;?>' <?php if ($_SESSION['group'] == GROUP_DAY) {
                     echo "selected='selected'";
                 }
                 ?>><?php echo _('Day');?><!--Giorno--></option>
                     </select>
                </div>
                <div class="item">
                  <label><?php echo _('Caller:');?></label> <!--Chiamante:--> &nbsp;
                  <div class="ui input">
                          <input type="text" size="8" name="chiamante" id="chiamante" value="<?php echo $_SESSION['filter'][3];?>" onKeyUp="if(this.value.length>=2 || this.value.length==0)  ExecAllFilter(<?php echo "$js_functions,$js_targets";?>);" <?php if (!$enableChiamante) {
                          echo "onFocus='blur()'";
                      }
                      ?>>
                  </div>
                  <span class="input-info"> <?php echo _('(min. 2 characters)');?></span><!--(min. 2 caratteri)-->
                </div>
                <div class="item">
                    <label><?php echo _('Agent:');?></label> <!--Agente:--> &nbsp;
                <select class="ui dropdown" name="agente"   onChange="ExecAllFilter(<?php echo "$js_functions,$js_targets";?>);"  id="agente">
                      <option value=""><?php echo _('All');?><!--Tutti--></option>
              <?php
          foreach ($dbcdr->getAll($sql_agent, DB_FETCHMODE_ASSOC) as $key => $agent) {
              $agent = array_values($agent);
              $select = '';
              if ($agent[0] == $_SESSION['filter'][4]) {
                  $select = "selected='selected'";
              }
              echo "<option value='$agent[0]' $select>$agent[0]</option>";
          }
          ?>
                </select>
                </div>
                <div class="item">
                    <label><?php echo _('Queue:');?></label> <!--Coda:--> &nbsp;
                <select class="ui dropdown" onChange="ExecAllFilter(<?php echo "$js_functions,$js_targets";?>);" name="coda" id="coda">
                      <option value=""><?php echo _('All');?><!--Tutti--></option>
                      <?php
                      foreach ($dbcdr->getAll($sql_queues, DB_FETCHMODE_ASSOC) as $key => $queue) {
                          $queue = array_values($queue);
                          $select = '';
                          if ($queue[0] === $_SESSION['filter'][5]) {
                              $select = 'selected';
                          }
                          echo "<option value='$queue[0]' $select>$queue[1] ($queue[0])</option>";
                      }
                      ?>
                </select>
                </div>
                <div class="right menu">
                    <div class="item">
                        <div class="ui toggle checkbox">
                            <input type="checkbox" name="activeFilter" id="activeFilter" onclick="ApplyFilter(<?php echo "$js_functions,$js_targets";?>)"
                             <?php if ($_SESSION['filter'][0] == 'true') {
                             echo "checked='checked'";
                            }
                             ?>/>
                             <label><?php echo _('Filter');?></label><!--Applica Filtro:-->
                        </div>
                    </div>
               </div>
           </div>
       </div>
    </form>
    <div id='listing' class="loadingfilter"><img class="ui avatar image" src='assets/img/loader.gif'/><div class='loading_text'><?php echo _('Loading...');?><!--Caricamento...--></div></div>
    <?php if ($showExport) {
        ?>
    <a href="modules/export.php?action=<?php echo $export[0];?>" alt="Esporta foglio di calcolo" title="Esporta foglio di calcolo">
        <button class="ui right floated right labeled icon primary button exp_btn"><?php echo _('Export .xlsx');?>
            <i class="file excel outline icon"></i><!--Esporta:-->
        </button>
    </a>
    <?php

    }
    ?>
<script type='text/javascript'>
$(document).ready(function() {
   $.datepicker.setDefaults( $.datepicker.regional[ "it" ] );
   $('#todate').datepicker({dateFormat: "dd-mm-yy"});
   $('#fromdate').datepicker({dateFormat: "dd-mm-yy"});
   // HACK: hide datepicker initialitazion --- I really don't know what's going on!
   $('#ui-datepicker-div').hide();

});
</script>
<?php

}

function filter_summary()
{
    echo "<span class='filter'>";
    if ($_SESSION['filter'][0] == 'true') {
        if ($_SESSION['filter'][1]) { //fromdate
            echo _('From ') . $_SESSION['filter'][1];
        } //Dal
        if ($_SESSION['filter'][2]) { //todate
            echo _(' to ') . $_SESSION['filter'][2];
        } //al
        if ($_SESSION['filter'][3] != '') { //chiamante
            echo _(" | Caller: ''") . $_SESSION['filter'][3] . "'";
        } // | Chiamante: ''
        if ($_SESSION['filter'][4]) { //agente
            echo ' | Agent: ' . $_SESSION['filter'][4];
        } // | Agente:
        if ($_SESSION['filter'][5]) { //coda
            echo ' | queue: ' . $_SESSION['filter'][5];
        } // | coda:
    } else {
        echo _('No filter applied');
    } //Nessun filtro applicato;
    echo '</span>';
}

function group()
{
    switch ($_SESSION['group']) {
        case GROUP_MONTH:
            return ' year(from_unixtime(timestamp_in)), month(from_unixtime(timestamp_in)) ';

        case GROUP_WEEK:
            return ' year(from_unixtime(timestamp_in)), week(from_unixtime(timestamp_in)) ';

        case GROUP_DAY:
            return ' year(from_unixtime(timestamp_in)), month(from_unixtime(timestamp_in)), day(from_unixtime(timestamp_in)) ';

        default:
        case GROUP_YEAR:
            return ' year(from_unixtime(timestamp_in)) ';
    }
}

function workingdays()
{
    switch ($_SESSION['group']) {
        case GROUP_MONTH:
            return 22;

        case GROUP_WEEK:
            return 5;

        case GROUP_DAY:
            return 1;

        default:
        case GROUP_YEAR:
            return 220;
    }
}

function print_date_by_group($date)
{
    switch ($_SESSION['group']) {
        case GROUP_MONTH:
            return date('m-Y', $date);

        case GROUP_WEEK:
            return date('d-m-Y', $date);

        case GROUP_DAY:
            return date('d-m-Y', $date);

        default:
        case GROUP_YEAR:
            return date('Y', $date);
    }
}

function qdebug()
{
    for ($i = 0; $i < func_num_args(); ++$i) {
        echo '<pre>';
        print_r(func_get_arg($i));
        echo '</pre>';
    }
}

function selectZone()
{
    if ($_REQUEST['zone_filter']) {
        $_SESSION['select_zone'] = $_REQUEST['zone_filter'];
    }
    $return = $_REQUEST['zone_filter'] ? $_REQUEST['zone_filter'] : $_SESSION['select_zone'];
    if ($return == '') {
        $return = 'regione';
    }

    return $return;
}

function selectLimit()
{
    return $_REQUEST['zone_limit'] ? $_REQUEST['zone_limit'] : 10;
}

function select()
{
    switch ($_SESSION['group']) {
        case GROUP_MONTH:
            return ' DATE_FORMAT(from_unixtime(timestamp_in),"%m-%Y") as period ';

        case GROUP_WEEK:
            return ' DATE_FORMAT(from_unixtime(timestamp_in),"%u-%Y") as period ';

        case GROUP_DAY:
            return ' DATE_FORMAT(from_unixtime(timestamp_in),"%d-%m-%Y") as period ';

        default:
        case GROUP_YEAR:
            return ' DATE_FORMAT(from_unixtime(timestamp_in),"%Y") as period ';
    }
}

?>
