#!/usr/bin/python3

"""
Sync contacts from onOffice enterprise API into the centralized phonebook.

Set token and secret below (or in /etc/phonebook/sources.d/, see load_api_credentials).
Copy this script in /usr/share/phonebooks/scripts/

launch with DEBUG=true for debug output
DEBUG=true /usr/share/phonebooks/scripts/onoffice_api.py
"""

import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import requests

# DB driver fallback
try:
    import pymysql as mysql_driver
    DB_BACKEND = "pymysql"
except ImportError:
    import mysql.connector as mysql_driver
    DB_BACKEND = "mysql.connector"

# onOffice API credentials (API user created in onOffice enterprise)
url = 'https://api.onoffice.de/api/stable/api.php'
token = 'CHANGE_ME'
secret = 'CHANGE_ME'

IMPORT_SOURCE = 'onoffice'

ACTION_READ = 'urn:onoffice-de-ns:smart:2.5:smartml:action:read'
PAGE_SIZE = 500  # max listlimit allowed by onOffice

# Address fields requested to onOffice
ADDRESS_FIELDS = [
    'KdNr',      # customer number
    'Vorname',   # first name
    'Name',      # last name
    'Zusatz1',   # company
    'Strasse',   # street
    'Plz',       # postal code
    'Ort',       # city
    'Land',      # country
    'phone',     # all phone entries (except mobile)
    'mobile',    # all mobile entries
    'fax',       # all fax entries
    'email',     # all email entries
]


def env_truthy(value):
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ('1', 'true', 'yes', 'on')


DEBUG = env_truthy(os.getenv('DEBUG'))


def log(message, payload=None):
    if not DEBUG:
        return
    if payload is None:
        print(f"[DEBUG] {message}")
    else:
        print(f"[DEBUG] {message}: {json.dumps(payload, ensure_ascii=False, default=str)}")


def is_set(value):
    return bool(value) and value != 'CHANGE_ME'


def load_api_credentials():
    """
    Credentials priority:
      1) values set in this script
      2) environment variables ONOFFICE_TOKEN / ONOFFICE_SECRET
      3) a JSON file in /etc/phonebook/sources.d/ with "dbtype": "onoffice",
         e.g. {"onoffice": {"dbtype": "onoffice", "token": "...", "secret": "..."}}
    """
    global url, token, secret

    if is_set(token) and is_set(secret):
        return

    if os.getenv('ONOFFICE_TOKEN') and os.getenv('ONOFFICE_SECRET'):
        token = os.getenv('ONOFFICE_TOKEN')
        secret = os.getenv('ONOFFICE_SECRET')
        log("Loaded onOffice credentials from environment")
        return

    config_dir = '/etc/phonebook/sources.d/'
    if not os.path.isdir(config_dir):
        return

    configuration_files = [
        os.path.join(config_dir, f)
        for f in os.listdir(config_dir)
        if f.endswith('.json')
    ]

    for configuration_file in configuration_files:
        try:
            with open(configuration_file, 'r', encoding='utf-8') as json_file:
                data = json.load(json_file)
                data = data[next(iter(data))]
                if data.get('dbtype') == 'onoffice':
                    url = data.get('url') or url
                    token = data.get('token', '')
                    secret = data.get('secret', '')
                    log("Loaded onOffice credentials from configuration", {"file": configuration_file})
                    break
        except Exception as err:
            log("Failed reading configuration file", {"file": configuration_file, "error": str(err)})


def build_hmac(timestamp, resourcetype, actionid):
    # HMAC version 2: base64(hmac_sha256(timestamp + token + resourcetype + actionid, secret))
    message = f"{timestamp}{token}{resourcetype}{actionid}".encode('utf-8')
    digest = hmac.new(secret.encode('utf-8'), message, hashlib.sha256).digest()
    return base64.b64encode(digest).decode('ascii')


