<?php
$escape = function ($value) {
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
};
$tab = $tab === 'trunks' ? 'trunks' : 'destinations';
?>
<div class="container-fluid">
    <h2><?php echo $escape(_('Satellite Agent')); ?></h2>
    <?php if (!empty($error)): ?>
        <div class="alert alert-danger" role="alert"><?php echo $escape($error); ?></div>
    <?php endif; ?>
    <?php if (!empty($notice)): ?>
        <div class="alert alert-success" role="status"><?php echo $escape($notice); ?></div>
    <?php endif; ?>

    <ul class="nav nav-tabs" id="satellite-agent-tabs" role="tablist">
        <li role="presentation" class="<?php echo $tab === 'destinations' ? 'active' : ''; ?>">
            <a href="<?php echo $formMode ? 'config.php?display=satellite_agents&amp;tab=destinations' : '#satellite-destinations'; ?>" role="tab" aria-controls="satellite-destinations" aria-selected="<?php echo $tab === 'destinations' ? 'true' : 'false'; ?>"<?php echo $formMode ? '' : ' data-toggle="tab" data-satellite-tab="destinations"'; ?>><?php echo $escape(_('CleverAI Destinations')); ?></a>
        </li>
        <li role="presentation" class="<?php echo $tab === 'trunks' ? 'active' : ''; ?>">
            <a href="<?php echo $formMode ? 'config.php?display=satellite_agents&amp;tab=trunks' : '#satellite-trunks'; ?>" role="tab" aria-controls="satellite-trunks" aria-selected="<?php echo $tab === 'trunks' ? 'true' : 'false'; ?>"<?php echo $formMode ? '' : ' data-toggle="tab" data-satellite-tab="trunks"'; ?>><?php echo $escape(_('Agent Trunks')); ?></a>
        </li>
    </ul>
    <div class="tab-content display">
        <div role="tabpanel" class="tab-pane<?php echo $tab === 'destinations' ? ' active' : ''; ?>" id="satellite-destinations">
            <?php echo $destinationsContent; ?>
        </div>
        <div role="tabpanel" class="tab-pane<?php echo $tab === 'trunks' ? ' active' : ''; ?>" id="satellite-trunks">
            <?php echo $trunksContent; ?>
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
