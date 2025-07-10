#!/usr/bin/php -q
<?php
/****************************
*  Gamma DB credentials  *
*****************************/
$dsn="teamsystem";
$user="sa";
$pass="Teamsystem01";
/****************************/

$code = 0;

// Get NethServer phonebook database credentials
exec('perl -e \'use NethServer::Password; my $password = NethServer::Password::store(\'PhonebookDBPasswd\')  ; printf $password;\'',$out);
$pbookpass = $out[0];

// Connect to NethServer phonebook database
$phonebookDB = new PDO(
    'mysql:host=localhost;dbname=phonebook;charset=utf8',
    'pbookuser',
    $pbookpass);

// Connect to MSSQL using PDO odbc driver
$mssqlDB = new PDO(
    'odbc:'.$dsn,
    $user,
    $pass);

// Remove Business contacts from centralized phonebook
try {
    $phonebookDB->exec('DELETE FROM phonebook WHERE sid_imported = "gamma"');
} catch (Exception $e) {
    echo "Error '".$e->getMessage()."' cleaning phonebook";
    $code ++;
}
//Query da modificare secondo le esigenze specifiche del server usato
$query="select CG16_RAGSOANAG as azienda, CG16_COGNOME as cognome, CG16_NOME as nome, CG16_TEL1NUM as tel, CG16_INDEMAIL as email, CG16_FAXNUM as fax, CG16_INDIRIZZO as via, CG16_CITTA as citta, CG16_PROV as prov, CG16_CAP as cap from CG16_ANAGGEN";

try {
    $sth = $mssqlDB->prepare($query);
    $sth->execute(array());
} catch (Exception $e) {
    echo "Error '".$e->getMessage()."' executing query: $query";
    $code ++;
}
while ($record = $sth->fetch(PDO::FETCH_ASSOC,PDO::FETCH_ORI_NEXT)) {
    $azienda = (isset($record['azienda']) ? $record['azienda'] : '');
    $nome = (isset($record['cognome']) ? $record['cognome'] : '')." ".$record['nome'];
    $email = (isset($record['email']) ? $record['email'] : '');
    $via = (isset($record['via']) ? $record['via'] : '');
    $citta = (isset($record['citta']) ? $record['citta'] : '');
    $prov = (isset($record['prov']) ? $record['prov'] : '');
    $cap = (isset($record['cap']) ? $record['cap'] : '');
    $workcountry = (isset($record['workcountry']) ? $record['workcountry'] : '');
    foreach (['tel','fax','cell','homephone'] as $field) {
        if (isset($record[$field])) {
            $$field = preg_replace("/-| |\//","",$record[$field]);
            $$field = str_replace("+","00",$$field);
        } else {
            $$field = '';
        }
    }

    $query_ins = "INSERT INTO phonebook
        (company,workstreet,workcity,workprovince,workphone,homephone,cellphone,fax,workemail,workcountry,type,sid_imported)
        VALUES
        (?,?,?,?,?,?,?,?,?,?,?,?)";

    try {
        $sth2 = $phonebookDB->prepare($query_ins);
        $sth2->execute(array(
            $azienda,
            $via,
            $citta,
            $prov,
            $tel,
            $homephone,
            $cell,
            $fax,
            $email,
            $workcountry,
            'gamma',
            'gamma'
        ));
    } catch (Exception $e) {
        echo "Error '".$e->getMessage()."' executing query: $query_ins";
        $code ++;
    }
}

exit($code);

