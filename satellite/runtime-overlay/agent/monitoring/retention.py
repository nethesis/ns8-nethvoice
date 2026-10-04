"""NS8 retention entrypoint. Credentials stay in the container environment."""
import os
import sys
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def main():
    try:
        port = int(os.environ["HTTP_PORT"])
        if not 0 < port < 65536:
            raise ValueError()
        token = os.environ["API_TOKEN"]
        request = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/agent/v1/monitoring/retention", data=b"",
            headers={"Authorization": "Bearer " + token}, method="POST")
        # Loopback only; do not inherit an outbound proxy configuration.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        with opener.open(request, timeout=8) as response:
            if response.status != 200:
                raise ValueError()
        return 0
    except (KeyError, ValueError, OSError, urllib.error.URLError):
        print("Agent monitoring retention unavailable", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
