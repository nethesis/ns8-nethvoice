-- rest_devices_phones collation is set by nethvoice-db-init

SELECT Concat(Coalesce(vendor, ""), ",", Coalesce(model, ""), ",", 
              Coalesce(extension, ""), ",", Coalesce(type, "")) 
FROM   asterisk.rest_devices_phones 
WHERE  extension IS NOT NULL
UNION
SELECT Concat(",", ",", exten, ",", "meetme")
FROM   asterisk.meetme
UNION
SELECT Concat(",", ",", grpnum, ",", "ringgroups")
FROM   asterisk.ringgroups;
