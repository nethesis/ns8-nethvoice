*** Settings ***
Library    SSHLibrary
Resource   ./rest_api.resource

*** Test Cases ***
Check configuration allow external SIPs REST smoke path
    Ensure REST Smoke Prerequisites
    ${manifest_path} =    Normalize Path    ${CURDIR}/data/rest_api/smoke.yaml
    ${operation} =    Read REST Manifest Operation    ${manifest_path}    configuration-allowexternalsips-enabled
    ${artifact_dir} =    Normalize Path    ${OUTPUT DIR}/rest_api_smoke/${operation['name']}
    ${headers_dir} =    Normalize Path    ${artifact_dir}/auth
    ${public_host} =    Get REST Public Host
    ${headers} =    Compute REST Auth Headers    ${operation['auth']['user']}    ${operation['auth']['password']}    ${headers_dir}    ${public_host}
    ${post_path} =    Set Variable    ${operation['path_prefix']}/${operation['target_value']}
    ${post_report} =    Call REST Endpoint    ${operation['method']}    ${post_path}    ${EMPTY}    ${operation['expected_status']}    ${headers}    ${artifact_dir}    post.json
    Wait For FreePBX Regeneration    ${operation['post_wait_seconds']}
    ${verify_report} =    Call REST Endpoint    GET    ${operation['verify_path']}    ${EMPTY}    200    ${headers}    ${artifact_dir}    get-after.json
    Should Be Equal As Strings    ${verify_report['response']['json']}    ${operation['target_value']}