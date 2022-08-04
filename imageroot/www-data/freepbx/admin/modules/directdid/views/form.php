<!--
#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of DirectDID FreePBX module.
#
#    DirectDID module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    DirectDID module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with DirectDID module.  If not, see <http://www.gnu.org/licenses/>.
#
-->

<form action="config.php?display=directdid" method="post" class="fpbx-submit" id="hwform" name="hwform" data-fpbx-delete="config.php?display=directdid">
<input type="hidden" name='action' value="<?php echo $_REQUEST['id']?'edit':'add' ?>">

<?php
if (isset($_REQUEST['id'])) {
    $config = directdid_get_details($_REQUEST['id']);
    echo("<input type='hidden' name='id' value='".$_REQUEST['id']."'>");
} else {
    $config['timeout'] = 15;
    $config['timeout_destination'] = 'app-blackhole,hangup,1';
    $config['busy_destination'] = 'app-blackhole,hangup,1';
    $config['unavailable_destination'] = 'app-blackhole,hangup,1';
    $config['root'] = '';
    //guess prefix and varlength searching in ext list
    try {
        $extensions = \FreePBX::Core()->getAllUsers();
        $extensions = array_keys($extensions);
        $extarr = array();
        foreach ($extensions as $i => $ext) {
            if (preg_match('/^9...*/',$ext)) {
                continue;
            }
            $extarr[] = substr($ext,0,1);
            $sumlen += strlen($ext) ;
        }
        $avglen = $sumlen / count($extarr);
        $count=array_count_values($extarr);
        arsort($count);
        $keys=array_keys($count);
        $config['prefix'] = (int) $keys[0];
        $config['varlength'] = round($avglen-1);
    } catch (Exception $e) {
        $config['prefix'] = '2';
        $config['varlength'] = 2;
    }
}

?>

<div class="element-container">
    <!--ROOT-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="root"><?php echo _("DID Root") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="root"></i>
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control" id="root" name="root" value="<?php  echo $config['root'] ?>">
            </div>
        </div>
        <div class="col-md-12">
            <span id="root-help" class="help-block fpbx-help-block"><?php echo _('This is the root of the directdid. If DID is _12345678XX, root is _12345678. This field is just a useful lable, can be empty and is not important for the overall operation')?></span>
        </div>
    </div>
    <!--END ROOT-->
    <!--VARLENGTH-->
     <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="varlength"><?php echo _("Variable Length") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="varlength"></i>
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control" id="varlength" name="varlength" value="<?php  echo $config['varlength'] ?>">
            </div>
        </div>
        <div class="col-md-12">
            <span id="varlength-help" class="help-block fpbx-help-block"><?php echo _('This is the number of digit that are variable in the DID and correspond to the number of "X" in the DID. If the DID is _12345678XX, Variable length is 2')?></span>
        </div>
    </div>
    <!--END VARLENGTH-->
    <!--PREFIX-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="prefix"><?php echo _("Extension Prefix") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="prefix"></i>
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control" id="prefix" name="prefix" value="<?php echo $config['prefix'] ?>">
            </div>
        </div>
        <div class="col-md-12">
            <span id="prefix-help" class="help-block fpbx-help-block"><?php echo _('This is the number to prepend to the variable to obtain the extension number. If DID is _12345678XX, and 3 digit extensions are used with extension number 2XX, Extension Prefix is 2. If variable is 2 and extensions are of two digit, this field is empty')?></span>
        </div>
    </div>

    <!--END PREFIX-->
    <!--TIMEOUT-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="timeout"><?php echo _("Timeout") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="timeout"></i>
            </div>
            <div class="col-md-7">
                <input type="number" min="5" max="60" class="form-control" id="timeout" name="timeout" value="<?php echo $config['timeout'] ?>">
            </div>
        </div>    
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="timeout-help" class="help-block fpbx-help-block"><?php echo _("Ringing timeout before going to timeout destination. Minimum value: 5 Maximum value: 60")?></span>
        </div>
    </div>
    <!--TIMEOUT END-->
<?php
// implementation of module hook
$module_hook = \moduleHook::create();
echo $module_hook->hookHtml;
?>

    <!--TIMEOUT DESTINATION-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="timeout_destination"><?php echo _("Timeout Destination") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="timeout_destination"></i>
            </div>
            <div class="col-md-7">
                <?php echo drawselects($config['timeout_destination'],'timeout_destination',false,false)?>
            </div>
        </div>    
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="timeout_destination-help" class="help-block fpbx-help-block"><?php echo _("Destination when timeout is reached")?></span>
        </div>
    </div>
    <!--END TIMEOUT DESTINATION-->
    <!--BUSY DESTINATION-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4"///>
                <label class="control-label" for="busy_destination"><?php echo _("Busy Destination") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="busy_destination"></i>
            </div>
            <div class="col-md-7">
                <?php echo drawselects($config['busy_destination'],'busy_destination',false,false)?>
            </div>
        </div>    
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="busy_destination-help" class="help-block fpbx-help-block"><?php echo _("Destination if destination is busy")?></span>
        </div>
    </div>
    <!--END BUSY DESTINATION-->
    <!--UNAVAILABLE DESTINATION-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="unvailable_destination"><?php echo _("Unavailable Destination") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="unavailable_destination"></i>
            </div>
            <div class="col-md-7">
                <?php echo drawselects($config['unavailable_destination'],'unavailable_destination',false,false)?>
            </div>
        </div>    
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="unavailable_destination-help" class="help-block fpbx-help-block"><?php echo _("Destination if destination is unavailable")?></span>
        </div>
    </div>
    <!--END UNAVAILABLE DESTINATION-->
</div>
</form>
