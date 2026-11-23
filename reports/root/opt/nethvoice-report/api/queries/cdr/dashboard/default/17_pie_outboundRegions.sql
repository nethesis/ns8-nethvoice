SELECT
    region,
    total AS total£num
FROM dashboard_cdr_17_{{ .Time.CdrDashboardRange }}
