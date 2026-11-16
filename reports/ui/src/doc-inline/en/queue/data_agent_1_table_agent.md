# By Agent

Data broken down *by Agent* and the selected queues during 
the given period.
Data are grouped according to the chosen filter criteria.

The data *by Agent* show the work activity and the load of
phone calls for each selected agent.

The items shown for the *by Agent* data are:

- `Grouping Period`
- `Agent`
- `Queue Number`
- `Queue Name`
- `Working Days`: days with activity in the selected period
- `Login`: total login time in queue. If the agent is static, then `-` is shown
- `Pause`: total pause time in queue
- `After Work`: the total amount of time each queue can grant
at the end of each call answered before submitting another one
- `Effective`: the actual working time which is the difference between the
Login time and the sum of Pause time and After Closing time
- `Calls Total`: total conversation time in answered calls
- `Answered`: total number of calls answered
- `Unanswered`: total number of unanswered calls
- `Transferred`: total number of replies to transfer calls 
- `Calls per hour`: the ratio between the number of answered calls and the
actual time in hours
- `Occupation`: the percentage of actual time spent on the phone
- `Total Recall`: total number of successfully recall
- `Average Recall Time`: average time elapsed from failure to recall
- `Minimum, Maximum and Average Duration`: duration of answered calls

If no agent has been selected, all agent will be shown.
If no queues have been selected, the agents of all available queues will be 
shown.
