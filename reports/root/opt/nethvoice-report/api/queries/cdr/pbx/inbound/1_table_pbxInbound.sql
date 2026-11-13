SELECT
    linkedid,
	accountcode,
	peeraccount,
    DATE_FORMAT(calldate, '%Y-%m-%d %H:%i:%s') AS time£hourDate,
    {{ MaskSrcSQL .Privacy .UserExtensions }} AS src£phoneNumber,
    {{ MaskDstSQL .Privacy .UserExtensions }} AS dst£phoneNumber,
    type AS call_type£label,
    IF(dispositions LIKE '%ANSWERED%', 'ANSWERED', SUBSTRING_INDEX(dispositions, ',',- 1)) AS result£label, -- get last disposition
    duration AS totalDuration£seconds,
    billsec AS billsec£seconds,
	did
FROM	`<CDR_TABLE>`
WHERE	calldate >= "{{ .Time.Interval.Start }}"
	AND calldate <= "{{ .Time.Interval.End }}"
	AND type = "IN"
	{{ if (and (gt (len .Sources) 0) (gt (len .Destinations) 0)) }}
          AND (IF(cnum IS NULL OR cnum = "", src, cnum) REGEXP ({{ ExtractRegexpSrcOrDst .Sources }}) AND dst REGEXP ({{ ExtractRegexpSrcOrDst .Destinations }}))
        {{ else if gt (len .Sources) 0 }}
          AND IF(cnum IS NULL OR cnum = "", src, cnum) REGEXP ({{ ExtractRegexpSrcOrDst .Sources }})
        {{ else if gt (len .Destinations) 0 }}
          AND dst REGEXP ({{ ExtractRegexpSrcOrDst .Destinations }})
        {{ else }}
        {{ end }}
	{{ if gt (len .DIDs) 0 }}
	  AND did REGEXP ({{ ExtractRegexpStrings .DIDs}})
	{{ end }}
	{{ if .CallType }}
	  AND ({{ ExtractDispositions .CallType }})
	{{ end }}
	{{ if .Duration }}
	  AND duration <= {{ .Duration }}
	{{ end }}
	{{ if gt (len .Trunks) 0 }}
	  AND channel REGEXP ({{ ExtractRegexpTrunks .Trunks}})
	{{ end }}
	{{ if gt (len .CallDestinations) 0 }}
	  AND ({{ ExtractCallDestinations .CallDestinations }})
	{{ end }}
