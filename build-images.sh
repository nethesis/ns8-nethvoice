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
buildah config --entrypoint=/ \
    --label="org.nethserver.authorizations=traefik@any:routeadm" \
    --label="org.nethserver.tcp-ports-demand=3" \
    --label="org.nethserver.rootfull=0" \
    --label="org.nethserver.images=docker.io/library/mariadb:latest docker.io/library/php:5.6-apache docker.io/dougbtv/asterisk13:latest" \
    "${container}"
# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"

# Append the image URL to the images array
images+=("${repobase}/${reponame}")

#
# NOTICE:
#
# It is possible to build and publish multiple images.
#
# 1. create another buildah container
# 2. add things to it and commit it
# 3. append the image url to the images array
#

#
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
