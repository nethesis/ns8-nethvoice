SELECT
    inbound,
    month AS month£month,
    total AS total£num
FROM dashboard_cdr_5_{{ .Time.CdrDashboardRange }}
{{ if gt (len .Trunks) 0 }}
    WHERE inbound IN ({{ ExtractStrings .Trunks}})
{{ end }}
