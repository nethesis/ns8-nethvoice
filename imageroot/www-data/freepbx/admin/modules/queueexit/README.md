# QueueExit FreePBX Module
QueueExit FreePBX module allow to configure a different destination for failed calls of a queue.
This module can choose a different destination based on the value of QUEUESTATUS variable.

## Configuration

You can find module interface in FreePBX menu under Applications->Queue Exit

Adding a new Queue Exit creates a destinations that queues can use.

It is possible to differentiate the destination of the call based on the value of the QUEUESTATUS variable, the expected cases are:

- TIMEOUT
- FULL
- JOINEMPTY
- LEAVEEMPTY
- JOINUNAVAIL
- LEAVEUNAVAIL
- CONTINUE

## License

GPL v2
