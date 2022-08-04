<!--
#
#    Copyright (C) 2019 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of Pin FreePBX module.
#
#    Pin module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    Pin module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with Pin module.  If not, see <http://www.gnu.org/licenses/>.
#
-->

<form action="config.php?display=pin" method="post" class="fpbx-submit" id="hwform" name="hwform" data-fpbx-delete="config.php?display=pin">
<input type="hidden" name='action' value="<?php echo $_REQUEST['extension']?'edit':'add' ?>">

<?php

if (isset($_REQUEST['extension'])) {
    $config = \FreePBX::Pin()->pin_get($_REQUEST['extension']);
} else {
    $pins = \FreePBX::Pin()->pin_get();
    $avail = array();
    foreach (\FreePBX::Core()->getAllUsersByDeviceType() as $extension) {
        if (!isset($pins[$extension['extension']])) {
            $avail[] = array('extension' => $extension['extension'], 'name' => $extension['name']);
        }
    }
    $config['extension'] = isset($avail[0]) ? $avail[0]['extension'] : '' ;
    $config['pin'] = rand(0,9999);
    while (strlen($config['pin'] < 4))  $config['pin'] = '0'.$config['pin']; 
    $config['enabled'] = 1;
}

?>
<div class="element-container">
    <!--extension-->
       <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="extension"><?php echo _("Extension") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="extension"></i>
            </div>
            <div class="col-md-7">
                <?php
                    if (isset($_REQUEST['extension'])) {
                        // Edit existing
                        echo '<input type="text" class="form-control" id="extension" name="extension" value="'.$config['extension'].'" readonly>';
                    } else {
                        echo '<select class="form-control" id="extension" name="extension">';
                        foreach($avail as $extension) {
                            echo '<option value="'.$extension['extension'].'" '.($config['extension'] == $extension['extension'] ? 'SELECTED': '').'>'.$extension['extension']. ' - ' . $extension['name'].'</option>';
                        }
                        echo '</select>';
                    }?>
            </div>
        </div>
        <div class="col-md-12">
            <span id="extension-help" class="help-block fpbx-help-block"><?php echo _('Extension')?></span>
        </div>
    </div>
    <!--END extension-->
    <!--PIN-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="pin"><?php echo _("Pin") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="pin"></i>
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control" id="pin" name="pin" value="<?php  echo $config['pin'] ?>">
            </div>
        </div>
        <div class="col-md-12">
            <span id="pin-help" class="help-block fpbx-help-block"><?php echo _('This is the pin. Only numerical values are accepted')?></span>
        </div>
    </div>
    <!--END PIN-->
    <!--enabled-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="enabled"><?php echo _("Enabled") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="enabled"></i>
            </div>
            <div class="col-md-7">
                <input type="radio" name="enabled" id="enabledyes" value="1" <?php echo ($config['enabled'])?"CHECKED":""?>>
                <label for="enabledyes"><?php echo _("Yes");?></label>
                <input type="radio" name="enabled" id="enabledno" value="" <?php echo ($config['enabled'])?"":"CHECKED"?>>
                <label for="enabledno"><?php echo _("No");?></label>
            </div>
        </div>
        <div class="col-md-12">
            <span id="enabled-help" class="help-block fpbx-help-block"><?php echo _('Enable pin for this extension')?></span>
        </div>
    </div>
    <!--END enabled-->
</div>
</form>
