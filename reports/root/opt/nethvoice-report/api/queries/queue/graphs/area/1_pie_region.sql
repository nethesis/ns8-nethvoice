{{ if gt (len .Queues) 0  }}
SELECT regione, 
       sum(total) AS total£num
FROM   distribution_geo_{{ .Time.Group }}_regione
WHERE  TRUE 
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .Queues) 0 }}
                AND qname in ({{ ExtractStrings .Queues }})
        {{ end }}
GROUP BY regione
ORDER  BY total£num DESC, 
          regione; 
{{ else }}
SELECT "queues field is required" AS "!message";
{{ end }}
