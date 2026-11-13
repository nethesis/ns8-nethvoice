SELECT
    cti_group,
    cost AS cost£currency
FROM dashboard_cdr_16_{{ .Time.CdrDashboardRange }}
