SELECT
    agentName AS agent,
    Sum(total) AS total£num
FROM
    distribution_hour_agent_{{ .Time.Group }}_60
WHERE  TRUE
    {{ if and .Time.Interval.Start .Time.Interval.End }}
        AND period >= "{{ .Time.Interval.Start }}"
        AND period <= "{{ .Time.Interval.End }}"
    {{ end }}
    {{ if gt (len .Agents) 0 }}
        AND agentName in ({{ ExtractStrings .Agents }})
    {{ end }}
GROUP BY
    agent
ORDER BY total£num desc, agent
