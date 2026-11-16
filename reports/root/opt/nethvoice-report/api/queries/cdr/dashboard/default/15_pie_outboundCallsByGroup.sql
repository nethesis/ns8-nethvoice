SELECT
    cti_group,
    total AS total£num
FROM dashboard_cdr_15_{{ .Time.CdrDashboardRange }}
