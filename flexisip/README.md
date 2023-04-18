# Flexisip proxy

[Flexisip proxy](https://www.linphone.org/technical-corner/flexisip) for mobile clients.
The proxy handles the connection and notifications for iOS and Android applications.

Logs are sent to Loki but are saved also locally to the container on a volatile file system.
To inspect the log from container use:
```
ssh nethvoice1@localhost
podman exec -ti flexisip more /var/log/flexisip-proxy.log
```

## Environment variables

Relevant environment variables:
- `NETHVOICE_HOST` hostname of the NethVoice server
- `FLEXISIP_PORT` Flexisip listen port
- `REDIS_PORT` Redis listen port
- `APACHE_PORT` Port used for httpd
- `SUBSCRIPTION_SYSTEMID` subscription server SystemID
- `SUBSCRIPTION_SECRET` subcription server secret
- `BRAND_APPID` mobile app application id for push proxy
- `FLEXISIP_LOG_LEVEL` Flexisip log level, valid valures are `debug`, `message`, `warning` and `error`,
  the error log level is also passed to push proxy script
