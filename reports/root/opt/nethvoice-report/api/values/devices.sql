/* 
   ensure we have the same collation (on rest_devices_phones the collation
   is not defined, and the UNION exit with error).
*/
ALTER TABLE asterisk.rest_devices_phones convert TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
