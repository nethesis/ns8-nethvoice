#!/bin/bash
echo "[*] Install packages"
apt install -y patch buildah

# patch some files
echo "[*] Patch some files"
patch -p0 < freepbx_fixes.patch

echo "[*] Remove useless files"
rm -rf imageroot/volumes/freepbx/admin/assets/less/cache/*
rm -rf imageroot/volumes/freepbx/admin/modules/*/assets/less/cache/*
rm -rf imageroot/volumes/freepbx/admin/modules/*/assets/less/*/cache/*
rm -rf imageroot/freepbx/root/initdb.d/data/asterisk/asterisk.endpointman*

echo "[*] Set environment variables"
export MARIADB_PORT=13306
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
export CDRDBHOST=mariadb
export CDRDBNAME=asteriskcdrdb
export CDRDBUSER=cdruser
export CDRDBPASS=dummycdrdbpass
export PHP_INI_DIR=/usr/local/etc/php
export REPOBASE=ghcr.io/stell0
export REGISTRY_AUTH_FILE=/etc/nethserver/registry.json
export APACHE_PORT=7187
export AMPASTERISKGROUP=asterisk
export AMPASTERISKUSER=asterisk
export AMPASTERISKWEBGROUP=asterisk
export AMPASTERISKWEBUSER=asterisk
export NETHVOICESECRETKEY=dummysecretkey
export CTIDBPASS=dummyctidbpass
export TANCREDIPORT=7190
export TANCREDI_STATIC_TOKEN=dummytancredistatictoken
export BRAND_NAME=NexthVoice
export BRAND_SITE=http://www.nethvoice.it
export BRAND_DOCS=http://nethvoice.docs.nethesis.it

echo "[*] Set repobase"
repobase="${REPOBASE:-ghcr.io/nethserver}"
reponame="nethvoice"

echo "[*] Clean containers"
podman stop mariadb asterisk freepbx14 tancredi
podman rm mariadb asterisk freepbx14 tancredi

echo "[*] Build asterisk container"
container=$(buildah from centos:7)
buildah add "${container}" imageroot/asterisk/root/ /
buildah run "${container}" yum -y install asterisk18-core asterisk18-addons-core asterisk18-dahdi asterisk18-odbc asterisk18-voicemail asterisk18-voicemail-odbcstorage unixODBC
buildah run "${container}" rm -fr /var/cache/yum
buildah config --entrypoint='["/entrypoint.sh"]' "${container}"
buildah commit "${container}" asterisk

echo "[*] Build FreePBX container"
container=$(buildah from docker.io/library/php:5.6-apache)
buildah add "${container}" imageroot/freepbx/root/ /
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

# install PHP additional modules
buildah run "${container}" docker-php-source extract

# install pdo_mysql
buildah run "${container}" docker-php-ext-configure pdo_mysql
buildah run "${container}" docker-php-ext-install pdo_mysql

# install php gettext
buildah run "${container}" docker-php-ext-configure gettext
buildah run "${container}" docker-php-ext-install gettext

# install php semaphores (sysvsem)
buildah run "${container}" docker-php-ext-configure sysvsem
buildah run "${container}" docker-php-ext-install sysvsem

# TODO install pdo_odbc
#buildah run "${container}" apt-get update
#buildah run "${container}" apt install -y unixodbc unixodbc-dev
#buildah run "${container}" docker-php-ext-configure pdo_odbc --with-pdo-odbc=unixODBC
#buildah run "${container}" docker-php-ext-install pdo_odbc

# Install required packages
buildah run "${container}" apt-get update
buildah run "${container}" apt install -y gnupg
buildah run "${container}" apt install -y cron # TODO needed by freepbx cron module. To remove.

# Use PHP development ini configuration and enable logging on syslog
buildah run "${container}" cp -a "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
buildah run "${container}" sed -i 's/^;error_log = syslog/error_log = \/dev\/stderr/' $PHP_INI_DIR/php.ini
echo "error_log = /dev/stderr" | buildah run "${container}" tee -a "$PHP_INI_DIR/conf.d/freepbx.ini"
echo "variables_order = "EGPCS"" | buildah run "${container}" tee -a "$PHP_INI_DIR/conf.d/freepbx.ini"

# Enable environment variables
buildah run "${container}" sed -i 's/^variables_order = "GPCS"/variables_order = "EGPCS"/' $PHP_INI_DIR/php.ini

# enable apache rewrite module
buildah run "${container}" a2enmod rewrite

# remove php sources
buildah run "${container}" docker-php-source delete

# TODO REMOVE BEFORE DEPLOY
buildah run "${container}" apt-get install -y mycli vim telnet

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
buildah add "${container}"  imageroot/tancredi/root/ /
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
container=$(buildah from node:14.20.1-alpine)
buildah add "${container}" imageroot/nethcti/root/ /
buildah config --workingdir /usr/lib/node/nethcti-server "${container}"
#buildah run "${container}" npm install
buildah config --entrypoint '["npm", "start"]' "${container}"
buildah commit "${container}" nethcti-server

echo "[*] Run MariaDB"
rm -f /var/tmp/mariadb.ctr-id /var/tmp/mariadb.pid
MARIA_TAG=10.8.2
/usr/bin/podman run \
    --detach \
    --conmon-pidfile=/var/tmp/mariadb.pid \
    --cidfile=/var/tmp/mariadb.ctr-id \
    --cgroups=no-conmon \
    --log-opt=tag=mariadb \
    --replace --name=mariadb \
    --volume=mariadb-data:/var/lib/mysql:Z \
    --env=MARIADB_ROOT_PASSWORD \
    --network=host \
    docker.io/library/mariadb:${MARIA_TAG} \
    --port ${MARIADB_PORT}

sleep 15

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
    --mount=type=bind,source=imageroot/volumes/freepbx,destination=/var/www/html/freepbx,relabel=shared,ro=true \
    --mount=type=bind,source=imageroot/volumes/var_lib_asterisk_sounds,destination=/var/lib/asterisk/sounds,relabel=shared,ro=true \
    --mount=type=bind,source=imageroot/volumes/var_lib_asterisk_agi-bin,destination=/var/lib/asterisk/agi-bin,relabel=shared,ro=true \
    --env=APACHE_SSL_PORT \
    --env=ASTMANAGERHOST \
    --env=ASTMANAGERPORT \
    --env=AMPMGRUSER \
    --env=AMPMGRPASS \
    --network=host \
    asterisk

sleep 15

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
    --mount=type=bind,source=imageroot/volumes/freepbx,destination=/var/www/html/freepbx,relabel=shared,ro=false \
    --mount=type=bind,source=imageroot/volumes/var_lib_asterisk_sounds,destination=/var/lib/asterisk/sounds,relabel=shared,ro=false \
    --mount=type=bind,source=imageroot/volumes/var_lib_asterisk_agi-bin,destination=/var/lib/asterisk/agi-bin,relabel=shared,ro=false \
    --env=MARIADB_ROOT_PASSWORD \
    --env=MARIADB_PORT \
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

sleep 15

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
    --env=MARIADB_PORT \
    --env=TANCREDI_STATIC_TOKEN \
    --network=host \
    tancredi

echo "[*] Run NethCTI"
rm -f /var/tmp/nethcti-server.ctr-id /var/tmp/nethcti-server.pid
/usr/bin/podman run \
    --detach \
    --conmon-pidfile=/var/tmp/nethcti-server.pid \
    --cidfile=/var/tmp/nethcti-server.ctr-id \
    --cgroups=no-conmon \
    --log-opt=tag=nethcti-server \
    --replace --name=nethcti-server \
    --volume=nethcti:/var/lib/nethcti:Z \
    --network=host \
    nethcti-server

sleep 15
