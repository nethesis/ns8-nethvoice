<?php

include_once '/etc/freepbx.conf';
/*check auth*/
session_start();
if (!isset($_SESSION['AMP_user']) || !$_SESSION['AMP_user']->checkSection('queuereport')) {
    header("Location: /freepbx/admin/config.php?display=queuereport");
    exit(1);
}

//parametri distr oraria
define('ORA_INIZIO', 8);
define('ORA_FINE', 19);

//la funzione strtotime ritorna un giorno in meno nella conversione, quindi si aggiunge un giorno
define('ONE_DAY', 86000);

// Parametri performace
define('SEC_IGNORE', 5); // attesa minima entro l quale la chiamata non è considerata
define('SEC_GOOD', 60); // attesa max entro l quale la chiamata è considerat ottima
define('AFTER_WORK', 0); // Wrap up time

//parametri generali
// define("STR_AGENT","agent");
define('STR_AGENT', "IF(locate('@',agent)>0, substring_index(substring_index(agent,'/',-2),'@',1), substring_index(substring_index(agent,'/',-1),'-',1))");

//$stragent="substr(agent,7,2)";  # se nel formato Local/XX@234234234, devo estrarre XX

//parametri interfaccia

define('DEFAULT_ORDER', 'period ASC');
define('ROWS_PER_PAGE', 32);
define('PERIODS_PER_PAGE', 5); //Usato nella distribuzione oraria al posto di ROWS_PER_PAGE
define('TTF_DIR', $amp_conf['AMPWEBROOT'] . '/queue-report/fonts/');
define('GROUP_YEAR', 1);
define('GROUP_MONTH', 2);
define('GROUP_WEEK', 3);
define('GROUP_DAY', 4);

define('COLOR_BLUE', 1);
define('COLOR_GREEN', 2);

define('GRAPH_MARGIN_COLOR', '#DFE6FD');
define('GRAPH_BAR_COLOR', '#79A5CA');

//directory di salvataggio dei grafici
define('GRAPH_DIR', 'graph');

//#Configurazione asterisk
//file asterisk che contiene informazioni sulla coda
define('ASTERISK_FILE', '/var/log/asterisk/queue-status.log');
define('AGENT_NOT_LOGGED', 5);

//release
define('RELEASE', '2.3');

//auhtentication
define('VALID_USERS', 'admin');
