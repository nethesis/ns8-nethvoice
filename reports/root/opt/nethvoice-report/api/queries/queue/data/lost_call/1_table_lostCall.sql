{{ if and .Time.Interval.Start .Time.Interval.End }}
SELECT
    period as `period£hourDate`,
    qname,
    qdescr,
    cid,
    name,
    company,
    direction AS direction£label,
    reason AS reason£label
FROM
    data_lost
WHERE   TRUE
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }} 00:00:00"
            AND period <= "{{ .Time.Interval.End }} 23:59:59"
        {{ end }}
        {{ if gt (len .Phones) 0 }}
            AND cid in ({{ ExtractPhones .Phones true }})
        {{ end }}
        {{ if .Caller }}
            AND cid LIKE "{{ .Caller }}%"
        {{ end }}
        {{ if gt (len .Queues) 0 }}
            AND qname in ({{ ExtractStrings .Queues }})
        {{ end }}
        {{ if gt (len .Reasons) 0 }}
            AND reason in ({{ ExtractStrings .Reasons }})
        {{ end }}
LIMIT {{ ExtractSettings "QueryLimit" }}
{{ else }}
SELECT "timeIntervalStart and timeIntervalEnd are required" AS "!message";
{{ end }}
