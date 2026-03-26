*** Settings ***
Library    SSHLibrary
Resource   ./rest_api.resource

*** Test Cases ***
Check settings default language REST smoke path
    Ensure REST Smoke Prerequisites
    ${manifest_path} =    Normalize Path    ${CURDIR}/data/rest_api/smoke.yaml
    ${operation} =    Read REST Manifest Operation    ${manifest_path}    settings-defaultlanguage-en
    ${artifact_dir} =    Normalize Path    ${OUTPUT DIR}/rest_api_smoke/${operation['name']}
    ${headers_dir} =    Normalize Path    ${artifact_dir}/auth
    ${headers} =    Compute REST Auth Headers    ${operation['auth']['user']}    ${operation['auth']['password']}    ${headers_dir}
    ${payload_json} =    Evaluate    json.dumps($operation['payload'])    modules=json
    ${post_report} =    Call REST Endpoint    ${operation['method']}    ${operation['path']}    ${payload_json}    ${operation['expected_status']}    ${headers}    ${artifact_dir}    post.json
    Wait For FreePBX Regeneration    ${operation['post_wait_seconds']}
    ${verify_report} =    Call REST Endpoint    GET    /settings/languages    ${EMPTY}    200    ${headers}    ${artifact_dir}    get-settings-languages.json
    Should Be Equal As Booleans    ${verify_report['response']['json']['en']['default']}    ${True}
    Should Be Equal As Booleans    ${verify_report['response']['json']['it']['default']}    ${False}
    ${capture_report} =    Capture Asterisk Files    ${manifest_path}    ${operation['name']}    ${artifact_dir}/captured
    Should Be True    len($capture_report['files']) > 0
    Compare Asterisk Fixture    ${manifest_path}    ${operation['name']}    ${artifact_dir}/captured    ${artifact_dir}/comparison
    ${restore_payload} =    Evaluate    json.dumps({'lang': 'it'})    modules=json
    ${restore_report} =    Call REST Endpoint    POST    /settings/defaultlanguage    ${restore_payload}    200    ${headers}    ${artifact_dir}    restore.json
    Wait For FreePBX Regeneration    20