def call_api(resourcetype, actionid, parameters, timeout=120):
    timestamp = int(time.time())
    body = {
        "token": token,
        "request": {
            "actions": [{
                "actionid": actionid,
                "resourceid": "",
                "identifier": "",
                "resourcetype": resourcetype,
                "timestamp": timestamp,
                "hmac": build_hmac(timestamp, resourcetype, actionid),
                "hmac_version": "2",
                "parameters": parameters,
            }]
        }
    }

    response = requests.post(url, json=body, timeout=timeout)
    if response.status_code != 200:
        raise Exception(
            f"Failed request to {url} with status code {response.status_code}: {response.text}"
        )

    payload = response.json()
    status = payload.get('status', {})
    if status.get('code') != 200:
        raise Exception(f"onOffice API error: {status}")

    result = payload['response']['results'][0]
    action_status = result.get('status', {})
    if action_status.get('errorcode', 0) != 0:
        raise Exception(f"onOffice action error: {action_status}")

    return result.get('data', {})


def get_contacts():
    contacts = []
    offset = 0

    while True:
        log("Requesting addresses", {"listoffset": offset, "listlimit": PAGE_SIZE})
        data = call_api('address', ACTION_READ, {
            "data": ADDRESS_FIELDS,
            "listlimit": PAGE_SIZE,
            "listoffset": offset,
            "sortby": "Name",
            "sortorder": "ASC",
        })

        records = data.get('records', [])
        contacts.extend(records)

        total = data.get('meta', {}).get('cntabsolute', 0)
        offset += PAGE_SIZE
        log("Addresses retrieved", {"page": len(records), "so_far": len(contacts), "total": total})

        if not records or offset >= total:
            break

    return contacts


CONTACT_KEY_RE = re.compile(r'^([A-Za-z]+)__\d+$')


def classify_contact_data(elements):
    """
    onOffice returns contact data as "<type>__<id>": value, where <type> is e.g.
    phonebusiness, phoneprivate, mobile, fax, emailbusiness, emailprivate...
    ("<type>__<id>__Comment" entries don't match the pattern and are ignored).
    """
    groups = {'work': [], 'home': [], 'mobile': [], 'fax': [], 'email_work': [], 'email_home': []}
    for key, value in elements.items():
        m = CONTACT_KEY_RE.match(key)
        value = str(value or '').strip()
        if not m or not value:
            continue
        kind = m.group(1).lower()
        if 'fax' in kind:
            group = 'fax'
        elif 'mobile' in kind or 'handy' in kind:
            group = 'mobile'
        elif 'email' in kind or '@' in value:
            group = 'email_home' if 'private' in kind else 'email_work'
        elif kind.startswith('phone'):
            group = 'home' if 'private' in kind else 'work'
        else:
            continue
        if value not in groups[group]:
            groups[group].append(value)
    return groups


def pick(values, index):
    return values[index] if len(values) > index else ''


def build_notes(record, elements):
    notes = []
    if record.get('id'):
        notes.append(f"onOffice ID: {record['id']}")
    if elements.get('KdNr'):
        notes.append(f"KdNr: {elements['KdNr']}")
    return ' | '.join(notes)


def normalize_contact(record):
    el = record.get('elements', {})

    g = classify_contact_data(el)
    work, home, mobiles, faxes = g['work'], g['home'], g['mobile'], g['fax']
    emails = g['email_work'] + g['email_home']
    # numbers that don't fit in the main fields go to otherphone
    others = work[2:] + home[1:]

    firstname = (el.get('Vorname') or '').strip()
    lastname = (el.get('Name') or '').strip()
    company = (el.get('Zusatz1') or '').strip()
    name = ' '.join(p for p in (firstname, lastname) if p)

    row = (
        'admin',                              # owner_id
        'contact',                            # type (source category)
        'public',                             # access (sharing)
        pick(emails, 1),                      # homeemail
        pick(emails, 0),                      # workemail
        pick(home, 0),                        # homephone
        pick(work, 0),                        # workphone
        pick(mobiles, 0),                     # cellphone
        pick(faxes, 0),                       # fax
        '',                                   # title
        company,                              # company
        build_notes(record, el),              # notes
        name,                                 # name
        '',                                   # homestreet
        '',                                   # homepob
        '',                                   # homecity
        '',                                   # homeprovince
        '',                                   # homepostalcode
        '',                                   # homecountry
        (el.get('Strasse') or '').strip(),    # workstreet
        '',                                   # workpob
        (el.get('Ort') or '').strip(),        # workcity
        '',                                   # workprovince
        (el.get('Plz') or '').strip(),        # workpostalcode
        (el.get('Land') or '').strip(),       # workcountry
        '',                                   # url
        firstname,                            # firstname
        lastname,                             # lastname
        '',                                   # job
        '',                                   # facebook
        '',                                   # instagram
        '',                                   # linkedin
        pick(work, 1),                        # workphone2
        pick(mobiles, 1),                     # cellphone2
        pick(others, 0),                      # otherphone
        pick(emails, 2),                      # otheremail
        IMPORT_SOURCE                         # sid_imported
    )

    has_number = bool(work or home or mobiles or faxes)
    return row, has_number


