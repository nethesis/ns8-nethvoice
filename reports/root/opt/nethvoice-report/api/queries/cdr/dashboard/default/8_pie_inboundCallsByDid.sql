SELECT
    did,
    total AS total£num
FROM dashboard_cdr_8_{{ .Time.CdrDashboardRange }}
{{ if gt (len .DIDs) 0 }}
    WHERE did REGEXP ({{ ExtractRegexpStrings .DIDs}})
{{ end }}
