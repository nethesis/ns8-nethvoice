<!--
#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of QueueExit FreePBX module.
#
#    QueueExit module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    QueueExit module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with QueueExit module.  If not, see <http://www.gnu.org/licenses/>.
#
-->

<form action="config.php?display=queueexit" method="post" class="fpbx-submit" id="hwform" name="hwform" data-fpbx-delete="config.php?display=queueexit">
<input type="hidden" name='action' value="<?php echo $_REQUEST['id']?'edit':'add' ?>">

<?php
if (isset($_REQUEST['id'])) {
    $config = queueexit_get_details($_REQUEST['id']);
    echo("<input type='hidden' name='id' value='".$_REQUEST['id']."'>");
} else {
    $config['displayname'] = '';
    $config['timeout_destination'] = 'app-blackhole,hangup,1';
    $config['full_destination'] = 'app-blackhole,hangup,1';
    $config['joinempty_destination'] = 'app-blackhole,hangup,1';
    $config['leaveempty_destination'] = 'app-blackhole,hangup,1';
    $config['joinunavail_destination'] = 'app-blackhole,hangup,1';
    $config['leaveunavail_destination'] = 'app-blackhole,hangup,1';
    $config['continue_destination'] = 'app-blackhole,hangup,1';
}

?>

<div class="element-container">
    <!--DISPLAYNAME-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="displayname"><?php echo _("Name") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="displayname"></i>
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control" id="displayname" name="displayname" value="<?php  echo $config['displayname'] ?>">
            </div>
        </div>
        <div class="col-md-12">
            <span id="displayname-help" class="help-block fpbx-help-block"><?php echo _('Give this Queue Exit a brief name to help you identify it.')?></span>
        </div>
    </div>
    <!--END DISPLAYNAME-->
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
            <span id="timeout_destination-help" class="help-block fpbx-help-block"><?php echo _("Destination when call leave the queue because has reached maximum waiting time")?></span>
        </div>
    </div>
    <!--END TIMEOUT DESTINATION-->
    <!--FULL DESTINATION-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="full_destination"><?php echo _("Full Destination") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="full_destination"></i>
            </div>
            <div class="col-md-7">
                <?php echo drawselects($config['full_destination'],'full_destination',false,false)?>
            </div>
        </div>    
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="full_destination-help" class="help-block fpbx-help-block"><?php echo _("Destination when call leave because queue has reached maximum number of waiting calls")?></span>
        </div>
    </div>
    <!--END FULL DESTINATION-->
    <!--JOINEMPTY DESTINATION-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="joinempty_destination"><?php echo _("Joinempty Destination") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="joinempty_destination"></i>
            </div>
            <div class="col-md-7">
                <?php echo drawselects($config['joinempty_destination'],'joinempty_destination',false,false)?>
            </div>
        </div>    
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="joinempty_destination-help" class="help-block fpbx-help-block"><?php echo _("Destination when call leave the queue because there wasn't any agent")?></span>
        </div>
    </div>
    <!--END JOINEMPTY DESTINATION-->
    <!--LEAVEEMPTY DESTINATION-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="leaveempty_destination"><?php echo _("Leaveempty Destination") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="leaveempty_destination"></i>
            </div>
            <div class="col-md-7">
                <?php echo drawselects($config['leaveempty_destination'],'leaveempty_destination',false,false)?>
            </div>
        </div>    
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="leaveempty_destination-help" class="help-block fpbx-help-block"><?php echo _("Destination when call leave the queue because during the waiting all available agent logged off")?></span>
        </div>
    </div>
    <!--END LEAVEEMPTY DESTINATION-->
    <!--JOINUNAVAIL DESTINATION-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="joinunavail_destination"><?php echo _("Joinunavail Destination") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="joinunavail_destination"></i>
            </div>
            <div class="col-md-7">
                <?php echo drawselects($config['joinunavail_destination'],'joinunavail_destination',false,false)?>
            </div>
        </div>    
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="joinunavail_destination-help" class="help-block fpbx-help-block"><?php echo _("Destination when call leave the queue because there wasn't available agents")?></span>
        </div>
    </div>
    <!--END JOINUNAVAIL DESTINATION-->
    <!--LEAVEUNAVAIL DESTINATION-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="leaveunavail_destination"><?php echo _("Leaveunavail Destination") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="leaveunavail_destination"></i>
            </div>
            <div class="col-md-7">
                <?php echo drawselects($config['leaveunavail_destination'],'leaveunavail_destination',false,false)?>
            </div>
        </div>    
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="leaveunavail_destination-help" class="help-block fpbx-help-block"><?php echo _("Destination when call leave the queue because during the waiting all available agents changed status")?></span>
        </div>
    </div>
    <!--END LEAVEUNAVAIL DESTINATION-->
    <!--CONTINUE DESTINATION-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="continue_destination"><?php echo _("Continue Destination") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="continue_destination"></i>
            </div>
            <div class="col-md-7">
                <?php echo drawselects($config['continue_destination'],'continue_destination',false,false)?>
            </div>
        </div>    
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="continue_destination-help" class="help-block fpbx-help-block"><?php echo _("Destination when CONTINUE is value of QUEUESTATUS")?></span>
        </div>
    </div>
    <!--END CONTINUE DESTINATION-->
</div>
</form>
