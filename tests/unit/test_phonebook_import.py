# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import http.server
import json
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import sys
import tempfile
import textwrap
import threading
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
        import signal
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
                block = fixture.get('block')
                if block and block['sql'] in sql:
                    with open(block['ready'], 'w') as ready:
                        ready.write('ready')
                    signal.pause()
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
            log({'connect': options.get('host'), 'connection_timeout': options.get('connection_timeout')})
            error = load().get('connect_errors', {}).get(options.get('host'))
            if error:
                fail(error)
            return Connection(options.get('database'))
    ''',
    'pyodbc.py': '''
        import os
        import signal
        from stubfixture import load, log

        class Error(Exception):
            pass

        def connect(*connection, **options):
            if not connection:
                os.kill(os.getpid(), signal.SIGSEGV)
            log({'connect': options['server'], 'timeout': options.get('timeout')})
            raise Error(*load()['odbc_errors'][options['server']])
    ''',
    'pycurl.py': '''
        import collections
        import json
        import os
        import socket
        from stubfixture import load

        OPTIONS = ['URL', 'WRITEFUNCTION', 'FAILONERROR', 'FOLLOWLOCATION', 'MAXREDIRS', 'PROTOCOLS', 'REDIR_PROTOCOLS',
                   'CONNECTTIMEOUT', 'TIMEOUT', 'MAXFILESIZE_LARGE', 'OPENSOCKETFUNCTION']
        globals().update({name: index for index, name in enumerate(OPTIONS)})
        RESPONSE_CODE = 100
        PROTO_HTTP, PROTO_HTTPS, PROTO_FTP, PROTO_FILE = 1, 2, 4, 1024
        SCHEMES = {'http': PROTO_HTTP, 'https': PROTO_HTTPS, 'ftp': PROTO_FTP, 'file': PROTO_FILE}
        SOCKET_BAD = -1
        E_UNSUPPORTED_PROTOCOL = 1
        E_COULDNT_CONNECT = 7
        E_HTTP_RETURNED_ERROR = 22
        E_WRITE_ERROR = 23
        E_FILE_COULDNT_READ_FILE = 37
        E_FILESIZE_EXCEEDED = 63
        Address = collections.namedtuple('Address', 'family socktype protocol addr')

        class error(Exception):
            pass

        class Curl:
            def __init__(self):
                self.options = {}
                self.status = 0

            def __getattr__(self, name):
                if name in OPTIONS:
                    return OPTIONS.index(name)
                raise AttributeError(name)

            def setopt(self, option, value):
                self.options[option] = value

            def record(self, served):
                options = {name: ('callable' if callable(self.options[index]) else self.options[index])
                           for index, name in enumerate(OPTIONS) if index in self.options}
                with open(os.environ['TEST_LOG'] + '.curl', 'a') as log:
                    log.write(json.dumps({'options': options, 'served': served}) + '\\n')

            def allowed(self, url, option):
                scheme = url.split(':', 1)[0].lower()
                if option in self.options and not self.options[option] & SCHEMES.get(scheme, 0):
                    raise error(E_UNSUPPORTED_PROTOCOL, 'Protocol "%s" not supported or disabled in libcurl' % scheme)

            def connect(self, url, address):
                opensocket = self.options.get(OPENSOCKETFUNCTION)
                if opensocket is None:
                    return
                family = socket.AF_INET6 if ':' in address else socket.AF_INET
                result = opensocket(1, Address(family, socket.SOCK_STREAM, 6, (address, 443)))
                if result == SOCKET_BAD:
                    raise error(E_COULDNT_CONNECT, 'Failed to connect to %s port 443 after 0 ms: Could not connect to server' % address)
                result.close()

            def deliver(self, chunks):
                for chunk in chunks:
                    if self.options[WRITEFUNCTION](chunk) not in (None, len(chunk)):
                        raise error(E_WRITE_ERROR, 'Failure writing output to destination')

            def perform(self):
                served = []
                try:
                    self.transfer(served)
                finally:
                    self.record(served)

            def transfer(self, served):
                url = self.options[URL]
                self.allowed(url, PROTOCOLS)
                if url.startswith('file://'):
                    try:
                        with open(url[len('file://'):], 'rb') as source:
                            data = source.read()
                    except OSError:
                        raise error(E_FILE_COULDNT_READ_FILE, "Couldn't open file " + url[len('file://'):])
                    self.deliver([data])
                    return
                for hop in range(6):
                    response = load().get('http', {}).get(url)
                    if response is None:
                        raise error(6, 'Could not resolve host: ' + url.split('/')[2].split('@')[-1])
                    if 'error' in response:
                        raise error(*response['error'])
                    self.connect(url, response.get('address', '203.0.113.10'))
                    served.append(url)
                    if 'redirect' in response:
                        url = response['redirect']
                        self.allowed(url, REDIR_PROTOCOLS)
                        continue
                    self.status = response.get('status', 200)
                    if self.status >= 400:
                        raise error(E_HTTP_RETURNED_ERROR, 'The requested URL returned error: %d' % self.status)
                    if response.get('length', 0) > self.options.get(MAXFILESIZE_LARGE, float('inf')):
                        raise error(E_FILESIZE_EXCEEDED, 'Maximum file size exceeded')
                    if 'chunks' in response:
                        self.deliver(b'x' * response['chunk'] for _ in range(response['chunks']))
                    else:
                        self.deliver([response['body'].encode()])
                    return

            def getinfo(self, option):
                return self.status

            def close(self):
                pass
    ''',
    'requests.py': '''
        import os
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

        class adapters:
            class HTTPAdapter:
                def __init__(self):
                    self.init_poolmanager()

                def init_poolmanager(self, *args, **kwargs):
                    self.poolmanager = type('PoolManager', (), {})()

        class Session:
            def mount(self, prefix, adapter):
                with open(os.environ['TEST_LOG'] + '.mounts', 'a') as mounts:
                    mounts.write(prefix + ' ' + ','.join(sorted(adapter.poolmanager.pool_classes_by_scheme)) + '\\n')

            def post(self, url, **options):
                return respond(url)

            def get(self, url, **options):
                return respond(url)
    ''',
    'urllib3/__init__.py': '',
    'urllib3/connection.py': '''
        class HTTPConnection:
            pass

        class HTTPSConnection(HTTPConnection):
            pass
    ''',
    'urllib3/exceptions.py': '''
        class HTTPError(Exception):
            pass
    ''',
    'urllib3/connectionpool.py': '''
        class HTTPConnectionPool:
            pass

        class HTTPSConnectionPool(HTTPConnectionPool):
            pass
    ''',
}

NETWORK = '''
    import json
    import os
    import socket

    network = json.loads(os.environ.get('TEST_NETWORK') or '{}')
    if network:
        names, routes, peers = network['names'], network['routes'], {}
        resolve, connect, peer = socket.getaddrinfo, socket.socket.connect, socket.socket.getpeername

        def getaddrinfo(host, *args, **kwargs):
            addresses = names.get(host, host)
            if isinstance(addresses, list):
                return [info for address in addresses for info in resolve(address, *args, **kwargs)]
            return resolve(addresses, *args, **kwargs)

        def routed(sock, address):
            peers.pop(sock.fileno(), None)
            if address[0] in routes:
                peers[sock.fileno()] = address
                address = ('127.0.0.1', routes[address[0]])
            return connect(sock, address)

        socket.getaddrinfo = getaddrinfo
        socket.socket.connect = routed
        socket.socket.getpeername = lambda sock: peers.get(sock.fileno()) or peer(sock)
