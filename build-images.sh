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

build_image() {
    shift
    buildah build "$@"
}

# Sanitize the image tag by replacing slashes with dashes to avoid issues with buildah tagging
if [[ -n "${IMAGETAG}" ]]; then
    IMAGETAG=$(printf '%s' "${IMAGETAG}" | tr '/' '-')
fi

# Agent features require a coordinated Satellite runtime. Refuse to publish a module
# image that would still bundle the upstream 0.2.4 transcription-only process.
if should_build "nethvoice-satellite"; then
    if [[ -n "${SATELLITE_SOURCE_DIR:-}" && -n "${SATELLITE_BASE_IMAGE:-}" ]] ||
       [[ -z "${SATELLITE_SOURCE_DIR:-}" && -z "${SATELLITE_BASE_IMAGE:-}" ]]; then
        printf 'Set exactly one of SATELLITE_SOURCE_DIR or SATELLITE_BASE_IMAGE for Satellite Agent features\n' >&2
        exit 2
    fi
elif should_build "nethvoice"; then
    if [[ -z "${SATELLITE_BASE_IMAGE:-}" || -n "${SATELLITE_SOURCE_DIR:-}" ]]; then
        printf 'A module-only build requires SATELLITE_BASE_IMAGE; select nethvoice-satellite to build from SATELLITE_SOURCE_DIR\n' >&2
        exit 2
    fi
fi

if [[ -n "${SATELLITE_BASE_IMAGE:-}" ]]; then
    satellite_image_name="${SATELLITE_BASE_IMAGE##*/}"
    if [[ "${satellite_image_name}" != *:* && "${SATELLITE_BASE_IMAGE}" != *@sha256:* ]] ||
       [[ "${SATELLITE_BASE_IMAGE}" == *:latest || "${SATELLITE_BASE_IMAGE}" == *:lts ||
          "${SATELLITE_BASE_IMAGE}" == *:main || "${SATELLITE_BASE_IMAGE}" == *:master ||
          "${SATELLITE_BASE_IMAGE}" == *:dev ]]; then
        printf 'SATELLITE_BASE_IMAGE must be a reviewed, pinned image reference\n' >&2
        exit 2
    fi
fi

satellite_label_image="${repobase}/nethvoice-satellite:${IMAGETAG:-latest}"
if should_build "nethvoice" && ! should_build "nethvoice-satellite"; then
    satellite_label_image="${SATELLITE_BASE_IMAGE}"
    satellite_check_container=$(buildah from "${SATELLITE_BASE_IMAGE}")
    buildah run "${satellite_check_container}" -- python -c \
        'import api, agent.api, agent.runtime, agent.monitoring.api, inspect, main; assert isinstance(api.agent_runtime, agent.runtime.AgentRuntime); assert "/api/agent/v1/readiness" in api.app.openapi()["paths"]; assert inspect.iscoroutinefunction(main.main) and "server.serve" in inspect.getsource(main.main)'
    buildah rm "${satellite_check_container}"
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
        --build-arg SATELLITE_IMAGE="${satellite_label_image}" \
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
    container=$(buildah from docker.io/library/mariadb:10.11.19)
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
    container=$(buildah from ghcr.io/nethesis/nethcti-middleware:v0.5.22)

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
    container=$(buildah from ghcr.io/nethesis/nethvoice-cti:v0.15.32)

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
##  SAML2 SP (SSO)    ##
#############################
reponame="nethvoice-saml2-proxy"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    pushd saml2-proxy
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
##  OIDC front-door (SSO)  ##
#############################
# Mirror of the upstream oauth2-proxy (configured entirely via env at runtime).
reponame="nethvoice-oauth2-proxy"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    container=$(buildah from quay.io/oauth2-proxy/oauth2-proxy:v7.7.1)
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
## Satellite API, Agent and STT/TTS ##
##########################
reponame="nethvoice-satellite"
if should_build "${reponame}"; then
    start_timing "${reponame}"
    if [[ -n "${SATELLITE_SOURCE_DIR:-}" ]]; then
        satellite_source=$(realpath "${SATELLITE_SOURCE_DIR}")
        # Runtime extensions are versioned with the NethVoice feature. Build
        # from the exact upstream base and apply the module's reviewed patch;
        # never mutate the supplied checkout or depend on an unpublished ref.
        satellite_build_context=$(mktemp -d)
        trap 'rm -rf -- "${satellite_build_context}"' EXIT
        satellite_base_ref=$(cat satellite/runtime-ref)
        [[ "${satellite_base_ref}" =~ ^[0-9a-f]{40}$ ]]
        git -C "${satellite_source}" archive --format=tar "${satellite_base_ref}" > "${satellite_build_context}/source.tar"
        tar -xf "${satellite_build_context}/source.tar" -C "${satellite_build_context}"
        rm "${satellite_build_context}/source.tar"
        git -C "${satellite_build_context}" apply "$(realpath satellite/runtime-patches/phase3.patch)"
        cp -a satellite/runtime-overlay/. "${satellite_build_context}/"
        satellite_source="${satellite_build_context}"
        for required in Containerfile main.py requirements.txt agent/runtime.py agent/api.py; do
            if [[ ! -f "${satellite_source}/${required}" ]]; then
                printf 'Satellite source is missing %s\n' "${required}" >&2
                exit 2
            fi
        done
        if ! grep -Eq '^jsonschema([<=>[:space:]]|$)' "${satellite_source}/requirements.txt"; then
            printf 'Satellite source must include jsonschema in requirements.txt\n' >&2
            exit 2
        fi
        satellite_build_tag="localhost/nethvoice-satellite-agent-build:${IMAGETAG:-latest}"
        buildah build --force-rm --layers \
            --file "${satellite_source}/Containerfile" \
            --tag "${satellite_build_tag}" "${satellite_source}"
        container=$(buildah from "${satellite_build_tag}")
        rm -rf -- "${satellite_build_context}"
        trap - EXIT
    else
        container=$(buildah from "${SATELLITE_BASE_IMAGE}")
    fi
    # Check the assembled runtime before tagging it for deployment.
    buildah run "${container}" -- python -c \
        'import api, agent.api, agent.runtime, agent.monitoring.api, inspect, main; assert isinstance(api.agent_runtime, agent.runtime.AgentRuntime); assert "/api/agent/v1/readiness" in api.app.openapi()["paths"]; assert inspect.iscoroutinefunction(main.main) and "server.serve" in inspect.getsource(main.main)'
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
