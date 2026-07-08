{{ if gt (len .Agents) 0  }}
SELECT agent,
       hour AS time£hourDate,
       Sum(num) AS num£num
FROM   graph_hour_agents
WHERE  hour >= '{{ ExtractSettings "StartHour" }}' AND hour <= '{{ ExtractSettings "EndHour" }}'
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .Agents) 0 }}
                AND agent in ({{ ExtractStrings .Agents }})
        {{ end }}
GROUP BY agent, hour
ORDER BY agent, hour
{{ else }}
SELECT "agents field is required" AS "!message";
{{ end }}
