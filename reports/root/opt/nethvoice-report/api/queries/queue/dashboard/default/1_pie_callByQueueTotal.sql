SELECT
    CONCAT(qdescr, " (", qname, ")") AS qdescr,
    sum(total) AS `total£num`
FROM
    distribution_hour_total_{{ .Time.Group }}_60
WHERE  TRUE
    {{ if and .Time.Interval.Start .Time.Interval.End }}
        AND period >= "{{ .Time.Interval.Start }}"
        AND period <= "{{ .Time.Interval.End }}"
    {{ end }}
    {{ if gt (len .Queues) 0 }}
        AND qname in ({{ ExtractStrings .Queues }})
    {{ end }}
GROUP BY
    qname
ORDER BY `total£num` desc, qname;