SELECT
    province,
    total AS total£num
FROM dashboard_cdr_7_{{ .Time.CdrDashboardRange }}
