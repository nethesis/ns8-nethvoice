# NethVoice Configure Module Refactoring

## Overview
This document describes the refactoring of the monolithic `configure-module` action into modular, isolated actions to support the new UI design (GitHub issue #7660).

## Goals
- **Modularity**: Split configuration into logical, independent sections
- **Scalability**: Easy to add new settings modules in the future
- **UX Improvement**: Allow users to configure sections independently
- **Backward Compatibility**: Keep existing `configure-module` as a wrapper (deprecated)

## Current Architecture (Before Refactoring)

### configure-module Action
**Purpose**: Configure all NethVoice settings in one monolithic action

**Sub-actions** (numbered execution order):
1. `10validate_user_domain` - Validate user domain exists and has valid LDAP parameters
2. `20setenvs` - Set environment variables for all settings
3. `21subscription` - Check subscription status for premium features
4. `30traefik` - Configure traefik routes for web access
5. `50users` - Configure LDAP/domain user settings
6. `60sip_proxy` - Configure SIP proxy routing
7. `61ice_enforce` - ICE configuration
8. `71reports_api` - Configure reports API endpoint
9. `72reports_ui` - Configure reports UI endpoint
10. `80start_services` - Start/restart required services
11. `85mysql_background_import` - Background MySQL import
12. `90wait_freepbx` - Wait for FreePBX initialization
13. `95service_adjust` - Adjust services based on configuration
14. `96publish_srv_keys` - Publish SRV records

**Input Schema** (`validate-input.json`):
- Base settings: `nethvoice_host`, `nethcti_ui_host`, `lets_encrypt`, `user_domain`, `timezone`, `reports_international_prefix`
- NethVoice admin: `nethvoice_adm_username`, `nethvoice_adm_password`
- Hotel module: `nethvoice_hotel`, `nethvoice_hotel_fias_address`, `nethvoice_hotel_fias_port`
- Satellite: `satellite_call_transcription_enabled`, `satellite_voicemail_transcription_enabled`, `deepgram_api_key`, `openai_api_key`
- Advanced CTI: `nethcti_*` parameters (prefix, autoc2c, trunks_events, etc.)
- Branding: `app_brand_id`, `nethcti_ui_*` parameters
- Reports: `reports_ui_*` parameters

### Already Isolated Actions
- **set-rebranding**: Configure CTI rebranding (logo, colors, etc.)
- **set-nethvoice-admin-password**: Change FreePBX admin password

## New Architecture (After Refactoring)

### 1. configure-base-settings
**Purpose**: Configure core NethVoice settings (required for initial setup)

**Input Parameters**:
- `nethvoice_host` (required): Main hostname for NethVoice
- `nethcti_ui_host` (required): CTI hostname (must differ from nethvoice_host)
- `user_domain` (required): LDAP domain for users
- `timezone` (required): Asterisk timezone
- `reports_international_prefix` (required): International prefix for reports
- `lets_encrypt` (optional, default: true): Enable Let's Encrypt certificates

**Sub-actions**:
1. `10validate_user_domain` - Validate domain and LDAP parameters
2. `20setenvs` - Set base environment variables
3. `21subscription` - Check subscription status
4. `30traefik` - Configure traefik routes
5. `50users` - Configure LDAP user settings
6. `60sip_proxy` - Configure SIP proxy
7. `61ice_enforce` - ICE configuration
8. `71reports_api` - Configure reports API
9. `72reports_ui` - Configure reports UI
10. `80start_services` - Restart services
11. `90wait_freepbx` - Wait for FreePBX
12. `95service_adjust` - Adjust services
13. `96publish_srv_keys` - Publish SRV records

**Dependencies**: Requires traefik and nethvoice-proxy to be installed

---

### 2. configure-hotel
**Purpose**: Configure NethHotel module (premium feature requiring subscription)

**Input Parameters**:
- `nethvoice_hotel` (required): Enable/disable hotel module ("True"/"False")
- `nethvoice_hotel_fias_address` (optional): FIAS server address (hostname or IP)
- `nethvoice_hotel_fias_port` (optional): FIAS server port

**Sub-actions**:
1. `10validate_subscription` - Check if subscription is valid for hotel module
2. `20setenvs` - Set hotel-specific environment variables
3. `30configure_cdr_script` - Configure CDR script for hotel integration
4. `40restart_services` - Restart nethcti-server if hotel settings changed

**Dependencies**: Requires valid subscription (nsent provider)

---

### 3. configure-integrations
**Purpose**: Configure integrations (AI features, call/voicemail transcription, summarization, future integrations)

**Input Parameters**:
- `satellite_call_transcription_enabled` (required): Enable real-time call transcription ("True"/"False")
- `satellite_voicemail_transcription_enabled` (required): Enable voicemail transcription ("True"/"False")
- `deepgram_api_key` (optional): Deepgram API key for transcription
- `openai_api_key` (optional): OpenAI API key for summarization

**Validation Rules**:
- If transcription enabled, `deepgram_api_key` is required
- API keys must match expected format

**Sub-actions**:
1. `10validate_keys` - Validate API keys format and requirements
2. `20setenvs` - Set integrations environment variables and passwords
3. `30restart_integrations` - Restart integrations service if configuration changed

**Dependencies**: None (standalone feature)

---

### 4. configure-advanced-cti (optional - future enhancement)
**Purpose**: Configure advanced NethCTI settings (currently part of configure-base-settings)

**Input Parameters**:
- `nethcti_prefix`, `nethcti_autoc2c`, `nethcti_trunks_events`, `nethcti_alerts`
- `nethcti_authentication_enabled`, `nethcti_unauthe_call`, `nethcti_unauthe_call_ip`
- `nethcti_jabber_url`, `nethcti_jabber_domain`
- `nethcti_cdr_script`, `nethcti_cdr_script_timeout`, `nethcti_cdr_script_call_in`
- `nethcti_log_level`, `nethcti_privacy_numbers`
- `conference_jitsi_url`
- `app_brand_id`
- CTI UI branding: `nethcti_ui_product_name`, `nethcti_ui_company_name`, `nethcti_ui_company_url`

**Note**: For the initial refactoring, these remain in `configure-base-settings`. Future work can extract these into a separate action.

---

### 5. Existing Isolated Actions (Keep as-is)

#### set-rebranding
**Purpose**: Configure NethCTI UI rebranding (logos, colors, backgrounds)

**Input Parameters**:
- `rebranding_brand_name`, `rebranding_navbar_logo_url`, `rebranding_navbar_logo_dark_url`
- `rebranding_login_background_url`, `rebranding_favicon_url`
- `rebranding_login_logo_url`, `rebranding_login_logo_dark_url`
- `rebranding_login_people` ("show"/"hide")

**Dependencies**: Requires valid subscription with rebranding feature

#### set-nethvoice-admin-password
**Purpose**: Change FreePBX admin password

**Input Parameters**:
- `nethvoice_admin_password`: New admin password

**Dependencies**: Requires MariaDB to be running

---

## Migration Strategy

### Phase 1: Create New Actions (Current Phase)
1. Create `configure-base-settings` action with core functionality
2. Create `configure-hotel` action for hotel module
3. Create `configure-satellite` action for AI features
4. Test each action independently

### Phase 2: Update UI (Next Phase)
1. Refactor `Settings.vue` into multiple components/cards:
   - BaseSettingsCard: Core settings form → calls `configure-base-settings`
   - HotelModuleCard: Hotel settings form → calls `configure-hotel`
   - SatelliteCard: AI transcription form → calls `configure-satellite`
   - AdminPasswordCard: Password change form → calls `set-nethvoice-admin-password`
   - RebrandingCard: Rebranding form → calls `set-rebranding`
2. Each card can be saved independently
3. Add routing/tabs for better navigation

### Phase 3: Deprecate configure-module
1. Keep `configure-module` as a wrapper that calls new actions (for backward compatibility)
2. Add deprecation warning in API documentation
3. Update all documentation to reference new actions
4. Eventually remove in a future major version

### Phase 4: Extract Advanced CTI Settings (Future)
1. Create `configure-advanced-cti` action
2. Move advanced parameters from `configure-base-settings`
3. Add new UI card for advanced CTI settings

---

## Backward Compatibility

The existing `configure-module` action will be preserved as a **wrapper** that:
1. Receives all parameters (old schema)
2. Validates all parameters
3. Calls new isolated actions in sequence:
   - `configure-base-settings` (with base parameters)
   - `configure-hotel` (with hotel parameters)
   - `configure-satellite` (with satellite parameters)
4. Returns success if all sub-actions succeed

This ensures:
- Old API clients continue to work
- Existing automation scripts don't break
- Smooth transition to new architecture

---

## Benefits

### For Users
- **Clearer Interface**: Settings organized by feature
- **Faster Configuration**: Only configure what you need
- **Less Confusion**: Hotel settings separate when subscription required
- **Better Feedback**: Errors localized to specific feature

### For Developers
- **Easier Maintenance**: Changes isolated to specific actions
- **Better Testing**: Test each action independently
- **Scalability**: Easy to add new feature modules
- **Reusability**: Actions can be called from different contexts (UI, CLI, automation)

### For System Integrators
- **API Simplicity**: Call only what you need to configure
- **Parallel Configuration**: Configure independent features simultaneously
- **Atomic Changes**: Change one setting without affecting others
- **Better Error Handling**: Precise error messages per feature

---

## Testing Strategy

### Unit Tests (Robot Framework)
1. Test each new action independently with valid/invalid inputs
2. Test validation logic for each action
3. Test subscription requirements for hotel module
4. Test API key validation for satellite

### Integration Tests
1. Test full configuration workflow using new actions
2. Test backward compatibility via configure-module wrapper
3. Test UI interaction with new actions
4. Test service restarts and dependencies

### Regression Tests
1. Ensure existing configure-module behavior unchanged (via wrapper)
2. Test upgrade path from old to new actions
3. Verify all environment variables set correctly
4. Confirm traefik/SIP proxy routes configured properly

---

## File Structure

```
imageroot/actions/
├── configure-module/               # Deprecated wrapper (kept for compatibility)
│   ├── 10validate_user_domain
│   ├── 20setenvs
│   ├── ...
│   └── validate-input.json
│
├── configure-base-settings/        # NEW: Core configuration
│   ├── 10validate_user_domain
│   ├── 20setenvs
│   ├── 21subscription
│   ├── 30traefik
│   ├── 50users
│   ├── 60sip_proxy
│   ├── 61ice_enforce
│   ├── 71reports_api
│   ├── 72reports_ui
│   ├── 80start_services
│   ├── 90wait_freepbx
│   ├── 95service_adjust
│   ├── 96publish_srv_keys
│   ├── validate-input.json
│   └── validate-output.json
│
├── configure-hotel/                # NEW: Hotel module
│   ├── 10validate_subscription
│   ├── 20setenvs
│   ├── 30configure_cdr_script
│   ├── 40restart_services
│   ├── validate-input.json
│   └── validate-output.json

├── configure-integrations/         # NEW: Integrations (AI, transcription, etc.)
│   ├── 10validate_keys
│   ├── 20setenvs
│   ├── 30restart_integrations
│   ├── validate-input.json
│   └── validate-output.json
│
├── set-rebranding/                 # Existing: Rebranding
│   ├── 10setenvs
│   └── validate-input.json
│
└── set-nethvoice-admin-password/   # Existing: Admin password
    ├── 10start_services
    ├── 20set_password
    └── validate-input.json
```

---

## Next Steps

1. ✅ Document current architecture
2. ✅ Design new action structure
3. ⏳ Implement `configure-base-settings`
4. ⏳ Implement `configure-hotel`
5. ⏳ Implement `configure-satellite`
6. ⏳ Test new actions independently
7. ⏳ Update `configure-module` as wrapper
8. ⏳ Update UI to use new actions
9. ⏳ Write test cases
10. ⏳ Update documentation

---

## Notes

- All new actions follow NS8 conventions (JSON schemas, numbered scripts, agent library)
- Environment variables remain in `state/environment` and `passwords.env`
- Service restarts minimized - only restart affected services
- Validation errors use standard format for UI display
- All actions support `--dry-run` mode for testing
