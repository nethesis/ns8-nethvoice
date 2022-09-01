
<a href="config.php?display=parking" class="list-group-item"><?php echo _('Overview') ?></a>
        <?php foreach($lots as $l) {?>
<a href="config.php?display=parking&amp;id=<?php echo $l['id']?>&amp;action=modify" class="list-group-item"><?php echo $l['defaultlot'] == 'yes' ? '<strong>[D]</strong> ' : ''?><?php echo $l['name']?></a>
        <?php } ?>
