<?php
$escape = function ($value) {
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
};
$trunks = isset($trunks) && is_array($trunks) ? $trunks : array();
$form = isset($form) && is_array($form) ? $form : array();
$showForm = isset($showForm) ? (bool) $showForm : ((isset($_GET['view']) && $_GET['view'] === 'form') || !empty($form));
$editing = isset($editing) ? (bool) $editing : !empty($form['id']);
$provider = isset($form['provider']) ? $form['provider'] : 'openai';
$csrfField = isset($csrfField) ? $csrfField : (
    isset($csrfToken) && is_scalar($csrfToken) && (string) $csrfToken !== ''
        ? '<input type="hidden" name="csrf_token" value="' . $escape($csrfToken) . '">'
        : ''
);
?>
<?php if ($showForm): ?>
        <h3><?php echo $escape($editing ? _('Edit Agent Trunk') : _('Add Agent Trunk')); ?></h3>
        <form action="config.php?display=satellite_agents&amp;tab=trunks" method="post" class="fpbx-submit" id="satellite-trunk-form">
            <input type="hidden" name="section" value="trunks">
            <input type="hidden" name="action" value="save">
            <?php echo $csrfField; ?>
            <?php if ($editing): ?>
                <input type="hidden" name="id" value="<?php echo (int) $form['id']; ?>">
            <?php endif; ?>
            <div class="element-container"><div class="row"><div class="form-group">
                <label class="control-label col-md-3" for="satellite-trunk-name"><?php echo $escape(_('Name')); ?></label>
                <div class="col-md-9"><input class="form-control" id="satellite-trunk-name" name="name" type="text" maxlength="100" required value="<?php echo $escape(isset($form['name']) ? $form['name'] : ''); ?>"></div>
            </div></div></div>
            <div class="element-container"><div class="row"><div class="form-group">
                <label class="control-label col-md-3" for="satellite-trunk-provider"><?php echo $escape(_('Provider')); ?></label>
                <div class="col-md-9"><select class="form-control" id="satellite-trunk-provider" name="provider">
                    <option value="openai"<?php echo $provider === 'openai' ? ' selected' : ''; ?>>OpenAI</option>
                    <option value="grok"<?php echo $provider === 'grok' ? ' selected' : ''; ?>>Grok</option>
                </select></div>
            </div></div></div>
            <div class="element-container"><div class="row"><div class="form-group">
                <label class="control-label col-md-3" for="satellite-trunk-runtime"><?php echo $escape(_('Runtime')); ?></label>
                <div class="col-md-9"><select class="form-control" id="satellite-trunk-runtime" name="runtime_owner"<?php echo $editing ? ' disabled' : ''; ?>>
                    <option value="cleverai"<?php echo !isset($form['runtime_owner']) || $form['runtime_owner'] === 'cleverai' ? ' selected' : ''; ?>><?php echo $escape(_('CleverAI')); ?></option>
                    <option value="builtin"<?php echo isset($form['runtime_owner']) && $form['runtime_owner'] === 'builtin' ? ' selected' : ''; ?>><?php echo $escape(_('Builtin Satellite')); ?></option>
                </select><?php if ($editing): ?><input type="hidden" name="runtime_owner" value="<?php echo $escape(isset($form['runtime_owner']) ? $form['runtime_owner'] : 'cleverai'); ?>"><?php endif; ?><p class="help-block"><?php echo $escape(_('Use a separate provider project or number for each runtime.')); ?></p></div>
            </div></div></div>
            <fieldset class="satellite-provider-settings" data-provider="openai">
                <legend><?php echo $escape(_('OpenAI settings')); ?></legend>
                <div class="element-container"><div class="row"><div class="form-group">
                    <label class="control-label col-md-3" for="satellite-project-id"><?php echo $escape(_('Project ID')); ?></label>
                    <div class="col-md-9">
                        <input class="form-control" id="satellite-project-id" name="openai_project_id" type="text" maxlength="128" pattern="proj_[A-Za-z0-9_-]+" value="<?php echo $escape(isset($form['openai_project_id']) ? $form['openai_project_id'] : ''); ?>">
                        <p class="help-block"><?php echo $escape(_('Required for OpenAI. Format: proj_ followed by letters, digits, underscores, or hyphens.')); ?></p>
                    </div>
                </div></div></div>
                <p class="help-block"><?php echo $escape(_('Generated SIP server: sip.api.openai.com, port 5061, TLS, without registration.')); ?></p>
            </fieldset>
            <fieldset class="satellite-provider-settings" data-provider="grok">
                <legend><?php echo $escape(_('Grok settings')); ?></legend>
                <div class="element-container"><div class="row"><div class="form-group">
                    <label class="control-label col-md-3" for="satellite-phone-number"><?php echo $escape(_('Direct SIP number')); ?></label>
                    <div class="col-md-9">
                        <input class="form-control" id="satellite-phone-number" name="grok_phone_number" type="tel" maxlength="32" value="<?php echo $escape(isset($form['grok_phone_number']) ? $form['grok_phone_number'] : ''); ?>">
                        <p class="help-block"><?php echo $escape(_('Required for Grok; normally use E.164 format, such as +390721123456.')); ?></p>
                    </div>
                </div></div></div>
                <div class="element-container"><div class="row"><div class="form-group">
                    <label class="control-label col-md-3" for="satellite-sip-auth-mode"><?php echo $escape(_('SIP authentication mode')); ?></label>
                    <div class="col-md-9"><select class="form-control" id="satellite-sip-auth-mode" name="sip_auth_mode">
                        <option value="none"<?php echo !isset($form['sip_auth_mode']) || $form['sip_auth_mode'] === 'none' ? ' selected' : ''; ?>><?php echo $escape(_('None / IP allowlist')); ?></option>
                        <option value="digest"<?php echo isset($form['sip_auth_mode']) && $form['sip_auth_mode'] === 'digest' ? ' selected' : ''; ?>><?php echo $escape(_('Digest')); ?></option>
                    </select></div>
                </div></div></div>
                <div class="element-container"><div class="row"><div class="form-group">
                    <label class="control-label col-md-3" for="satellite-sip-username"><?php echo $escape(_('SIP username (Digest only)')); ?></label>
                    <div class="col-md-9"><input class="form-control" id="satellite-sip-username" name="sip_auth_username" type="text" maxlength="128" autocomplete="off" value="<?php echo $escape(isset($form['sip_auth_username']) ? $form['sip_auth_username'] : ''); ?>"></div>
                </div></div></div>
                <div class="element-container"><div class="row"><div class="form-group">
                    <label class="control-label col-md-3" for="satellite-sip-password"><?php echo $escape(_('SIP password (Digest only)')); ?></label>
                    <div class="col-md-9">
                        <input class="form-control" id="satellite-sip-password" name="sip_auth_password" type="password" autocomplete="new-password" value="">
                        <?php if ($editing): ?><p class="help-block"><?php echo $escape(_('Leave blank to keep the existing SIP password.')); ?></p><?php endif; ?>
                    </div>
                </div></div></div>
            </fieldset>
            <div class="element-container"><div class="row"><div class="form-group">
                <label class="control-label col-md-3" for="satellite-api-key"><?php echo $escape(_('Provider API key')); ?></label>
                <div class="col-md-9">
                    <input class="form-control" id="satellite-api-key" name="api_key" type="password" autocomplete="new-password" value="">
                    <p class="help-block"><?php echo $escape($editing ? _('Leave blank to keep the existing key. OpenAI can use OPENAI_API_KEY from the environment.') : _('Grok requires a key. OpenAI can use OPENAI_API_KEY from the environment.')); ?></p>
                </div>
            </div></div></div>
            <p class="help-block"><?php echo $escape(_('Configure built-in webhook signing secrets on the Webhooks page.')); ?></p>
            <p><a href="config.php?display=satellite_agents&amp;tab=trunks"><?php echo $escape(_('Back to trunks')); ?></a></p>
        </form>
        <script>
        (function () {
            var form = document.getElementById('satellite-trunk-form');
            var provider = document.getElementById('satellite-trunk-provider');
            if (!form || !provider) {
                return;
            }
            var settings = form.querySelectorAll('.satellite-provider-settings');
            // Show the fields required by the selected provider.
            function updateProviderSettings() {
                for (var i = 0; i < settings.length; i++) {
                    var active = settings[i].getAttribute('data-provider') === provider.value;
                    settings[i].style.display = active ? '' : 'none';
                    var fields = settings[i].querySelectorAll('input, select, textarea');
                    for (var j = 0; j < fields.length; j++) {
                        fields[j].disabled = !active;
                    }
                }
            }
            provider.addEventListener('change', updateProviderSettings);
            updateProviderSettings();
        }());
        </script>
    <?php else: ?>
        <h3><?php echo $escape(_('Agent Trunks')); ?></h3>
        <p><a class="btn btn-default" href="config.php?display=satellite_agents&amp;tab=trunks&amp;view=form"><i class="fa fa-plus" aria-hidden="true"></i> <?php echo $escape(_('Add Agent Trunk')); ?></a></p>
        <table class="table table-striped">
            <thead><tr><th><?php echo $escape(_('Name')); ?></th><th><?php echo $escape(_('Provider')); ?></th><th><?php echo $escape(_('Remote identifier')); ?></th><th><?php echo $escape(_('Runtime')); ?></th><th><?php echo $escape(_('Status')); ?></th><th><?php echo $escape(_('Actions')); ?></th></tr></thead>
            <tbody>
            <?php foreach ($trunks as $trunk): ?>
                <?php
                $id = isset($trunk['id']) ? (int) $trunk['id'] : 0;
                $type = isset($trunk['provider']) ? $trunk['provider'] : '';
                $remote = $type === 'openai' ? (isset($trunk['openai_project_id']) ? $trunk['openai_project_id'] : '') : (isset($trunk['grok_phone_number']) ? $trunk['grok_phone_number'] : '');
                ?>
                <tr>
                    <td><?php echo $escape(isset($trunk['name']) ? $trunk['name'] : ''); ?></td>
                    <td><?php echo $escape($type === 'openai' ? 'OpenAI' : ($type === 'grok' ? 'Grok' : $type)); ?></td>
                    <td><?php echo $escape($remote); ?></td>
                    <td><?php echo $escape(isset($trunk['runtime_owner']) && $trunk['runtime_owner'] === 'builtin' ? _('Builtin Satellite') : _('CleverAI')); ?></td>
                    <td><?php echo $escape(isset($trunk['status']) ? $trunk['status'] : _('Configured')); ?></td>
                    <td>
                        <a class="btn btn-default btn-sm" href="config.php?display=satellite_agents&amp;tab=trunks&amp;view=form&amp;id=<?php echo $id; ?>"><?php echo $escape(_('Edit')); ?></a>
                        <form action="config.php?display=satellite_agents&amp;tab=trunks" method="post" style="display:inline">
                            <input type="hidden" name="section" value="trunks"><input type="hidden" name="action" value="validate"><input type="hidden" name="id" value="<?php echo $id; ?>"><?php echo $csrfField; ?>
                            <button class="btn btn-default btn-sm" type="submit"><?php echo $escape(_('Validate')); ?></button>
                        </form>
                        <form action="config.php?display=satellite_agents&amp;tab=trunks" method="post" style="display:inline" onsubmit="return confirm(<?php echo $escape(json_encode(_('Delete this Agent Trunk?'))); ?>)">
                            <input type="hidden" name="section" value="trunks"><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?php echo $id; ?>"><?php echo $csrfField; ?>
                            <button class="btn btn-danger btn-sm" type="submit"><?php echo $escape(_('Delete')); ?></button>
                        </form>
                    </td>
                </tr>
            <?php endforeach; ?>
            <?php if (!$trunks): ?><tr><td colspan="6"><?php echo $escape(_('No Agent Trunks configured.')); ?></td></tr><?php endif; ?>
            </tbody>
        </table>
<?php endif; ?>
