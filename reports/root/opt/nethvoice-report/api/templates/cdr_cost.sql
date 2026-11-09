UPDATE `{{ .Table }}`
SET    cost = billsec * (SELECT cost / 60
                         FROM   cost_details
                         WHERE  destination = call_type 
                                AND channelid = get_trunk_name(dstchannel))
WHERE  cost IS NULL AND type = "OUT";
