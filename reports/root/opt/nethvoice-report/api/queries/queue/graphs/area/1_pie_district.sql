{{ if gt (len .Queues) 0  }}
SELECT comune, 
       sum(total) AS total£num
FROM   distribution_geo_{{ .Time.Group }}_comune
WHERE  TRUE
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .Queues) 0 }}
                AND qname in ({{ ExtractStrings .Queues }})
        {{ end }}
GROUP BY comune
ORDER  BY total£num DESC,
          comune;
{{ else }}
SELECT "queues field is required" AS "!message";
{{ end }}
