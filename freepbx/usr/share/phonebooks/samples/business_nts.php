#!/usr/bin/env php
<?php
/****************************
*  Business DB credentials  *
*****************************/
$dsn="dblib:host=192.168.1.100\SQLEXPRESS;port=1433;dbname=TDS;version=7.4;charset=UTF-8";
$user="USER";
$pass="PASSWORD";
/****************************/

$phonebookDB = new PDO(
    'mysql:host='.getenv('PHONEBOOK_DB_HOST').';port='.getenv('PHONEBOOK_DB_PORT').';dbname='.getenv('PHONEBOOK_DB_NAME'),
    getenv('PHONEBOOK_DB_USER'),
    getenv('PHONEBOOK_DB_PASS'));

// Connect to MSSQL using PDO odbc driver
$mssqlDB = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

$code = 0;

// Remove Business contacts from centralized phonebook
try {
    $phonebookDB->exec('DELETE FROM phonebook WHERE sid_imported = "business"');
} catch (Exception $e) {
    echo "Error '".$e->getMessage()."' cleaning phonebook";
    $code ++;
}
//Query da modificare secondo le esigenze specifiche del server usato
$query="select an_descr1 as azienda1, an_descr2 as azienda2,
		an_contatt as contatto,
		an_telef as tel,
		an_email as email,
		an_faxtlx as fax,
		an_cell as cell,
		an_indir as via,
		an_citta as citta,
		an_prov as prov,
		an_cap as cap
	from ANAGRA where an_tipo = 'c' or an_tipo = 'f';";

try {
    $sth = $mssqlDB->prepare($query);
    $sth->execute(array());
} catch (Exception $e) {
    echo "Error '".$e->getMessage()."' executing query: $query";
    $code ++;
}
while ($record = $sth->fetch(PDO::FETCH_ASSOC,PDO::FETCH_ORI_NEXT)) {
    $azienda = $record['azienda1'].' '.$record['azienda2'];
    $azienda = (isset($azienda) ? $azienda : '');
    $nome = (isset($record['contatto']) ? $record['contatto'] : '' );
    $email = (isset($record['email']) ? $record['email'] : '' );
    $via = (isset($record['via']) ? $record['via'] : '' );
    $citta = (isset($record['citta']) ? $record['citta'] : '' );
    $prov= (isset($record['prov']) ? $record['prov'] : '' );
    $cap= (isset($record['cap']) ? $record['cap'] : '' );
    foreach (['tel','fax','cell','homephone'] as $field) {
        if (isset($record[$field])) {
            $$field = preg_replace("/-| |\//","",$record[$field]);
            $$field = str_replace("+","00",$$field);
        } else {
            $$field = '';
        }
    }

    $query_ins = "INSERT INTO phonebook
        (company,name,workphone,fax,workemail,workstreet,workcity,workprovince,workpostalcode,cellphone,type,sid_imported)
        VALUES
        (?,?,?,?,?,?,?,?,?,?,?,?)";

    try {
        $sth2 = $phonebookDB->prepare($query_ins);
        $sth2->execute(array(
            $azienda,
            $nome,
            $tel,
            $fax,
            $email,
            $via,
            $citta,
            $prov,
            $cap,
            $cell,
            'business',
            'business'
        ));
    } catch (Exception $e) {
        echo "Error '".$e->getMessage()."' executing query: $query_ins";
        $code ++;
    }
}

exit($code);
