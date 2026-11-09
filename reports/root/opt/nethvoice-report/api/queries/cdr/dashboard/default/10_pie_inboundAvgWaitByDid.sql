SELECT
    did,
    avg_wait as avgHold£seconds
FROM dashboard_cdr_10_{{ .Time.CdrDashboardRange }}
{{ if gt (len .DIDs) 0 }}
    WHERE did REGEXP ({{ ExtractRegexpStrings .DIDs}})
{{ end }}
