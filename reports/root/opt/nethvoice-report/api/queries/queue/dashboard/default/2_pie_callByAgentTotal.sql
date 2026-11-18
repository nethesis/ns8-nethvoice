SELECT
    agent,
    sum(total) AS `total£num`
FROM
    dashboard_call_byagent_{{ .Time.Group }}
WHERE  TRUE
    {{ if and .Time.Interval.Start .Time.Interval.End }}
        AND period >= "{{ .Time.Interval.Start }}"
        AND period <= "{{ .Time.Interval.End }}"
    {{ end }}
    {{ if gt (len .Agents) 0 }}
        AND agent in ({{ ExtractStrings .Agents }})
    {{ end }}
GROUP BY
    agent
ORDER BY `total£num` desc, agent;