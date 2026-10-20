*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Alert rules are published
    ${output}    ${rc} =    Execute Command    runagent redis-exec HKEYS module/${module_id}/metrics_alert_rules    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Contain    ${output}    nethvoice-services
    Should Contain    ${output}    nethvoice-dns
    Should Contain    ${output}    nethvoice-ai

Service state is exported
    ${output}    ${rc} =    Execute Command    runagent -m ${module_id} export-metrics    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Contain    ${output}    nethvoice_service_up{service="freepbx"} 1
    Should Contain    ${output}    nethvoice_service_restarts_total{service="freepbx"}
    Should Contain    ${output}    nethvoice_exporter_collector_up{collector="systemd"} 1
    # Public resolvers may be unreachable from the test machine: only the status line is sure
    Should Contain    ${output}    nethvoice_exporter_collector_up{collector="public_dns"}
    Should Not Contain    ${output}    module=

Publishing unchanged rules sends no event
    ${output}    ${rc} =    Execute Command    runagent -m ${module_id} publish-metrics-config    return_stdout=False    return_stderr=True    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Contain    ${output}    alert rules unchanged
