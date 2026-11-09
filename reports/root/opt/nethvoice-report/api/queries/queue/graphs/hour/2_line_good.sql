{{ if gt (len .Queues) 0  }}
SELECT CONCAT(qdescr, " (", qname, ")") AS qdescr,
       hour AS time£hourDate,
       Sum(num) AS num£num
FROM   graph_hour_good
WHERE  hour >= '{{ ExtractSettings "StartHour" }}' AND hour <= '{{ ExtractSettings "EndHour" }}'
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .Queues) 0 }}
                AND qname in ({{ ExtractStrings .Queues }})
        {{ end }}
GROUP BY hour,qdescr
{{ else }}
SELECT "queues field is required" AS "!message";
{{ end }}
