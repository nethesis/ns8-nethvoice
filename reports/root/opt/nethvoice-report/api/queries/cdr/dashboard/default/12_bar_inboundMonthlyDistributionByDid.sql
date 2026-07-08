SELECT
    did,
    month AS month£month,
    total AS total£num
FROM dashboard_cdr_12_{{ .Time.CdrDashboardRange }}
{{ if gt (len .DIDs) 0 }}
    WHERE did REGEXP ({{ ExtractRegexpStrings .DIDs}})
{{ end }}
