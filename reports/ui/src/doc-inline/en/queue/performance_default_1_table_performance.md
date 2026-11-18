# Performace

Data regarding the selected queues useful to summarize the
workload and evaluate pbx *Performance* over time.

The *Performance* data of the queues are used to evaluate current workload and highlight critical issues.

The items shown for *Performace*  are:

- `Grouping Period`
- `Queue number`
- `Queue name`
- `Total incoming calls`
- `Total Calls Fulfilled`: answered calls
- `Percentage on Incoming Calls of Fulfilled Calls`
- `Calls Fulfilled before the service level`: data of
configuration in the queue
- `Percentage on Incoming Calls of Calls Fulfilled before
service level`
- `Total unanswered calls`: missed calls
- `Percentage on incoming calls of unanswered calls`
- `Total Calls not processed due to Abandonment`: calls closed since
caller after the set minimum wait
- `Percentage on Incoming Calls of Abandoned Calls`
- `Total unanswered calls for Timeout`: unanswered calls
within the configured maximum waiting time
- `Percentage on Incoming Calls of Calls in Timeout`
- `Total Unanswered Calls for Exit No Agents`: failed calls for
lack of online / available / free agents
- `Percentage on Incoming Calls of Exit No Agents Calls`
- `Total unanswered calls for Exit Menu`: calls in which the
caller used the Exit Menu to exit the queue
- `Percentage on Incoming Calls of Calls in Exit Menu`
- `Total unanswered calls for Full Queue`: calls not entered in
queue for maximum number of calls waiting in queue reached
- `Percentage on Incoming Calls of Calls in Full Queue`
- `Total unanswered calls for Entry No Agents`: calls not
queue due to absence of online / available / free agents
- `Percentage on Incoming Calls of Entry No Agents Calls`
- `Total Recall`: total number of successfully recall
- `Recall Percentage`: percentage of successfully recall on total amount of failed calls
- `Average Recall Time`: average time elapsed from failure to recall
- `Total Null Calls`: calls queued and closed since
caller before the set minimum wait
- `Percentage of Incoming Calls of Null Calls`
- `Total Not Managed calls`: number of calls wich last interaction failed
- `Percentage of Not Managed calls`: percentage of not managed calls on the total calls
- `Maximum, minimum, average wait`: before the answer
- `Maximum, minimum and average call duration`

If no queues have been selected, the data of all available 
queues will be shown.
