SELECT
    "total" AS `total£label`,
    time_60 AS `time£hourDate`,
    sum(total) AS `num£num`
FROM
    distribution_hour_total_{{ .Time.Group }}_60
WHERE  time_60 >= '{{ ExtractSettings "StartHour" }}' AND time_60 <= '{{ ExtractSettings "EndHour" }}'
    {{ if and .Time.Interval.Start .Time.Interval.End }}
        AND period >= "{{ .Time.Interval.Start }}"
        AND period <= "{{ .Time.Interval.End }}"
    {{ end }}
    {{ if gt (len .Queues) 0 }}
        AND qname in ({{ ExtractStrings .Queues }})
    {{ end }}
GROUP BY
    time_60;
