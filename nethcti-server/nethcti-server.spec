Name: nethcti-server3
Version: 3.29.0
Release: 1%{?dist}
Summary: Node.js server for NethCTI
Group: Network
License: AGPLv3
Source0: %{name}-%{version}.tar.gz
BuildRequires: nethserver-devtools
BuildRequires: nodejs >= 6.16.0
BuildRequires: npm
Requires: rh-nodejs10
Requires: nethserver-nethvoice14 >= 14.7.3
Requires: nethserver-janus
Requires: nethserver-conference
Requires: nethvoice-report
Requires: sox
Requires: mpg123
Conflicts: nethcti-server
AutoReq: no

%description
Node.js server application used for NethCTI

%prep
%setup

%build
perl -w createlinks
cd root/usr/lib/node/nethcti-server && npm install && cd -
# nethcti configuration directory
mkdir -p root/etc/nethcti
mkdir -p root/etc/nethcti/dbstatic.d
mkdir -p root/var/lib/nethserver/nethcti/static
mkdir -p root/var/lib/asterisk/sounds/nethcti

# clean nodejs npm modules
find root/usr/lib/node/nethcti-server/node_modules -iname readme.\* -o \
  -iname benchmark\* -o \
  -iname sample\* -o \
  -iname logos\* -o \
  -iname test\* -o \
  -iname example\* -o \
  -iname changelog\* -o \
  -iname man -o \
  -iname doc -o \
  -iname docs -o \
  -iname component.json -o \
  -iname \*.md -o \
  -iname \*.bat -o \
  -iname \*.tgz | xargs rm -rf

%install
rm -rf %{buildroot}
(cd root; find . -depth -print | cpio -dump %{buildroot})
%{genfilelist} %{buildroot} \
--file /usr/lib/node/nethcti-server/scripts/pam-authenticate.pl 'attr(0550,asterisk,asterisk)' \
--file /etc/nethcti/ast_objects.json 'attr(0600,asterisk,asterisk)' \
--file /etc/nethcti/users.json 'attr(0600,asterisk,asterisk)' \
--file /etc/nethcti/profiles.json 'attr(0600,asterisk,asterisk)' \
--file /etc/nethcti/streaming.json 'attr(0600,asterisk,asterisk)' \
--file /etc/nethcti/operator.json 'attr(0600,asterisk,asterisk)' \
--file /var/lib/nethserver/nethcti/templates/customer_card/statistics.ejs 'attr(0600,asterisk,asterisk)' \
--file /var/lib/nethserver/nethcti/templates/customer_card/table.ejs 'attr(0600,asterisk,asterisk)' \
--dir /var/lib/nethserver/nethcti/static 'attr(0775,asterisk,asterisk)' \
--dir /var/lib/nethserver/nethcti/templates/customer_card 'attr(0775,asterisk,asterisk)' \
--dir /usr/lib/node/nethcti-server/plugins/com_static_http/static 'attr(0775,asterisk,asterisk)' \
--dir /var/lib/asterisk/sounds/nethcti 'attr(0775,asterisk,asterisk)' \
--dir /etc/nethcti/dbstatic.d 'attr(0770,asterisk,asterisk)' \
--dir /etc/nethcti 'attr(0775,asterisk,asterisk)' > %{name}-%{version}-filelist

%clean
rm -rf %{buildroot}

%files -f %{name}-%{version}-filelist
%defattr(-,root,root,-)
%config(noreplace) /etc/nethcti/ast_objects.json
%config(noreplace) /etc/nethcti/users.json
%config(noreplace) /etc/nethcti/profiles.json
%config(noreplace) /etc/nethcti/operator.json
%config(noreplace) /etc/nethcti/streaming.json
%config(noreplace) /var/lib/nethserver/nethcti/templates/customer_card/statistics.ejs
%config(noreplace) /var/lib/nethserver/nethcti/templates/customer_card/table.ejs


%doc
%dir %{_nseventsdir}/%{name}-update

%changelog
* Wed Jul 26 2023 Stefano Fancello <stefano.fancello@nethesis.it> - 3.29.0-1
- Enhance presence on unavailable management nethesis/dev#6211

