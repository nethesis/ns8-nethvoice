SELECT
    CONCAT(ivr_name, " (", ivr_id, ")", " (", choice, ")") AS ivr_name,
    time_60 AS `time£hourDate`,
    Sum(tot) AS `num£num`
FROM
    distribution_hour_ivr_{{ .Time.Group }}_60
WHERE  time_60 >= '{{ ExtractSettings "StartHour" }}' AND time_60 <= '{{ ExtractSettings "EndHour" }}'
    {{ if and .Time.Interval.Start .Time.Interval.End }}
        AND period >= "{{ .Time.Interval.Start }}"
        AND period <= "{{ .Time.Interval.End }}"
    {{ end }}
    {{ if gt (len .IVRs) 0 }}
            AND ivr_name in ({{ ExtractStrings .IVRs }})
    {{ end }}
    {{ if gt (len .Choices) 0 }}
        AND choice in ({{ ExtractStrings .Choices }})
    {{ end }}
GROUP BY
    time_60,
    choice
ORDER BY
    ivr_name,
    time_60;