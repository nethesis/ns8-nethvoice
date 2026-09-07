*** Settings ***
Library    SSHLibrary
Resource   ./api.resource

*** Test Cases ***
Setup internal user provider
    ${response} =     Run task    cluster/add-internal-provider    {"image":"openldap","node":1}
    Set Global Variable    ${openldap_module_id}    ${response['module_id']}
    Set Global Variable    ${users_domain}    domain.ns8.local
    Run task    module/${openldap_module_id}/configure-module    {"domain":"${users_domain}","admuser":"admin","admpass":"Nethesis,1234","provision":"new-domain"}

Check if nethvoice-proxy is installed correctly
    ${output}  ${rc} =    Execute Command    add-module nethvoice-proxy
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}  0
    &{output} =    Evaluate    ${output}
    Set Global Variable    ${proxy_module_id}    ${output.module_id}
    ${local_ip} =    Execute Command    ip -j addr show dev eth0 | jq -r '.[].addr_info[] | select(.family=="inet") | .local' | head -n 1
    Run task    module/${proxy_module_id}/configure-module
    ...    {"addresses": {"address": "${local_ip}"}, "fqdn": "proxy.ns8.local","lets_encrypt": false}
