#!/usr/bin/php -q
<?php
header('Content-Type: application/vnd.ms-excel'); //IE and Opera
header('Content-Type: application/x-msexcel'); // Other browsers
header('Expires: 0');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
header('Content-Disposition: attachment; filename="report.xls"');

require_once '../includes/config.inc.php';
require_once '../includes/utils.inc.php';
require_once '../includes/ajax_report.inc.php';

//( [0] => true [1] => 01-06-2014 [2] => 01-07-2014 [3] => [4] => [5] => [6] => 2 )

if ($argc != 8) {
    echo "\n";
    echo 'Numero Argomenti errato: ' . ($argc - 1) . " (attesi 7)\n";
    echo "Utilizzo: export_to_file.php from_date to_date caller agent coda report\n";
    echo "    from_date:  '2014-03-01'\n";
    echo "    to_date:    '2014-03-01'\n";
    echo "    caller:     '0721405516'   ('a' = tutti)\n";
    echo "    agent:      'Arturo Vidal' ('a' = tutti)\n";
    echo "    coda:       '401'          ('a' = tutte)\n";
    echo "    group:      [1=anno|2=mese|3=giorno|4=settimana]\n";
    echo "    report:     [riepilogo|agente|chiamante|performance|oraria|geografica]\n";
    exit;
}

$_SESSION['filter'][0] = true;
$_SESSION['filter'][1] = $argv[1];
$_SESSION['filter'][2] = $argv[2];
if ($argv[3] != 'a') {
    $_SESSION['filter'][3] = $argv[3];
}
if ($argv[4] != 'a') {
    $_SESSION['filter'][4] = $argv[4];
}
if ($argv[5] != 'a') {
    $_SESSION['filter'][5] = $argv[5];
}
$_SESSION['filter'][6] = $argv[6]; //gruppo

$action = $argv[7];

$_SESSION['group'] = $_SESSION['filter'][6];

$where = ' WHERE ';
//$where.=" timestamp_in>=".(strtotime($d[2]."-".$d[1]."-".$d[0]))." AND ";
//$where.=" timestamp_out<=".(strtotime($d[2]."-".$d[1]."-".$d[0])+85000)." AND ";

$where .= ' timestamp_in>=' . (strtotime($argv[1])) . ' AND ';
$where .= ' timestamp_out<=' . (strtotime($argv[2]) + 85000) . ' AND ';
//$where.=" ".STR_AGENT."='".$_SESSION['filter'][4]."' AND ";
//$where.=" qname='".   $_SESSION['filter'][5]."' AND ";
$where .= ' AND ';

connect_db();

ob_start();
echo '<html><head><title>Queue Report - ' . $action . '</title></head><body>';

$break = '<table><tr><td/></tr></table>';

switch ($action) {
    case 'riepilogo':
        echo '<h1>Report di riepilogo</h1>';
        echo getGeneraleEvase(-1);
        echo $break;
        echo getGeneraleAbbandoni(-1);
        echo $break;
        echo getGeneraleTimeout(-1);
        echo $break;
        echo getGeneraleExitmpty(-1);
        echo $break;
        echo getGeneraleExitkey(-1);
        echo $break;
        echo getGeneraleFull(-1);
        echo $break;
        echo getGeneraleJoinempty(-1);
        echo $break;
        echo getGeneraleNull(-1);
        break;
    case 'agente':
        echo '<h1>Report per agente</h1>';
        echo getPerAgente(-1);
        echo $break;
        echo getSessioniAgente(-1);
        echo $break;
        break;
    case 'chiamante':
        echo '<h1>Report per chiamante</h1>';
        echo getPerChiamante(-1);
        break;
    case 'performance':
        echo '<h1>Performance report</h1>';
        echo getPerformance(-1);
        break;
    case 'oraria':
        echo '<h1>Report per fascia oraria</h1>';
        echo getOrariaTotali(-1);
        echo $break;
        echo getOrariaEvase(-1);
        echo $break;
        echo getOrariaInevase(-1);
        echo $break;
        echo getOrariaNonGestite(-1);        
        echo $break;
        echo getOrariaNulle(-1);
        break;
    case 'geografica':
        echo '<h1>Report per zona geografica</h1>';
        echo getGeografica(-1);
        break;
    case 'ivr':
        echo '<h1>Report IVR</h1>';
        echo getIvr(-1);
        break;
    default:
        ;
}

echo '</body></html>';
$html = ob_get_contents();
$html = preg_replace('/<td class="cdrhdr" colspan="(.*)" id="gridHead">/', '<td colspan="\\1" border="0" style="font-weight:bold">', $html);
$html = str_replace('class="cdrhdr"', 'border="1" bgcolor="#79A5CA" color="black" style="font-weight:bold"', $html);
$html = str_replace("class='cdrhdr'", 'border="1" bgcolor="#79A5CA" color="black" style="font-weight:bold"', $html);
$html = str_replace("class='cdr'", 'border="1"', $html);
if ($_GET['action'] == 'oraria') { //evita la formattazione in data
    $html = preg_replace("/(\d) - (\d)/", '\\1..\\2', $html);
}
$html = str_replace("class='cdrdta1'", 'bgcolor="#DFE6FD"', $html);
$html = str_replace('onmouseover="GridHeader(\'over\', this)" onmouseout="GridHeader(\'out\', this)"', '', $html);
$html = preg_replace('/onclick=\".*\"/', '', $html);
ob_end_clean();
echo $html;
?>
