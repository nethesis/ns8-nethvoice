UPDATE `{{ .Table }}`
SET    	cost = billsec * {{ .Cost }} / 60
WHERE  	type = "OUT"
	AND call_type = "{{ .Destination }}"
	AND get_trunk_name(dstchannel) = "{{ .Trunk }}"
