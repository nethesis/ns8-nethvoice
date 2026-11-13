SELECT Concat(name, "|", Group_concat(extension)) AS groups 
FROM   asterisk.userman_users u 
       JOIN asterisk.rest_cti_users_groups cg 
         ON cg.user_id = u.id 
       JOIN asterisk.rest_cti_groups g 
         ON g.id = cg.group_id 
       JOIN asterisk.rest_devices_phones p 
         ON p.user_id = u.id 
GROUP  BY name; 
