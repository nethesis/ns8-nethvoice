<?php
$escape = function ($value) {
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
};
$trunks = isset($trunks) && is_array($trunks) ? $trunks : array();
$destinations = isset($destinations) && is_array($destinations) ? $destinations : array();
$form = isset($form) && is_array($form) ? $form : array();
$showForm = !empty($showForm);
$editing = !empty($form['id']);
$systemForm = !empty($form['system_managed']);
$csrfField = isset($csrfToken) && is_scalar($csrfToken) && (string) $csrfToken !== ''
    ? '<input type="hidden" name="csrf_token" value="' . $escape($csrfToken) . '">'
    : '';
$trunkNames = array();
$cleveraiTrunks = array();
foreach ($trunks as $trunk) {
    if (isset($trunk['id'])) {
        $trunkNames[(int) $trunk['id']] = isset($trunk['name']) ? $trunk['name'] : '';
        if (!isset($trunk['runtime_owner']) || $trunk['runtime_owner'] === 'cleverai') {
            $cleveraiTrunks[] = $trunk;
        }
    }
}
$agentLabels = array('workflow' => _('Workflow'), 'cleverai' => _('CleverAI'), 'builtin_internal' => _('Builtin Internal'), 'builtin_external' => _('Builtin External'));
?>
<?php if ($showForm): ?>
    <h3><?php echo $escape($editing ? _('Edit Agent Destination') : _('Add Agent Destination')); ?></h3>
    <p><?php echo $escape($systemForm ? _('Change the fallback used if this built-in agent call fails. Configure the agent in its Builtin tab.') : _('The destination name is generated automatically when saved.')); ?></p>
    <form class="fpbx-submit" action="config.php?display=satellite_agents&amp;tab=destinations" method="post">
        <input type="hidden" name="section" value="destinations">
        <input type="hidden" name="action" value="save">
        <?php echo $csrfField; ?>
        <?php if ($editing): ?><input type="hidden" name="id" value="<?php echo (int) $form['id']; ?>"><?php endif; ?>

        <div class="element-container"><div class="row"><div class="form-group">
            <div class="col-md-3"><label class="control-label" for="satellite-agent-type"><?php echo $escape(_('Agent')); ?></label></div>
            <div class="col-md-9"><select class="form-control" id="satellite-agent-type" name="agent_type"<?php echo $systemForm ? ' disabled' : ''; ?>>
                <?php foreach ($agentLabels as $type => $label): ?><option value="<?php echo $type; ?>"<?php echo (isset($form['agent_type']) ? $form['agent_type'] : 'cleverai') === $type ? ' selected' : ''; ?>><?php echo $escape($label); ?></option><?php endforeach; ?>
            </select><?php if ($systemForm): ?><input type="hidden" name="agent_type" value="<?php echo $escape($form['agent_type']); ?>"><?php endif; ?></div>
        </div></div></div>

        <div class="element-container satellite-cleverai-field"><div class="row"><div class="form-group">
            <div class="col-md-3"><label class="control-label" for="satellite-agent-trunk"><?php echo $escape(_('Trunk')); ?></label></div>
            <div class="col-md-9">
                <select class="form-control" id="satellite-agent-trunk" name="cleverai_trunk_id" required>
                    <option value=""><?php echo $escape(_('Select a trunk')); ?></option>
                    <?php foreach ($cleveraiTrunks as $trunk): ?>
                        <?php $id = isset($trunk['id']) ? (int) $trunk['id'] : 0; ?>
                        <option value="<?php echo $id; ?>"<?php echo isset($form['cleverai_trunk_id']) && (int) $form['cleverai_trunk_id'] === $id ? ' selected' : ''; ?>><?php echo $escape(isset($trunk['name']) ? $trunk['name'] : ''); ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
        </div></div></div>

        <div class="element-container satellite-cleverai-field"><div class="row"><div class="form-group">
            <div class="col-md-3"><label class="control-label" for="satellite-agent-flow"><?php echo $escape(_('CleverAI flow')); ?></label></div>
            <div class="col-md-9">
                <input class="form-control" id="satellite-agent-flow" name="cleverai_flow" type="text" maxlength="128" pattern="[A-Za-z0-9][A-Za-z0-9._:-]{0,127}" value="<?php echo $escape(isset($form['cleverai_flow']) ? $form['cleverai_flow'] : ''); ?>">
                <span class="help-block"><?php echo $escape(_('Letters, digits, periods, underscores, colons, and hyphens. No spaces or control characters.')); ?></span>
            </div>
        </div></div></div>

        <div class="element-container"><div class="row"><div class="form-group">
            <div class="col-md-3">
                <label class="control-label" for="goto0"><?php echo $escape(_('Fallback destination')); ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="goto0"></i>
            </div>
            <div class="col-md-9">
                <?php echo drawselects(isset($form['fallback_destination']) ? $form['fallback_destination'] : '', 0, false, false); ?>
            </div>
        </div><div class="col-md-12"><span id="goto0-help" class="help-block fpbx-help-block"><?php echo $escape(_('Optional FreePBX destination to use if the agent call fails.')); ?></span></div></div></div>
    </form>
    <script>
    (function () {
        var type = document.getElementById('satellite-agent-type');
        var fields = document.querySelectorAll('.satellite-cleverai-field');
        // Show only fields used by the selected destination type.
        function updateFields() {
            for (var i = 0; i < fields.length; i++) {
                fields[i].style.display = type.value === 'cleverai' ? '' : 'none';
            }
            document.getElementById('satellite-agent-trunk').disabled = type.value !== 'cleverai';
            document.getElementById('satellite-agent-flow').disabled = type.value !== 'cleverai';
            document.getElementById('satellite-agent-trunk').required = type.value === 'cleverai';
            document.getElementById('satellite-agent-flow').required = type.value === 'cleverai';
        }
        type.addEventListener('change', updateFields);
        updateFields();
    }());
    </script>
    <?php if (!$cleveraiTrunks): ?><div class="alert alert-warning"><?php echo $escape(_('Create a CleverAI Agent Trunk before adding a CleverAI destination.')); ?></div><?php endif; ?>
    <p><a class="btn btn-default" href="config.php?display=satellite_agents&amp;tab=destinations"><?php echo $escape(_('Back to destinations')); ?></a></p>
