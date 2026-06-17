#!/bin/bash

# Terminate on error
set -e

# Prepare variables for later use
images=()
timings=()
build_timing_file="${BUILD_TIMING_FILE:-build-timings.tsv}"
# The image will be pushed to GitHub container registry
repobase="${REPOBASE:-ghcr.io/nethesis}"
# Configure the image name
reponame="nethvoice"

start_timing() {
    current_timing_label="$1"
    current_timing_started_at=$(date +%s)
    printf "[*] Build %s\n" "${current_timing_label}"
}

finish_timing() {
    local ended_at duration

    ended_at=$(date +%s)
    duration=$((ended_at - current_timing_started_at))
    timings+=("${current_timing_label}"$'\t'"${duration}")
    printf "[*] Finished %s in %ss\n" "${current_timing_label}" "${duration}"
}

write_timing_summary() {
    local row label seconds

    {
        printf "image\tduration_seconds\n"
        if ((${#timings[@]})); then
            printf "%s\n" "${timings[@]}"
        fi
    } > "${build_timing_file}"

    if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
        {
            printf "### Image build timings\n\n"
            printf "| Image | Duration |\n"
            printf "| --- | ---: |\n"
            for row in "${timings[@]}"; do
                IFS=$'\t' read -r label seconds <<< "${row}"
                printf "| %s | %ss |\n" "${label}" "${seconds}"
            done
            printf "\n"
        } >> "${GITHUB_STEP_SUMMARY}"
    fi
}

should_build() {
    local requested_image image_short_name selected_image
    local -a selected_images

    requested_image="$1"
    if [[ -z "${BUILD_IMAGES:-}" ]]; then
        return 0
    fi

    image_short_name="${requested_image#nethvoice-}"
    IFS=',' read -ra selected_images <<< "${BUILD_IMAGES}"
    for selected_image in "${selected_images[@]}"; do
        selected_image="${selected_image//[[:space:]]/}"
        if [[ "${selected_image}" == "all" ||
              "${selected_image}" == "${requested_image}" ||
              "${selected_image}" == "${image_short_name}" ]]; then
            return 0
        fi
    done

    return 1
}

skip_build() {
    printf "[*] Skip %s (not selected by BUILD_IMAGES=%s)\n" "$1" "${BUILD_IMAGES}"
}

cache_repository() {
    local cache_template image_name

    cache_template="$1"
    image_name="$2"
    # Cache variables are repository prefixes unless they include {image}.
    if [[ "${cache_template}" == *"{image}"* ]]; then
        printf "%s" "${cache_template//\{image\}/${image_name}}"
    else
        printf "%s/%s" "${cache_template%/}" "${image_name}"
    fi
}

set_buildah_cache_args() {
    local image_name cache_repo cache_template cache_templates
    local -a cache_from_templates cache_to_templates

    image_name="$1"
    buildah_cache_args=()

    if [[ -n "${BUILDAH_CACHE_FROM:-}" ]]; then
        cache_templates="${BUILDAH_CACHE_FROM//$'\n'/,}"
        IFS=',' read -ra cache_from_templates <<< "${cache_templates}"
        for cache_template in "${cache_from_templates[@]}"; do
            cache_template="${cache_template//[[:space:]]/}"
            if [[ -n "${cache_template}" ]]; then
                cache_repo="$(cache_repository "${cache_template}" "${image_name}")"
                buildah_cache_args+=(--cache-from "${cache_repo}")
            fi
        done
    fi

    if [[ -n "${BUILDAH_CACHE_TO:-}" ]]; then
        cache_templates="${BUILDAH_CACHE_TO//$'\n'/,}"
        IFS=',' read -ra cache_to_templates <<< "${cache_templates}"
        for cache_template in "${cache_to_templates[@]}"; do
            cache_template="${cache_template//[[:space:]]/}"
            if [[ -n "${cache_template}" ]]; then
                cache_repo="$(cache_repository "${cache_template}" "${image_name}")"
                buildah_cache_args+=(--cache-to "${cache_repo}")
            fi
        done
    fi

    if [[ -n "${BUILDAH_CACHE_TTL:-}" ]]; then
        buildah_cache_args+=(--cache-ttl "${BUILDAH_CACHE_TTL}")
    fi
}

build_image() {
    local image_name

    image_name="$1"
    shift
    set_buildah_cache_args "${image_name}"
    buildah build "${buildah_cache_args[@]}" "$@"
}

# Sanitize the image tag by replacing slashes with dashes to avoid issues with buildah tagging
if [[ -n "${IMAGETAG}" ]]; then
    IMAGETAG=$(printf '%s' "${IMAGETAG}" | tr '/' '-')
fi

if [[ -n "${BUILDAH_CACHE_TTL:-}" && -z "${BUILDAH_CACHE_FROM:-}" ]]; then
    printf "BUILDAH_CACHE_TTL requires BUILDAH_CACHE_FROM\n" >&2
    exit 1
fi

# Build NS8 Module image
if should_build "${reponame}"; then
    start_timing "${reponame}"
    build_image "${reponame}" \
        --force-rm \
        --layers \
        --jobs "$(nproc)" \
        --build-arg REPOBASE="${repobase}" \
        --build-arg IMAGETAG="${IMAGETAG:-latest}" \
        --target dist \
        --tag "${repobase}/${reponame}" \
        --tag "${repobase}/${reponame}:${IMAGETAG:-latest}"
    finish_timing
    # Append the image URL to the images array
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi



#######################
##      MariaDB      ##
#######################
reponame="nethvoice-mariadb"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    container=$(buildah from docker.io/library/mariadb:10.11.17)
    buildah add "${container}" mariadb/ /

    # Commit the image
    buildah commit "${container}" "${repobase}/${reponame}"
    buildah commit "${container}" "${repobase}/${reponame}:${IMAGETAG:-latest}"
    finish_timing
    # Append the image URL to the images array
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi


##########################
##      FreePBX 16      ##
##########################
reponame="nethvoice-freepbx"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    pushd freepbx
    build_image "${reponame}" --force-rm --layers --jobs "$(nproc)" \
        --tag "${repobase}/${reponame}" \
        --tag "${repobase}/${reponame}:${IMAGETAG:-latest}"
    popd
    finish_timing

    # Append the image URL to the images array
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi


########################
##      Tancredi      ##
########################
reponame="nethvoice-tancredi"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    pushd tancredi
    build_image "${reponame}" --force-rm --layers --jobs "$(nproc)" \
        --tag "${repobase}/${reponame}" \
        --tag "${repobase}/${reponame}:${IMAGETAG:-latest}"
    popd
    finish_timing
    # Append the image URL to the images array
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi


#############################
##      NethCTI Server     ##
#############################
reponame="nethvoice-cti-server"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    pushd nethcti-server
    build_image "${reponame}" --force-rm --layers --jobs "$(nproc)" --target production \
        --tag "${repobase}/${reponame}" \
        --tag "${repobase}/${reponame}:${IMAGETAG:-latest}"
    popd
    finish_timing
    # Append the image URL to the images array
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi


#############################
##    NethCTI Middleware   ##
#############################
reponame="nethvoice-cti-middleware"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    container=$(buildah from ghcr.io/nethesis/nethcti-middleware:v0.5.3)

    # Commit the image
    buildah commit "${container}" "${repobase}/${reponame}"
    buildah commit "${container}" "${repobase}/${reponame}:${IMAGETAG:-latest}"
    finish_timing
    # Append the image URL to the images array
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi


#############################
##      NethCTI Client     ##
#############################
reponame="nethvoice-cti-ui"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    container=$(buildah from ghcr.io/nethesis/nethvoice-cti:v0.15.18)

    # Commit the image
    buildah commit "${container}" "${repobase}/${reponame}"
    buildah commit "${container}" "${repobase}/${reponame}:${IMAGETAG:-latest}"
    finish_timing
    # Append the image URL to the images array
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi

#############################
##      Janus Gateway      ##
#############################
reponame="nethvoice-janus"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    pushd janus
    build_image "${reponame}" --force-rm --layers --jobs "$(nproc)" \
        --tag "${repobase}/${reponame}" \
        --tag "${repobase}/${reponame}:${IMAGETAG:-latest}"
    popd
    finish_timing

    # Append the image URL to the images array
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi


#########################
##      Phonebook      ##
#########################
reponame="nethvoice-phonebook"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    pushd phonebook
    build_image "${reponame}" --force-rm --layers --jobs "$(nproc)" \
        --tag "${repobase}/${reponame}" \
        --tag "${repobase}/${reponame}:${IMAGETAG:-latest}"
    popd
    finish_timing

    # Append the image URL to the images array
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi


#########################
##      Reports        ##
#########################
pushd reports
reponame="nethvoice-reports-api"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    build_image "${reponame}" --force-rm --layers --jobs "$(nproc)" --target api-production \
        --tag "${repobase}"/"${reponame}" \
        --tag "${repobase}"/"${reponame}:${IMAGETAG:-latest}"
    finish_timing
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi
reponame="nethvoice-reports-ui"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    build_image "${reponame}" --force-rm --layers --jobs "$(nproc)" --target ui-production \
        --tag "${repobase}"/"${reponame}" \
        --tag "${repobase}"/"${reponame}:${IMAGETAG:-latest}"
    finish_timing
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi
popd

#########################
##   sftp recordings   ##
#########################
reponame="nethvoice-sftp"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    pushd sftp
    build_image "${reponame}" --force-rm --layers --jobs "$(nproc)" \
        --tag "${repobase}/${reponame}" \
        --tag "${repobase}/${reponame}:${IMAGETAG:-latest}"
    popd
    finish_timing
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi

##########################
## Satellite AI STT/TTS ##
##########################
reponame="nethvoice-satellite"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    container=$(buildah from ghcr.io/nethesis/satellite:0.2.2)
    # Commit the image
    buildah commit "${container}" "${repobase}/${reponame}"
    buildah commit "${container}" "${repobase}/${reponame}:${IMAGETAG:-latest}"
    finish_timing
    # Append the image URL to the images array
    images+=("${repobase}/${reponame}")
else
    skip_build "${reponame}"
fi

write_timing_summary

if ((${#images[@]} == 0)); then
    printf "No images selected. Check BUILD_IMAGES=%s\n" "${BUILD_IMAGES:-}" >&2
    exit 1
fi

# Setup CI when pushing to Github.
# Warning! docker::// protocol expects lowercase letters (,,)
if [[ -n "${CI}" ]]; then
    if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
        printf "GITHUB_OUTPUT is required when CI is set\n" >&2
        exit 1
    fi
    printf "images=%s\n" "${images[*]}" >> "${GITHUB_OUTPUT}"
else
    # Just print info for manual push
    printf "Publish the images with:\n\n"
    for image in "${images[@],,}"; do printf "  buildah push %s docker://%s:%s\n" "${image}" "${image}" "${IMAGETAG:-latest}" ; done
    printf "\n"
fi
