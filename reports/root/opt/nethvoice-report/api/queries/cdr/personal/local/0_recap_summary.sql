<CDR_SELECT: type,call_type,sum(total£num) AS "total£num",sum(answered£num) AS "answered£num",sum(noAnswer£num) AS "noAnswer£num",sum(busy£num) AS "busy£num",sum(failed£num) AS "failed£num",sum(totalDuration£seconds) AS "totalDuration£seconds",avg(avgDuration£seconds) AS "avgDuration£seconds",sum(totalCost£currency) AS "totalCost£currency",avg(avgCost£currency) AS "avgCost£currency",sum(totalWait£seconds) AS "totalWait£seconds",avg(avgWait£seconds) AS "avgWait£seconds", sum(totalEffectiveDuration£seconds) AS "totalEffectiveDuration£seconds">
SELECT type,
       call_type,	
       Count(*)                                                 AS "total£num", 
       Sum(IF(dispositions LIKE '%ANSWERED%', 1, 0))           AS "answered£num", 
       Sum(IF(dispositions NOT LIKE '%ANSWERED%' AND dispositions LIKE '%NO ANSWER', 1, 0))          AS "noAnswer£num", 
       Sum(IF(dispositions NOT LIKE '%ANSWERED%' AND dispositions LIKE '%BUSY', 1, 0))               AS "busy£num", 
       Sum(IF(dispositions NOT LIKE '%ANSWERED%' AND ( dispositions LIKE '%FAILED' 
                 OR dispositions LIKE '%CONGESTION' ), 1, 0)) AS "failed£num",
       Sum(duration)						AS "totalDuration£seconds",	
       Avg(duration)                                            AS "avgDuration£seconds",
       Sum(COALESCE(cost,0))					AS "totalCost£currency",
       Avg(COALESCE(cost,0))                                    AS "avgCost£currency", 
       Sum(duration) - Sum(billsec)				AS "totalWait£seconds",
       Avg(duration) - Avg(billsec)                             AS "avgWait£seconds", 
       Sum(duration) - (Sum(duration) - Sum(billsec))           AS "totalEffectiveDuration£seconds" 
FROM   `<CDR_TABLE>`
WHERE	calldate >= "{{ .Time.Interval.Start }}"
	AND calldate <= "{{ .Time.Interval.End }}"
	AND type = "LOCAL"
	{{ if (and (gt (len .Sources) 0) (gt (len .Destinations) 0)) }}
	  AND (IF(cnum IS NULL OR cnum = "", src, cnum) REGEXP ({{ ExtractRegexpSrcOrDst .Sources }}) OR dst REGEXP ({{ ExtractRegexpSrcOrDst .Destinations }}))
	{{ else if gt (len .Sources) 0 }}
	  AND IF(cnum IS NULL OR cnum = "", src, cnum) REGEXP ({{ ExtractRegexpSrcOrDst .Sources }})
	{{ else if gt (len .Destinations) 0 }}
	  AND dst REGEXP ({{ ExtractRegexpSrcOrDst .Destinations }})
	{{ else }}
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
<CDR_GROUP: type, call_type>
<CDR_ORDER: type, call_type>
