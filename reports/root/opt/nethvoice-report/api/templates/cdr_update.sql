UPDATE `{{ .Table }}`
SET 	call_type = "{{ .Destination }}"
WHERE 	dst LIKE "{{ .Pattern }}%"
	AND type = "OUT";
