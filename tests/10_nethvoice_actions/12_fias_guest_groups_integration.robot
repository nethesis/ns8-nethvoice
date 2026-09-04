*** Settings ***
Library     SSHLibrary
Library     ./FiasGuestGroups.py
Resource    ../api.resource


*** Test Cases ***
GG configuration is available as an opt-in format
    [Tags]    fias    gg    integration
    ${result} =    Run Fias Guest Group Check    ${module_id}    config
    Should Be True    ${result['legacy_default']}
    Should Be True    ${result['gg_opt_in_available']}
    Should Be True    ${result['room_text_length']} >= 255
    Should Be Equal As Integers    ${result['group_key_length']}    100
    Should Be True    ${result['group_key_nullable']}
    Should Be True    ${result['unique_group_key']}

Grouped check-ins create and reuse a FIAS-managed group
    [Tags]    fias    gg    integration
    ${result} =    Run Fias Guest Group Check    ${module_id}    create-reuse
    Should Be Equal As Integers    ${result['rooms_assigned']}    2
    Should Be True    ${result['manual_collision_avoided']}

Concurrent grouped check-ins create one FIAS-managed group
    [Tags]    fias    gg    integration
    ${result} =    Run Fias Guest Group Check    ${module_id}    concurrent-create
    Should Be True    ${result['single_group_created']}
    Should Be True    ${result['both_rooms_assigned']}

Long GG values are truncated consistently
    [Tags]    fias    gg    integration
    ${result} =    Run Fias Guest Group Check    ${module_id}    long-group
    Should Be Equal As Integers    ${result['stored_group_length']}    100
    Should Be True    ${result['truncated_group_reused']}

Group assignment errors fail GI without terminating inside setGroup
    [Tags]    fias    gg    integration
    ${result} =    Run Fias Guest Group Check    ${module_id}    assignment-error
    Should Be True    ${result['nonzero_exit']}
    Should Be True    ${result['structured_error']}

Changing or clearing GG reconciles the room assignment
    [Tags]    fias    gg    integration
    ${result} =    Run Fias Guest Group Check    ${module_id}    change-empty
    Should Be True    ${result['group_changed']}
    Should Be True    ${result['empty_group_cleared']}
    Should Be True    ${result['old_definition_retained']}

Shared checkout keeps GG until the final guest leaves
    [Tags]    fias    gg    integration
    ${result} =    Run Fias Guest Group Check    ${module_id}    shared-checkout
    Should Be True    ${result['partial_checkout_preserved_group']}
    Should Be True    ${result['final_checkout_removed_assignment']}
    Should Be True    ${result['shared_label_length']} > 32

Legacy GI and checkout preserve manually managed groups
    [Tags]    fias    gg    integration
    ${result} =    Run Fias Guest Group Check    ${module_id}    legacy-manual
    Should Be True    ${result['legacy_gi_preserved_manual_group']}
    Should Be True    ${result['checkout_preserved_manual_group']}
