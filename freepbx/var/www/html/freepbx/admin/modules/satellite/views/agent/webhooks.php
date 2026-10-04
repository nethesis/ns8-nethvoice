<?php
$escape = function ($value) {
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
};
$trunks = isset($trunks) && is_array($trunks) ? $trunks : array();
$webhook = isset($webhook) ? trim((string) $webhook) : '';
$builtinWebhook = isset($builtinWebhook) ? trim((string) $builtinWebhook) : '';
?>
<div class="container-fluid">
    <p><a class="btn btn-default" href="/freepbx/wizard/#!/agents"><?php echo $escape(_('Agent monitoring')); ?></a></p>
    <h2><?php echo $escape(_('Webhooks')); ?></h2>
    <?php if (!empty($error)): ?><div class="alert alert-danger" role="alert"><?php echo $escape($error); ?></div><?php endif; ?>
    <?php if (!empty($notice)): ?><div class="alert alert-success" role="status"><?php echo $escape($notice); ?></div><?php endif; ?>
    <?php if (!empty($warning)): ?><div class="alert alert-warning" role="alert"><?php echo $escape($warning); ?></div><?php endif; ?>
    <div class="panel panel-default">
        <div class="panel-heading"><?php echo $escape(_('CleverAI webhook')); ?></div>
        <div class="panel-body">
            <?php if ($webhook === ''): ?>
                <p><strong><?php echo $escape(_('Status: Not configured')); ?></strong></p>
                <div class="alert alert-warning" role="alert"><?php echo $escape(_('CLEVERAI_WEBHOOK is missing from the FreePBX environment. Agent Trunks cannot be configured correctly until it is set.')); ?></div>
            <?php else: ?>
                <p><strong><?php echo $escape(_('Status: Configured')); ?></strong></p>
                <p><code><?php echo $escape($webhook); ?></code></p>
            <?php endif; ?>
            <p class="help-block"><?php echo $escape(_('This URL is read-only. CleverAI processes provider webhooks and owns webhook signing secrets.')); ?></p>
        </div>
    </div>
    <table class="table table-striped">
        <thead><tr><th><?php echo $escape(_('Trunk')); ?></th><th><?php echo $escape(_('Provider')); ?></th><th><?php echo $escape(_('Expected webhook')); ?></th><th><?php echo $escape(_('Runtime')); ?></th><th><?php echo $escape(_('Actions')); ?></th></tr></thead>
        <tbody>
        <?php foreach ($trunks as $trunk): ?>
            <?php if (isset($trunk['runtime_owner']) && $trunk['runtime_owner'] !== 'cleverai') continue; ?>
            <?php $type = isset($trunk['provider']) ? $trunk['provider'] : ''; ?>
            <tr>
                <td><?php echo $escape(isset($trunk['name']) ? $trunk['name'] : ''); ?></td>
                <td><?php echo $escape($type === 'openai' ? 'OpenAI' : ($type === 'grok' ? 'Grok' : $type)); ?></td>
                <td><?php echo $webhook === '' ? $escape(_('Not configured')) : '<code>' . $escape($webhook) . '</code>'; ?></td>
                <td><?php echo $escape(_('CleverAI')); ?></td>
                <td><?php echo $escape(_('Remote validation unavailable')); ?></td>
            </tr>
        <?php endforeach; ?>
        <?php if (!array_filter($trunks, function ($trunk) { return !isset($trunk['runtime_owner']) || $trunk['runtime_owner'] === 'cleverai'; })): ?><tr><td colspan="5"><?php echo $escape(_('No CleverAI trunks configured.')); ?></td></tr><?php endif; ?>
        </tbody>
    </table>
    <div class="panel panel-default">
        <div class="panel-heading"><?php echo $escape(_('Built-in Satellite webhook')); ?></div>
        <div class="panel-body">
            <p><?php echo $builtinWebhook === '' ? $escape(_('NethVoice public hostname is not configured.')) : '<code>' . $escape($builtinWebhook) . '</code>'; ?></p>
            <p class="help-block"><?php echo $escape(_('This URL is derived from the NethVoice hostname and cannot be edited here.')); ?></p>
        </div>
    </div>
    <table class="table table-striped">
        <thead><tr><th><?php echo $escape(_('Trunk')); ?></th><th><?php echo $escape(_('Provider')); ?></th><th><?php echo $escape(_('Webhook')); ?></th><th><?php echo $escape(_('Signing secret')); ?></th><th><?php echo $escape(_('Status')); ?></th><th><?php echo $escape(_('Actions')); ?></th></tr></thead>
        <tbody>
        <?php foreach ($trunks as $trunk): ?>
            <?php if (!isset($trunk['runtime_owner']) || $trunk['runtime_owner'] !== 'builtin') continue; ?>
            <?php $id = (int) $trunk['id']; ?>
            <tr><td><?php echo $escape($trunk['name']); ?></td>
                <td><?php echo $escape($trunk['provider'] === 'openai' ? 'OpenAI' : 'Grok'); ?></td>
                <td><?php echo $builtinWebhook === '' ? $escape(_('Not configured')) : '<code>' . $escape($builtinWebhook) . '</code>'; ?></td>
                <td><?php echo !empty($trunk['webhook_signing_secret_configured']) ? $escape(_('Configured: Yes (********)')) : $escape(_('Not configured')); ?></td>
                <td><?php echo $escape(empty($trunk['webhook_signing_secret_configured']) ? _('Not configured') : $builtinStatus); ?></td>
                <td>
                    <form action="config.php?display=satellite_webhooks" method="post">
                        <input type="hidden" name="csrf_token" value="<?php echo $escape($csrfToken); ?>">
                        <input type="hidden" name="id" value="<?php echo $id; ?>">
                        <input type="hidden" name="action" value="replace_secret">
                        <label for="webhook-secret-<?php echo $id; ?>"><?php echo $escape(_('Replace secret')); ?></label>
                        <input class="form-control" id="webhook-secret-<?php echo $id; ?>" name="webhook_signing_secret" type="password" autocomplete="new-password" value="">
                        <button class="btn btn-default btn-sm" type="submit"><?php echo $escape(_('Save secret')); ?></button>
                    </form>
                    <?php if (!empty($trunk['webhook_signing_secret_configured'])): ?>
                    <form action="config.php?display=satellite_webhooks" method="post" onsubmit="return confirm(<?php echo $escape(json_encode(_('Remove this signing secret?'))); ?>)">
                        <input type="hidden" name="csrf_token" value="<?php echo $escape($csrfToken); ?>">
                        <input type="hidden" name="id" value="<?php echo $id; ?>">
                        <input type="hidden" name="action" value="remove_secret">
                        <button class="btn btn-danger btn-sm" type="submit"><?php echo $escape(_('Remove secret')); ?></button>
                    </form>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
        <?php if (!array_filter($trunks, function ($trunk) { return isset($trunk['runtime_owner']) && $trunk['runtime_owner'] === 'builtin'; })): ?><tr><td colspan="6"><?php echo $escape(_('No built-in trunks configured.')); ?></td></tr><?php endif; ?>
        </tbody>
    </table>
</div>
