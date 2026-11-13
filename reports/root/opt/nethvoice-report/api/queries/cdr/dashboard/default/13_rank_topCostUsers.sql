SELECT
    name,
    cost AS cost£currency
FROM dashboard_cdr_13_{{ .Time.CdrDashboardRange }}
