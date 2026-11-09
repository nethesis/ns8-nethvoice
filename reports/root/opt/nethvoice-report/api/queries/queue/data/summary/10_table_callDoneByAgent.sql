SELECT period  AS period£{{ .Time.Group }}Date, 
       agentName,
       type AS callType£label,
       total   AS total£num, 
       uniqCallees AS uniqCallees£num, 
       minbill AS duration$min_duration£seconds, 
       avgbill AS duration$avg_duration£seconds, 
       maxbill AS duration$max_duration£seconds,
       totalbill AS duration$total_duration£seconds
FROM   data_summary_agent_{{ .Time.Group }}
WHERE   TRUE
        {{ if and .Time.Interval.Start .Time.Interval.End }}
            AND period >= "{{ .Time.Interval.Start }}"
            AND period <= "{{ .Time.Interval.End }}"
        {{ end }}
        {{ if gt (len .Agents) 0 }}
            AND agentName in ({{ ExtractStrings .Agents }})
        {{ end }}
LIMIT {{ ExtractSettings "QueryLimit" }}