<?php else: ?>
    <h3><?php echo $escape(_('Agent Destinations')); ?></h3>
    <p><a class="btn btn-default" href="config.php?display=satellite_agents&amp;tab=destinations&amp;view=form"><i class="fa fa-plus" aria-hidden="true"></i> <?php echo $escape(_('Add Agent Destination')); ?></a></p>
    <table class="table table-striped">
        <thead><tr><th><?php echo $escape(_('Destination')); ?></th><th><?php echo $escape(_('Agent')); ?></th><th><?php echo $escape(_('CleverAI flow')); ?></th><th><?php echo $escape(_('Status')); ?></th><th><?php echo $escape(_('Actions')); ?></th></tr></thead>
        <tbody>
        <?php foreach ($destinations as $destination): ?>
            <?php
            $id = isset($destination['id']) ? (int) $destination['id'] : 0;
            $trunkId = isset($destination['cleverai_trunk_id']) ? (int) $destination['cleverai_trunk_id'] : 0;
            $type = isset($destination['agent_type']) ? $destination['agent_type'] : 'cleverai';
            $system = !empty($destination['system_managed']);
            ?>
            <tr>
                <td><?php echo $escape(isset($destination['freepbx_name']) ? $destination['freepbx_name'] : ''); ?></td>
                <td><?php echo $escape(isset($agentLabels[$type]) ? $agentLabels[$type] : $type); ?></td>
                <td><?php echo $escape(isset($destination['cleverai_flow']) ? $destination['cleverai_flow'] : ''); ?></td>
                <td><?php echo $escape($system ? _('System') : ($type === 'cleverai' ? _('Configured') : (isset($builtinStatuses[str_replace('builtin_', '', $type)]) ? $builtinStatuses[str_replace('builtin_', '', $type)] : _('Not configured')))); ?></td>
                <td>
                    <a class="btn btn-default btn-sm" href="config.php?display=satellite_agents&amp;tab=destinations&amp;view=form&amp;id=<?php echo $id; ?>"><?php echo $escape(_('Edit')); ?></a>
                    <?php if (!$system): ?>
                    <form action="config.php?display=satellite_agents&amp;tab=destinations" method="post" style="display:inline" onsubmit="return confirm(<?php echo $escape(json_encode(_('Delete this destination?'))); ?>)">
                        <input type="hidden" name="section" value="destinations"><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?php echo $id; ?>"><?php echo $csrfField; ?>
                        <button class="btn btn-danger btn-sm" type="submit"><?php echo $escape(_('Delete')); ?></button>
                    </form>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
        <?php if (!$destinations): ?><tr><td colspan="5"><?php echo $escape(_('No Agent destinations configured.')); ?></td></tr><?php endif; ?>
        </tbody>
    </table>
<?php endif; ?>