'''
try:
    import requests
    import urllib3
    REAL_REQUESTS = True
except ImportError:
    REAL_REQUESTS = False

QUERY = 'SELECT name, workphone FROM qa_contacts'
MYSQL = dict(dbtype='mysql', host='crm.example.org', port='3306', user='qa_reader', password='Qa-Source-Pass', dbname='crm', query=QUERY)
REFUSED = 'Connections to local addresses are not allowed for this source'
BODY = 'name,workphone\nQA One,01\nQA Two,02\n'
MISSING_TABLE = {'msg': "Table 'phonebook.sync_status' doesn't exist", 'errno': 1146, 'sqlstate': '42S02'}


class ImporterCase(unittest.TestCase):
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
        self.curl_log = self.root / 'calls.jsonl.curl'
        self.mounts_log = self.root / 'calls.jsonl.mounts'
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
        for log in (self.log, self.curl_log, self.mounts_log):
            log.unlink(missing_ok=True)
        return subprocess.run([sys.executable, str(IMPORTER), *options, str(source)], env=self.env,
                              capture_output=True, text=True, cwd=self.root)

    def calls(self):
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def curl_runs(self):
        if not self.curl_log.exists():
            return []
        return [json.loads(line) for line in self.curl_log.read_text().splitlines()]

    def csv_check(self, url, **http):
        return self.run_import(self.source(dbtype='csv', url=url), '--check', '--error-json', http=http)

    def interrupt(self, signum, *options):
        ready = self.root / 'ready'
        os.mkfifo(ready)
        self.fixture.write_text(json.dumps({'queries': self.rows(2), 'block': {'sql': 'qa_contacts', 'ready': str(ready)}}))
        self.log.unlink(missing_ok=True)
        process = subprocess.Popen([sys.executable, str(IMPORTER), *options, str(self.mysql())], env=self.env,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=self.root)
        self.addCleanup(process.kill)
        with open(ready) as fifo:
            self.assertEqual(fifo.read(), 'ready')
        process.send_signal(signum)
        stdout, stderr = process.communicate()
        return process.returncode, stdout, stderr

    def queries(self):
        return [call for call in self.calls() if 'sql' in call]

    def statuses(self):
        return [call['params'] for call in self.queries() if 'sync_status' in call['sql']]

    def error_of(self, result):
        self.assertEqual(result.returncode, 1, result.stderr)
        return json.loads(result.stdout.strip().splitlines()[-1])

    def rows(self, count):
        return {QUERY: {'columns': ['name', 'workphone'], 'rows': [['QA Contact %d' % i, '0%d' % i] for i in range(count)]}}


class PhonebookImportTest(ImporterCase):
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
        inserted = [call['params'] for call in self.queries() if call['sql'].startswith('INSERT INTO phonebook')]
        self.assertEqual(len(inserted), 2)
        status = [call['sql'] for call in self.queries() if 'sync_status' in call['sql']]
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
        self.assertEqual(len([c for c in self.queries() if c['sql'].startswith('INSERT INTO phonebook')]), 1)

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

    def test_failing_source_query_keeps_the_previous_contacts(self):
        result = self.run_import(self.mysql(), '--skip-sync-metadata-update', '--error-json', sql_errors={
            'qa_contacts': {'msg': "Table 'crm.qa_contacts' doesn't exist", 'errno': 1146, 'sqlstate': '42S02'}})
        self.assertEqual(self.error_of(result)['kind'], 'query')
        self.assertFalse([call for call in self.queries() if call['sql'].startswith(('DELETE', 'INSERT INTO phonebook'))])
        self.assertEqual(self.statuses()[-1][1], 'failed')

    def test_sync_reads_the_whole_source_before_deleting(self):
        result = self.run_import(self.mysql(), '--skip-sync-metadata-update', queries=self.rows(3))
        self.assertEqual(result.returncode, 0, result.stderr)
        sql = [call['sql'] for call in self.queries() if 'sync_status' not in call['sql']]
        self.assertEqual(sql[0], QUERY)
        self.assertTrue(sql[1].startswith('DELETE FROM phonebook WHERE sid_imported="custom_7"'))
        self.assertEqual(len(sql), 5)
        self.assertNotIn(QUERY, sql[1:])
        result = self.run_import(self.mysql(), '--deleteonly', queries=self.rows(3))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([call['sql'][:6] for call in self.queries()], ['DELETE'])

    def test_database_connections_have_a_connect_timeout(self):
        self.run_import(self.mysql(), '--check', queries=self.rows(1))
        self.assertEqual([call['connection_timeout'] for call in self.calls() if 'connect' in call], [10])
        mssql = dict(dbtype='mssql', host='mssql.example.org', port='1433', user='qa_reader', password='Qa-Source-Pass', dbname='crm', query=QUERY)
        self.run_import(self.source(**mssql), '--check', odbc_errors={'mssql.example.org': ['08001', '[08001] Unable to connect (0)']})
        self.assertEqual([call['timeout'] for call in self.calls() if 'connect' in call], [10])

    def test_csv_download_has_timeouts_a_size_limit_and_http_redirects_only(self):
        url = 'https://csv.example.org/qa.csv'
        result = self.csv_check(url, **{url: {'body': BODY}})
        self.assertEqual(result.returncode, 0, result.stderr)
        options = self.curl_runs()[0]['options']
        self.assertEqual((options['CONNECTTIMEOUT'], options['TIMEOUT'], options['MAXFILESIZE_LARGE']), (10, 120, 100 * 1024 * 1024))
        self.assertEqual(options['REDIR_PROTOCOLS'], 1 | 2)
        self.assertEqual(options['OPENSOCKETFUNCTION'], 'callable')
        self.assertNotIn('PROTOCOLS', options)

    def test_ftp_sources_are_still_downloaded(self):
        url = 'ftp://qa_reader:Ftp-Pass@ftp.example.org/qa.csv'
        result = self.csv_check(url, **{url: {'body': BODY}})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(json.loads(result.stdout)), 2)
        self.assertEqual(self.curl_runs()[0]['served'], [url])

    def test_redirects_to_other_protocols_are_refused(self):
        url = 'https://csv.example.org/qa.csv'
        result = self.csv_check(url, **{url: {'redirect': 'ftp://ftp.example.org/qa.csv'}, 'ftp://ftp.example.org/qa.csv': {'body': BODY}})
        self.assertEqual(self.error_of(result)['kind'], 'connection')
        self.assertEqual(self.curl_runs()[0]['served'], [url])

    def test_download_timeouts_and_oversized_files_are_reported(self):
        url = 'https://csv.example.org/qa.csv'
        cases = [
            ('connection', 'timed out', {'error': [28, 'Operation timed out after 120000 milliseconds with 0 bytes received']}),
            ('connection', 'timed out', {'error': [28, 'Connection timed out after 10000 milliseconds']}),
            ('format', '100 MB', {'length': 100 * 1024 * 1024 + 1, 'body': BODY}),
            ('format', '100 MB', {'chunk': 1024 * 1024, 'chunks': 101}),
        ]
        for kind, text, response in cases:
            with self.subTest(response=response.get('error') or response.get('length') or 'stream'):
                result = self.csv_check(url, **{url: response})
                error = self.error_of(result)
                self.assertEqual(error['kind'], kind)
                self.assertIn(text, error['details'])
        result = self.run_import(self.source(dbtype='csv', url=url), '--skip-sync-metadata-update', http={url: {'chunk': 1024 * 1024, 'chunks': 101}})
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.statuses()[-1][:2], ['custom_7', 'failed'])
        self.assertFalse([call for call in self.queries() if call['sql'].startswith('DELETE')])

    def test_public_sources_never_connect_to_local_addresses(self):
        public = 'https://csv.example.org/qa.csv'
        local = 'http://127.0.0.1:8080/secret.csv'
        result = self.csv_check(public, **{public: {'redirect': local}, local: {'address': '127.0.0.1', 'body': BODY}})
        error = self.error_of(result)
        self.assertEqual(error['kind'], 'connection')
        self.assertEqual(error['details'], REFUSED)
        self.assertEqual(self.curl_runs()[0]['served'], [public])
        for address in ['127.0.0.1', '127.8.9.10', '0.0.0.0', '169.254.169.254', '::1', '::', '::ffff:127.0.0.1', 'fe80::1']:
            with self.subTest(address=address):
                result = self.csv_check(public, **{public: {'address': address, 'body': BODY}})
                self.assertEqual(self.error_of(result), {'kind': 'connection', 'details': REFUSED})
                self.assertEqual(self.curl_runs()[0]['served'], [])

    def test_lan_and_local_sources_keep_working(self):
        cases = [
            ('http://192.168.10.20/qa.csv', '192.168.10.20'),
            ('http://lan.example.org/qa.csv', '10.1.2.3'),
            ('https://csv.example.org/qa.csv', '203.0.113.10'),
            ('https://csv.example.org/qa.csv', '2001:db8::5'),
            ('http://127.0.0.1:8080/qa.csv', '127.0.0.1'),
            ('http://localhost:8080/qa.csv', '127.0.0.1'),
            ('http://[::1]:8080/qa.csv', '::1'),
        ]
        for url, address in cases:
            with self.subTest(url=url, address=address):
                result = self.csv_check(url, **{url: {'address': address, 'body': BODY}})
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(len(json.loads(result.stdout)), 2)
        local = 'http://127.0.0.1:8080/qa.csv'
        moved = 'http://127.0.0.1:8080/moved.csv'
        result = self.csv_check(local, **{local: {'address': '127.0.0.1', 'redirect': moved}, moved: {'address': '127.0.0.1', 'body': BODY}})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn('OPENSOCKETFUNCTION', self.curl_runs()[0]['options'])

    def test_infinity_guards_connections_only_for_non_local_hosts(self):
        for base, guarded in [('https://erp.example.org', True), ('http://127.0.0.1:8080', False), ('http://localhost:8080', False)]:
            with self.subTest(base=base):
                self.run_import(self.source(dbtype='infinity', url=base, username='qa', password='Qa-Erp-Pass'), '--check', requests={
                    base + '/servlet/oauth/token': {'status': 200, 'json': {'access_token': 'qa-token'}},
                    base + '/servlet/api/gsfr_fgetaddress_wsapi': {'status': 200, 'json': {'data': []}},
                })
                mounts = self.mounts_log.read_text().splitlines() if self.mounts_log.exists() else []
                self.assertEqual(mounts, ['http:// http,https', 'https:// http,https'] if guarded else [])

    def test_interrupted_sync_is_reported_as_failed(self):
        for signum, name in [(signal.SIGTERM, 'SIGTERM'), (signal.SIGINT, 'SIGINT')]:
            with self.subTest(signal=name):
                (self.root / 'ready').unlink(missing_ok=True)
                returncode, stdout, stderr = self.interrupt(signum, '--skip-sync-metadata-update', '--error-json')
                self.assertEqual(returncode, 1, stderr)
                self.assertEqual(json.loads(stdout.strip().splitlines()[-1]), {'kind': 'unknown', 'details': 'Interrupted by ' + name})
                self.assertEqual(self.statuses(), [['custom_7', 'running'], ['custom_7', 'failed', None, 'Interrupted by ' + name]])
                self.assertFalse([call for call in self.queries() if call['sql'].startswith('DELETE')])


class InfinityServer(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        self.server.paths.append(self.path)
        if self.path.startswith('/hop/'):
            self.send_response(307)
            self.send_header('Location', 'http://127.0.0.1:%d/%s' % (self.server.server_port, self.path[len('/hop/'):]))
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        self.reply({'access_token': 'qa-token'})

    def do_GET(self):
        self.server.paths.append(self.path)
        self.reply({'data': [{'id': 1, 'name': 'QA One'}, {'id': 2, 'name': 'QA Two'}]})

    def reply(self, body):
        data = json.dumps(body).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


@unittest.skipUnless(REAL_REQUESTS, 'requests is not installed')
class InfinityNetworkTest(ImporterCase):
    def setUp(self):
        super().setUp()
        stubs = self.root / 'stubs'
        for name in ['requests.py', 'urllib3/__init__.py', 'urllib3/connection.py', 'urllib3/connectionpool.py', 'urllib3/exceptions.py']:
            (stubs / name).unlink()
        with open(stubs / 'sitecustomize.py', 'a') as sitecustomize:
            sitecustomize.write(textwrap.dedent(NETWORK))
        self.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), InfinityServer)
        self.server.paths = []
        thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        port = self.server.server_port
        closed = socket.socket()
        closed.bind(('127.0.0.1', 0))
        self.closed_port = closed.getsockname()[1]
        closed.close()
        for name in ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY']:
            self.env.pop(name, None)
        self.env['NO_PROXY'] = '*'
        self.env['TEST_NETWORK'] = json.dumps({
            'names': {'erp.example.org': '203.0.113.10', 'lan.example.org': '192.168.10.20', 'rebind.example.org': '127.0.0.1',
                      'multi.example.org': ['198.51.100.7', '203.0.113.10']},
            'routes': {'203.0.113.10': port, '192.168.10.20': port, '198.51.100.7': self.closed_port},
        })

    def infinity(self, base):
        self.server.paths.clear()
        url = base.replace('PORT', str(self.server.server_port))
        return self.run_import(self.source(dbtype='infinity', url=url, username='qa', password='Qa-Erp-Pass'), '--check', '--error-json')

    def test_public_lan_and_local_hosts_are_read(self):
        for base in ['http://erp.example.org:PORT', 'http://lan.example.org:PORT', 'http://multi.example.org:PORT', 'http://127.0.0.1:PORT', 'http://localhost:PORT']:
            with self.subTest(base=base):
                result = self.infinity(base)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual([row['name'] for row in json.loads(result.stdout)], ['QA One', 'QA Two'])
                self.assertEqual(self.server.paths, ['/servlet/oauth/token', '/servlet/api/gsfr_fgetaddress_wsapi'])

    def test_redirects_and_rebinding_to_local_addresses_are_refused(self):
        cases = [
            ('http://erp.example.org:PORT/hop', ['/hop/servlet/oauth/token']),
            ('http://rebind.example.org:PORT', []),
            ('http://rebind.example.org:%d' % self.closed_port, []),
        ]
        for base, paths in cases:
            with self.subTest(base=base):
                error = self.error_of(self.infinity(base))
                self.assertEqual(error, {'kind': 'connection', 'details': REFUSED})
                self.assertEqual(self.server.paths, paths)

    def test_local_sources_may_redirect_locally(self):
        result = self.infinity('http://127.0.0.1:PORT/hop')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.server.paths, ['/hop/servlet/oauth/token', '/servlet/oauth/token', '/hop/servlet/api/gsfr_fgetaddress_wsapi'])


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
