SELECT
    inbound,
    hour,
    total AS total£num
FROM dashboard_cdr_4_{{ .Time.CdrDashboardRange }}
{{ if gt (len .Trunks) 0 }}
    WHERE inbound IN ({{ ExtractStrings .Trunks}})
{{ end }}
