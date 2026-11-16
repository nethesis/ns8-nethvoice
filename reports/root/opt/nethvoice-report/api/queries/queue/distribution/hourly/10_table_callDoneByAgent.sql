{{ if gt (len .Agents) 0 }}
SELECT
	period AS period£{{ .Time.Group }}Date,
	agentNum,
	agentName,
	time_{{ .Time.Division  }} AS `time£num^pivot{{ PivotGroup .Time.Division }}`,
	total AS `{{ ExtractSettings "StartHour" }}-{{ ExtractSettings "EndHour" }}^sum_total£num`
FROM	distribution_hour_agent_{{ .Time.Group }}_{{ .Time.Division  }}
WHERE   time_{{ .Time.Division  }} >= '{{ ExtractSettings "StartHour" }}' AND time_{{ .Time.Division  }} <= '{{ ExtractSettings "EndHour" }}'
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .Agents) 0 }}
            AND agentName in ({{ ExtractStrings .Agents }})
        {{ end }}
GROUP BY period, time_{{ .Time.Division }}
ORDER BY period, agentNum, time_{{ .Time.Division }}
LIMIT {{ ExtractSettings "QueryLimit" }}
{{ else }}
SELECT "agents field is required" AS "!message";
{{ end }}
