# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[2]
IMPORTER = ROOT / 'freepbx/usr/share/phonebooks/phonebook-import'

STUBS = {
    'sitecustomize.py': '''
        import logging
        import logging.handlers

        class SysLogHandler(logging.Handler):
            def __init__(self, *args, **kwargs):
                super().__init__()

            def emit(self, record):
                pass

        logging.handlers.SysLogHandler = SysLogHandler
    ''',
    'stubfixture.py': '''
        import json
        import os

        def load():
            with open(os.environ['TEST_FIXTURE']) as fixture:
                return json.load(fixture)

        def log(entry):
            with open(os.environ['TEST_LOG'], 'a') as calls:
                calls.write(json.dumps(entry) + '\\n')
    ''',
    'mysql/__init__.py': '',
    'mysql/connector/__init__.py': '''
        from stubfixture import load, log

        class Error(Exception):
            def __init__(self, msg, errno, sqlstate=None):
                self.errno = errno
                super().__init__(errno, '%d (%s): %s' % (errno, sqlstate, msg), sqlstate)

            def __str__(self):
                return self.args[1]

        def fail(error):
            raise Error(error['msg'], error['errno'], error.get('sqlstate'))

        class Cursor:
            def __init__(self, database):
                self.database = database
                self.rows = []
                self.description = None
                self.rowcount = -1

            def execute(self, sql, params=()):
                fixture = load()
                log({'db': self.database, 'sql': sql, 'params': list(params or ())})
                for fragment, error in fixture.get('sql_errors', {}).items():
                    if fragment in sql:
                        fail(error)
                result = fixture.get('queries', {}).get(sql, {'columns': [], 'rows': []})
                self.description = [(column,) for column in result['columns']]
                self.rows = [tuple(row) for row in result['rows']]
                self.rowcount = len(self.rows)

            def fetchmany(self, size):
                chunk, self.rows = self.rows[:size], self.rows[size:]
                return chunk

            def fetchone(self):
                return self.rows.pop(0) if self.rows else None

            def fetchall(self):
                rows, self.rows = self.rows, []
                return rows

            def close(self):
                pass

        class Connection:
            def __init__(self, database):
                self.database = database

            def cursor(self):
                return Cursor(self.database)

            def commit(self):
                pass

            def close(self):
                pass

        def connect(**options):
            error = load().get('connect_errors', {}).get(options.get('host'))
            if error:
                fail(error)
            return Connection(options.get('database'))
    ''',
    'pyodbc.py': '''
        import os
        import signal
        from stubfixture import load

        class Error(Exception):
            pass

        def connect(*connection, **options):
            if not connection:
                os.kill(os.getpid(), signal.SIGSEGV)
            raise Error(*load()['odbc_errors'][options['server']])
    ''',
    'pycurl.py': '''
        from stubfixture import load

        URL, WRITEFUNCTION, FAILONERROR, FOLLOWLOCATION, MAXREDIRS, PROTOCOLS, REDIR_PROTOCOLS, RESPONSE_CODE = range(8)
        PROTO_HTTP, PROTO_HTTPS, PROTO_FILE = 1, 2, 4
        E_HTTP_RETURNED_ERROR = 22
        E_FILE_COULDNT_READ_FILE = 37

        class error(Exception):
            pass

        class Curl:
            URL, WRITEFUNCTION, FAILONERROR, FOLLOWLOCATION = URL, WRITEFUNCTION, FAILONERROR, FOLLOWLOCATION
            MAXREDIRS, PROTOCOLS, REDIR_PROTOCOLS = MAXREDIRS, PROTOCOLS, REDIR_PROTOCOLS

            def __init__(self):
                self.options = {}
                self.status = 0

            def setopt(self, option, value):
                self.options[option] = value

            def perform(self):
                url = self.options[URL]
                if url.startswith('file://'):
                    try:
                        with open(url[len('file://'):], 'rb') as source:
                            data = source.read()
                    except OSError:
                        raise error(E_FILE_COULDNT_READ_FILE, "Couldn't open file " + url[len('file://'):])
                    self.options[WRITEFUNCTION](data)
                    return
                response = load().get('http', {}).get(url)
                if response is None:
                    raise error(6, 'Could not resolve host: ' + url.split('/')[2].split('@')[-1])
                self.status = response['status']
                if self.status >= 400:
                    raise error(E_HTTP_RETURNED_ERROR, 'The requested URL returned error: %d' % self.status)
                self.options[WRITEFUNCTION](response['body'].encode())

            def getinfo(self, option):
                return self.status

            def close(self):
                pass
    ''',
    'requests.py': '''
        from stubfixture import load

        class exceptions:
            class RequestException(IOError):
                pass

            class ConnectionError(RequestException):
                pass

        class Response:
            def __init__(self, spec):
                self.status_code = spec['status']
                self.body = spec.get('json')

            def json(self):
                if self.body is None:
                    raise ValueError('Expecting value: line 1 column 1 (char 0)')
                return self.body

        def respond(url):
            spec = load().get('requests', {}).get(url)
            if spec is None:
                raise exceptions.ConnectionError("HTTPSConnectionPool(host='erp.example.org', port=443): Max retries exceeded")
            return Response(spec)

        def post(url, **options):
            return respond(url)

        def get(url, **options):
            return respond(url)
    ''',
}

