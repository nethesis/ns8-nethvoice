#!/bin/bash

# Terminate on error
set -e

# Prepare variables for later use
images=()
# The image will be pushed to GitHub container registry
repobase="${REPOBASE:-ghcr.io/nethserver}"
# Configure the image name
reponame="nethvoice"

# Build NS8 Module image
buildah build \
	--force-rm \
	--layers \
	--jobs "$(nproc)" \
	--build-arg REPOBASE="${repobase}" \
	--build-arg IMAGETAG="${IMAGETAG:-latest}" \
	--target dist \
	--tag "${repobase}/${reponame}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")



#######################
##      MariaDB      ##
#######################
echo "[*] Build mariadb container"
reponame="nethvoice-mariadb"
container=$(buildah from docker.io/library/mariadb:10.8.2)
buildah add "${container}" mariadb/ /

# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")


##########################
##      FreePBX 16      ##
##########################
echo "[*] Build FreePBX container"
reponame="nethvoice-freepbx"
pushd freepbx
buildah build --force-rm --no-cache --jobs "$(nproc)" --tag "${repobase}/${reponame}"
popd

# Append the image URL to the images array
images+=("${repobase}/${reponame}")


########################
##      Tancredi      ##
########################
echo "[*] Build Tancredi container"
reponame="nethvoice-tancredi"
container=$(buildah from docker.io/library/php:7-apache)
buildah config --entrypoint='["/entrypoint.sh"]' "${container}"
buildah config --workingdir /var/lib/tancredi "${container}"
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
BRANCH=master
curl -L https://github.com/nethesis/tancredi/archive/refs/heads/${BRANCH}.tar.gz -o - | tar xzp --strip-component=1 -C /usr/share/tancredi/ tancredi-${BRANCH}/data/ tancredi-${BRANCH}/public/ tancredi-${BRANCH}/scripts/ tancredi-${BRANCH}/src/ tancredi-${BRANCH}/composer.json tancredi-${BRANCH}/composer.lock

BRANCH=master
curl -L https://github.com/nethesis/nethserver-tancredi/archive/refs/heads/${BRANCH}.tar.gz -o - | tar xzp --strip-component=2 -C / nethserver-tancredi-${BRANCH}/root/usr/share/tancredi/ nethserver-tancredi-${BRANCH}/root/var/lib/tancredi
cd /usr/share/tancredi/
curl -s https://getcomposer.org/installer | php
COMPOSER_ALLOW_SUPERUSER=1 php composer.phar install --no-dev
rm -fr /usr/share/tancredi/src/Entity/SampleFilter.php /usr/share/tancredi/composer.phar /usr/share/tancredi/composer.json /usr/share/tancredi/composer.lock
chgrp -R www-data /var/lib/tancredi/data/*

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

export PHP_INI_DIR=/usr/local/etc/php
buildah run "${container}" cp -a "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
buildah run "${container}" sed -i 's/^;error_log = syslog/error_log = \/dev\/stderr/' $PHP_INI_DIR/php.ini

# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")



#############################
##      NethCTI Server     ##
#############################
echo "[*] Build nethcti container"
reponame="nethvoice-cti-server"
pushd nethcti-server
buildah build --force-rm --layers --jobs "$(nproc)" --target production --tag "${repobase}/${reponame}"
popd
# Append the image URL to the images array
images+=("${repobase}/${reponame}")

#############################
##      NethCTI Client     ##
#############################
reponame="nethvoice-cti-ui"
container=$(buildah from ghcr.io/nethesis/nethvoice-cti:0.0.9)

# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")

#############################
##      Janus Gateway      ##
#############################
echo "[*] Build Janus Gateway container"
reponame="nethvoice-janus"
pushd janus
buildah build --force-rm --layers --jobs "$(nproc)" --tag "${repobase}/${reponame}"
popd

# Append the image URL to the images array
images+=("${repobase}/${reponame}")


#########################
##      Phonebook      ##
#########################
echo "[*] Build Phonebook container"
reponame="nethvoice-phonebook"
pushd phonebook
buildah build --force-rm --layers --jobs "$(nproc)" --tag "${repobase}/${reponame}"
popd

# Append the image URL to the images array
images+=("${repobase}/${reponame}")

#############################
##      FlexiSIP proxy     ##
#############################
echo "[*] Build flexisip container"
reponame="nethvoice-flexisip"
pushd flexisip
buildah build --force-rm --layers --jobs "$(nproc)" --tag "${repobase}/${reponame}"
popd
# Append the image URL to the images array
images+=("${repobase}/${reponame}")

#########################
##      Reports        ##
#########################
pushd reports
reponame="nethvoice-reports-api"
buildah build --force-rm --layers --jobs "$(nproc)" --target api-production --tag "${repobase}"/"${reponame}"
images+=("${repobase}/${reponame}")
reponame="nethvoice-reports-ui"
buildah build --force-rm --layers --jobs "$(nproc)" --target ui-production --tag "${repobase}"/"${reponame}"
images+=("${repobase}/${reponame}")
popd


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
