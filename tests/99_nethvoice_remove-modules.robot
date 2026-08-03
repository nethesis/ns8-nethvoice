*** Settings ***
Library    SSHLibrary
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

Remove internal domain
    Run task    cluster/remove-internal-domain    {"domain":"${users_domain}"}
