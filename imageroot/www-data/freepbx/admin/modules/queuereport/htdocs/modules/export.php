<?php

header('Content-Type: application/vnd.ms-excel'); //IE and Opera
header('Content-Type: application/x-msexcel'); // Other browsers
header('Expires: 0');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
header('Content-Disposition: attachment; filename="' . $_GET['action'] . '.xls"');

require_once '../includes/config.inc.php';
require_once '../includes/utils.inc.php';
require_once '../includes/ajax_report.inc.php';
require_once 'traduzione.php';

connect_db();

ob_start();
echo '<html><head><title>Queue Report - ' . ucfirst($_GET['action']) . '</title></head><body>';

$break = '<table><tr><td/></tr></table>';

switch ($_GET['action']) {
    case 'riepilogo':
        echo '<h1>' . _('Summary report') . '</h1>'; //Report di riepilogo
        echo getGeneraleEvase(-1);
        echo $break;
        echo getGeneraleAbbandoni(-1);
        echo $break;
        echo getGeneraleTimeout(-1);
        echo $break;
        echo getGeneraleExitempty(-1);
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
        echo '<h1>' . _('Report by agent') . '</h1>'; //Report per agente
        echo getPerAgente(-1);
        echo $break;
        echo getSessioniAgente(-1);
        echo $break;
        break;
    case 'chiamante':
        echo '<h1>' . _('Report by caller') . '</h1>'; //Report per chiamante
        echo getPerChiamante(-1);
        break;
    case 'chiamata':
        echo '<h1>' . _('Report by call') . '</h1>'; //Report per chiamante
        echo getPerChiamata(-1);
        break;
    case 'performance':
        echo '<h1>' . _('Performance report') . '</h1>'; //Performance report
        echo getPerformance(-1);
        break;
    case 'oraria':
        echo '<h1>' . _('Report by hour') . '</h1>'; //Report per fascia oraria
        echo getOrariaTotali(-1);
        echo $break;
        echo getOrariaEvase(-1);
        echo $break;
        echo getOrariaInevase(-1);
        echo $break;
        echo getOrariaNonGestite(-1);
        echo $break;
        echo getOrariaNulle(-1);
        echo $break;
        echo getOrariaNonGestite(-1);
        break;
    case 'geografica':
        echo '<h1>' . _('Report by geographic area') . '</h1>'; //Report per zona geografica
        echo getGeografica(-1);
        break;
    case 'ivr':
        echo '<h1>' . _('IVR Report') . '</h1>'; //Report IVR
        echo getIVr(-1);
        break;
    case 'sessioni':
        echo '<h1>' . _('Report Sessions Agent') . '</h1>'; //Report Sessioni
        echo getSessioniAgente(-1);
    default:
        break;

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
