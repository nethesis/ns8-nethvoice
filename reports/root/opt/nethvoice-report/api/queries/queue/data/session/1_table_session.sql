SELECT
    qname,
    qdescr,
    IF(
        locate('@', agent) > 0,
        substring_index(substring_index(agent, '/', -2), '@', 1),
        substring_index(substring_index(agent, '/', -1), '-', 1)
    ) AS agent,
    action AS action£label,
    Date_format(From_unixtime(timestamp_in), "%Y-%m-%d %H:%i:%s") AS start£hourDate,
    Date_format(From_unixtime(timestamp_out), "%Y-%m-%d %H:%i:%s") AS end£hourDate,
    (timestamp_out - timestamp_in) AS duration£seconds,
    IF(action = 'logon', "", reason) as reason
FROM
    agentsessions
WHERE TRUE
    {{ if and .Time.Interval.Start .Time.Interval.End }}
        AND Date_format(From_unixtime(timestamp_in), "%Y-%m-%d %H:%i:%s") >= "{{ .Time.Interval.Start }}"
        AND Date_format(From_unixtime(timestamp_out), "%Y-%m-%d %H:%i:%s") <= "{{ .Time.Interval.End }}"
    {{ end }}
    {{ if gt (len .Queues) 0 }}
        AND qname in ({{ ExtractStrings .Queues }})
    {{ end }}
    {{ if gt (len .Agents) 0 }}
        AND IF(
            locate('@', agent) > 0,
            substring_index(substring_index(agent, '/', -2), '@', 1),
            substring_index(substring_index(agent, '/', -1), '-', 1)
        ) in ({{ ExtractStrings .Agents }})
    {{ end }}
    {{ if gt (len .Reasons) 0 }}
        AND reason in ({{ ExtractStrings .Reasons }})
    {{ end }}
ORDER BY
    qname,
    agent,
    timestamp_in
LIMIT {{ ExtractSettings "QueryLimit" }}
