SELECT period  AS period£{{ .Time.Group }}Date,
       qname,
       qdescr,
       min_recall AS recall$min_recall£seconds,
       avg_recall AS recall$avg_recall£seconds,
       max_recall AS recall$max_recall£seconds
FROM   data_summary_recall_{{ .Time.Group }}
WHERE   TRUE
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .Queues) 0 }}
            AND qname in ({{ ExtractStrings .Queues }})
        {{ end }}
LIMIT {{ ExtractSettings "QueryLimit" }}
