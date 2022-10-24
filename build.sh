#!/bin/bash
echo "[*] Install packages"
apt install -y patch buildah

echo "[*] Remove useless files"
rm -rf imageroot/volumes/freepbx/admin/assets/less/cache/*
rm -rf imageroot/volumes/freepbx/admin/modules/*/assets/less/cache/*
rm -rf imageroot/volumes/freepbx/admin/modules/*/assets/less/*/cache/*
rm -rf imageroot/freepbx/root/initdb.d/data/asterisk/asterisk.endpointman*

echo "[*] Set environment variables"
export NETHVOICE_MARIADB_PORT=13306
export APACHE_SSL_PORT=7189
export APACHE_RUN_USER=asterisk
export APACHE_RUN_GROUP=asterisk
export MARIADB_ROOT_PASSWORD=dummymariadbpass
export AMPDBUSER=freepbxuser
export AMPDBHOST=127.0.0.1
export AMPDBNAME=asterisk
export ASTMANAGERHOST=127.0.0.1
export ASTMANAGERPORT=5038
export AMPMGRUSER=admin
export AMPMGRPASS=dummyampmgrpass
export AMPDBPASS=dummyampdbpass
export CDRDBHOST=127.0.0.1
export CDRDBNAME=asteriskcdrdb
export CDRDBUSER=cdruser
export CDRDBPASS=dummycdrdbpass
export PHP_INI_DIR=/usr/local/etc/php
export REGISTRY_AUTH_FILE=/etc/nethserver/registry.json
export APACHE_PORT=7187
export AMPASTERISKGROUP=asterisk
export AMPASTERISKUSER=asterisk
export AMPASTERISKWEBGROUP=asterisk
export AMPASTERISKWEBUSER=asterisk
export NETHVOICESECRETKEY=dummysecretkey
export CTIUSER=nethcti
export CTIDBPASS=dummyctidbpass
export TANCREDIPORT=7190
export TANCREDI_STATIC_TOKEN=dummytancredistatictoken
export BRAND_NAME=NexthVoice
export BRAND_SITE=http://www.nethvoice.it
export BRAND_DOCS=http://nethvoice.docs.nethesis.it
export JANUS_ADMIN_SECRET=dummyjanusadminsecret
export JANUS_TRANSPORT_PORT=8089
export DEBUG_LEVEL=5
export RTPSTART=10000
export RTPEND=15000
export STUNSERVER=stun1.l.google.com
export STUNPORT=19302
export ICEIGNORE=vmnet,tap,tun,virb,vb-
export LOCAL_IP=172.25.5.83
export PROXYCTI_PASS=NOwGG9_bYd5GSgm3
export CTIUIPORT=8080

echo "[*] Clean containers"
podman stop mariadb asterisk freepbx14 tancredi nethcti-server janus
podman rm mariadb asterisk freepbx14 tancredi nethcti-server janus
podman rmi mariadb asterisk freepbx14 tancredi nethcti-server janus
podman volume rm mariadb-data asterisk spool tancredi nethcti nethcti-server nethcti-server-code nethcti-server-log janus

echo "[*] Clean podman system"
podman image prune -f
podman volume prune -f
podman container prune -f
podman system prune -f

echo "[*] Build MariaDB container"
container=$(buildah from docker.io/library/mariadb:10.8.2)
buildah add "${container}" mariadb/ /
buildah commit "${container}" mariadb

echo "[*] Build asterisk container"
container=$(buildah from centos:7)
buildah add "${container}" asterisk/ /
buildah run "${container}" yum -y install asterisk18-core asterisk18-addons-core asterisk18-dahdi asterisk18-odbc asterisk18-voicemail asterisk18-voicemail-odbcstorage unixODBC
buildah run "${container}" rm -fr /var/cache/yum
buildah config --entrypoint='["/entrypoint.sh"]' "${container}"
buildah commit "${container}" asterisk

echo "[*] Build FreePBX container"
container=$(buildah from docker.io/library/php:5.6-apache)
buildah add "${container}" freepbx/ /
buildah run "${container}" groupadd -r asterisk
buildah run "${container}" useradd -r -s /bin/false -d /var/lib/asterisk -M -c 'Asterisk User' -g asterisk asterisk

buildah run "${container}" /bin/sh <<EOF
sed -i 's/<VirtualHost \*:80>/<VirtualHost \*:\$\{APACHE_PORT\}>/' /etc/apache2/sites-enabled/000-default.conf
sed -i 's/Listen 80/Listen \$\{APACHE_PORT\}/' /etc/apache2/ports.conf
sed -i 's/Listen 443/Listen \$\{APACHE_SSL_PORT\}/' /etc/apache2/ports.conf
echo '\n: \${APACHE_PORT:=80}\nexport APACHE_PORT\n: \${APACHE_SSL_PORT:=443}\nexport APACHE_SSL_PORT\n' >> /etc/apache2/envvars
EOF

buildah config \
    --entrypoint='["/entrypoint.sh"]' \
    "${container}"

# Install required packages
buildah run "${container}" apt-get update
buildah run "${container}" apt install -y gnupg mycli libldap2-dev
buildah run "${container}" apt install -y cron # TODO needed by freepbx cron module. To remove.

# install PHP additional modules
buildah run "${container}" docker-php-source extract

# install pdo_mysql
buildah run "${container}" docker-php-ext-configure pdo_mysql
buildah run "${container}" docker-php-ext-install pdo_mysql

# install php gettext
buildah run "${container}" docker-php-ext-configure gettext
buildah run "${container}" docker-php-ext-install gettext

# install ldap
buildah run "${container}" ln -s /usr/lib/x86_64-linux-gnu/libldap.so /usr/lib/libldap.so
buildah run "${container}" docker-php-ext-configure ldap
buildah run "${container}" docker-php-ext-install ldap

# install php semaphores (sysvsem)
buildah run "${container}" docker-php-ext-configure sysvsem
buildah run "${container}" docker-php-ext-install sysvsem

# TODO install pdo_odbc
#buildah run "${container}" apt-get update
#buildah run "${container}" apt install -y unixodbc unixodbc-dev
#buildah run "${container}" docker-php-ext-configure pdo_odbc --with-pdo-odbc=unixODBC
#buildah run "${container}" docker-php-ext-install pdo_odbc

# Use PHP development ini configuration and enable logging on syslog
buildah run "${container}" cp -a "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
buildah run "${container}" sed -i 's/^;error_log = syslog/error_log = \/dev\/stderr/' $PHP_INI_DIR/php.ini
echo "error_log = /dev/stderr" | buildah run "${container}" tee -a "$PHP_INI_DIR/conf.d/freepbx.ini"
echo "variables_order = "EGPCS"" | buildah run "${container}" tee -a "$PHP_INI_DIR/conf.d/freepbx.ini"

# Enable environment variables
buildah run "${container}" sed -i 's/^variables_order = "GPCS"/variables_order = "EGPCS"/' $PHP_INI_DIR/php.ini

# enable apache rewrite module
buildah run "${container}" a2enmod rewrite proxy*

# remove php sources
buildah run "${container}" docker-php-source delete

# TODO REMOVE BEFORE DEPLOY
buildah run "${container}" apt-get install -y vim telnet

# clean apt cache
buildah run "${container}" apt-get clean autoclean
buildah run "${container}" apt-get autoremove --yes
buildah run "${container}" rm -rf /var/lib/dpkg/info/* /var/lib/cache/* /var/lib/log/*
buildah run "${container}" touch /var/lib/dpkg/status

# commit container
buildah commit "${container}" freepbx14

echo "[*] Build Tancredi container"
container=$(buildah from docker.io/library/php:7-apache)
buildah config --entrypoint='["/entrypoint.sh"]' "${container}"
buildah add "${container}"  tancredi/ /
buildah run "${container}" /bin/sh <<'EOF'
apt update
apt install -y libapache2-mod-xsendfile zip
ln -sf /etc/apache2/sites-available/tancredi.conf /etc/apache2/sites-enabled/tancredi.conf

sed -i 's/<VirtualHost \*:80>/<VirtualHost \*:$\{TANCREDIPORT\}>/' /etc/apache2/sites-enabled/000-default.conf
sed -i 's/Listen 80/Listen $\{TANCREDIPORT\}/' /etc/apache2/ports.conf
sed -i 's/Listen 443/Listen $\{TANCREDI_SSL_PORT\}/' /etc/apache2/ports.conf
echo -e '\n: ${TANCREDIPORT:=80}\nexport TANCREDIPORT\n: ${TANCREDI_SSL_PORT:=443}\nexport TANCREDI_SSL_PORT\n' | buildah run "${container}" tee -a /etc/apache2/envvars

# Install Tancredi files
mkdir /usr/share/tancredi/
curl -L https://github.com/nethesis/tancredi/archive/refs/heads/master.tar.gz -o - | tar xzp --strip-component=1 -C /usr/share/tancredi/ tancredi-master/data/ tancredi-master/public/ tancredi-master/scripts/ tancredi-master/src/ tancredi-master/composer.json tancredi-master/composer.lock

BRANCH=otherdb
curl -L https://github.com/nethesis/nethserver-tancredi/archive/refs/heads/${BRANCH}.tar.gz -o - | tar xzp --strip-component=2 -C / nethserver-tancredi-${BRANCH}/root/usr/share/tancredi/ nethserver-tancredi-${BRANCH}/root/var/lib/tancredi
cd /usr/share/tancredi/
curl -s https://getcomposer.org/installer | php
COMPOSER_ALLOW_SUPERUSER=1 php composer.phar install --no-dev
rm -fr /usr/share/tancredi/src/Entity/SampleFilter.php /usr/share/tancredi/composer.phar /usr/share/tancredi/composer.json /usr/share/tancredi/composer.lock

# install pdo_mysql
docker-php-source extract
docker-php-ext-configure pdo_mysql
docker-php-ext-install pdo_mysql
docker-php-source delete

# clean apt cache
apt-get clean autoclean
apt-get autoremove --yes
rm -rf /var/lib/dpkg/info/* /var/lib/cache/* /var/lib/log/*
touch /var/lib/dpkg/status
EOF

buildah run "${container}" cp -a "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
buildah run "${container}" sed -i 's/^;error_log = syslog/error_log = \/dev\/stderr/' $PHP_INI_DIR/php.ini
buildah commit "${container}" tancredi

echo "[*] Build nethcti container"
container=$(buildah from docker.io/library/node:14)
buildah add "${container}" nethcti/ /
buildah run "${container}" apt-get clean autoclean
buildah run "${container}" apt-get update
buildah run "${container}" apt-get install -y jq ldap-utils
buildah config --workingdir /usr/lib/node/nethcti-server "${container}"
buildah config --entrypoint '["npm", "start"]' "${container}"
buildah commit "${container}" nethcti-server

echo "[*] Build nethcti-ui container"
container=$(buildah from docker.io/library/httpd:2.4)
buildah add "${container}" imageroot/nethcti-ui/root/usr/share/cti/ /usr/local/apache2/htdocs/
buildah run "${container}" sed -i "s/Listen 80/Listen ${CTIUIPORT}/g" conf/httpd.conf
buildah commit "${container}" nethcti-ui

echo "[*] Build Janus Gateway container"
container=$(buildah from docker.io/canyan/janus-gateway:master)
buildah add "${container}" janus/ /
buildah config --entrypoint='["/entrypoint.sh"]' "${container}"
buildah commit "${container}" janus


echo "[*] Run MariaDB"
rm -f /var/tmp/mariadb.ctr-id /var/tmp/mariadb.pid
/usr/bin/podman run \
    --detach \
    --conmon-pidfile=/var/tmp/mariadb.pid \
    --cidfile=/var/tmp/mariadb.ctr-id \
    --cgroups=no-conmon \
    --log-opt=tag=mariadb \
    --replace --name=mariadb \
    --volume=mariadb-data:/var/lib/mysql:Z \
    --env=MARIADB_ROOT_PASSWORD \
    --env=NETHVOICE_MARIADB_PORT \
    --env=AMPDBUSER \
    --env=AMPDBPASS \
    --env=CDRDBUSER \
    --env=CDRDBHOST \
    --env=CDRDBPASS \
    --env=CTIUSER \
    --env=CTIDBPASS \
    --network=host \
    mariadb
    --port ${NETHVOICE_MARIADB_PORT}

sleep 5

echo "[*] Run Asterisk"
rm -f /var/tmp/asterisk.ctr-id /var/tmp/asterisk.pid
/usr/bin/podman run \
    --detach \
    --conmon-pidfile=/var/tmp/asterisk.pid \
    --cidfile=/var/tmp/asterisk.ctr-id \
    --cgroups=no-conmon \
    --log-opt=tag=asterisk \
    --replace --name=asterisk \
    --volume=asterisk:/etc/asterisk:z \
    --volume=spool:/var/spool/asterisk:z \
    --volume=sounds:/var/lib/asterisk/sounds:Z \
    --volume=agi-bin:/var/lib/asterisk/agi-bin:Z \
    --env=APACHE_SSL_PORT \
    --env=ASTMANAGERHOST \
    --env=ASTMANAGERPORT \
    --env=AMPMGRUSER \
    --env=AMPMGRPASS \
    --env=LOCAL_IP \
    --env=RTPSTART \
    --env=RTPEND \
    --network=host \
    asterisk

sleep 60

echo "[*] Run FreePBX"
rm -f /var/tmp/freepbx14.ctr-id /var/tmp/freepbx14.pid
/usr/bin/podman run \
    --detach \
    --conmon-pidfile=/var/tmp/freepbx14.pid \
    --cidfile=/var/tmp/freepbx14.ctr-id \
    --cgroups=no-conmon \
    --log-opt=tag=freepbx14 \
    --replace --name=freepbx14 \
    --volume=spool:/var/spool/asterisk:z \
    --volume=asterisk:/etc/asterisk:z \
    --volume=nethcti:/etc/nethcti:z \
    --volume=sounds:/var/lib/asterisk/sounds:Z \
    --volume=agi-bin:/var/lib/asterisk/agi-bin:Z \
    --volume=lookup.d:/usr/src/nethvoice/lookup.d:z \
    --env=MARIADB_ROOT_PASSWORD \
    --env=NETHVOICE_MARIADB_PORT \
    --env=APACHE_RUN_USER \
    --env=APACHE_RUN_GROUP \
    --env=ASTMANAGERHOST \
    --env=ASTMANAGERPORT \
    --env=AMPMGRUSER \
    --env=AMPMGRPASS \
    --env=AMPDBUSER \
    --env=AMPDBPASS \
    --env=AMPDBHOST \
    --env=AMPDBNAME \
    --env=CDRDBUSER \
    --env=CDRDBPASS \
    --env=CTIDBPASS \
    --env=APACHE_PORT \
    --env=APACHE_SSL_PORT \
    --env=NETHVOICESECRETKEY \
    --env=CTIDBPASS \
    --env=TANCREDIPORT \
    --env=BRAND_NAME \
    --env=BRAND_SITE \
    --env=BRAND_DOCS \
    --network=host \
    freepbx14

sleep 5

echo "[*] Run Tancredi"
rm -f /var/tmp/tancredi.ctr-id /var/tmp/tancredi.pid
/usr/bin/podman run \
    --detach \
    --conmon-pidfile=/var/tmp/tancredi.pid \
    --cidfile=/var/tmp/tancredi.ctr-id \
    --cgroups=no-conmon \
    --log-opt=tag=tancredi \
    --replace --name=tancredi \
    --volume=tancredi:/var/lib/tancredi:Z \
    --env=TANCREDIPORT \
    --env=NETHVOICESECRETKEY \
    --env=AMPDBUSER \
    --env=AMPDBPASS \
    --env=NETHVOICE_MARIADB_PORT \
    --env=TANCREDI_STATIC_TOKEN \
    --env=LOCAL_IP \
    --env=RTPSTART \
    --env=RTPEND \
    --network=host \
    tancredi

sleep 5

echo "[*] Run NethCTI"
rm -f /var/tmp/nethcti-server.ctr-id /var/tmp/nethcti-server.pid
/usr/bin/podman run \
    --detach \
    --conmon-pidfile=/var/tmp/nethcti-server.pid \
    --cidfile=/var/tmp/nethcti-server.ctr-id \
    --cgroups=no-conmon \
    --log-opt=tag=nethcti-server \
    --replace --name=nethcti-server \
    --volume=nethcti:/etc/nethcti:z \
    --volume=nethcti-server:/root:Z \
    --volume=nethcti-server-code:/usr/lib/node/nethcti-server:Z \
    --volume=nethcti-server-log:/var/log/asterisk:Z \
    --network=host \
    nethcti-server

sleep 5

echo "[*] Run NethCTI UI"
rm -f /var/tmp/nethcti-ui.ctr-id /var/tmp/nethcti-ui.pid
/usr/bin/podman run \
    --detach \
    --conmon-pidfile=/var/tmp/nethcti-ui.pid \
    --cidfile=/var/tmp/nethcti-ui.ctr-id \
    --cgroups=no-conmon \
    --log-opt=tag=nethcti-ui \
    --replace --name=nethcti-ui \
    --volume=nethcti-ui:/usr/local/apache2/htdocs:z \
    --network=host \
    nethcti-ui

sleep 5

echo "[*] Run Janus"
rm -f /var/tmp/janus.ctr-id /var/tmp/janus.pid
/usr/bin/podman run \
    --detach \
    --conmon-pidfile=/var/tmp/janus.pid \
    --cidfile=/var/tmp/janus.ctr-id \
    --cgroups=no-conmon \
    --log-opt=tag=janus \
    --replace --name=janus \
    --env=LOCAL_IP \
    --env=RTPSTART \
    --env=RTPEND \
    --network=host \
    janus \
    /usr/local/bin/janus \
    --configs-folder /usr/local/etc/janus \
    --interface=lo \
    --stun-server=${STUNSERVER:=stun1.l.google.com}:${STUNPORT:=19302} \
    --ice-ignore-list=${ICEIGNORE:=vmnet,tap,tun,virb,vb-} \
    --rtp-port-range=${RTPSTART:=10000}-${RTPEND:=20000} \
    --debug-level=${DEBUG_LEVEL:=4}

sleep 5

echo "[*] Set LDAP configuration"
ldap_conf=$(runagent python3 -magent.ldapproxy |  cut -d "{" -f 2 | echo "{$(cat -)" | tr "'" '"')
ldap_settings='{"host":"'$(echo $ldap_conf | jq -r .host)'","port":"'$(echo $ldap_conf | jq -r .port)'","basedn":"'$(echo $ldap_conf | jq -r .base_dn)'","username":"'$(echo $ldap_conf | jq -r .bind_dn)'","password":"'$(echo $ldap_conf | jq -r .bind_password)'","connection":"","localgroups":"0","createextensions":"","externalidattr":"entryUUID","descriptionattr":"description","commonnameattr":"cn","userdn":"","userobjectclass":"posixAccount","userobjectfilter":"(objectclass=posixAccount)","usernameattr":"uid","userfirstnameattr":"givenName","userlastnameattr":"sn","userdisplaynameattr":"displayName","usertitleattr":"","usercompanyattr":"","usercellphoneattr":"","userworkphoneattr":"telephoneNumber","userhomephoneattr":"","userfaxphoneattr":"","usermailattr":"mail","usergroupmemberattr":"memberOf","la":"","groupdnaddition":"","groupobjectclass":"groupOfUniqueNames","groupobjectfilter":"(objectclass=posixGroup)","groupmemberattr":"memberUid","sync":"*\/30 * * * *"}'
podman exec -it mariadb mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e 'INSERT INTO userman_directories VALUES (2, "NethServer", "Openldap2", 1, 5, 1, 0);'
podman exec -it mariadb mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e "INSERT INTO kvstore_FreePBX_modules_Userman VALUES ('auth-settings', '$ldap_settings', 'json-arr', 2);"
podman exec -it mariadb mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e 'UPDATE userman_directories set `default` = 0 WHERE id = 1;'
podman exec -it freepbx14 mkdir -p /var/run/asterisk
podman exec -it freepbx14 touch /var/run/asterisk/userman.lock
asterisk_pid=$(podman exec -it asterisk cat /var/run/asterisk/asterisk.pid)
podman exec -it freepbx14 bash -c "echo $asterisk_pid > /var/run/asterisk/userman.lock"
podman exec -it freepbx14 chown -R asterisk:asterisk /var/www/html/freepbx/admin/assets/less/cache/
podman exec -it freepbx14 chown -R asterisk:asterisk /etc/asterisk/*
podman exec -it freepbx14 fwconsole userman --syncall --force

echo "[*] Replace old asterisk pass"
podman exec -it mariadb mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e "UPDATE manager set secret = '$PROXYCTI_PASS' WHERE name = 'proxycti';"
podman exec -it freepbx14 fwconsole r
podman restart asterisk

echo "[*] Put nethcti-server env file for auth script"
podman exec -it nethcti-server bash -c "touch /usr/lib/node/nethcti-server/scripts/nethcti_env"
podman exec -it nethcti-server bash -c "echo LDAP_CONF=\''$ldap_conf'\' > /usr/lib/node/nethcti-server/scripts/nethcti_env"
podman restart nethcti-server
