<?php
$escape = function ($value) { return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'); };
$profile = isset($profile) && is_array($profile) ? $profile : array();
$profileKey = $profileKey === 'external' ? 'external' : 'internal';
$profileName = $profileKey === 'internal' ? _('Builtin Internal') : _('Builtin External');
$permissions = isset($profile['permissions']) && is_array($profile['permissions']) ? $profile['permissions'] : array();
$tools = isset($profile['tools']) && is_array($profile['tools']) ? $profile['tools'] : array();
$company = isset($profile['company']) && is_array($profile['company']) ? $profile['company'] : array();
$emails = isset($company['email']) && is_array($company['email']) ? $company['email'] : array();
$locations = isset($company['locations']) && is_array($company['locations']) ? $company['locations'] : array();
$location = isset($locations[0]) && is_array($locations[0]) ? $locations[0] : array();
$calendarServices = isset($profile['calendar_services']) && is_array($profile['calendar_services']) ? $profile['calendar_services'] : array();
$calendarRows = $calendarServices;
$calendarRows[''] = '';
$allowedTrunks = array_filter($trunks, function ($trunk) { return isset($trunk['runtime_owner']) && $trunk['runtime_owner'] === 'builtin'; });
$fallbackIndex = $profileKey === 'internal' ? 1 : 2;
?>
<h3><?php echo $escape($profileName); ?></h3>
<p><?php echo $escape(isset($profileStatus) ? $profileStatus : _('Not configured')); ?></p>
<form class="fpbx-submit" method="post" action="config.php?display=satellite_agents&amp;tab=<?php echo $profileKey; ?>">
    <input type="hidden" name="section" value="<?php echo $profileKey; ?>">
    <input type="hidden" name="action" value="save">
    <input type="hidden" name="csrf_token" value="<?php echo $escape($csrfToken); ?>">
    <h4><?php echo $escape(_('General')); ?></h4>
    <div class="form-group"><label for="<?php echo $profileKey; ?>-trunk"><?php echo $escape(_('Agent trunk')); ?></label>
        <select class="form-control" id="<?php echo $profileKey; ?>-trunk" name="trunk_id">
            <option value=""><?php echo $escape(_('Select a built-in trunk')); ?></option>
            <?php foreach ($allowedTrunks as $trunk): ?><option value="<?php echo (int) $trunk['id']; ?>"<?php echo isset($profile['trunk_id']) && (int) $profile['trunk_id'] === (int) $trunk['id'] ? ' selected' : ''; ?>><?php echo $escape($trunk['name']); ?></option><?php endforeach; ?>
        </select>
    </div>
    <?php foreach (array('model' => _('Model'), 'voice' => _('Voice'), 'language' => _('Language'), 'greeting' => _('Greeting')) as $field => $label): ?>
    <div class="form-group"><label for="<?php echo $profileKey . '-' . $field; ?>"><?php echo $escape($label); ?></label>
        <input class="form-control" id="<?php echo $profileKey . '-' . $field; ?>" name="<?php echo $field; ?>" type="text" maxlength="<?php echo $field === 'greeting' ? 1000 : ($field === 'language' ? 16 : 128); ?>" value="<?php echo $escape(isset($profile[$field]) ? $profile[$field] : ''); ?>">
    </div>
    <?php endforeach; ?>
    <div class="form-group"><label for="<?php echo $profileKey; ?>-duration"><?php echo $escape(_('Maximum call duration (seconds)')); ?></label>
        <input class="form-control" id="<?php echo $profileKey; ?>-duration" name="max_call_duration_seconds" type="number" min="60" max="7200" required value="<?php echo $escape(isset($profile['max_call_duration_seconds']) ? $profile['max_call_duration_seconds'] : 900); ?>">
    </div>
    <h4><?php echo $escape(_('Prompt')); ?></h4>
    <div class="form-group"><label for="<?php echo $profileKey; ?>-prompt"><?php echo $escape(_('Instructions')); ?></label>
        <textarea class="form-control" id="<?php echo $profileKey; ?>-prompt" name="prompt" rows="7"><?php echo $escape(isset($profile['prompt']) ? $profile['prompt'] : ''); ?></textarea>
    </div>
    <h4><?php echo $escape(_('Permissions')); ?></h4>
    <table class="table table-striped"><thead><tr><th><?php echo $escape(_('Permission')); ?></th><th><?php echo $escape(_('Policy')); ?></th></tr></thead><tbody>
        <?php foreach ($permissionCatalog as $catalogKey => $catalogValue): ?>
        <?php $key = is_int($catalogKey) ? $catalogValue : $catalogKey; $value = isset($permissions[$key]) ? $permissions[$key] : 'deny'; ?>
        <tr><td><?php echo $escape($key); ?></td><td>
            <label><input type="radio" name="permissions[<?php echo $escape($key); ?>]" value="allow"<?php echo $value === 'allow' ? ' checked' : ''; ?>> <?php echo $escape(_('Allow')); ?></label>
            <label><input type="radio" name="permissions[<?php echo $escape($key); ?>]" value="deny"<?php echo $value !== 'allow' ? ' checked' : ''; ?>> <?php echo $escape(_('Deny')); ?></label>
        </td></tr>
        <?php endforeach; ?>
    </tbody></table>
    <h4><?php echo $escape(_('Tools')); ?></h4>
    <table class="table table-striped"><thead><tr><th><?php echo $escape(_('Tool')); ?></th><th><?php echo $escape(_('Status')); ?></th></tr></thead><tbody>
        <?php foreach ($toolCatalog as $catalogKey => $catalogValue): ?>
        <?php $key = is_int($catalogKey) ? $catalogValue : $catalogKey; $value = isset($tools[$key]) ? $tools[$key] : 'disabled'; ?>
        <tr><td><?php echo $escape($key); ?></td><td>
            <label><input type="radio" name="tools[<?php echo $escape($key); ?>]" value="enabled"<?php echo $value === 'enabled' ? ' checked' : ''; ?>> <?php echo $escape(_('Enabled')); ?></label>
            <label><input type="radio" name="tools[<?php echo $escape($key); ?>]" value="disabled"<?php echo $value !== 'enabled' ? ' checked' : ''; ?>> <?php echo $escape(_('Disabled')); ?></label>
        </td></tr>
        <?php endforeach; ?>
    </tbody></table>
    <h4><?php echo $escape(_('Directory')); ?></h4>
    <p class="help-block"><?php echo $escape(_('Set the name and description visible to the agent. Select whether this profile may use each destination.')); ?></p>
    <table class="table table-striped"><thead><tr><th><?php echo $escape(_('Destination')); ?></th><th><?php echo $escape(_('Visible')); ?></th><th><?php echo $escape(_('Description')); ?></th><th><?php echo $escape(_('Synonyms (comma separated)')); ?></th></tr></thead><tbody>
        <?php foreach ($directory as $item): ?>
        <?php $key = $item['id']; $rule = isset($directoryRules[$key]) ? $directoryRules[$key] : array(); ?>
        <tr><td><?php echo $escape($item['name'] . ' (' . $key . ')'); ?></td>
            <td><input type="checkbox" name="directory[<?php echo $escape($key); ?>][allowed]" value="1"<?php echo !empty($rule[$profileKey . '_allowed']) ? ' checked' : ''; ?>></td>
            <td><input class="form-control" name="directory[<?php echo $escape($key); ?>][description]" type="text" maxlength="1000" value="<?php echo $escape(isset($rule['description']) ? $rule['description'] : ''); ?>"></td>
            <td><input class="form-control" name="directory[<?php echo $escape($key); ?>][synonyms]" type="text" maxlength="1000" value="<?php echo $escape(isset($rule['synonyms']) ? (is_array($rule['synonyms']) ? implode(', ', $rule['synonyms']) : $rule['synonyms']) : ''); ?>"></td>
        </tr><?php endforeach; ?>
        <?php if (!$directory): ?><tr><td colspan="4"><?php echo $escape(_('No FreePBX directory resources found.')); ?></td></tr><?php endif; ?>
    </tbody></table>
    <h4><?php echo $escape(_('Company information')); ?></h4>
    <?php foreach (array('company_name' => _('Company name'), 'vat_number' => _('VAT number')) as $field => $label): ?>
    <div class="form-group"><label for="<?php echo $profileKey . '-' . $field; ?>"><?php echo $escape($label); ?></label><input class="form-control" id="<?php echo $profileKey . '-' . $field; ?>" name="company[<?php echo $field; ?>]" type="text" maxlength="255" value="<?php echo $escape(isset($company[$field]) ? $company[$field] : ''); ?>"></div>
    <?php endforeach; ?>
    <?php foreach (array('general' => _('General email'), 'support' => _('Support email')) as $field => $label): ?>
    <div class="form-group"><label><?php echo $escape($label); ?></label><input class="form-control" name="company[email][<?php echo $field; ?>]" type="email" maxlength="255" value="<?php echo $escape(isset($emails[$field]) ? $emails[$field] : ''); ?>"></div>
    <?php endforeach; ?>
    <?php foreach (array('name' => _('Location name'), 'address' => _('Address'), 'directions' => _('Directions')) as $field => $label): ?>
    <div class="form-group"><label><?php echo $escape($label); ?></label><input class="form-control" name="company[locations][0][<?php echo $field; ?>]" type="text" maxlength="1000" value="<?php echo $escape(isset($location[$field]) ? $location[$field] : ''); ?>"></div>
    <?php endforeach; ?>
    <h4><?php echo $escape(_('Calendar and opening hours')); ?></h4>
    <p class="help-block"><?php echo $escape(_('Use FreePBX time conditions. The service ID is the name agents use when asking for hours.')); ?></p>
    <?php foreach ($calendarRows as $serviceId => $conditionId): ?>
    <div class="row form-group"><div class="col-md-4"><input class="form-control" name="calendar_service_id[]" type="text" maxlength="64" placeholder="<?php echo $escape(_('Service ID')); ?>" value="<?php echo $escape($serviceId); ?>"></div>
        <div class="col-md-8"><select class="form-control" name="calendar_time_condition_id[]"><option value=""><?php echo $escape(_('Select a time condition')); ?></option>
            <?php foreach ($timeConditions as $condition): ?><?php $conditionKey = isset($condition['id']) ? (string) $condition['id'] : ''; ?><option value="<?php echo $escape($conditionKey); ?>"<?php echo (string) $conditionId === $conditionKey ? ' selected' : ''; ?>><?php echo $escape(isset($condition['name']) ? $condition['name'] : $conditionKey); ?></option><?php endforeach; ?>
        </select></div></div>
    <?php endforeach; ?>
    <h4><?php echo $escape(_('Fallback')); ?></h4>
    <div class="form-group"><label for="goto<?php echo $fallbackIndex; ?>"><?php echo $escape(_('Fallback FreePBX destination')); ?></label>
        <?php echo drawselects(isset($profile['fallback_destination']) ? $profile['fallback_destination'] : '', $fallbackIndex, false, false); ?>
    </div>
    <p class="help-block"><?php echo $escape(_('Basic handoff follows the permission and directory rules above.')); ?></p>
</form>
