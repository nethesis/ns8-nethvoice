#!/bin/bash

# Terminate on error
set -e

# Prepare variables for later use
images=()
# The image will be pushed to GitHub container registry
repobase="${REPOBASE:-ghcr.io/nethserver}"
# Configure the image name
reponame="nethvoice"

# Create a new empty container image
container=$(buildah from scratch)

# Reuse existing nodebuilder-nethvoice container, to speed up builds
if ! buildah containers --format "{{.ContainerName}}" | grep -q nodebuilder-nethvoice; then
    echo "Pulling NodeJS runtime..."
    buildah from --name nodebuilder-nethvoice -v "${PWD}:/usr/src:Z" docker.io/library/node:lts
fi

#echo "Build static UI files with node..."
buildah run nodebuilder-nethvoice sh -c "cd /usr/src/ui && yarn install && yarn build"

# Add imageroot directory to the container image
buildah add "${container}" imageroot /imageroot
mkdir -p  ui/dist
buildah add "${container}" ui/dist /ui
# Setup the entrypoint, ask to reserve one TCP port with the label and set a rootless container
buildah config \
    --label="org.nethserver.authorizations=traefik@any:routeadm" \
    --label="org.nethserver.tcp-ports-demand=5" \
    --label="org.nethserver.rootfull=0" \
    --label="org.nethserver.images=$repobase/mariadb:latest $repobase/freepbx14:latest $repobase/asterisk:latest $repobase/nethcti:latest $repobase/tancredi:latest $repobase/janus:latest" \
    "${container}"

# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")



#######################
##      MariaDB      ##
#######################
echo "[*] Build mariadb container"
reponame="mariadb"
container=$(buildah from docker.io/library/mariadb:10.8.2)
buildah add "${container}" mariadb/ /

# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")


########################
##      Asterisk      ##
########################
echo "[*] Build Asterisk container"
reponame="asterisk"
container=$(buildah from centos:7)
buildah add "${container}" asterisk/ /
buildah run "${container}" yum -y install asterisk18-core asterisk18-addons-core asterisk18-dahdi asterisk18-odbc asterisk18-voicemail asterisk18-voicemail-odbcstorage unixODBC
buildah run "${container}" rm -fr /var/cache/yum
buildah config --entrypoint='["/entrypoint.sh"]' "${container}"

# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")



##########################
##      FreePBX 14      ##
##########################
echo "[*] Build FreePBX container"
reponame="freepbx14"

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
    --workingdir='/var/lib/asterisk' \
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
export PHP_INI_DIR=/usr/local/etc/php
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

# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")



########################
##      Tancredi      ##
########################
echo "[*] Build Tancredi container"
reponame="tancredi"
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

# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")



#######################
##      NethCTI      ##
#######################
echo "[*] Build nethcti container"
reponame="nethcti"
container=$(buildah from docker.io/library/node:14)
buildah add "${container}" nethcti/ /
buildah config --workingdir /usr/lib/node/nethcti-server "${container}"
buildah config --entrypoint '["npm", "start"]' "${container}"

# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")



#############################
##      Janus Gateway      ##
#############################
echo "[*] Build Janus Gateway container"
reponame="janus"
container=$(buildah from docker.io/canyan/janus-gateway:master)
buildah add "${container}" janus/ /
buildah config --entrypoint='["/entrypoint.sh"]' "${container}"

# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")



# Setup CI when pushing to Github. 
# Warning! docker::// protocol expects lowercase letters (,,)
if [[ -n "${CI}" ]]; then
    # Set output value for Github Actions
    printf "::set-output name=images::%s\n" "${images[*]}"
else
    # Just print info for manual push
    printf "Publish the images with:\n\n"
    for image in "${images[@],,}"; do printf "  buildah push %s docker://%s:%s\n" "${image}" "${image}" "${IMAGETAG:-latest}" ; done
    printf "\n"
fi
