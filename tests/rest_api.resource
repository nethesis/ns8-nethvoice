*** Settings ***
Library    Collections
Library    OperatingSystem
Library    Process
Library    SSHLibrary
Resource   ./api.resource

*** Variables ***
${REST_API_SCRIPTS_DIR}    ${CURDIR}/scripts
${REST_API_DATA_DIR}    ${CURDIR}/data/rest_api

*** Keywords ***
Read REST Manifest Operation
    [Arguments]    ${manifest_path}    ${operation_name}
    ${result} =    Run Process    python3    ${REST_API_SCRIPTS_DIR}/rest_api_runner.py    operation    --manifest    ${manifest_path}    --operation    ${operation_name}
    Should Be Equal As Integers    ${result.rc}    0    Failed to read REST manifest operation ${operation_name}!${\n}${result.stderr}
    ${operation} =    Evaluate    json.loads($result.stdout)    modules=json
    [Return]    ${operation}

Ensure REST Smoke Prerequisites
    ${stdout}    ${stderr}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx test -f /etc/amportal.conf    return_stdout=True    return_stderr=True    return_rc=True
    Should Be Equal As Integers    ${rc}    0    FreePBX container is not ready for REST smoke tests!${\n}${stderr}

Get REST Public Host
    ${response} =    Run task    module/${module_id}/get-configuration    {}
    ${public_host} =    Set Variable    ${response['nethvoice_host']}
    Should Not Be Empty    ${public_host}    NethVoice host is not configured.
    [Return]    ${public_host}

Compute REST Auth Headers
    [Arguments]    ${user}    ${password}    ${artifact_dir}    ${host_header}=${EMPTY}
    Create Directory    ${artifact_dir}
    ${result} =    Run Process    python3    ${REST_API_SCRIPTS_DIR}/rest_api_runner.py    headers    --node-addr    ${NODE_ADDR}    --ssh-key    ${SSH_KEYFILE}    --module-id    ${module_id}    --auth-user    ${user}    --auth-password    ${password}    --output-dir    ${artifact_dir}
    Should Be Equal As Integers    ${result.rc}    0    Failed to compute REST auth headers!${\n}${result.stderr}
    ${headers} =    Evaluate    json.loads($result.stdout)    modules=json
    IF    '${host_header}' != ''
        Set To Dictionary    ${headers}    Host    ${host_header}
    END
    [Return]    ${headers}

Call REST Endpoint
    [Arguments]    ${method}    ${path}    ${payload_json}    ${expected_status}    ${headers}    ${artifact_dir}    ${report_name}=rest-call.json
    Create Directory    ${artifact_dir}
    ${headers_json} =    Evaluate    json.dumps($headers)    modules=json
    ${report_path} =    Normalize Path    ${artifact_dir}/${report_name}
    @{args} =    Create List    python3    ${REST_API_SCRIPTS_DIR}/rest_api_runner.py    call    --base-url    https://${NODE_ADDR}/freepbx/rest    --method    ${method}    --path    ${path}    --expected-status    ${expected_status}    --headers-json    ${headers_json}    --report-file    ${report_path}
    IF    '${payload_json}' != ''
        Append To List    ${args}    --payload-json
        Append To List    ${args}    ${payload_json}
    END
    ${result} =    Run Process    @{args}
    Should Be Equal As Integers    ${result.rc}    0    REST call ${method} ${path} failed!${\n}${result.stderr}
    ${report} =    Evaluate    json.loads($result.stdout)    modules=json
    [Return]    ${report}

Wait For FreePBX Regeneration
    [Arguments]    ${seconds}
    Sleep    ${seconds}s

