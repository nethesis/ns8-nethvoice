*** Settings ***
Library    SSHLibrary
Resource   ./rest_api.resource

*** Test Cases ***
Run authentication REST manifest
    Ensure REST Smoke Prerequisites
    ${manifest_path} =    Normalize Path    ${CURDIR}/data/rest_api/authentication.yaml
    ${artifact_dir} =    Normalize Path    ${OUTPUT DIR}/rest_api_full/authentication
    ${public_host} =    Get REST Public Host
    ${report} =    Execute REST Manifest    ${manifest_path}    ${artifact_dir}    ${public_host}
    Should Be Equal As Strings    ${report['status']}    passed

Run users and extensions REST manifest
    Ensure REST Smoke Prerequisites
    ${manifest_path} =    Normalize Path    ${CURDIR}/data/rest_api/users_extensions.yaml
    ${artifact_dir} =    Normalize Path    ${OUTPUT DIR}/rest_api_full/users_extensions
    ${public_host} =    Get REST Public Host
    ${report} =    Execute REST Manifest    ${manifest_path}    ${artifact_dir}    ${public_host}
    Should Be Equal As Strings    ${report['status']}    passed

Run destructive REST manifest in isolated state
    Ensure REST Smoke Prerequisites
    ${manifest_path} =    Normalize Path    ${CURDIR}/data/rest_api/destructive.yaml
    ${artifact_dir} =    Normalize Path    ${OUTPUT DIR}/rest_api_full/destructive
    ${public_host} =    Get REST Public Host
    ${report} =    Execute REST Manifest    ${manifest_path}    ${artifact_dir}    ${public_host}
    Should Be Equal As Strings    ${report['status']}    passed