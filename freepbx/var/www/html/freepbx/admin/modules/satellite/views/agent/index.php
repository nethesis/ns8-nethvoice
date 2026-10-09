<?php
$escape = function ($value) {
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
};
$tab = in_array($tab, array('destinations', 'trunks', 'internal', 'external'), true) ? $tab : 'destinations';
?>
<div class="container-fluid">
    <h2><?php echo $escape(_('Satellite Agent')); ?></h2>
    <p><a class="btn btn-default" href="/freepbx/wizard/#!/agents"><?php echo $escape(_('Agent monitoring')); ?></a></p>
    <?php if (!empty($error)): ?>
        <div class="alert alert-danger" role="alert"><?php echo $escape($error); ?></div>
    <?php endif; ?>
    <?php if (!empty($notice)): ?>
        <div class="alert alert-success" role="status"><?php echo $escape($notice); ?></div>
    <?php endif; ?>
    <?php if (!empty($warning)): ?>
        <div class="alert alert-warning" role="alert"><?php echo $escape($warning); ?></div>
    <?php endif; ?>
    <?php if (!empty($syncStatus)): ?>
        <div class="alert alert-info" role="status"><?php echo $escape($syncStatus); ?></div>
    <?php endif; ?>

    <ul class="nav nav-tabs" id="satellite-agent-tabs" role="tablist">
        <li role="presentation" class="<?php echo $tab === 'destinations' ? 'active' : ''; ?>">
            <a href="<?php echo $formMode ? 'config.php?display=satellite_agents&amp;tab=destinations' : '#satellite-destinations'; ?>" role="tab" aria-controls="satellite-destinations" aria-selected="<?php echo $tab === 'destinations' ? 'true' : 'false'; ?>"<?php echo $formMode ? '' : ' data-toggle="tab" data-satellite-tab="destinations"'; ?>><?php echo $escape(_('Destinations')); ?></a>
        </li>
        <li role="presentation" class="<?php echo $tab === 'trunks' ? 'active' : ''; ?>">
            <a href="<?php echo $formMode ? 'config.php?display=satellite_agents&amp;tab=trunks' : '#satellite-trunks'; ?>" role="tab" aria-controls="satellite-trunks" aria-selected="<?php echo $tab === 'trunks' ? 'true' : 'false'; ?>"<?php echo $formMode ? '' : ' data-toggle="tab" data-satellite-tab="trunks"'; ?>><?php echo $escape(_('Agent Trunks')); ?></a>
        </li>
        <?php foreach (array('internal' => _('Builtin Internal'), 'external' => _('Builtin External')) as $profileTab => $label): ?>
        <li role="presentation" class="<?php echo $tab === $profileTab ? 'active' : ''; ?>">
            <a href="config.php?display=satellite_agents&amp;tab=<?php echo $profileTab; ?>" role="tab" aria-controls="satellite-<?php echo $profileTab; ?>" aria-selected="<?php echo $tab === $profileTab ? 'true' : 'false'; ?>"><?php echo $escape($label); ?></a>
        </li>
        <?php endforeach; ?>
    </ul>
    <div class="tab-content display">
        <div role="tabpanel" class="tab-pane<?php echo $tab === 'destinations' ? ' active' : ''; ?>" id="satellite-destinations">
            <?php echo $destinationsContent; ?>
        </div>
        <div role="tabpanel" class="tab-pane<?php echo $tab === 'trunks' ? ' active' : ''; ?>" id="satellite-trunks">
            <?php echo $trunksContent; ?>
        </div>
        <div role="tabpanel" class="tab-pane<?php echo $tab === 'internal' ? ' active' : ''; ?>" id="satellite-internal">
            <?php echo $internalContent; ?>
        </div>
        <div role="tabpanel" class="tab-pane<?php echo $tab === 'external' ? ' active' : ''; ?>" id="satellite-external">
            <?php echo $externalContent; ?>
        </div>
    </div>
</div>
<?php if (!$formMode): ?>
<script>
(function ($) {
    $('#satellite-agent-tabs a[data-toggle="tab"]').on('shown.bs.tab', function () {
        var tab = $(this).attr('data-satellite-tab');
        var url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.replaceState(null, '', url.toString());
        $('#satellite-agent-tabs a[role="tab"]').attr('aria-selected', 'false');
        $(this).attr('aria-selected', 'true');
    });
}(jQuery));
</script>
<?php endif; ?>
