SELECT
    region,
    total AS total£num
FROM dashboard_cdr_6_{{ .Time.CdrDashboardRange }}
