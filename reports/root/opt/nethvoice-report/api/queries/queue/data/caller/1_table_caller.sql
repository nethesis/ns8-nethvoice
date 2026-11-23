{{ if not (and .Time.Interval.Start .Time.Interval.End) }}
 SELECT "timeIntervalStart and timeIntervalEnd are required" AS "!message";
{{ else }}
SELECT
    period AS `period£{{ .Time.Group }}Date`,
    cid,
    cid AS `name£phonebookName`,
    cid AS `company£phonebookCompany`,
    qname,
    qdescr,
    `total` AS `results$total£num`,
    `good` AS `results$good£num#`,
    `failed` AS `results$failed£num#`,
    `timeout` AS `results$timeout£num#`,
    `exitempty` AS `results$exitempty£num#`,
    `exitkey` AS `results$exitkey£num#`,
    `full` AS `results$full£num#`,
    `joinempty` AS `results$joinempty£num#`,
    `null` AS `results$null£num#`,
    total_recall AS `results$totalRecall£num`,
    avg_recall AS `results$avgRecall£seconds`,
    min_hold AS `hold$min_hold£seconds#`,
    avg_hold AS `hold$avg_hold£seconds`,
    max_hold AS `hold$max_hold£seconds#`,
    min_duration AS `duration$min_duration£seconds#`,
    avg_duration AS `duration$avg_duration£seconds`,
    max_duration AS `duration$max_duration£seconds#`,
    min_position AS `position$min_position£num#`,
    avg_position AS `position$avg_position£num`,
    max_position AS `position$max_position£num#`
FROM
    data_caller_{{ .Time.Group }}
WHERE   TRUE
    {{ if and .Time.Interval.Start .Time.Interval.End }}
        AND period >= "{{ .Time.Interval.Start }}"
        AND period <= "{{ .Time.Interval.End }}"
    {{ end }}
    {{ if gt (len .Queues) 0 }}
        AND qname in ({{ ExtractStrings .Queues }})
    {{ end }}
    {{ if .Caller }}
        AND cid LIKE "{{ .Caller }}%"
    {{ end }}
    {{ if gt (len .Phones) 0 }}
        AND cid in ({{ ExtractPhones .Phones true }})
    {{ end }}
LIMIT {{ ExtractSettings "QueryLimit" }}
{{ end }}
