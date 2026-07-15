*** Settings ***
Library    SSHLibrary
Library    Collections
Library    String

*** Test Cases ***
Check if nethvoice is installed correctly
    ${output}  ${rc} =    Execute Command    add-module ${IMAGE_URL} 1
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}  0
    &{output} =    Evaluate    ${output}
    Set Global Variable    ${module_id}    ${output.module_id}

Check NethVoice public firewall protection
    ${port_values} =    Execute Command    runagent -m ${module_id} printenv ASTERISK_SIP_PORT SATELLITE_HTTP_PORT NETHCTI_TLS_PORT JANUS_RTPSTART JANUS_RTPEND ASTERISK_IAX_PORT PHONEBOOK_LDAP_PORT ASTERISK_RECORDING_SFTP_PORT ASTERISK_WSS_PORT ASTERISK_RTPSTART ASTERISK_RTPEND
    ${ports} =    Split To Lines    ${port_values}
    Length Should Be    ${ports}    11
    Set Global Variable    ${asterisk_sip_port}    ${ports}[0]
    Set Global Variable    ${satellite_http_port}    ${ports}[1]

    ${rich_rules_output} =    Execute Command    firewall-cmd --permanent --zone=public --list-rich-rules
    ${rich_rules} =    Split To Lines    ${rich_rules_output}
    ${expected_rich_rules} =    Create List
    ...    rule priority="-100" family="ipv4" port port="${asterisk_sip_port}" protocol="udp" drop
    ...    rule priority="-100" family="ipv6" port port="${asterisk_sip_port}" protocol="udp" drop
    ...    rule priority="-100" family="ipv4" port port="${satellite_http_port}" protocol="udp" drop
    ...    rule priority="-100" family="ipv6" port port="${satellite_http_port}" protocol="udp" drop
    FOR    ${rule}    IN    @{expected_rich_rules}
        ${rule_count} =    Count Values In List    ${rich_rules}    ${rule}
        Should Be Equal As Integers    ${rule_count}    1
    END

    ${service_ports_output} =    Execute Command    firewall-cmd --permanent --service=${module_id} --get-ports
    ${service_ports} =    Split String    ${service_ports_output}
    ${expected_service_ports} =    Create List
    ...    ${ports}[2]/tcp
    ...    ${ports}[3]-${ports}[4]/udp
    ...    ${ports}[5]/udp
    ...    ${ports}[6]/tcp
    ...    ${ports}[7]/tcp
    ...    ${ports}[8]/tcp
    ...    ${ports}[9]-${ports}[10]/udp
    FOR    ${port}    IN    @{expected_service_ports}
        List Should Contain Value    ${service_ports}    ${port}
    END
