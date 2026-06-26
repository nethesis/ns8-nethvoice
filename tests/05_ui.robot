*** Settings ***
Library           Browser

*** Variables ***
${ADMIN_USER}    admin
${ADMIN_PASSWORD}    Nethesis,1234
${module_id}    ${EMPTY}

*** Keywords ***

Login to cluster-admin
    New Page    https://${NODE_ADDR}/cluster-admin/
    Fill Text    css=input[name="username"]    ${ADMIN_USER}
    Click    css=button.login-button
    Wait For Elements State    css=input[name="password"]    visible    timeout=10s
    Fill Text    css=input[name="password"]    ${ADMIN_PASSWORD}
    Evaluate JavaScript    css=form    (form) => form.requestSubmit()
    Wait For Elements State    css=input[name="password"]    hidden    timeout=30s

*** Test Cases ***

Take screenshots
    [Tags]    ui
    New Browser    chromium    headless=True
    New Context    ignoreHTTPSErrors=True
    Login to cluster-admin
    Go To    https://${NODE_ADDR}/cluster-admin/#/apps/${module_id}
    Wait For Elements State    iframe >>> css=.card-grid    visible    timeout=30s
    Sleep    5s
    Take Screenshot    filename=${OUTPUT DIR}/browser/screenshot/1._Status.png
    Go To    https://${NODE_ADDR}/cluster-admin/#/apps/${module_id}?page=settings
    Wait For Elements State    iframe >>> css=.page-title h2    visible    timeout=30s
    Sleep    5s
    Take Screenshot    filename=${OUTPUT DIR}/browser/screenshot/2._Settings.png
    Close Browser
