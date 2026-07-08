# asterisk-stats-collectd

Python plugin for collectd to gather Asterisks statistics.

The plugin collects:

- total active calls
- total active queue calls
- active call for each queue
- agents for each queue

Note: the plugin monitors only queues with a numeri name (eg, 405), while ignores queues with alphanumeric name (eg. queue3).

## Configuration

Configuration parameters:

- ``Interval``: it controls how often metrics are collected. Default is ``30`` seconds
- ``Debug``: enable verbose logging, can be ``True`` or ``False``. Default is ``False``

## Installation

- Copy ``asterisk_stats.py`` file inside ``/usr/lib/python2.7/site-packages/``: this the default python path for CentOS, change it accordingly to your distro
- Copy ``asterisk_stats.conf`` file inside ``/etc/collectd.d/``
- Restart collectd: ``sytemctl restart collecd``
