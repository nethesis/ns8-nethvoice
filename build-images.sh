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
#buildah run nodebuilder-nethvoice sh -c "cd /usr/src/ui && yarn install && yarn build"

# Add imageroot directory to the container image
buildah add "${container}" imageroot /imageroot
mkdir -p  ui/dist
buildah add "${container}" ui/dist /ui
# Setup the entrypoint, ask to reserve one TCP port with the label and set a rootless container
buildah config \
    --label="org.nethserver.authorizations=traefik@any:routeadm" \
    --label="org.nethserver.tcp-ports-demand=3" \
    --label="org.nethserver.rootfull=0" \
    --label="org.nethserver.images=docker.io/library/mariadb:latest $repobase/freepbx:latest $repobase/asterisk:latest" \
    "${container}"

images+=("${repobase}/${reponame}"):

reponame="freepbx"
container=$(buildah from docker.io/library/php:5.6-apache)

# Copy entrypoint script into freepbx container
buildah add "${container}" imageroot/freepbx/entrypoint.sh /entrypoint.sh

# Copy mysql initializzation data
buildah add "${container}" imageroot/freepbx/initdb.d /

buildah config \
    --entrypoint='["/entrypoint.sh"]' \
    "${container}"

# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"

# Append the image URL to the images array
images+=("${repobase}/${reponame}"):

# Build Asterisk container

reponame="asterisk"
container=$(buildah from centos:7)

buildah run $container -- bash -s <<'EOF'
yum install -y http://mirror.nethserver.org/nethserver/nethserver-release-7.rpm
yum install -y epel-release
yum install -y \
    asterisk13-core \
    asterisk13-odbc \
    asterisk13-addons-mysql \
    asterisk13-resample \
    asterisk-codecs \
    asterisk13-voicemail-odbcstorage \
    asterisk13-dahdi \
    asterisk13-speex \
    asterisk13-addons-core \
    asterisk-sounds-extra-en-ulaw \
    unixODBC \
    mysql-connector-odbc
yum clean all
rm -rf /var/cache/yum
EOF

buildah config \
    --workingdir=/var/lib/asterisk \
    "${container}"

# Commit the asterisk image
buildah commit "${container}" "${repobase}/${reponame}"

images+=("${repobase}/${reponame}")

# Setup CI when pushing to Github. 
# Warning! docker::// protocol expects lowercase letters (,,)
if [[ -n "${CI}" ]]; then
    # Set output value for Github Actions
    printf "::set-output name=images::%s\n" "${images[*],,}"
else
    # Just print info for manual push
    printf "Publish the images with:\n\n"
    for image in "${images[@],,}"; do printf "  buildah push %s docker://%s:%s\n" "${image}" "${image}" "${IMAGETAG:-latest}" ; done
    printf "\n"
fi
