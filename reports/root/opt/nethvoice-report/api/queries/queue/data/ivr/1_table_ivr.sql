SELECT
    period AS period£{{ .Time.Group }}Date,
    ivr_id,
    ivr_name,
    choice,
    tot AS tot£num
FROM
    data_ivr_{{ .Time.Group }}
WHERE   TRUE
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .Choices) 0 }}
            AND choice in ({{ ExtractStrings .Choices }})
        {{ end }}
        {{ if gt (len .IVRs) 0 }}
            AND ivr_name in ({{ ExtractStrings .IVRs }})
        {{ end }}
LIMIT {{ ExtractSettings "QueryLimit" }}
