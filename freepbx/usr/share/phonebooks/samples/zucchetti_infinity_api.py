#!/usr/bin/python3

"""
Sync contacts from Zucchetti Infinity API into the centralized phonebook.

Set url, username and password below.
Copy this script in /usr/share/phonebooks/scripts/

launch with DEBUG=true for debug output
DEBUG=true /usr/share/phonebooks/scripts/zucchetti_infinity_api.py
"""

import json
import os
import sys
import requests

# DB driver fallback
try:
    import pymysql as mysql_driver
    DB_BACKEND = "pymysql"
except ImportError:
    import mysql.connector as mysql_driver
    DB_BACKEND = "mysql.connector"

# Set the URL for the API
url = 'https://CHANGE_ME/infinity'
username = 'CHANGE_ME'
password = 'CHANGE_ME'

IMPORT_SOURCE = 'infinity'


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


def load_api_credentials():
    global url, username, password

    if url and username and password:
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
                if data.get('dbtype') == 'infinity':
                    url = data.get('url', '')
                    username = data.get('username', '')
                    password = data.get('password', '')
                    log("Loaded Infinity credentials from configuration", {"file": configuration_file})
                    break
        except Exception as err:
            log("Failed reading configuration file", {"file": configuration_file, "error": str(err)})


def get_token(base_url, api_username, api_password):
    token_url = f"{base_url.rstrip('/')}/servlet/oauth/token"
    auth = (api_username, api_password)
    token_body = {"scope": "logintoken"}

    log("Requesting OAuth token", {"url": token_url, "username": api_username})
    response = requests.post(token_url, auth=auth, data=token_body, timeout=30)

    if response.status_code != 200:
        raise Exception(
            f"Failed to get token from {token_url} with status code {response.status_code}: {response.text}"
        )

    token = response.json().get("access_token")
    if not token:
        raise Exception(f"No token found in response from {token_url}")

    return token


def get_contacts(base_url, token):
    contact_url = f"{base_url.rstrip('/')}/servlet/api/gsfr_fgetaddress_wsapi"
    headers = {
        "Authorization": f"Bearer {token}"
    }

    log("Requesting contacts", {"url": contact_url})
    response = requests.get(contact_url, headers=headers, timeout=120)

    if response.status_code != 200:
        raise Exception(
            f"Failed to get contacts from {contact_url} with status code {response.status_code}: {response.text}"
        )

    payload = response.json()
    contacts = payload.get('data', [])

    if not isinstance(contacts, list):
        raise Exception(f"Unexpected response schema from {contact_url}")

    log("Contacts retrieved", {"count": len(contacts)})
    return contacts


def normalize_email_values(mail_list):
    primary = ''
    secondary = ''

    for item in mail_list or []:
        email = (item.get('mail') or '').strip()
        email_type = (item.get('type') or '').strip().lower()

        if not email:
            continue

        if email_type == 'primary' and not primary:
            primary = email
        elif email_type == 'secondary' and not secondary:
            secondary = email
        elif not primary:
            primary = email
        elif not secondary:
            secondary = email

    return secondary, primary  # homeemail, workemail


def normalize_phone_values(tel_list):
    homephone = ''
    workphone = ''
    cellphone = ''
    fax = ''

    for item in tel_list or []:
        number = (item.get('number') or '').strip()
        phone_type = (item.get('type') or '').strip().lower()

        if not number:
            continue

        if 'fax' in phone_type and not fax:
            fax = number
        elif 'cell' in phone_type or 'mobile' in phone_type or 'cellulare' in phone_type:
            if not cellphone:
                cellphone = number
        elif not workphone:
            workphone = number
        elif not homephone:
            homephone = number

    return homephone, workphone, cellphone, fax


def build_notes(contact):
    notes = []

    if contact.get('id'):
        notes.append(f"Infinity ID: {contact['id']}")
    if contact.get('office'):
        notes.append(f"Office: {contact['office']}")
    if contact.get('status'):
        notes.append(f"Status: {contact['status']}")

    return ' | '.join(notes)


def normalize_contact(contact):
    homeemail, workemail = normalize_email_values(contact.get('mail'))
    homephone, workphone, cellphone, fax = normalize_phone_values(contact.get('tel'))
    address = (contact.get('address') or '').strip()

    row = (
        'admin',                              # owner_id
        'contact',                            # type
        homeemail,                            # homeemail
        workemail,                            # workemail
        homephone,                            # homephone
        workphone,                            # workphone
        cellphone,                            # cellphone
        fax,                                  # fax
        (contact.get('office') or '').strip(),# title
        (contact.get('company') or '').strip(),# company
        build_notes(contact),                 # notes
        (contact.get('name') or '').strip(),  # name
        '',                                   # homestreet
        '',                                   # homepob
        '',                                   # homecity
        '',                                   # homeprovince
        '',                                   # homepostalcode
        '',                                   # homecountry
        address,                              # workstreet
        '',                                   # workpob
        '',                                   # workcity
        '',                                   # workprovince
        '',                                   # workpostalcode
        '',                                   # workcountry
        '',                                   # url
        IMPORT_SOURCE                         # sid_imported
    )

    return row


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

    if not url or not username or not password:
        print('No URL, username or password found', file=sys.stderr)
        sys.exit(1)

    token = get_token(url, username, password)
    contacts = get_contacts(url, token)

    insert_sql = """
        INSERT INTO phonebook (
            owner_id,
            type,
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
            sid_imported
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """

    rows = []
    for contact in contacts:
        row = normalize_contact(contact)
        rows.append(row)
        log("Prepared contact row", {
            "name": contact.get('name', ''),
            "company": contact.get('company', ''),
            "phones": contact.get('tel', []),
            "emails": contact.get('mail', [])
        })

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
        except Exception:
            pass
        try:
            db.close()
        except Exception:
            pass


if __name__ == '__main__':
    try:
        main()
    except Exception as err:
        print(str(err), file=sys.stderr)
        sys.exit(1)

