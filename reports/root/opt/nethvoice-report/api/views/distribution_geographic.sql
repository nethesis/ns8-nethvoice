DROP TABLE IF EXISTS distribution_geo_year_regione;
DROP TABLE IF EXISTS distribution_geo_year_provincia;
DROP TABLE IF EXISTS distribution_geo_year_comune;
DROP TABLE IF EXISTS distribution_geo_year_prefisso;

DROP TABLE IF EXISTS distribution_geo_month_regione;
DROP TABLE IF EXISTS distribution_geo_month_provincia;
DROP TABLE IF EXISTS distribution_geo_month_comune;
DROP TABLE IF EXISTS distribution_geo_month_prefisso;

DROP TABLE IF EXISTS distribution_geo_week_regione;
DROP TABLE IF EXISTS distribution_geo_week_provincia;
DROP TABLE IF EXISTS distribution_geo_week_comune;
DROP TABLE IF EXISTS distribution_geo_week_prefisso;

DROP TABLE IF EXISTS distribution_geo_day_regione;
DROP TABLE IF EXISTS distribution_geo_day_provincia;
DROP TABLE IF EXISTS distribution_geo_day_comune;
DROP TABLE IF EXISTS distribution_geo_day_prefisso;

CREATE TABLE distribution_geo_year_regione AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       regione IS NOT NULL
GROUP BY
       period,
       qname,
       regione
ORDER BY
       period,
       qname,
       regione;

CREATE TABLE distribution_geo_year_provincia AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       provincia IS NOT NULL
GROUP BY
       period,
       qname,
       provincia
ORDER BY
       period,
       qname,
       provincia;

CREATE TABLE distribution_geo_year_comune AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       comune IS NOT NULL
GROUP BY
       period,
       qname,
       comune
ORDER BY
       period,
       qname,
       comune;

CREATE TABLE distribution_geo_year_prefisso AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       prefisso IS NOT NULL
GROUP BY
       period,
       qname,
       prefisso
ORDER BY
       period,
       qname,
       prefisso;


CREATE TABLE distribution_geo_month_regione AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       regione IS NOT NULL
GROUP BY
       period,
       qname,
       regione
ORDER BY
       period,
       qname,
       regione;

CREATE TABLE distribution_geo_month_provincia AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       provincia IS NOT NULL
GROUP BY
       period,
       qname,
       provincia
ORDER BY
       period,
       qname,
       provincia;

CREATE TABLE distribution_geo_month_comune AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       comune IS NOT NULL
GROUP BY
       period,
       qname,
       comune
ORDER BY
       period,
       qname,
       comune;

CREATE TABLE distribution_geo_month_prefisso AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       prefisso IS NOT NULL
GROUP BY
       period,
       qname,
       prefisso
ORDER BY
       period,
       qname,
       prefisso;


CREATE TABLE distribution_geo_week_regione AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       regione IS NOT NULL
GROUP BY
       period,
       qname,
       regione
ORDER BY
       period,
       qname,
       regione;

CREATE TABLE distribution_geo_week_provincia AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       provincia IS NOT NULL
GROUP BY
       period,
       qname,
       provincia
ORDER BY
       period,
       qname,
       provincia;

CREATE TABLE distribution_geo_week_comune AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       comune IS NOT NULL
GROUP BY
       period,
       qname,
       comune
ORDER BY
       period,
       qname,
       comune;

CREATE TABLE distribution_geo_week_prefisso AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%x-W%v") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       prefisso IS NOT NULL
GROUP BY
       period,
       qname,
       prefisso
ORDER BY
       period,
       qname,
       prefisso;


CREATE TABLE distribution_geo_day_regione AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       regione IS NOT NULL
GROUP BY
       period,
       qname,
       regione
ORDER BY
       period,
       qname,
       regione;

CREATE TABLE distribution_geo_day_provincia AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       provincia IS NOT NULL
GROUP BY
       period,
       qname,
       provincia
ORDER BY
       period,
       qname,
       provincia;

CREATE TABLE distribution_geo_day_comune AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       comune IS NOT NULL
GROUP BY
       period,
       qname,
       comune
ORDER BY
       period,
       qname,
       comune;

CREATE TABLE distribution_geo_day_prefisso AS
SELECT
       Date_format(From_unixtime(timestamp_in), "%Y-%m-%d") AS period,
       qname,
       qdescr,
       regione,provincia,comune,prefisso,
       Count(id) AS total
FROM
       report_queue_callers
WHERE
       prefisso IS NOT NULL
GROUP BY
       period,
       qname,
       prefisso
ORDER BY
       period,
       qname,
       prefisso;
