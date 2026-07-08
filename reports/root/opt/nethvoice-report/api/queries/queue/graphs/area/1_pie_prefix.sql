{{ if gt (len .Queues) 0  }}
SELECT prefisso,
       sum(total) AS total£num
FROM   distribution_geo_{{ .Time.Group }}_prefisso
WHERE  TRUE
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .Queues) 0 }}
                AND qname in ({{ ExtractStrings .Queues }})
        {{ end }}
GROUP BY prefisso
ORDER  BY total£num DESC,
          prefisso;
{{ else }}
SELECT "queues field is required" AS "!message";
{{ end }}
