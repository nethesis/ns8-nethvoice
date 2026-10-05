# Payment sheet viewer setup

The test sheet is [NethVoice test](https://docs.google.com/spreadsheets/d/11TWoBZvZvAGfoeu3p6v2SFJdWxFUx0kX8GNmerHiY-g/edit#gid=0), tab `Foglio1`, range `Foglio1!A1:I7`.
It contains six fictional payment records covering a unique number, an unknown
number, a shared number, accented names, two months and exact decimal amounts.
The same initial values are in `tests/fixtures/payments.csv`.

## Published test CSV (configured)

The owner subsequently supplied a published CSV URL. The PBX now uses
`google_csv`, with `payments` snapshot version 2 and hourly refresh. No Google
credential is needed for this test source. Select **Google Sheets (published CSV)**
in Data sources and paste the published URL; preview, publish, then pin the new
resource version in the secretary. Only HTTPS Google publishing URLs are accepted.
Redirects are limited to Google Sheets download hosts, with TLS verification and
connection-time public-address checks. Downloads have a 15-second deadline and
10 MiB bound. Failed refresh preserves the previous valid snapshot.

## Private viewer service account (optional)

For a private spreadsheet, use the separate `google_sheets` adapter below.

1. Select your project in [Google Cloud Console](https://console.cloud.google.com/).
   Enable **Google Sheets API** under APIs & Services → Library.
2. Under IAM & Admin → Service Accounts, create `nethvoice-sheet-reader`.
   Skip project role grants and domain-wide delegation: access is granted on the
   individual spreadsheet, not through a project administrator role.
3. Open that account → Keys → Add key → Create new key → JSON. Keep the download
   outside the repository. Do not paste the private key into chat.
4. Share the test spreadsheet with the service account's `client_email`, using
   **Viewer** access. This email is in the downloaded JSON and Cloud Console.
5. Import the downloaded key into the PBX's encrypted credential store:

   ```sh
   python3 satellite/import-sheets-key.py \
     --host makako.sf.nethserver.net --module nethvoice51 \
     --key-file /path/to/downloaded-service-account.json \
     --secret-id phase5-sheets
   ```

   The helper reads the key locally, sends it through SSH stdin to the private
   application API and prints only the HTTP status. It does not write a key copy
   into module configuration or expose it in process arguments.
   Alternatively, add `phase5-sheets` under Agents → Connections → Credentials;
   use compact JSON as the credential value.
6. In Agents → Data sources, create a Google Sheets source, select `phase5-sheets`,
   set spreadsheet ID `11TWoBZvZvAGfoeu3p6v2SFJdWxFUx0kX8GNmerHiY-g`, and range
   `Foglio1!A1:I7`. Map each header to the same canonical field name. Use country
   code `39`, decimal separator `.`, header row `1` and a refresh interval such
   as `3600` seconds. Preview and publish the imported snapshot.
7. Select the new resource/version in the secretary's identity and lookup blocks,
   then save, validate and publish the graph. Published graphs retain their pinned
   snapshot until a new graph version explicitly adopts a refreshed data version.

The Satellite adapter requests only `spreadsheets.readonly`, validates the token
endpoint and uses the fixed Sheets API origin. It never writes to the spreadsheet.
The Google Drive connector used to seed the sheet authenticates separately from
the PBX service account; successful connector reads do not establish PBX access.

References: [Google Workspace service-account credentials](https://developers.google.com/workspace/guides/create-credentials),
[creating JSON keys](https://docs.cloud.google.com/iam/docs/keys-create-delete),
[Sheets authorization scopes](https://developers.google.com/workspace/sheets/api/scopes).
