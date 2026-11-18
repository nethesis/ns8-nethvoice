# Tasks
This CLI is used to perform some actions to precalculate data or filters for the API and the UI.

# Synopsis
```bash
[root@ns78 ~]# /path/to/tasks/command/tasks help
NethVoice reports support CLI

Usage:
  tasks [command]

Available Commands:
  cdr         Group cdr records into date-based tables (by year, month, week etc...)
  cost        Calculate cost for each record based on cost configuration
  help        Help about any command
  phonebook   Find all numbers in phonebook and save to cache
  queries     Execute all report queries applying all saved filters
  values      Calculate all possible values to show in filters
  version     Show NethVoice Tasks support CLI version
  views       Calculate query views to combine data and columns

Flags:
  -h, --help   help for tasks

Use "tasks [command] --help" for more information about a command.
```

## CDR command
`cdr` command can be executed in 2 modes:
- **without flags**, update all cdr table and set the correct call type destination
- **with flags**, update only specific records of specific table with a particular call type destionation configuration

Example
```
/path/to/tasks/command/tasks cdr --from "2018-01-01" --to "2020-12-31" --destination "PayPay" --pattern "8"
```
Updates only records between *01 January 2018* and *31 December 2020* with new destination *PayPay* and pattern prefix *8*

```
[root@ns78 ~]# /path/to/tasks/command/tasks cdr -h
Group cdr records into date-based tables (by year, month, week etc...)

Usage:
  tasks cdr [flags]

Flags:
  -d, --destination string   Type of call to update: national, international, cell etc...
  -f, --from string          Date interval <from> to update cdr records
  -h, --help                 help for cdr
  -p, --pattern string       Pattern to match dst number. Ex. 00390 to match italian national numbers
  -t, --to string            Date interval <to> to update cdr records
```

## Cost command
`cost` command can be executed in 2 modes:
- **without flags**, update all cdr table and set the correct costs
- **with flags**, update only specific records of specific table with a particular cost configuration

Example
```
/path/to/tasks/command/tasks cost --from "2020-09-30" --to "2020-12-31" --cost "1" --destination "Mobile" --trunk "Patton_2001"
```
Updates only records between *30 September 2020* and *31 December 2020* for destination *Mobile* and trunk *Patton_123*

```
[root@ns78 ~]# /path/to/tasks/command/tasks cost -h
Calculate cost for each record based on cost configuration

Usage:
  tasks cost [flags]

Flags:
  -c, --cost string          Cost value to update
  -d, --destination string   Type of call to update: national, international, cell etc...
  -f, --from string          Date interval <from> to update costs
  -h, --help                 help for cost
  -t, --to string            Date interval <to> to update costs
  -u, --trunk string         Trunk used with specific destination to update
```
