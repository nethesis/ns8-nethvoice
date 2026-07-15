*** Settings ***
Library    SSHLibrary
Library    Collections
Library    String
Resource    ./api.resource

*** Test Cases ***
Check if nethvoice-proxy is removed correctly
    ${rc} =    Execute Command    remove-module --no-preserve ${proxy_module_id}
    ...    return_rc=True  return_stdout=False
    Should Be Equal As Integers    ${rc}  0

Check if nethvoice is removed correctly
    ${rc} =    Execute Command    remove-module --no-preserve ${module_id}
    ...    return_rc=True  return_stdout=False
    Should Be Equal As Integers    ${rc}  0

Check if NethVoice public firewall protection is removed
    ${rich_rules_output} =    Execute Command    firewall-cmd --permanent --zone=public --list-rich-rules
    ${rich_rules} =    Split To Lines    ${rich_rules_output}
    ${removed_rich_rules} =    Create List
    ...    rule priority="-100" family="ipv4" port port="${asterisk_sip_port}" protocol="udp" drop
    ...    rule priority="-100" family="ipv6" port port="${asterisk_sip_port}" protocol="udp" drop
    ...    rule priority="-100" family="ipv4" port port="${satellite_http_port}" protocol="udp" drop
    ...    rule priority="-100" family="ipv6" port port="${satellite_http_port}" protocol="udp" drop
    FOR    ${rule}    IN    @{removed_rich_rules}
        List Should Not Contain Value    ${rich_rules}    ${rule}
    END

Check if the nethvoice user domain admin is removed correctly
    ${response} =  Run task    cluster/get-domain-user
    ...    {"domain":"${users_domain}", "user":"${nv_domain_admin}"}
    ...    rc_expected=2    decode_json=False

Remove internal domain
    Run task    cluster/remove-internal-domain    {"domain":"${users_domain}"}
