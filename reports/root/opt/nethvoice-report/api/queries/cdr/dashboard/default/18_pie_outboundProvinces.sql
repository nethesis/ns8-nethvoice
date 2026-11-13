SELECT
    province,
    total AS total£num
FROM dashboard_cdr_18_{{ .Time.CdrDashboardRange }}
