{{ if or (gt (len .IVRs) 0) (gt (len .Choices) 0) }}
SELECT ivr_name,
       hour AS time£hourDate,
       Sum(num) AS num£num
FROM   graph_hour_ivr
WHERE  hour >= '{{ ExtractSettings "StartHour" }}' AND hour <= '{{ ExtractSettings "EndHour" }}'
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .IVRs) 0 }}
                AND ivr_name in ({{ ExtractStrings .IVRs }})
        {{ end }}
        {{ if gt (len .Choices) 0 }}
            AND choice in ({{ ExtractStrings .Choices }})
        {{ end }}
GROUP BY ivr_name, hour
ORDER BY ivr_name, hour
{{ else }}
SELECT "ivr or choice fields are required" AS "!message";
{{ end }}
