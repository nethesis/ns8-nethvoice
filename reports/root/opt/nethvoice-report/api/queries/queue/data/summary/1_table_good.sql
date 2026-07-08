SELECT
    period AS period£{{ .Time.Group }}Date,
    qname,
    qdescr,
    uniqCid AS uniqCid£num,
    num AS num£num,
    max_hold AS waiting$max_hold£seconds,
    min_hold AS waiting$min_hold£seconds,
    avg_hold AS waiting$avg_hold£seconds,
    max_duration AS duration$max_duration£seconds,
    min_duration AS duration$min_duration£seconds,
    avg_duration AS duration$avg_duration£seconds,
    max_position AS position$max_position£num,
    avg_position AS position$avg_position£num
FROM
    data_summary_good_{{ .Time.Group }}
WHERE   TRUE
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .Queues) 0 }}
            AND qname in ({{ ExtractStrings .Queues }})
        {{ end }}
LIMIT {{ ExtractSettings "QueryLimit" }}
