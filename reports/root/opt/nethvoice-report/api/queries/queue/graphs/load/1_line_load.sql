SELECT CONCAT(qdescr, " (", qname, ")") AS qdescr,
       period AS period£{{ .Time.Group }}Date,
       total AS total£num
FROM   graph_load_total_{{ .Time.Group }}
WHERE  TRUE 
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .Queues) 0 }}
                AND qname in ({{ ExtractStrings .Queues }})
        {{ end }}
ORDER BY qdescr, period£{{ .Time.Group }}Date;
