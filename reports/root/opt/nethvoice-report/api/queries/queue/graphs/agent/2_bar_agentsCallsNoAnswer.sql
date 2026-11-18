{{ if gt (len .Queues) 0 }}
SELECT
    CONCAT(qdescr, " (", qname, ")") AS qdescr,
    agent,
    Sum(total) AS total£num
FROM
    graph_agent_noanswer_{{ .Time.Group }}
WHERE  TRUE
    {{ if and .Time.Interval.Start .Time.Interval.End }}
        AND period >= "{{ .Time.Interval.Start }}"
        AND period <= "{{ .Time.Interval.End }}"
    {{ end }}
    {{ if gt (len .Queues) 0 }}
            AND qname in ({{ ExtractStrings .Queues }})
    {{ end }}
GROUP BY
    qdescr,
    agent
ORDER BY agent
{{ else }}
SELECT "queues field is required" AS "!message";
{{ end }}