{{ if gt (len .Queues) 0  }}
SELECT CONCAT(qdescr, " (", qname, ")") AS qdescr,
       time_{{ .Time.Division  }} AS time£hourDate,
       Avg(avg_position) AS avgPosition£num
FROM   graph_queue_position_{{ .Time.Division }}
WHERE  time_{{ .Time.Division  }} >= '{{ ExtractSettings "StartHour" }}' AND time_{{ .Time.Division  }} <= '{{ ExtractSettings "EndHour" }}'
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .Queues) 0 }}
                AND qname in ({{ ExtractStrings .Queues }})
        {{ end }}
GROUP BY time_{{ .Time.Division }},qdescr
ORDER BY qdescr,time_{{ .Time.Division }}
{{ else }}
SELECT "queues field is required" AS "!message";
{{ end }}