Capture Asterisk Files
    [Arguments]    ${manifest_path}    ${operation_name}    ${output_dir}
    Create Directory    ${output_dir}
    ${result} =    Run Process    python3    ${REST_API_SCRIPTS_DIR}/capture_asterisk_fixture.py    --manifest    ${manifest_path}    --operation    ${operation_name}    --node-addr    ${NODE_ADDR}    --ssh-key    ${SSH_KEYFILE}    --module-id    ${module_id}    --output-dir    ${output_dir}
    Should Be Equal As Integers    ${result.rc}    0    Failed to capture fixture files for ${operation_name}!${\n}${result.stderr}
    ${capture_report} =    Evaluate    json.loads($result.stdout)    modules=json
    [Return]    ${capture_report}

Compare Asterisk Fixture
    [Arguments]    ${manifest_path}    ${operation_name}    ${captured_dir}    ${comparison_dir}
    Create Directory    ${comparison_dir}
    ${operation} =    Read REST Manifest Operation    ${manifest_path}    ${operation_name}
    ${expected_dir} =    Normalize Path    ${CURDIR}/../${operation['expected_fixture']}
    Directory Should Exist    ${expected_dir}
    ${normalized_expected_dir} =    Normalize Path    ${comparison_dir}/expected
    ${normalized_actual_dir} =    Normalize Path    ${comparison_dir}/actual
    ${expected_norm} =    Run Process    python3    ${REST_API_SCRIPTS_DIR}/normalize_asterisk_fixture.py    --input-dir    ${expected_dir}    --output-dir    ${normalized_expected_dir}
    Should Be Equal As Integers    ${expected_norm.rc}    0    Failed to normalize expected fixture for ${operation_name}!${\n}${expected_norm.stderr}
    ${actual_norm} =    Run Process    python3    ${REST_API_SCRIPTS_DIR}/normalize_asterisk_fixture.py    --input-dir    ${captured_dir}    --output-dir    ${normalized_actual_dir}
    Should Be Equal As Integers    ${actual_norm.rc}    0    Failed to normalize captured fixture for ${operation_name}!${\n}${actual_norm.stderr}
    ${diff_result} =    Run Process    diff    -ru    ${normalized_expected_dir}    ${normalized_actual_dir}
    ${diff_path} =    Normalize Path    ${comparison_dir}/fixture.diff
    Create File    ${diff_path}    ${diff_result.stdout}
    Should Be Equal As Integers    ${diff_result.rc}    0    Fixture mismatch for ${operation_name}. Diff: ${diff_path}

Execute REST Manifest
    [Arguments]    ${manifest_path}    ${artifact_dir}    ${host_header}=${EMPTY}
    Create Directory    ${artifact_dir}
    @{args} =    Create List    python3    ${REST_API_SCRIPTS_DIR}/rest_api_runner.py    execute-manifest    --manifest    ${manifest_path}    --node-addr    ${NODE_ADDR}    --ssh-key    ${SSH_KEYFILE}    --module-id    ${module_id}    --base-url    https://${NODE_ADDR}/freepbx/rest    --output-dir    ${artifact_dir}
    IF    '${host_header}' != ''
        Append To List    ${args}    --host-header
        Append To List    ${args}    ${host_header}
    END
    ${result} =    Run Process    @{args}
    Should Be Equal As Integers    ${result.rc}    0    REST manifest execution failed for ${manifest_path}!${\n}${result.stderr}${\n}Artifacts: ${artifact_dir}
    ${report} =    Evaluate    json.loads($result.stdout)    modules=json
    ${manifest_report_path} =    Normalize Path    ${artifact_dir}/manifest-report.json
    OperatingSystem.File Should Exist    ${manifest_report_path}
    ${manifest_artifact_dir} =    Normalize Path    ${OUTPUT DIR}/rest_api_manifests
    Create Directory    ${manifest_artifact_dir}
    ${manifest_file_name} =    Evaluate    pathlib.Path($manifest_path).stem + '.json'    modules=pathlib
    ${manifest_artifact_path} =    Normalize Path    ${manifest_artifact_dir}/${manifest_file_name}
    Copy File    ${manifest_report_path}    ${manifest_artifact_path}
    [Return]    ${report}