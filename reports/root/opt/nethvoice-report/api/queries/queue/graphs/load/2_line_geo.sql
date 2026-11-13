{{ if gt (len .Origins) 0 }}
SELECT CONCAT(qdescr, " (", qname, ")") AS qdescr, 
       period AS period£{{ .Time.Group }}Date,
       total AS total£num
FROM   distribution_geo_{{ .Time.Group }}
WHERE  TRUE
       {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
       {{ end }}
       {{ if gt (len .Queues) 0 }}
            AND qname in ({{ ExtractStrings .Queues }})
       {{ end }}
       {{ if gt (len .Origins) 0 }}
                AND ({{ ExtractOrigins .Origins false }})
       {{ end }}
ORDER BY qdescr, period£{{ .Time.Group }}Date;
{{ else }}
SELECT "origins field is required" AS "!message";
{{ end }}