def get_db_connection():
    host = getenv_required('PHONEBOOK_DB_HOST')
    port = int(os.getenv('PHONEBOOK_DB_PORT', '3306'))
    database = getenv_required('PHONEBOOK_DB_NAME')
    user = getenv_required('PHONEBOOK_DB_USER')
    passwd = getenv_required('PHONEBOOK_DB_PASS')

    log("Opening phonebook DB connection", {
        "backend": DB_BACKEND,
        "host": host,
        "port": port,
        "database": database,
        "user": user
    })

    if DB_BACKEND == "pymysql":
        return mysql_driver.connect(
            host=host,
            port=port,
            user=user,
            password=passwd,
            database=database,
            charset='utf8mb4',
            autocommit=False
        )

    return mysql_driver.connect(
        host=host,
        port=port,
        user=user,
        password=passwd,
        database=database
    )


def getenv_required(name):
    value = os.getenv(name)
    if not value:
        raise Exception(f"Missing required environment variable: {name}")
    return value


def main():
    load_api_credentials()

    if not url or not is_set(token) or not is_set(secret):
        print('No URL, token or secret found', file=sys.stderr)
        sys.exit(1)

    contacts = get_contacts()

    insert_sql = """
        INSERT INTO phonebook (
            owner_id,
            type,
            access,
            homeemail,
            workemail,
            homephone,
            workphone,
            cellphone,
            fax,
            title,
            company,
            notes,
            name,
            homestreet,
            homepob,
            homecity,
            homeprovince,
            homepostalcode,
            homecountry,
            workstreet,
            workpob,
            workcity,
            workprovince,
            workpostalcode,
            workcountry,
            url,
            firstname,
            lastname,
            job,
            facebook,
            instagram,
            linkedin,
            workphone2,
            cellphone2,
            otherphone,
            otheremail,
            sid_imported
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """

    rows = []
    skipped = 0
    for record in contacts:
        row, has_number = normalize_contact(record)
        # skip addresses without any phone number: useless in the PBX phonebook
        if not has_number:
            skipped += 1
            continue
        rows.append(row)
        log("Prepared contact row", {
            "id": record.get('id'),
            "name": row[12],
            "company": row[10],
            "workphone": row[6],
            "cellphone": row[7],
        })

    log("Contacts without phone numbers skipped", {"count": skipped})

    db = get_db_connection()
    cursor = db.cursor()

    try:
        log("Removing previous imported contacts", {"sid_imported": IMPORT_SOURCE})
        cursor.execute('DELETE FROM phonebook WHERE sid_imported = %s', (IMPORT_SOURCE,))

        if rows:
            log("Inserting contacts into phonebook", {"count": len(rows)})
            cursor.executemany(insert_sql, rows)

        db.commit()
        log("Phonebook sync completed", {"inserted": len(rows)})
        print(f"Imported {len(rows)} contacts")
        sys.exit(0)

    except Exception:
        db.rollback()
        raise

    finally:
        try:
            cursor.close()
        except Exception as err:
            log("Failed to close database cursor", {"error": str(err)})
        try:
            db.close()
        except Exception as err:
            log("Failed to close database connection", {"error": str(err)})


if __name__ == '__main__':
    try:
        main()
    except Exception as err:
        print(str(err), file=sys.stderr)
        sys.exit(1)
