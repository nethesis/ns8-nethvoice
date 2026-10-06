<?php
$escape = function ($value) {
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
};
$trunks = isset($trunks) && is_array($trunks) ? $trunks : array();
$webhook = isset($webhook) ? trim((string) $webhook) : '';
?>
<div class="container-fluid">
    <h2><?php echo $escape(_('Webhooks')); ?></h2>
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
            <?php $type = isset($trunk['provider']) ? $trunk['provider'] : ''; ?>
            <tr>
                <td><?php echo $escape(isset($trunk['name']) ? $trunk['name'] : ''); ?></td>
                <td><?php echo $escape($type === 'openai' ? 'OpenAI' : ($type === 'grok' ? 'Grok' : $type)); ?></td>
                <td><?php echo $webhook === '' ? $escape(_('Not configured')) : '<code>' . $escape($webhook) . '</code>'; ?></td>
                <td><?php echo $escape(_('CleverAI')); ?></td>
                <td><?php echo $escape(_('Remote validation unavailable')); ?></td>
            </tr>
        <?php endforeach; ?>
        <?php if (!$trunks): ?><tr><td colspan="5"><?php echo $escape(_('No Agent Trunks configured.')); ?></td></tr><?php endif; ?>
        </tbody>
    </table>
</div>