QUERY = 'SELECT name, workphone FROM qa_contacts'
MYSQL = dict(dbtype='mysql', host='crm.example.org', port='3306', user='qa_reader', password='Qa-Source-Pass', dbname='crm', query=QUERY)
MISSING_TABLE = {'msg': "Table 'phonebook.sync_status' doesn't exist", 'errno': 1146, 'sqlstate': '42S02'}


class PhonebookImportTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        stubs = self.root / 'stubs'
        for name, source in STUBS.items():
            path = stubs / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(textwrap.dedent(source))
        self.fixture = self.root / 'fixture.json'
        self.log = self.root / 'calls.jsonl'
        self.env = dict(os.environ, PYTHONPATH=str(stubs), TEST_FIXTURE=str(self.fixture), TEST_LOG=str(self.log),
                        PHONEBOOK_DB_HOST='phonebook.test', PHONEBOOK_DB_PORT='3306', PHONEBOOK_DB_USER='pbookuser',
                        PHONEBOOK_DB_PASS='pbook-db-secret', PHONEBOOK_DB_NAME='phonebook')
        self.env.pop('PYTHONHOME', None)

    def source(self, enabled=True, **fields):
        path = self.root / 'source.json'
        path.write_text(json.dumps({'custom_7': dict({'type': 'QA contacts', 'access': 'public', 'enabled': enabled,
                                                      'mapping': {'name': 'name', 'workphone': 'workphone'}}, **fields)}))
        return path

    def mysql(self, **fields):
        return self.source(**MYSQL, **fields)

    def run_import(self, source, *options, **fixture):
        self.fixture.write_text(json.dumps(fixture))
        self.log.unlink(missing_ok=True)
        return subprocess.run([sys.executable, str(IMPORTER), *options, str(source)], env=self.env,
                              capture_output=True, text=True, cwd=self.root)

    def calls(self):
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def statuses(self):
        return [call['params'] for call in self.calls() if 'sync_status' in call['sql']]

    def error_of(self, result):
        self.assertEqual(result.returncode, 1, result.stderr)
        return json.loads(result.stdout.strip().splitlines()[-1])

    def rows(self, count):
        return {QUERY: {'columns': ['name', 'workphone'], 'rows': [['QA Contact %d' % i, '0%d' % i] for i in range(count)]}}

    def test_preview_stays_an_array_and_adds_the_total_on_request(self):
        source = self.mysql()
        result = self.run_import(source, '--check', queries=self.rows(5))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), [{'name': 'QA Contact %d' % i, 'workphone': '0%d' % i} for i in range(3)])
        result = self.run_import(source, '--check', '--with-total', queries=self.rows(1234))
        preview = json.loads(result.stdout)
        self.assertEqual((len(preview['rows']), preview['total']), (3, 1234))
        result = self.run_import(source, '--check', '--with-total', queries={QUERY: {'columns': ['name', 'workphone'], 'rows': []}})
        self.assertEqual(json.loads(result.stdout), {'rows': [{'name': '', 'workphone': ''}], 'total': 0})
        self.assertEqual(self.statuses(), [])

    def test_csv_and_infinity_previews_count_every_row(self):
        csv = self.root / 'qa.csv'
        csv.write_text('name,workphone\n' + ''.join('QA %d,0%d\n' % (i, i) for i in range(7)))
        result = self.run_import(self.source(dbtype='csv', url='file://' + str(csv)), '--check', '--with-total')
        self.assertEqual(json.loads(result.stdout)['total'], 7)
        base = 'https://erp.example.org'
        result = self.run_import(self.source(dbtype='infinity', url=base, username='qa', password='Qa-Erp-Pass'), '--check', '--with-total', requests={
            base + '/servlet/oauth/token': {'status': 200, 'json': {'access_token': 'qa-token'}},
            base + '/servlet/api/gsfr_fgetaddress_wsapi': {'status': 200, 'json': {'data': [{'name': 'QA %d' % i} for i in range(4)]}},
        })
        preview = json.loads(result.stdout)
        self.assertEqual((len(preview['rows']), preview['total']), (3, 4))

    def test_read_failures_are_categorized(self):
        missing = self.root / 'missing.csv'
        invalid = self.root / 'invalid.csv'
        invalid.write_bytes(b'name,workphone\n\xff\xfe,1\n')
        empty = self.root / 'empty.csv'
        empty.write_text('')
        url = 'https://csv.example.org/qa.csv'
        base = 'https://erp.example.org'
        token = base + '/servlet/oauth/token'
        contacts = base + '/servlet/api/gsfr_fgetaddress_wsapi'
        infinity = dict(dbtype='infinity', url=base, username='qa', password='Qa-Erp-Pass')
        mssql = dict(dbtype='mssql', host='mssql.example.org', port='1433', user='qa_reader', password='Qa-Source-Pass', dbname='crm', query=QUERY)
        cases = [
            ('connection', MYSQL, {'connect_errors': {'crm.example.org': {'msg': "Can't connect to MySQL server on 'crm.example.org:3306' (111)", 'errno': 2003, 'sqlstate': 'HY000'}}}),
            ('auth', MYSQL, {'connect_errors': {'crm.example.org': {'msg': "Access denied for user 'qa_reader'@'192.0.2.10' (using password: YES)", 'errno': 1045, 'sqlstate': '28000'}}}),
            ('connection', MYSQL, {'connect_errors': {'crm.example.org': {'msg': "Unknown database 'crm'", 'errno': 1049, 'sqlstate': '42000'}}}),
            ('query', MYSQL, {'sql_errors': {'qa_contacts': {'msg': "Table 'crm.qa_contacts' doesn't exist", 'errno': 1146, 'sqlstate': '42S02'}}}),
            ('auth', mssql, {'odbc_errors': {'mssql.example.org': ['28000', "[28000] [FreeTDS][SQL Server]Login failed for user 'qa_reader'. (18456)"]}}),
            ('connection', mssql, {'odbc_errors': {'mssql.example.org': ['08001', '[08001] [FreeTDS][SQL Server]Unable to connect to data source (0)']}}),
            ('file', dict(dbtype='csv', url='file://' + str(missing)), {}),
            ('format', dict(dbtype='csv', url='file://' + str(invalid)), {}),
            ('format', dict(dbtype='csv', url='file://' + str(empty)), {}),
            ('http', dict(dbtype='csv', url=url), {'http': {url: {'status': 404}}}),
            ('auth', dict(dbtype='csv', url=url), {'http': {url: {'status': 401}}}),
            ('connection', dict(dbtype='csv', url=url), {}),
            ('auth', infinity, {'requests': {token: {'status': 401}}}),
            ('http', infinity, {'requests': {token: {'status': 200, 'json': {'access_token': 'qa-token'}}, contacts: {'status': 500}}}),
            ('format', infinity, {'requests': {token: {'status': 200}}}),
            ('connection', infinity, {}),
        ]
        for kind, fields, fixture in cases:
            with self.subTest(kind=kind, dbtype=fields['dbtype'], fixture=fixture):
                result = self.run_import(self.source(**fields), '--check', '--error-json', **fixture)
                error = self.error_of(result)
                self.assertEqual(error['kind'], kind)
                self.assertTrue(error['details'])
                self.assertEqual(self.statuses(), [])

    def test_mssql_sync_reports_the_failure_instead_of_crashing(self):
        mssql = dict(dbtype='mssql', host='mssql.example.org', port='1433', user='qa_reader', password='Qa-Source-Pass', dbname='crm', query=QUERY)
        result = self.run_import(self.source(**mssql), '--skip-sync-metadata-update', odbc_errors={
            'mssql.example.org': ['08001', '[08001] [FreeTDS][SQL Server]Unable to connect to data source (0)']})
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(self.statuses(), [['custom_7', 'running'], ['custom_7', 'failed', None, '[08001] [FreeTDS][SQL Server]Unable to connect to data source (0)']])

    def test_failure_writes_nothing_without_error_json(self):
        result = self.run_import(self.source(dbtype='csv', url='file:///nonexistent/qa.csv'), '--check')
        self.assertEqual((result.returncode, result.stdout), (1, ''))

    def test_details_are_one_line_capped_and_without_secrets(self):
        message = 'Access for Qa-Source-Pass via https://qa_reader:Url-Pass@crm.example.org/x and pbook-db-secret ' + 'x' * 900 + '\nsecond line'
        result = self.run_import(self.mysql(), '--check', '--error-json',
                                 connect_errors={'crm.example.org': {'msg': message, 'errno': 2003}})
        details = self.error_of(result)['details']
        self.assertEqual(len(details), 500)
        for secret in ['Qa-Source-Pass', 'Url-Pass', 'qa_reader:', 'pbook-db-secret', 'second line']:
            self.assertNotIn(secret, details)
        self.assertIn('https://***@crm.example.org/x', details)

    def test_sync_writes_running_then_the_result(self):
        result = self.run_import(self.mysql(), '--skip-sync-metadata-update', queries=self.rows(2))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.statuses(), [['custom_7', 'running'], ['custom_7', 'ok', 2, None]])
        inserted = [call['params'] for call in self.calls() if call['sql'].startswith('INSERT INTO phonebook')]
        self.assertEqual(len(inserted), 2)
        status = [call['sql'] for call in self.calls() if 'sync_status' in call['sql']]
        self.assertTrue(all('UTC_TIMESTAMP()' in sql for sql in status))

        url = 'https://qa_reader:Url-Pass@csv.example.org/qa.csv'
        result = self.run_import(self.source(dbtype='csv', url=url), '--skip-sync-metadata-update')
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.statuses(), [['custom_7', 'running'], ['custom_7', 'failed', None, 'Could not resolve host: csv.example.org']])
        self.assertEqual(result.stdout, '')

        result = self.run_import(self.mysql(), '--skip-sync-metadata-update', connect_errors={
            'crm.example.org': {'msg': "Access denied for user 'qa_reader'@'192.0.2.10' (using password: YES)", 'errno': 1045, 'sqlstate': '28000'}})
        self.assertEqual(self.statuses()[-1], ['custom_7', 'failed', None, "1045 (28000): Access denied for user 'qa_reader'@'192.0.2.10' (using password: YES)"])

    def test_missing_status_table_never_fails_a_sync(self):
        csv = self.root / 'qa.csv'
        csv.write_text('name,workphone\nQA One,01\n')
        result = self.run_import(self.source(dbtype='csv', url='file://' + str(csv)), '--skip-sync-metadata-update',
                                 sql_errors={'sync_status': MISSING_TABLE})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len([c for c in self.calls() if c['sql'].startswith('INSERT INTO phonebook')]), 1)

    def test_disabled_source_is_skipped_unless_forced(self):
        csv = self.root / 'qa.csv'
        csv.write_text('name,workphone\nQA One,01\nQA Two,02\n')
        source = self.source(enabled=False, dbtype='csv', url='file://' + str(csv))
        result = self.run_import(source, '--skip-sync-metadata-update')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls(), [])
        result = self.run_import(source, '--skip-sync-metadata-update', '--force')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.statuses(), [['custom_7', 'running'], ['custom_7', 'ok', 2, None]])