* Wed May 31 2023 Stefano Fancello <stefano.fancello@nethesis.it> - 3.28.8-1
- license: change to AGPLv3
- Offhour: accept CORS (#284) nethesis/dev#6202
- build(deps): NPM: update astproxy dependency (automated) (#287)
- Force astproxy version update to latest
- Fix phone-island authentication token check (#281)
- Add remove_persistent_token and phone_island_token_exists apis
- Remove user component check from phone_island_token
- Add  phone_island_token api for phone island's token
- Fix documentation URL
- Fix external script launcher comment (#279)

* Fri Sep 02 2022 Giacomo Sanchietti <giacomo.sanchietti@nethesis.it> - 3.28.7-1
- rsync disaster recovery introduces permissions issue - Bug NethServer/dev#6691

* Mon Aug 01 2022 Stefano Fancello <stefano.fancello@nethesis.it> - 3.28.6-1
- In not managed calls, take time from first interaction instead of last one - Bug nethesis/dev#6177

* Wed Jul 06 2022 Stefano Fancello <stefano.fancello@nethesis.it> - 3.28.5-1
- in cti call history, transfered calls show a wrong duration - Bug nethesis/dev#6162
- Don't show internal calls answered by someone else as lost   - Bug nethesis/dev#6161

* Wed Jun 01 2022 Sebastian <sebastian.besel@nethesis.it> - 3.28.4-1
- Pickup of calls parked with transfer to 70 fails - Bug nethesis/dev#6156

* Thu May 26 2022 Sebastian <sebastian.besel@nethesis.it> - 3.28.3-1
- Wrong DND and Queues status of physical phone - Bug nethesis/dev#6151
- Avoid inconsistent status on presence update  - Bug nethesis/dev#6155
- Missing data inside history - Bug nethesis/dev#6153
- An error is thrown on device pin get - Bug nethesis/dev#6148

* Mon May 09 2022 Sebastian <sebastian.besel@nethesis.it> - 3.28.2-1
- Add param URL to nethifier - nethesis/dev#6141
- Add recall times for agents and for queues - nethesis/dev#6127
- Don't show calls answered by someone else as lost - Bug nethesis/dev#6129
- Sometimes the new presence is not correctly updated - Bug nethesis/dev#6128

* Thu Mar 24 2022 Sebastian <sebastian.besel@nethesis.it> - 3.28.1-1
- Sometimes the new presence is not correctly updated - Bug nethesis/dev#6128

* Mon Mar 07 2022 Sebastian <sebastian.besel@nethesis.it> - 3.28.0-1
- Combine telephone presence and custom presence into one main presence - nethesis/dev#6110

* Wed Feb 16 2022 Sebastian <sebastian.besel@nethesis.it> - 3.27.6-1
- Something goes wrong on user-extension check - Bug nethesis/dev#6107
- Fix of favorite contacts in the speed-dial and in the address book - Bug nethesis/dev#6082

* Fri Feb 04 2022 Stefano Fancello <stefano.fancello@nethesis.it> - 3.27.5-1
- Merge pull request #256 from nethesis/facter

* Mon Jan 31 2022 Sebastian <sebastian.besel@nethesis.it> - 3.27.4-1
- Improve management of some actions available on calls - Bug nethesis/dev#6105

* Fri Jan 28 2022 Sebastian <sebastian.besel@nethesis.it> - 3.27.3-1
- Lack of call popup if using physical phone - Bug nethesis/dev#6083

* Wed Dec 01 2021 Sebastian <sebastian.besel@nethesis.it> - 3.27.2-1
- Enhance recall on busy management - Bug nethesis/dev#6089

* Fri Oct 29 2021 Sebastian <sebastian.besel@nethesis.it> - 3.27.1-1
- NethCTI: add phone URLs for NethPhone - nethesis/dev#6070
- Phonebook's _/getall_ endpoint returns wrong contacts - Bug nethesis/dev#6071

* Thu Oct 21 2021 Sebastian <sebastian.besel@nethesis.it> - 3.27.0-1
- Switch nethifier's socket to TLS with backward compatibility - nethesis/dev#6060
- Add the Recall On Busy module - nethesis/dev#6066

* Thu Sep 16 2021 Sebastian <sebastian.besel@nethesis.it> - 3.26.1-1
- Default registration value for unmonitored trunks is wrong - Bug nethesis/dev#6049
- Enable encrypted connections to the tcp module  - nethesis/dev#6047
- The timers are showing wrong info when server and client time are misaligned - Bug nethesis/dev#6052
- Add company column to tables indexes - nethesis/dev#6045

* Fri Aug 06 2021 Sebastian <sebastian.besel@nethesis.it> - 3.26.0-1
- Phonebook: data for companies and contacts sometimes don't correspond - Bug nethesis/dev#6038

* Fri Jun 18 2021 Sebastian <sebastian.besel@nethesis.it> - 3.25.0-1
- Nethifier shows error dialog making a new call with Snom (c2c auto) - Bug nethesis/dev#6025
- Calls don't work in "cloud click 2 call" mode and nethifier not connected - Bug nethesis/dev#6023
- Reload phone configuration instead of restarting it (setting physical buttons) - nethesis/dev#6022
- Server crash getting streaming source with malformed URL - Bug nethesis/dev#6020
- Wizard: add an option to open parameterized URL only for incoming calls through queues - nethesis/dev#5928
- Nethifier: it does not receive events when logged-in as user@domain or with the extension identifier - Bug nethesis/dev#6019
- Nethifier: custom notification popup is not definitive - Bug nethesis/dev#6005
- Add nethvoice-report rpm requirement - nethesis/dev#5951
- Get "NullCallPeriod" from nethvoice-report api instead of from the config db - nethesis/dev#5950
- Migrate astproxy npm package to the new org account - Bug nethesis/dev#6013
- Groups calls history - nethesis/dev#5914
- Mobile requests authentication is broken when nethcti tokens aren't present - Bug nethesis/dev#6009

* Tue May 04 2021 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.24.2-1
- Mobile requests authentication is broken when nethcti tokens aren't present - Bug nethesis/dev#6009

* Wed Apr 28 2021 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.24.1-1
- Rest api `extension/:id` used by "admin" user return data with privacy - Bug nethesis/dev#5999
- Too many database connections - Bug nethesis/dev#5996

* Thu Apr 22 2021 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.24.0-1
- Jitsi instant video conference integration - nethesis/dev#5966
- Privacy issue into the operator panel for call forward option - Bug nethesis/dev#5990
- The authentication fallback makes the log file incomprehensible - Bug nethesis/dev#5983
- WebSocket disconnection with reason "ping timeout" - Bug nethesis/dev#5977
- Privacy problem with Shibboleth authentication - Bug nethesis/dev#5980
- DND and CF status not syncronized from NethCTI to phones - Bug nethesis/dev#5960
- Automatic Click2Call support for cloud installation - nethesis/dev#5916

* Wed Mar 10 2021 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.23.0-1
- Automatic Click2Call support for cloud installation - nethesis/dev#5916
- Add new authentication token for the mobile apps - nethesis/dev#5962
- NethCTI Conference doesn't update events  - Bug nethesis/dev#5957
- Add api to return phonebook contacts sorted alphabetically - nethesis/dev#5964
- Add support to enable Nethifier log - nethesis/dev#5948

* Fri Feb 12 2021 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.20.9-1
- Fix values validation on phonebook contact modify - nethesis/dev#5945
- Update Yealink call action URL (#210)
- Change Fanvil call action url (#211)

* Wed Jan 27 2021 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.20.8-1
- Privacy problem using username@domain to login - Bug nethesis/dev#5946
- README.md: add nethcti cli doc section - Bug nethesis/dev#5948
- nethcti.json template: fix field type (#207)

* Mon Jan 04 2021 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.20.7-1
- Change phonebook search to search on all fields - nethesis/dev#5925
- Privacy problem using extension number to login - Bug nethesis/dev#5936
- Some sporadic login failures - Bug nethesis/dev#5933
- Parameterized URL opens also for internal calls - Bug nethesis/dev#5927

* Fri Nov 27 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.20.6-1
- Add lost calls list to the history calls - nethesis/dev#5912
- Show Brand & Model into own device list - Bug nethesis/dev#5910
- Sequelize migration to mysql: step 2 - Bug nethesis/dev#5895
- Use Flexisip proxy for mobile app phone - nethesis/dev#5904 !! INCOMPLETE

* Fri Nov 06 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.20.5-1
- Poor performance on lost calls list on queues and qmanager - Bug nethesis/dev#5889
- After a period of inactivity, QManager does not show some information - Bug nethesis/dev#5900

* Fri Oct 30 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.20.4-1
- Server reload duplicate MySQL connections - Bug nethesis/dev#5898

* Tue Oct 20 2020 Davide Principi <davide.principi@nethesis.it> - 3.20.3-1
- NethVoice restore config fails in new systems - Bug nethesis/dev#5885
- Removing a user from nethserver manager doesn't reflect in the nethcti - Bug nethesis/dev#5884
- Sequelize migration to mysql - Bug nethesis/dev#5883

* Fri Sep 18 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.20.2-1
- Customer cards not always showed correctly - Bug nethesis/dev#5870

* Thu Sep 10 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.20.1-1
- Fix manual c2c to new simplified astproxy syntax- Bug nethesis/dev#5849

* Wed Sep 09 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.20.0-1
- Sometimes it happens that asterisk proxy can't get ready - Bug nethesis/dev#5855
- Unstable QRcode parameters breaks mobile app notifications - Bug nethesis/dev#5816
- Make the "astproxy" plugin an npm module - Bug nethesis/dev#5849
- Refresh client app after a client rpm upgrade - nethesis/dev#5725

* Mon Jul 27 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.19.2-1
- Add capability to inherit to Tancredi API GET /phones/{mac} - Bug nethesis/dev#5845
- MP3 audio files upload fails in offhour service - Bug nethesis/dev#5817

* Mon Jul 06 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.19.1-1
- Add "linkedid" to "extenConvConnected" websocket event - nethesis/dev#5823

* Fri May 29 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.19.0-1
- Insert audio into a conversation - nethesis/dev#5808
- Add call "uniqueid" into astproxy/call response - nethesis/dev#5806
- Additional data into "extenConvConnected" event from cti server - nethesis/dev#5804
- Add possibility to execute a script for each incoming external call - nethesis/dev#5805
- Improve management of parameterized URL - nethesis/dev#5803
- Wrong response code using rest api `astproxy/call` using offline webrtc - Bug nethesis/dev#5801
- NethCTI: Pauses are doubled - Bug nethesis/dev#5793

* Wed Apr 08 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.18.3-1
- Manage the presence of "webrtc_mobile" exten into users.json - Bug nethesis/dev#5770

* Mon Apr 06 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.18.2-1
- Fix a regression that cause problem during boot for user initialization with capital letter in username

* Sun Apr 05 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.18.1-1
- Some data inconsistency during reload - Bug nethesis/dev#5758

* Thu Apr 02 2020 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.18.0-1
- Add a proxy to communicate with tancredi and corbera components - nethesis/dev#5728

* Mon Dec 02 2019 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.17.3-1
- Sometimes reconnection fail - Bug nethesis/dev#5742

* Wed Oct 23 2019 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.17.0-1
- Fix login problems after server reboot (#148) - nethesis/dev#5724
- Improve performance of queue agent stats - nethesis/dev#5719
- Improve performance of the history search query - nethesis/dev#5717
- Improve performance of lost calls query - nethesis/dev#5708
- Sometimes, after a server restart, clients can't login to the cti - nethesis/dev#5707
- Rest api "extensions" performance improvement - nethesis/dev#5700

* Wed Sep 04 2019 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.16.1-1
- No login in sporadic scenario - nethesis/dev#5682
- Improve PIN management hiding it in some circumstances - nethesis/dev#5681

* Thu Jul 11 2019 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.16.0-1
- New phone pin management rest apis - nethesis/dev#5668

* Tue Jul 02 2019 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.15.0-1
- Add personal statistic of queue agent into the "Queues" tab - nethesis/dev#5656
- Add new events to WebSocket layer - nethesis/dev#5654
- QM add new Lost Calls tab - nethesis/dev#5646
- Show "hold" status into the box of the "Queues" of the QManager - Bug nethesis/dev#5658
- Add notifications for queues - nethesis/dev#5621
- No login on some boot scenarios and with no port 50113 listening - Bug nethesis/dev#5650

* Wed Jun 12 2019 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.14.0-1
- QManager_astats return queue data without privilege - Bug nethesis/dev#5634
- QManager new Dashboard tab - nethesis/dev#5610
- Fanvill support: 1 lost call for each outgoing call - Bug nethesis/dev#5526
- Add date time to qmanager dashboard alarms - nethesis/dev#5635
- Frequent log error on streaming error - Bug nethesis/dev#5637
- Added desktop sharing functions - nethesis/dev#5607
- Server error log "Error: Unable to retrieve transport udp,tcp,ws,wss" - Bug nethesis/dev#5636

* Tue May 28 2019 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.13.0-1
- QManager new Dashboard tab - nethesis/dev#5610
- Add notifications for queues - nethesis/dev#5621
- Wrong call direction during ringing time - Bug nethesis/dev#5629
- Execute script at the end of a call - nethesis/dev#5613

* Wed Apr 17 2019 Alessandro Polidori <alessandro.polidori@gmail.com> - 3.12.0-1
- No call management box for spy action - Bug nethesis/dev#5612
- Server history interval doesn't work correctly with type user - Bug nethesis/dev#5608
- Call recording does not work - Bug nethesis/dev#5615
- "astproxy/qmanager_astats" can generate a TypeError - Bug nethesis/dev#5611
- Rest api "extension/:id" returns only your extension - Bug nethesis/dev#5609

* Mon Apr 01 2019 Stefano Fancello <stefano.fancello@nethesis.it> - 3.11.0-1
- Added new com_ipc module to overcome reload problem - nethesis/dev#5600
- Added `linkedid` data to the extensions conversations - nethesis/dev#5605
- Add the possibility to disable the authentication - nethesis/dev#5532

* Fri Mar 22 2019 Alessandro Polidori <alessandro.polidori@gmail.com> - 3.10.1-1
- Asterisk 13.23+ missing IdentifyDetail event - Bug nethesis/dev#5597

* Fri Mar 15 2019 Alessandro Polidori <alessandro.polidori@gmail.com> - 3.10.0-1
- Added customization of "user not configured" message - nethesis/dev#5585
- Wrong behavior of historycall/intervall using user as type - Bug nethesis/dev#5584
- Automatic queue login/logout does not work using extension for login - Bug nethesis/dev#5581
- Upgrade nodejs to v10 - nethesis/dev#5588
- Upgrade some libraries for security reasons - Bug nethesis/dev#5587

* Fri Feb 08 2019 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.8.0-1
- Add new service "Operator Panel" - nethesis/dev#5549
- Queue agent penalty is not supported - Bug nethesis/dev#5575

* Mon Jan 21 2019 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.7.0-1
- Log as warn when a user deletes an offhour audio message - nethesis/dev#5565

* Fri Jan 11 2019 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.6.0-1
- Phonebook on modify contact privacy is always set to public - Bug nethesis/dev#5535
- Server does not work properly if some ports are busy during the boot - Bug nethesis/dev#5451
- Phonebook fix modify contacts buttons and search input submit event - Bug nethesis/dev#5533
- Add title and notes to phone book contacts - nethesis/dev#5536
- Migration from NethVoice11 to NethVoice14 - nethesis/dev#5454
- Add a dashboard to the wizard - nethesis/dev#5544

* Mon Dec 10 2018 Alessandro Polidori <alessandro.polidori@gmail.com> - 3.5.0-1
- Optimize the management of asterisk events, executed queries and websocket events - nethesis/dev#5513
- QManager agents empty information - Bug nethesis/dev#5524
- Log level "info" cause the writing on messages log file - Bug nethesis/dev#5508
- Audio conference does not work properly when used from physical phones - Bug nethesis/dev#5520
- Some technical debts on history, offhour, phonebook - Bug nethesis/dev#5517
- Remove unused rest api - Bug nethesis/dev#5518

* Mon Nov 12 2018 Alessandro Polidori <alessandro.polidori@gmail.com> - 3.4.0-1
- NethCTI 3: new rest api "astproxy/unauthe_call" - nethesis/dev#5507

* Wed Oct 31 2018 Alessandro Polidori <alessandro.polidori@gmail.com> - 3.3.3-1
- NethCTI 3: cti client freeze during reload of the server with many users - Bug nethesis/dev#5504
- NethCTI 3: extensions api is reachable without authentication - Bug nethesis/dev#5501
- NethCTI 3: error logs on auto queue loging/logout after reload - Bug nethesis/dev#5495

* Tue Oct 23 2018 Alessandro Polidori <alessandro.polidori@gmail.com> - 3.3.2-1
- NethCTI 3: phonebook and history tech debt - Bug nethesis/dev#5485

* Fri Oct 05 2018 Giacomo Sanchietti <giacomo.sanchietti@nethesis.it> - 3.3.1-1
- NethCTI 3: high cpu usage during huge traffic on trunks - Bug nethesis/dev#5453
- NethCTI 3: no automatic reload on customer card creation - Bug nethesis/dev#5441
- NethCTI 3: add mute both speak and listen on audio conference - nethesis/dev#5446

* Wed Sep 19 2018 Alessandro Polidori <alessandro.polidori@gmail.com> - 3.3.0-1
- QM: functions for queue summary tab. nethesis/dev#5437
- Update node-postgres to pg@6.1.6. nethesis/dev#5450
- remove useless output log
- Fix to show operator panel users with upper case letters. nethesis/dev#5439
- Fix small output log for authentication
- nethcti.js: add process pid on boot into the log

* Tue Jul 24 2018 Alessandro Polidori <alessandro.polidori@gmail.com> - 3.2.0-1
- Fix queue agent auto pause reason is lost - Bug nethesis/dev#5436
- Fix no call management box on voicemail - Bug nethesis/dev#5432
- QManager "queues" tab: add drag&drop feature and fixes - nethesis/dev#5429
- QManager: create new "Realtime tab" - nethesis/dev#5428
- Fix to support HTTP response code 302 with Snom D725 - Bug nethesis/dev#5435

* Mon Jul 02 2018 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.1.0-1
- Add support for new service "QManager" - nethesis/dev#5416
- WebSocket emit new event "extenConnected" - nethesis/dev#5421

* Wed Jun 06 2018 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.14-1
- Add import/export of speed dial contacts - nethesis/dev#5411
- Add automatic queue login/logout and DND - nethesis/dev#5410
- New service for Call Audio Conference - nethesis/dev#5408
- Add parameterized url to invoke on incoming call - nethesis/dev#5412

* Thu May 17 2018 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.13-1
- NethVoice14: agi fails with FreePBX framework 14.0.3.2 - Bug nethesis/dev#5406

* Wed May 16 2018 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.12-1
- New REST API POST "user/mobile" to associate cellphone number to a user - nethesis/dev#5396
- Presence list is not updated at runtime (upper right icon) - Bug nethesis/dev#5394

* Tue Apr 17 2018 Giacomo Sanchietti <giacomo.sanchietti@nethesis.it> - 3.0.11-1
- NethCTI3: queue_log table index creation fails during install - Bug nethesis/dev#5383

* Mon Apr 16 2018 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.10-1
- Return on blind transfer - nethesis/dev#5360

* Thu Apr 12 2018 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.9-1
- Upgrade moment.js dependency due to security vulnerability - Bug nethesis/dev#5375
- Wizard: no source available when create new customer card - Bug nethesis/dev#5362
- Add support for hangup and answer on webrtc - Bug nethesis/dev#5335
- List of unanswered calls for every queue - nethesis/dev#5363

* Wed Feb 14 2018 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.8-1
- NethCTI 3: add the possibility to remove customized avatar image (re-setting it to default) - nethesis/dev#5330

* Thu Feb 01 2018 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.7-1
- Calling numbers that start or end with * and/or # does not work - nethesis/dev#5312
- Add .travis.yml

* Mon Jan 29 2018 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.6-1
- Sporadic error in websocket send - nethesis/dev#5299
- Logrotate: fix permissions - nethesis/dev#5411

* Wed Jan 10 2018 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.5-1
- disable multiple login of the same type (desktop/mobile) - nethesis/5248
- add profiling component - nethesis/5271
- add layer to set nethifier led color
- add support for nethifier streaming popup - nethesis/dev#5265
- better doc for tcp events
- nethifier: temporary disable actions when use webrtc
- spec: sign streaming.json as config
- intrude does not work on some scenario - nethesis/5262
- restapi: add doc of user/presence get

* Thu Nov 30 2017 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.4-1
- new service offhour with mp3 & wav audio announcements for routes - nethesis/dev#5211
- support call to not clean phone numbers (e.g. with empty space) - nethesis/dev#5225
- fix default empty db sources after update on some cases
- fix authentication: enable case-sensitive login - nethesis/dev#5247
- fix download call recordings and voicemail messages - nethesis/dev#5252
- fix call started from a cellphone - nethesis/dev#5251
- fix other minor bugs

* Tue Nov 14 2017 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.3-1
- trunks: add support for sip,pjsip,iax trunks. nethesis/dev#5202 (#16)
- fix get channel for intrude. nethesis/dev#5246
- offhour: add support. nethesis/dev#5211
- wakeup: add retryTimes. nethesis/dev#5216
- voicemail: fix event emitter
- switchboard: fix entries for internal,out&in. nethesis/dev#5213

* Thu Sep 28 2017 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.2-1
- fix login with username@domain
- fix user list of audio conference
- add rest api for audio conference

* Fri Sep 01 2017 Alessandro Polidori <alessandro.polidori@nethesis.it> - 3.0.1-1
- Release 3.0.1

* Thu Aug 31 2017 Edoardo Spadoni <edoardo.spadoni@nethesis.it> - 3.0.0-1
Release 3.0.0

#* Wed Jan 18 2017 Alessandro Polidori <alessandro.polidori@nethesis.it> - 2.7.4-1
#- fix log "wrong parameter trunkStatus" for "UNREACHABLE" status
