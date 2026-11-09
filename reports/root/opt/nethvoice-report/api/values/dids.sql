SELECT DISTINCT extension 
FROM   asterisk.incoming 
WHERE  extension NOT LIKE "%X%"; 