class PhonebookTablesTest(unittest.TestCase):
    @staticmethod
    def normalized(sql):
        return re.sub(r'\s+', ' ', sql.replace('`asterisk`.', '')).strip().rstrip(';')

    def test_upgrades_create_the_same_tables_as_new_installs(self):
        schema = (ROOT / 'mariadb/docker-entrypoint-initdb.d/40_phonebook.phonebook-schema.sql').read_text()
        init = (ROOT / 'mariadb/usr/local/bin/nethvoice-db-init').read_text()
        new = re.search(r'CREATE TABLE IF NOT EXISTS `sync_status`.*?;', schema, re.S).group(0)
        upgrade = re.search(r"db phonebook -e '(CREATE TABLE IF NOT EXISTS `sync_status`.*?)'\n", init).group(1)
        self.assertEqual(self.normalized(new).replace('( ', '(').replace(' )', ')'), self.normalized(upgrade))

        schema = (ROOT / 'mariadb/docker-entrypoint-initdb.d/10_asterisk.rest_phonebook_imports-schema.sql').read_text()
        update = (ROOT / 'freepbx/initdb.d/update.php').read_text()
        new = re.search(r'CREATE TABLE IF NOT EXISTS `rest_phonebook_imports`.*?;', schema, re.S).group(0)
        upgrade = re.search(r'\$db->exec\("(CREATE TABLE IF NOT EXISTS `asterisk`\.`rest_phonebook_imports`.*?)"\);', update, re.S).group(1)
        self.assertEqual(self.normalized(new), self.normalized(upgrade))


if __name__ == '__main__':
    unittest.main()
