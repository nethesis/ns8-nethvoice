# Janus

Janus-gateway container for NethServer 8

## Environment variables

- `LOCAL_IP` local IP address to bind to for SIP stack and media
- `JANUS_RTPSTART` and `JANUS_RTPEND` are the UDP port range for RTP packages
- `ICEIGNORE` list of interfaces to ignore. Default is 'vmnet,tap,tun,virb,vb-' https://github.com/meetecho/janus-gateway#configure-and-start
- `STUNSERVER` STUN server. Default is stun1.l.google.com
- `STUNPORT` STUN port. Default is 19302
- `JANUS_DEBUG_LEVEL` Debug/logging level (0=disable debugging, 7=maximum debug level; default=4)
