*** Settings ***
Library    SSHLibrary
Library    ./UsersAdminAgentCredentials.py
Resource   ../api.resource

Suite Setup    Load Module Runtime Variables

*** Variables ***
${NETHVOICE_HOST}       ${EMPTY}
${USER_DOMAIN}          ${EMPTY}
${REDIS_USER}           ${EMPTY}
${REDIS_PASSWORD}       ${EMPTY}
${USERS_ADMIN_TOKEN}    ${EMPTY}

*** Keywords ***
Load Module Runtime Variables
    ${environment} =    Read Remote File    /home/${module_id}/.config/state/environment
    ${agent_env} =    Read Remote File    /home/${module_id}/.config/state/agent.env
    ${runtime} =    Parse Runtime Environment    ${environment}    ${agent_env}
    Should Be Empty    ${runtime['missing']}    Missing runtime keys: ${runtime['missing']}
    Should Not Be Empty    ${runtime['nethvoice_host']}
    Should Not Be Empty    ${runtime['user_domain']}
    Should Not Be Empty    ${runtime['redis_user']}
    Should Not Be Empty    ${runtime['redis_password']}
    Set Suite Variable    ${NETHVOICE_HOST}    ${runtime['nethvoice_host']}
    Set Suite Variable    ${USER_DOMAIN}    ${runtime['user_domain']}
    Set Suite Variable    ${REDIS_USER}    ${runtime['redis_user']}
    Set Suite Variable    ${REDIS_PASSWORD}    ${runtime['redis_password']}

Read Remote File
    [Arguments]    ${path}
    ${stdout}    ${stderr}    ${rc} =    Execute Command    cat ${path}    return_stdout=True    return_stderr=True    return_rc=True
    Should Be Equal As Integers    ${rc}    0    Cannot read ${path}!${\n}${stderr}
    RETURN    ${stdout}

Run Users-Admin API Request
    [Arguments]    ${endpoint}    ${payload}    ${token}=${EMPTY}
    ${command} =    Build Users Admin API Command    ${NETHVOICE_HOST}    ${USER_DOMAIN}    ${endpoint}    ${payload}    ${token}
    ${stdout}    ${stderr}    ${rc} =    Execute Command    ${command}    return_stdout=True    return_stderr=True    return_rc=True
    Should Be Equal As Integers    ${rc}    0    users-admin ${endpoint} request failed!${\n}${stderr}
    ${response} =    Load Json    ${stdout}
    RETURN    ${response}

Ensure Users-Admin Token
    IF    '${USERS_ADMIN_TOKEN}' == ''
        Login To Users-Admin With Agent Credentials
    END

Login To Users-Admin With Agent Credentials
    ${payload} =    Build Users Admin Login Payload    ${REDIS_USER}    ${REDIS_PASSWORD}
    ${response} =    Run Users-Admin API Request    login    ${payload}
    Should Not Be Empty    ${response['token']}
    Set Suite Variable    ${USERS_ADMIN_TOKEN}    ${response['token']}
    RETURN    ${response['token']}

List Users Through Users-Admin
    Ensure Users-Admin Token
    ${response} =    Run Users-Admin API Request    list-users    {}    ${USERS_ADMIN_TOKEN}
    RETURN    ${response['users']}

Import User Through FreePBX CSV
    [Arguments]    ${username}    ${display_name}
    ${csv_payload} =    Build FreePBX CSV Import Payload    ${username}    ${display_name}
    ${command} =    Build FreePBX CSV Import Command    ${module_id}    ${csv_payload}
    ${stdout}    ${stderr}    ${rc} =    Execute Command    ${command}    return_stdout=True    return_stderr=True    return_rc=True
    Should Be Equal As Integers    ${rc}    0    CSV import failed!${\n}${stderr}

Remove User Through Users-Admin
    [Arguments]    ${username}
    Ensure Users-Admin Token
    ${payload} =    Build Remove User Payload    ${username}
    ${response} =    Run Users-Admin API Request    remove-user    ${payload}    ${USERS_ADMIN_TOKEN}
    Should Be Equal As Strings    ${response['status']}    success

*** Test Cases ***
Check if users-admin login works with agent credentials
    ${token} =    Login To Users-Admin With Agent Credentials
    Should Not Be Empty    ${token}

Check if freepbx can create a new domain user with agent credentials
    ${test_user} =    Generate Test Username
    ${display_name} =    Set Variable    Credential Test ${test_user}
    TRY
        Import User Through FreePBX CSV    ${test_user}    ${display_name}
        ${users} =    List Users Through Users-Admin
        ${user_present} =    Users Contains User    ${users}    ${test_user}
        Should Be Equal    ${user_present}    ${TRUE}
    FINALLY
        Run Keyword And Ignore Error    Remove User Through Users-Admin    ${test_user}
    END
