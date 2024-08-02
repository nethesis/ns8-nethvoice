#!/bin/bash

# Terminate on error
set -e

# Prepare variables for later use
images=()
# The image will be pushed to GitHub container registry
repobase="${REPOBASE:-ghcr.io/nethesis}"
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
	--tag "${repobase}/${reponame}" \
	--tag "${repobase}/${reponame}:${IMAGETAG:-latest}" \
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
buildah commit "${container}" "${repobase}/${reponame}:${IMAGETAG:-latest}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")


##########################
##      FreePBX 16      ##
##########################
echo "[*] Build FreePBX container"
reponame="nethvoice-freepbx"
pushd freepbx
buildah build --force-rm --no-cache --jobs "$(nproc)" \
	--tag "${repobase}/${reponame}" \
	--tag "${repobase}/${reponame}:${IMAGETAG:-latest}"
popd

# Append the image URL to the images array
images+=("${repobase}/${reponame}")


########################
##      Tancredi      ##
########################
echo "[*] Build Tancredi container"
reponame="nethvoice-tancredi"
pushd tancredi
buildah build --force-rm --layers --jobs "$(nproc)" \
	--tag "${repobase}/${reponame}" \
	--tag "${repobase}/${reponame}:${IMAGETAG:-latest}"
popd
# Append the image URL to the images array
images+=("${repobase}/${reponame}")


#############################
##      NethCTI Server     ##
#############################
echo "[*] Build nethcti container"
reponame="nethvoice-cti-server"
pushd nethcti-server
buildah build --force-rm --layers --jobs "$(nproc)" --target production \
	--tag "${repobase}/${reponame}" \
	--tag "${repobase}/${reponame}:${IMAGETAG:-latest}"
popd
# Append the image URL to the images array
images+=("${repobase}/${reponame}")


#############################
##      NethCTI Client     ##
#############################
reponame="nethvoice-cti-ui"
container=$(buildah from ghcr.io/nethesis/nethvoice-cti:0.1.9)

# Commit the image
buildah commit "${container}" "${repobase}/${reponame}"
buildah commit "${container}" "${repobase}/${reponame}:${IMAGETAG:-latest}"
# Append the image URL to the images array
images+=("${repobase}/${reponame}")

#############################
##      Janus Gateway      ##
#############################
echo "[*] Build Janus Gateway container"
reponame="nethvoice-janus"
pushd janus
buildah build --force-rm --layers --jobs "$(nproc)" \
	--tag "${repobase}/${reponame}" \
	--tag "${repobase}/${reponame}:${IMAGETAG:-latest}"
popd

# Append the image URL to the images array
images+=("${repobase}/${reponame}")


#########################
##      Phonebook      ##
#########################
echo "[*] Build Phonebook container"
reponame="nethvoice-phonebook"
pushd phonebook
buildah build --force-rm --layers --jobs "$(nproc)" \
	--tag "${repobase}/${reponame}" \
	--tag "${repobase}/${reponame}:${IMAGETAG:-latest}"
popd

# Append the image URL to the images array
images+=("${repobase}/${reponame}")


#########################
##      Reports        ##
#########################
pushd reports
reponame="nethvoice-reports-api"
buildah build --force-rm --layers --jobs "$(nproc)" --target api-production \
	--tag "${repobase}"/"${reponame}" \
	--tag "${repobase}"/"${reponame}:${IMAGETAG:-latest}"
images+=("${repobase}/${reponame}")
reponame="nethvoice-reports-ui"
buildah build --force-rm --layers --jobs "$(nproc)" --target ui-production \
	--tag "${repobase}"/"${reponame}" \
	--tag "${repobase}"/"${reponame}:${IMAGETAG:-latest}"
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
