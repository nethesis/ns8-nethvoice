*** Settings ***
Library     SSHLibrary
Library     ./UsersAdminAgentCredentials.py
Resource    ../api.resource


*** Test Cases ***
Check users-admin provider and credential contract
    ${result} =    Run Users Admin Check    ${module_id}    contract
    Should Be True    ${result['provider_is_first_result']}
    Should Be True    ${result['credentials_are_agent_managed']}
    Should Be True    ${result['container_environment_matches']}
    Should Be True    ${result['legacy_fields_absent']}

Check users-admin operations with agent credentials
    ${result} =    Run Users Admin Check    ${module_id}    api-flow
    Should Be True    ${result['login']}
    Should Be True    ${result['list']}
    Should Be True    ${result['direct_add_remove']}
    Should Be True    ${result['freepbx_add_remove']}

Check upgrade cleanup keeps agent credentials unchanged
    ${result} =    Run Users Admin Check    ${module_id}    upgrade-cleanup
    Should Be True    ${result['legacy_user_removed']}
    Should Be True    ${result['agent_credentials_unchanged']}
