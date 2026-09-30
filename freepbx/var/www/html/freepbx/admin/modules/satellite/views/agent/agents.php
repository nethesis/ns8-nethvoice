<?php
$escape = function ($value) {
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
};
$trunks = isset($trunks) && is_array($trunks) ? $trunks : array();
$destinations = isset($destinations) && is_array($destinations) ? $destinations : array();
$form = isset($form) && is_array($form) ? $form : array();
$errors = isset($error) && $error !== '' ? (array) $error : array();
$showForm = (isset($_GET['view']) && $_GET['view'] === 'form') || !empty($form);
$editing = !empty($form['id']);
$enabled = array_key_exists('enabled', $form) ? (bool) $form['enabled'] : true;
$csrfField = isset($csrfToken) && is_scalar($csrfToken) && (string) $csrfToken !== ''
    ? '<input type="hidden" name="csrf_token" value="' . $escape($csrfToken) . '">'
    : '';
$trunkNames = array();
foreach ($trunks as $trunk) {
    if (isset($trunk['id'])) {
        $trunkNames[(int) $trunk['id']] = isset($trunk['name']) ? $trunk['name'] : '';
    }
}
?>
<div class="container-fluid">
    <h2><?php echo $escape(_('Agents')); ?></h2>
    <?php foreach ($errors as $message): ?>
        <div class="alert alert-danger" role="alert"><?php echo $escape($message); ?></div>
    <?php endforeach; ?>
    <?php if (!empty($notice)): ?>
        <div class="alert alert-success" role="status"><?php echo $escape($notice); ?></div>
    <?php endif; ?>

    <?php if ($showForm): ?>
        <h3><?php echo $escape($editing ? _('Edit CleverAI Destination') : _('Add CleverAI Destination')); ?></h3>
        <p><?php echo $escape(_('The destination name is generated automatically when saved.')); ?></p>
        <form action="config.php?display=satellite_agents" method="post">
            <input type="hidden" name="action" value="save">
            <?php echo $csrfField; ?>
            <?php if ($editing): ?><input type="hidden" name="id" value="<?php echo (int) $form['id']; ?>"><?php endif; ?>
            <div class="form-group">
                <label for="satellite-agent-trunk"><?php echo $escape(_('Trunk')); ?></label>
                <select class="form-control" id="satellite-agent-trunk" name="cleverai_trunk_id" required>
                    <option value=""><?php echo $escape(_('Select a trunk')); ?></option>
                    <?php foreach ($trunks as $trunk): ?>
                        <?php $id = isset($trunk['id']) ? (int) $trunk['id'] : 0; ?>
                        <option value="<?php echo $id; ?>"<?php echo isset($form['cleverai_trunk_id']) && (int) $form['cleverai_trunk_id'] === $id ? ' selected' : ''; ?>><?php echo $escape(isset($trunk['name']) ? $trunk['name'] : ''); ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label for="satellite-agent-flow"><?php echo $escape(_('CleverAI flow')); ?></label>
                <input class="form-control" id="satellite-agent-flow" name="cleverai_flow" type="text" maxlength="128" pattern="[A-Za-z0-9][A-Za-z0-9._:-]{0,127}" required value="<?php echo $escape(isset($form['cleverai_flow']) ? $form['cleverai_flow'] : ''); ?>">
                <p class="help-block"><?php echo $escape(_('Letters, digits, periods, underscores, colons, and hyphens. No spaces or control characters.')); ?></p>
            </div>
            <div class="form-group">
                <label for="satellite-agent-fallback"><?php echo $escape(_('Fallback destination')); ?></label>
                <input class="form-control" id="satellite-agent-fallback" name="fallback_destination" type="text" maxlength="255" value="<?php echo $escape(isset($form['fallback_destination']) ? $form['fallback_destination'] : ''); ?>">
                <p class="help-block"><?php echo $escape(_('Optional FreePBX destination to use if the agent call fails.')); ?></p>
            </div>
            <div class="checkbox">
                <label><input type="hidden" name="enabled" value="0"><input type="checkbox" name="enabled" value="1"<?php echo $enabled ? ' checked' : ''; ?>> <?php echo $escape(_('Enabled')); ?></label>
            </div>
            <button class="btn btn-primary" type="submit"<?php echo !$trunks ? ' disabled' : ''; ?>><?php echo $escape(_('Save')); ?></button>
            <a class="btn btn-default" href="config.php?display=satellite_agents"><?php echo $escape(_('Cancel')); ?></a>
        </form>
        <?php if (!$trunks): ?><div class="alert alert-warning"><?php echo $escape(_('Create an Agent Trunk before adding a destination.')); ?></div><?php endif; ?>
    <?php else: ?>
        <p><a class="btn btn-primary" href="config.php?display=satellite_agents&amp;view=form"><?php echo $escape(_('Add destination')); ?></a></p>
        <table class="table table-striped">
            <thead><tr><th><?php echo $escape(_('Destination')); ?></th><th><?php echo $escape(_('Trunk')); ?></th><th><?php echo $escape(_('CleverAI flow')); ?></th><th><?php echo $escape(_('Agent')); ?></th><th><?php echo $escape(_('Enabled')); ?></th><th><?php echo $escape(_('Actions')); ?></th></tr></thead>
            <tbody>
            <?php foreach ($destinations as $destination): ?>
                <?php
                $id = isset($destination['id']) ? (int) $destination['id'] : 0;
                $trunkId = isset($destination['cleverai_trunk_id']) ? (int) $destination['cleverai_trunk_id'] : 0;
                ?>
                <tr>
                    <td><?php echo $escape(isset($destination['freepbx_name']) ? $destination['freepbx_name'] : ''); ?></td>
                    <td><?php echo $escape(isset($trunkNames[$trunkId]) ? $trunkNames[$trunkId] : ''); ?></td>
                    <td><?php echo $escape(isset($destination['cleverai_flow']) ? $destination['cleverai_flow'] : ''); ?></td>
                    <td><?php echo $escape(_('CleverAI')); ?></td>
                    <td><?php echo $escape(!empty($destination['enabled']) ? _('Yes') : _('No')); ?></td>
                    <td>
                        <a class="btn btn-default btn-sm" href="config.php?display=satellite_agents&amp;view=form&amp;id=<?php echo $id; ?>"><?php echo $escape(_('Edit')); ?></a>
                        <form action="config.php?display=satellite_agents" method="post" style="display:inline" onsubmit="return confirm(<?php echo $escape(json_encode(_('Delete this destination?'))); ?>)">
                            <input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?php echo $id; ?>"><?php echo $csrfField; ?>
                            <button class="btn btn-danger btn-sm" type="submit"><?php echo $escape(_('Delete')); ?></button>
                        </form>
                    </td>
                </tr>
            <?php endforeach; ?>
            <?php if (!$destinations): ?><tr><td colspan="6"><?php echo $escape(_('No CleverAI destinations configured.')); ?></td></tr><?php endif; ?>
            </tbody>
        </table>
    <?php endif; ?>
</div>
