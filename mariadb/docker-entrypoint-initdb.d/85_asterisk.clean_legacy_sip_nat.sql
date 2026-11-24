-- FreePBX imports these chan_sip fields into general PJSIP settings on install.
DELETE FROM asterisk.sipsettings
WHERE keyword = 'externip_val' OR keyword REGEXP '^(localnet|netmask)_';
