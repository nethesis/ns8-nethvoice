SELECT
    outbound,
    total AS total£num
FROM dashboard_cdr_14_{{ .Time.CdrDashboardRange }}
{{ if gt (len .Trunks) 0 }}
    WHERE outbound IN ({{ ExtractStrings .Trunks}})
{{ end }}
