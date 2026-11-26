# Janus

Janus-gateway container for NethServer 8

The entrypoint prefixes every stdout/stderr line with `[janus]`, including
startup banners and library output. Lines already carrying the prefix are
left unchanged. `JANUS_DEBUG_LEVEL` controls Janus's logger; messages that
bypass that logger may still appear at lower levels.

## Environment variables

- `LOCAL_IP` local IP address to bind to for SIP stack and media
- `JANUS_RTPSTART` and `JANUS_RTPEND` are the UDP port range for WebRTC RTP packages
- `JANUS_SIP_RTPSTART` and `JANUS_SIP_RTPEND` are the UDP port range for SIP plugin RTP packages towards Asterisk
- `ICEENFORCE` list of interfaces or ip addresses to enforce ICE candidates gathering. Default is 'none'
- `ICEIGNORE` list of interfaces to ignore. Default is 'vmnet,tap,tun,virb,vb-' https://github.com/meetecho/janus-gateway#configure-and-start
- `STUNSERVER` STUN server. Default is stun1.l.google.com
- `STUNPORT` STUN port. Default is 19302
- `JANUS_DEBUG_LEVEL` defaults to 3 (warnings and errors). With `JANUS_ADMIN_SECRET` set, levels 5–7 emit a startup warning because they can log the key.
- `JANUS_ADMIN_SECRET` is the per-instance `admin_key` for creating AudioBridge and TextRoom rooms and Streaming mountpoints. NethVoice supplies it through `passwords.env`.
