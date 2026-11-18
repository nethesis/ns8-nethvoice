---
title: Home
nav_order: 0
---

# Tancredi

Tancredi is a file-backed IP phone provisioning engine for internet and LAN
deployments, released under the GNU Affero General Public License v3.0.

The current runtime stack is PHP 8.1+, Slim 4, Twig 3 and Monolog 3.

## Phone provisioning

An IP phone connects to Tancredi over HTTP and fetches one or more files
containing its configuration.

- The provisioning entrypoint maps a requested file name to a scope and a
  template through the rules under `data/patterns.d/`.

- The rendered configuration is built from merged defaults, model and phone
  variables, then optionally processed by one or more runtime filters.

- Each phone has two provisioning tokens: `tok1` for first access and `tok2`
  for steady-state provisioning. A successful request authenticated with
  `tok2` invalidates `tok1`.

- Some vendors start with a tokenless bootstrap request. In that path,
  Tancredi strips secrets from the rendered payload and instructs the phone to
  reconnect through the tokenized URL.

See [Provisioning flow and security]({{ '/provisioning' | relative_url }}) for
details.

## Administrative API

The administrative API manages defaults, models, phones and uploaded assets.
It also exposes the token values and derived provisioning URLs for each phone.

Tancredi does not provide an administrative user interface, but you can build
one on top of the API.

See [Tancredi API v1](./API) for details.

## Template files for phone provisioning

The variables defined with the administrative API can be used in template files
along with additional runtime variables. Shipped templates can be overridden in
the writable template directory for site-specific needs.

See [Templates](./templates) for details.

## Contributions

The project is hosted on GitHub: pull requests are welcome.

The initial development of Tancredi was sponsored by Nethesis as part of [NethVoice 14](https://www.nethesis.it/nethvoice/).

Send a mail to sviluppo@nethesis.it for any question.

## Other projects

The [Falconieri](http://github.com/nethesis/falconieri) project is a RPS (Redirect and Provisioning Service) gateway
that helps to store the phone provisioning URL in the phone vendor redirect service. Modern IP phones can contact the
phone vendor redirect service at boot time and discover their PBX address with it.
