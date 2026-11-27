"""Read only the enabled published view using a dedicated MariaDB identity."""
import json
from .contract import validate_snapshot


class PublishedRepository:
    def __init__(self, connect):
        self.connect = connect

    def load(self, agent_id: str) -> dict:
        connection = self.connect()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    'SELECT agent_id, destination_id, workflow_version, contract_version, definition_json '
                    'FROM asterisk.voice_agent_published WHERE agent_id = %s', (agent_id,))
                row = cursor.fetchone()
                if row is None:
                    raise ValueError('agent_unavailable')
                snapshot = validate_snapshot(json.loads(row['definition_json']))
                for field in ('agent_id', 'destination_id', 'workflow_version', 'contract_version'):
                    if snapshot[field] != row[field]:
                        raise ValueError('invalid_snapshot')
                return snapshot
            finally:
                cursor.close()
        finally:
            connection.close()
