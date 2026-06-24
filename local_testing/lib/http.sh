#!/usr/bin/env bash

lt_sha1_hex() {
  printf '%s' "$1" | sha1sum | awk '{print $1}'
}

lt_compute_rest_secretkey() {
  local password_sha1

  password_sha1="$(lt_sha1_hex "${FREEPBX_ADMIN_PASSWORD}")"
  REST_API_SECRETKEY="$(lt_sha1_hex "${REST_AUTH_USER}${password_sha1}${NETHVOICESECRETKEY}")"
  export REST_API_SECRETKEY
}

lt_run_pod_php_http_request() {
  local container="$1"
  local method="$2"
  local url="$3"
  local payload="${4-}"

  podman exec \
    -e NV_METHOD="${method}" \
    -e NV_URL="${url}" \
    -e NV_SECRETKEY="${REST_API_SECRETKEY:-}" \
    -e NV_USER="${REST_AUTH_USER:-}" \
    -e NV_PAYLOAD="${payload}" \
    "${container}" \
    php -r '
      $headers = [
        "Secretkey: " . getenv("NV_SECRETKEY"),
        "User: " . getenv("NV_USER"),
        "Content-Type: application/json;charset=UTF-8",
        "Accept: application/json, text/plain, */*",
      ];
      $options = [
        "http" => [
          "method" => getenv("NV_METHOD"),
          "ignore_errors" => true,
          "header" => implode("\r\n", $headers),
        ],
      ];

      $payload = getenv("NV_PAYLOAD");
      if ($payload !== "") {
        $options["http"]["content"] = $payload;
      }

      $context = stream_context_create($options);
      $body = @file_get_contents(getenv("NV_URL"), false, $context);
      if ($body === false) {
        $body = "";
      }

      $statusLine = $http_response_header[0] ?? "";
      preg_match("/\\s(\\d{3})\\s/", $statusLine, $matches);
      fwrite(STDOUT, $body . PHP_EOL . ($matches[1] ?? "000"));
    '
}

lt_run_authenticated_api() {
  local method="$1"
  local path="$2"
  local payload="${3-}"
  local expected_codes="${4:-200}"
  local operation_name="${5-}"
  local url
  local response
  local body
  local http_code
  local expected_code
  local matched=false
  local curl_args=(
    -sS
    -o
    -
    -w
    '\n%{http_code}'
    -X
    "${method}"
    -H
    "Secretkey: ${REST_API_SECRETKEY}"
    -H
    "User: ${REST_AUTH_USER}"
    -H
    'Content-Type: application/json;charset=UTF-8'
    -H
    'Accept: application/json, text/plain, */*'
  )

  if [[ -n "${payload}" ]]; then
    curl_args+=(--data-raw "${payload}")
  fi

  if [[ "${path}" == /tancredi/* || "${path}" == /provisioning/* ]]; then
    url="http://127.0.0.1:${TANCREDIPORT}${path}"
    response="$(lt_run_pod_php_http_request "${FREEPBX_CONTAINER}" "${method}" "${url}" "${payload}")"
  else
    url="http://127.0.0.1:${APACHE_PORT}${path}"
    response="$(curl "${curl_args[@]}" "${url}")"
  fi

  http_code="${response##*$'\n'}"
  body="${response%$'\n'*}"

  printf '\n'
  if [[ -n "${operation_name}" ]]; then
    lt_info "${operation_name}"
  fi
  printf '%s %s HTTP %s\n' "${method}" "${path}" "${http_code}"
  if [[ -n "${body}" ]]; then
    printf '%s\n' "${body}"
  fi

  IFS=',' read -r -a _expected_codes <<< "${expected_codes}"
  for expected_code in "${_expected_codes[@]}"; do
    if [[ "${http_code}" == "${expected_code}" ]]; then
      matched=true
      break
    fi
  done

  if [[ "${matched}" != true ]]; then
    lt_error "Unexpected HTTP status for ${method} ${path}. Expected ${expected_codes}, got ${http_code}."
    return 1
  fi
}

lt_run_manifest() {
  local manifest="$1"
  local name
  local method
  local path
  local payload
  local expected

  [[ -f "${manifest}" ]] || lt_die "Manifest not found: ${manifest}"

  lt_section "Running manifest $(basename "${manifest}")"
  lt_info "User: ${REST_AUTH_USER}"
  lt_info "Secretkey: ${REST_API_SECRETKEY}"

  while IFS=$'\t' read -r name method path payload expected; do
    lt_run_authenticated_api "${method}" "${path}" "${payload}" "${expected}" "${name}"
  done < <(python3 "${LOCAL_TESTING_DIR}/bin/manifest_to_tsv.py" "${manifest}")
}