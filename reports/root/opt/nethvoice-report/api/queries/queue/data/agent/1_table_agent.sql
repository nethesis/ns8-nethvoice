SELECT
    period AS `period£{{ .Time.Group }}Date`,
    agent,
    qname,
    qdescr,
    IF(login > 0, logon, NULL) as `activity$logonDays£num`,
    IF(login > 0, login, NULL) as `activity$login£seconds#`,
    pause as `activity$pause£seconds#`,
    afterwork as `activity$afterwork£seconds#`,
    IF(login > 0, login - pause - afterwork, NULL) as `activity$effective£seconds#`,
    totcall as `load$totCall£seconds`,
    answered as `load$answered£num#`,
    unanswered as `load$unAnswered£num#`,
    transfered as `load$transfered£num#`,
    IF((login - pause)>=0,round(answered / ((login - pause) / 3600), 2), NULL) as `load$callOnHour£num#`,
    IF((login - pause)>=0,round((totcall / (login - pause)*100), 2), NULL) as `load$occupation£percent#`,
    total_recall as `load$totalRecall£num#`,
    avg_recall as `load$avgRecall£seconds#`,
    min_duration as `duration$min_duration£seconds`,
    max_duration as `duration$max_duration£seconds`,
    avg_duration as `duration$avg_duration£seconds`
FROM data_agent_{{ .Time.Group }}
WHERE TRUE
    {{ if and .Time.Interval.Start .Time.Interval.End }}
        AND period >= "{{ .Time.Interval.Start }}"
        AND period <= "{{ .Time.Interval.End }}"
    {{ end }}
    {{ if gt (len .Queues) 0 }}
        AND qname in ({{ ExtractStrings .Queues }})
    {{ end }}
    {{ if gt (len .Agents) 0 }}
        AND agent in ({{ ExtractStrings .Agents }})
    {{ end }}
LIMIT {{ ExtractSettings "QueryLimit" }}
