SELECT
    inbound,
    avg_wait as avgHold£seconds
FROM dashboard_cdr_3_{{ .Time.CdrDashboardRange }}
{{ if gt (len .Trunks) 0 }}
    WHERE inbound IN ({{ ExtractStrings .Trunks}})
{{ end }}
