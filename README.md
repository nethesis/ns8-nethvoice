# NethVoice

NethVoice porting to NethServer 8

## Install

Instantiate the module with:

    add-module ghcr.io/nethserver/nethvoice:latest 1

The output of the command will return the instance name.
Output example:

    {"module_id": "nethvoice1", "image_name": "nethvoice", "image_url": "ghcr.io/nethserver/nethvoice:latest"}

## Configure

Let's assume that the nethvoice instance is named `nethvoice1`.

Launch `configure-module`, by setting the following parameters:
- `<MODULE_PARAM1_NAME>`: <MODULE_PARAM1_DESCRIPTION>
- `<MODULE_PARAM2_NAME>`: <MODULE_PARAM2_DESCRIPTION>
- ...

Example:

    api-cli run module/nethvoice1/configure-module --data '{}'

The above command will:
- start and configure the nethvoice instance
- (describe configuration process)
- ...

Send a test HTTP request to the nethvoice backend service:

    curl http://127.0.0.1/nethvoice/

## Uninstall

To uninstall the instance:

    remove-module --no-preserve nethvoice1

## Testing

Test the module using the `test-module.sh` script:


    ./test-module.sh <NODE_ADDR> ghcr.io/nethserver/nethvoice:latest

The tests are made using [Robot Framework](https://robotframework.org/)


# Manually build and launch containers

```
#
# Set ENV
#
export MARIADB_PORT=13306
export APACHE_PORT=7188
export APACHE_SSL_PORT=7189
export MARIADB_ROOT_PASSWORD=dummymariadbpass
export AMPDBUSER=freepbxuser
export AMPDBHOST=127.0.0.1
export AMPDBNAME=asterisk
export AMPDBPASS=dummyampdbpass
export CDRDBHOST=mariadb
export CDRDBNAME=asteriskcdrdb
export CDRDBUSER=cdruser
export CDRDBPASS=dummycdrdbpass
export AMPMGRUSER=admin
export AMPMGRPASS=dummyampmgrpass

#
# MariaDB
#

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

#
# Asterisk
#

container=$(buildah from centos:7)
buildah add "${container}" imageroot/asterisk/etc/yum.repos.d/nethserver.repo /etc/yum.repos.d/nethserver.repo
buildah run "${container}" yum -y install asterisk18-core asterisk18-addons-core asterisk18-dahdi asterisk18-odbc asterisk18-voicemail asterisk18-voicemail-odbcstorage unixODBC
buildah run "${container}" rm -fr /var/cache/yum
buildah add "${container}" imageroot/asterisk/entrypoint.sh /entrypoint.sh

# configuration
buildah config --entrypoint='["/entrypoint.sh"]' "${container}"

# TODO clean up container

# commit container
buildah commit "${container}" asterisk

rm -f /var/tmp/asterisk.ctr-id /var/tmp/asterisk.pid
/usr/bin/podman run \
    --detach \
    --conmon-pidfile=/var/tmp/asterisk.pid \
    --cidfile=/var/tmp/asterisk.ctr-id \
    --cgroups=no-conmon \
    --log-opt=tag=asterisk \
    --replace --name=asterisk \
    --volume=asterisk:/etc/asterisk:z \
    --env=APACHE_SSL_PORT \
    --network=host \
    asterisk

#
# FreePBX 16 PHP 7
#
export PHP_INI_DIR=/usr/local/etc/php
export REPOBASE=ghcr.io/stell0
export REGISTRY_AUTH_FILE=/etc/nethserver/registry.json
podman login -u Stell0 -p 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 ghcr.io
repobase="${REPOBASE:-ghcr.io/nethserver}"
reponame="nethvoice"


container=$(buildah from docker.io/library/php:7-apache)

buildah add "${container}" imageroot/freepbx/entrypoint.sh /entrypoint.sh

buildah add "${container}" imageroot/freepbx/initdbAST_CONFIG_DIR.d /initdb.d

buildah add "${container}"  imageroot/freepbx/usr/sbin/asterisk /usr/sbin/asterisk

buildah add "${container}"  imageroot/freepbx/var/lib/asterisk /var/lib/asterisk

buildah run "${container}" sed -i 's/<VirtualHost \*:80>/<VirtualHost \*:$\{APACHE_PORT\}>/' /etc/apache2/sites-enabled/000-default.conf
buildah run "${container}" sed -i 's/Listen 80/Listen $\{APACHE_PORT\}/' /etc/apache2/ports.conf
buildah run "${container}" sed -i 's/Listen 443/Listen $\{APACHE_SSL_PORT\}/' /etc/apache2/ports.conf

echo -e '\n: ${APACHE_PORT:=80}\nexport APACHE_PORT\n: ${APACHE_SSL_PORT:=443}\nexport APACHE_SSL_PORT\n' | buildah run "${container}" tee -a /etc/apache2/envvars

buildah config \
    --entrypoint='["/entrypoint.sh"]' \
    "${container}"


# install PHP additional modules
buildah run "${container}" docker-php-source extractAST_CONFIG_DIR

# install pdo_mysql
buildah run "${container}" docker-php-ext-configure pdo_mysql
buildah run "${container}" docker-php-ext-install pdo_mysql

# install php gettext
buildah run "${container}" docker-php-ext-configure gettext
buildah run "${container}" docker-php-ext-install gettext

# TODO install pdo_odbcssh tux@makako

#buildah run "${container}" apt-get update
#buildah run "${container}" apt install -y unixodbc unixodbc-dev
#buildah run "${container}" docker-php-ext-configure pdo_odbc --with-pdo-odbc=unixODBC
#buildah run "${container}" docker-php-ext-install pdo_odbc

# remove php sources
buildah run "${container}" docker-php-source delete

# Use PHP development ini configuration and enable logging on syslog
buildah run "${container}" cp -a "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
buildah run "${container}" sed -i 's/^;error_log = syslog/error_log = syslog/' $PHP_INI_DIR/php.ini
echo "error_log = syslog" | buildah run "${container}" tee -a "$PHP_INI_DIR/conf.d/freepbx.ini"
echo "variables_order = "EGPCS"" | buildah run "${coAST_CONFIG_DIRntainer}" tee -a "$PHP_INI_DIR/conf.d/freepbx.ini"

# Enable environment variables
buildah run "${container}" sed -i 's/^variables_order = "GPCS"/variables_order = "EGPCS"/' $PHP_INI_DIR/php.ini

# enable apache rewrite module
buildah run "${container}" a2enmod rewrite

# commit container
buildah commit "${container}" freepbx16

# Run
rm -f /var/tmp/freepbx16.ctr-id /var/tmp/freepbx16.pid
/usr/bin/podman run \
    --detach \
    --conmon-pidfile=/var/tmp/freepbx16.pid \
    --cidfile=/var/tmp/freepbx16.ctr-id \
    --cgroups=no-conmon \
    --log-opt=tag=freepbx16 \
    --replace --name=freepbx16 \
    --volume=./imageroot/www-data:/var/www/html:Z \
    --volume=./imageroot/freepbx/initdb.d:/initdb.d:Z \
    --env=MARIADB_ROOT_PASSWORD \
    --env=MARIADB_PORT \
    --env=AMPMGRUSER \
    --env=AMPMGRPASS \
    --env=AMPDBUSER \
    --env=AMPDBPASS \
    --env=AMPDBHOST \
    --env=AMPDBNAME \
    --env=CDRDBUSER \
    --env=CDRDBPASS \
    --env=APACHE_PORT \
    --volume=asterisk:/etc/asterisk:z \
    --env=MARIADB_ROOT_PASSWORD \
    --env=MARIADB_PORT \
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
    --network=host \
    freepbx16
    
podman exec -it freepbx16 bash

#
# FreePBX 14
#
export PHP_INI_DIR=/usr/local/etc/php
export REPOBASE=ghcr.io/stell0
export REGISTRY_AUTH_FILE=/etc/nethserver/registry.json
podman login -u Stell0 -p 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 ghcr.io
repobase="${REPOBASE:-ghcr.io/nethserver}"
reponame="nethvoice"


container=$(buildah from docker.io/library/php:5.6-apache)

buildah add "${container}" imageroot/freepbx/entrypoint.sh /entrypoint.sh

buildah add "${container}" imageroot/freepbx/initdb.d /initdb.d

buildah add "${container}"  imageroot/freepbx/var/lib/asterisk /var/lib/asterisk

buildah add "${container}"  imageroot/freepbx/usr/sbin/asterisk /usr/sbin/asterisk

buildah run "${container}" sed -i 's/<VirtualHost \*:80>/<VirtualHost \*:$\{APACHE_PORT\}>/' /etc/apache2/sites-enabled/000-default.conf
buildah run "${container}" sed -i 's/Listen 80/Listen $\{APACHE_PORT\}/' /etc/apache2/ports.conf
buildah run "${container}" sed -i 's/Listen 443/Listen $\{APACHE_SSL_PORT\}/' /etc/apache2/ports.conf

echo -e '\n: ${APACHE_PORT:=80}\nexport APACHE_PORT\n: ${APACHE_SSL_PORT:=443}\nexport APACHE_SSL_PORT\n' | buildah run "${container}" tee -a /etc/apache2/envvars

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

# TODO install pdo_odbc
#buildah run "${container}" apt-get update
#buildah run "${container}" apt install -y unixodbc unixodbc-dev
#buildah run "${container}" docker-php-ext-configure pdo_odbc --with-pdo-odbc=unixODBC
#buildah run "${container}" docker-php-ext-install pdo_odbc

# remove php sources
buildah run "${container}" docker-php-source delete

# Use PHP development ini configuration and enable logging on syslog
buildah run "${container}" cp -a "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
buildah run "${container}" sed -i 's/^;error_log = syslog/error_log = syslog/' $PHP_INI_DIR/php.ini
echo "error_log = syslog" | buildah run "${container}" tee -a "$PHP_INI_DIR/conf.d/freepbx.ini"
echo "variables_order = "EGPCS"" | buildah run "${container}" tee -a "$PHP_INI_DIR/conf.d/freepbx.ini"

# Enable environment variables
buildah run "${container}" sed -i 's/^variables_order = "GPCS"/variables_order = "EGPCS"/' $PHP_INI_DIR/php.ini

# enable apache rewrite module
buildah run "${container}" a2enmod rewrite

# commit container
buildah commit "${container}" freepbx14

export APACHE_PORT=7187

# Run
rm -f /var/tmp/freepbx14.ctr-id /var/tmp/freepbx14.pid
/usr/bin/podman run \
    --detach \
    --conmon-pidfile=/var/tmp/freepbx14.pid \
    --cidfile=/var/tmp/freepbx14.ctr-id \
    --cgroups=no-conmon \
    --log-opt=tag=freepbx14 \
    --replace --name=freepbx14 \
    --volume=./imageroot/www-data:/var/www/html:Z \
    --volume=./imageroot/freepbx/initdb.d:/initdb.d:Z \
    --env=MARIADB_ROOT_PASSWORD \
    --env=MARIADB_PORT \
    --env=AMPMGRUSER \
    --env=AMPMGRPASS \
    --env=AMPDBUSER \
    --env=AMPDBPASS \
    --env=AMPDBHOST \
    --env=AMPDBNAME \
    --env=CDRDBUSER \
    --env=CDRDBPASS \
    --env=APACHE_PORT \
    --volume=asterisk:/etc/asterisk:z \
    --env=MARIADB_ROOT_PASSWORD \
    --env=MARIADB_PORT \
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
    --network=host \
    freepbx14
    
podman exec -it freepbx14 bash

#
# Debug
#

podman exec -it freepbx bash
podman exec -it asterisk bash


apt-get update
apt-get install -y mycli vim telnet
# mycli -u root -h localhost -P $MARIADB_PORT -p $MARIADB_ROOT_PASSWORD
# telnet 

telnet 127.0.0.1 5038

Action: Login
ActionID: 1
Username: admin
Secret: dummyampmgrpass
```
