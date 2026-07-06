*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check get-defaults action output
    ${response} =  Run task    module/${module_id}/get-defaults
    ...    {}    rc_expected=0
    Should Not Be Empty    ${response['accepted_timezone_list']}
    Should Contain    ${response['accepted_timezone_list']}    UTC
    Should Not Be Empty    ${response['local_timezone']}
    Should Contain    ${response['accepted_timezone_list']}    ${response['local_timezone']}
    Should Contain    ${response['proxy_status']}    proxy_installed
    ${is_proxy_installed_bool} =    Evaluate    isinstance($response["proxy_status"]["proxy_installed"], bool)
    Should Be True    ${is_proxy_installed_bool}

Timezone helper does not block on timedatectl timeout
    ${cmd} =    Catenate    SEPARATOR= 
    ...    runagent -m ${module_id} python3 -c
    ...    'import os, subprocess, sys; from pathlib import Path; sys.path.insert(0, str(Path(os.environ["AGENT_INSTALL_DIR"]) / "actions" / "lib")); from timezones import get_accepted_timezones, get_local_timezone; timeout_run = lambda args, **kwargs: (_ for _ in ()).throw(subprocess.TimeoutExpired(args, kwargs.get("timeout"))); zones = get_accepted_timezones(); assert "UTC" in zones; timezone = get_local_timezone(accepted_timezones=zones, localtime_path=Path("/tmp/nethvoice-missing-localtime"), run=timeout_run, timedatectl_timeout=1); assert timezone == "UTC", timezone; print(timezone)'
    ${stdout}    ${stderr}    ${rc} =     Execute Command    ${cmd}    return_stdout=True    return_stderr=True    return_rc=True
    Should Be Equal As Integers    ${rc}    0    ${stderr}
    Should Be Equal    ${stdout.strip()}    UTC
