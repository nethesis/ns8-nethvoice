# nethvoice-report
This repo contains Queue and CDR/Costs reports

## Authentication and authorization

Access to Nethvoice reports is granted to system users using [PAM](https://github.com/msteinert/pam) and [JWT](https://github.com/appleboy/gin-jwt).

### Login process

- Username and password are validated with PAM
- User authorizations (granted queues and groups) are read from a file handled by NethCTI (`/opt/nethvoice-report/queue/user_authorizations.json` by default)
- A JWT token encapsulating user identity and authorizations is created and returned to client
- The client will enclose this token in subsequent report requests

Login requests are handled by `Authenticator` and `PayloadFunc` functions in `middleware.go`

### Report request

- The client enclose JWT token in every report request
- JWT data (user identity, queues and groups granted) is extracted from the token
- Authorization check is performed to ensure that client can access requested report

Report requests are handled by `IdentityHandler` and `Authorizator` functions in `middleware.go`

### Enable debug on api daemon

As default, the api daemon runs using `GIN_MODE=release`, taken from the `REPORTS_GIN_MODE` variable of the NethVoice module.

To switch on debug mode, set the variable and restart the api service (replace `nethvoice1` with the module instance name):
```
runagent -m nethvoice1 python3 -c 'import agent; agent.set_env("REPORTS_GIN_MODE", "debug")'
runagent -m nethvoice1 systemctl --user restart reports-api
```

To go back to the default, run the same commands with `release`.
