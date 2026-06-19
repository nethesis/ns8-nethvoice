*** Settings ***
Library    SSHLibrary
Library    Collections
Resource  ../api.resource

*** Test Cases ***
Check if the facts are returned as expected
    ${response} =  Run task    module/${module_id}/get-facts    {}

    Should Be Equal As Integers    ${response['nethvoice_users_count']}    0

    Should Be Equal As Integers    ${response['nethvoice_trunks_count']}    0
    Dictionary Should Contain Key    ${response}    nethvoice_trunks_by_tech
    ${by_tech} =    Set Variable    ${response['nethvoice_trunks_by_tech']}
    ${by_tech_sum} =    Evaluate    sum($by_tech.values()) if $by_tech else 0
    Should Be Equal As Integers    ${by_tech_sum}    ${response['nethvoice_trunks_count']}
    Dictionary Should Contain Key    ${response}    nethvoice_trunks_by_provider
    Should Be Empty    ${response['nethvoice_trunks_by_provider']}

    Should Be Equal As Integers    ${response['nethvoice_inbound_routes_count']}    0
    Should Be Equal As Integers    ${response['nethvoice_outbound_routes_count']}    0

    Should Be Equal As Integers    ${response['nethvoice_ivr_count']}    0
    Should Be Equal As Integers    ${response['nethvoice_queues_count']}    0
    Should Be Equal As Integers    ${response['nethvoice_ringgroups_count']}    0
    Should Be Equal As Integers    ${response['nethvoice_cqr_count']}    0

    Should Be Equal As Integers    ${response['nethvoice_calls_last_24h']}    0
    Should Be Equal As Integers    ${response['nethvoice_total_calls']}    0
    ${calls_24h} =    Convert To Integer    ${response['nethvoice_calls_last_24h']}
    ${total_calls} =    Convert To Integer    ${response['nethvoice_total_calls']}
    Should Be True    ${calls_24h} <= ${total_calls}

    Should Be Equal As Integers    ${response['nethvoice_cti_profiles_count']}    3
    Should Be Equal As Integers    ${response['nethvoice_cti_groups_count']}    0
    Should Be Equal As Integers    ${response['nethvoice_cti_users_count']}    0

    Should Be Equal As Integers    ${response['nethvoice_devices_count']}    0
    Dictionary Should Contain Key    ${response}    nethvoice_devices_by_type
    ${by_type} =    Set Variable    ${response['nethvoice_devices_by_type']}
    ${by_type_sum} =    Evaluate    sum($by_type.values()) if $by_type else 0
    Should Be Equal As Integers    ${by_type_sum}    ${response['nethvoice_devices_count']}
    Dictionary Should Contain Key    ${response}    nethvoice_physical_devices_by_vendor
    Dictionary Should Contain Key    ${response}    nethvoice_physical_devices_by_model
    Should Be Empty    ${response['nethvoice_physical_devices_by_vendor']}
    Should Be Empty    ${response['nethvoice_physical_devices_by_model']}

    Should Be Equal As Integers    ${response['nethvoice_streaming_count']}    0
    Should Be Equal As Integers    ${response['nethvoice_paramurl_count']}    0

    Dictionary Should Contain Key    ${response}    nethvoice_customer_cards_count
    Dictionary Should Contain Key    ${response}    nethvoice_nethlink_active_count
    Dictionary Should Contain Key    ${response}    nethvoice_announcements_count
    Dictionary Should Contain Key    ${response}    nethvoice_offhour_count

    Dictionary Should Contain Key    ${response}    nethvoice_hotel_enabled

    Dictionary Should Contain Key    ${response}    nethvoice_ai_call_summary_enabled
    Dictionary Should Contain Key    ${response}    nethvoice_ai_call_transcription_enabled
    Dictionary Should Contain Key    ${response}    nethvoice_ai_voicemail_transcription_enabled

    Dictionary Should Contain Key   ${response}    nethvoice_subscription_enabled
    Dictionary Should Contain Key   ${response}    nethvoice_user_domain_type
    Dictionary Should Contain Key   ${response}    nethvoice_user_domain_location

    Dictionary Should Contain Key   ${response}    nethvoice_ai_call_summary_enabled
    Dictionary Should Contain Key   ${response}    nethvoice_ai_call_transcription_enabled
    Dictionary Should Contain Key   ${response}    nethvoice_ai_voicemail_transcription_enabled
