"""Typed PBX routing policy; imported names and descriptions are always untrusted."""
import re

ID = re.compile(r'(extension|queue):[0-9]{1,20}\Z')


class RoutingPolicy:
    def __init__(self, snapshot):
        self.binding = next((b for b in snapshot['tool_bindings'] if b['tool_id'] == 'pbx.transfer'), None)
        self.lookup = next((b for b in snapshot['tool_bindings'] if b['tool_id'] == 'pbx.find_recent_callers'), None)

    def recent_enabled(self):
        return bool(self.binding and self.binding['enabled']
                    and self.binding['config'].get('recent_callers_enabled')
                    and self.binding['config']['extension_allowlist']
                    and self.lookup and self.lookup['enabled'])

    def permits_recent(self, destination_id):
        return bool(self.recent_enabled() and isinstance(destination_id, str)
                    and re.fullmatch(r'extension:[0-9]{1,20}', destination_id)
                    and destination_id in self.binding['config']['extension_allowlist']
                    and destination_id not in self.binding['config']['recent_caller_denylist'])

    def permits(self, destination_id):
        if not self.binding or not self.binding['enabled'] or not isinstance(destination_id, str) or not ID.fullmatch(destination_id):
            return False
        config = self.binding['config']
        kind = destination_id.split(':')[0]
        if kind == 'extension':
            return config['extensions_enabled'] and destination_id in config['extension_allowlist']
        return config[kind + 's_enabled'] and destination_id not in config[kind + '_denylist']

    def directory(self, rows):
        inventory = {row['id']: row for row in rows if isinstance(row.get('id'), str) and ID.fullmatch(row['id']) and row.get('available', True)}
        descriptions = {d['destination_id']: d['description'] for d in self.binding['config']['descriptions']} if self.binding else {}

        return [{'id': row['id'], 'name': str(row['name'])[:100],
                 'description': str(descriptions.get(row['id'], row.get('description', '')))[:500]}
                for key, row in sorted(inventory.items()) if self.permits(key)]
