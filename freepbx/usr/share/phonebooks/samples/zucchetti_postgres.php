#!/usr/bin/env php
<?php

/**
 * Establishes or retrieves a persistent PDO connection to PostgreSQL.
 * @return PDO The PDO connection handle.
 */
function getPgsqlPDO()
{
    static $pdo_handle = null;
    if ($pdo_handle !== null) {
        return $pdo_handle;
    }

    // *** CONFIGURE POSTGRESQL SETTINGS ***
    $host = 'localhost';
    $port = '1234';
    $dbname = 'database_name';
    $user = 'username';
    $pass = 'password';
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";

    try {
        $pdo_handle = new PDO($dsn, $user, $pass);
        $pdo_handle->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $pdo_handle;
    } catch (PDOException $e) {
        die("PDO connection to PostgreSQL failed: " . $e->getMessage());
    }
}

function PGOquery2array($query)
{
    try {
        $pdo = getPgsqlPDO();
        $statement = $pdo->query($query);
        $results = $statement->fetchAll(PDO::FETCH_ASSOC);
        return $results;
    } catch (PDOException $e) {
        die("PDO query failed: " . $e->getMessage());
        return false;
    }
}

try {
    // Connect to phonebook db
    $phonebookDB = new PDO(
        'mysql:host='.getenv('PHONEBOOK_DB_HOST').';port='.getenv('PHONEBOOK_DB_PORT').';dbname='.getenv('PHONEBOOK_DB_NAME'),
        getenv('PHONEBOOK_DB_USER'),
        getenv('PHONEBOOK_DB_PASS'));

    // Get Data from PostgreSQL
    $query_pg = "select cast(RAGSOC as varchar(255)) as azienda1, cast(ANDESCRI as varchar(255)) as contatto, ANTELEFO as tel from VW_RUBRICA;";
    $rubrica_ext = PGOquery2array($query_pg);

    if (empty($rubrica_ext)) {
        echo "No records found in external phonebook. Exiting.\n";
        exit;
    }

    // Delete old records from MySQL
    echo "Deleting old records...\n";
    $stmt_delete = $phonebookDB->prepare('DELETE FROM phonebook WHERE sid_imported = ?');
    $stmt_delete->execute(['zucchetti_postgres']);
    echo $stmt_delete->rowCount() . " records deleted.\n";


    // Prepare the INSERT statement
    $insert_sql = "INSERT INTO phonebook (company, name, workphone, type, sid_imported) 
                   VALUES (:company, :name, :workphone, :type, :sid)";
                   
    $stmt_insert = $phonebookDB->prepare($insert_sql);

    echo "Inserting new records...\n";
    $insert_count = 0;

    // Loop and Insert
    foreach ($rubrica_ext as $record) {
        // Clean data
        $tel = str_replace(["-", " ", ".", "/", "+"], ["", "", "", "", "00"], $record['tel']);
        
        // Execute the prepared statement with data
        $stmt_insert->execute([
            ':company'   => $record['azienda1'],
            ':name'      => $record['contatto'],
            ':workphone' => $tel,
            ':type'      => 'zucchetti_postgres',
            ':sid'       => 'zucchetti_postgres'
        ]);
        $insert_count++;
    }
    
    echo "Phonebook sync complete. $insert_count records inserted.\n";

} catch (Exception $e) {
    // Catch any database errors from PDO
    die("An error occurred: " . $e->getMessage());
}

