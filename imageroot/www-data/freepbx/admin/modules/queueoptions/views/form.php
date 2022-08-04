<!--
#
#    Copyright (C) 2019 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of QueueOptions FreePBX module.
#
#    QueueOptions module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    QueueOptions module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with QueueOptions module.  If not, see <http://www.gnu.org/licenses/>.
#
-->

<form action="config.php?display=queueoptions" method="post" class="fpbx-submit" id="hwform" name="hwform" data-fpbx-delete="config.php?display=queueoptions">
<input type="hidden" name='action' value="<?php echo $_REQUEST['id']?'edit':'add' ?>">

<?php
if (isset($_REQUEST['id'])) {
    $config = \FreePBX::Queueoptions()->queueoptions_get($_REQUEST['id']);
    echo("<input type='hidden' name='id' value='".$_REQUEST['id']."'>");
} else {
    $config['name'] = _('New Queue Options');
    $config['VQ_CIDPP'] = '';
    $config['VQ_AINFO'] = '';
    $config['VQ_JOINMSG'] = '';
    $config['VQ_RETRY'] = false;
    $config['VQ_OPTIONS'] = false;
    $config['VQ_GOSUB'] = '';
    $config['VQ_AGI'] = '';
    $config['VQ_POSITION_ENABLED'] = false;
    $config['VQ_POSITION'] = 0;
    $config['VQ_CONFIRMMSG'] = '';
    $config['VQ_AANNOUNCE'] = '';
    $config['VQ_MOH'] = '';
    $config['VQ_MAXWAIT_ENABLED'] = false;
    $config['VQ_MAXWAIT'] = 0;
    $config['VQ_DEST_ENABLED'] = false;
    $config['VQ_DEST'] = 'app-blackhole,hangup,1';
    $config['DEST'] = 'app-blackhole,hangup,1';
    $config['LazyMembers'] = false;
}

?>

<div class="element-container">
    <!--NAME-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="name"><?php echo _("Name") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="name"></i>
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control" id="name" name="name" value="<?php  echo $config['name'] ?>">
            </div>
        </div>
        <div class="col-md-12">
            <span id="name-help" class="help-block fpbx-help-block"><?php echo _('This is the name of the Queueoptions instance. It is just a label and it is usefull only if you need to setup different instance with different options')?></span>
        </div>
    </div>
    <!--END NAME-->
    <!--VQ_CIDPP-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_CIDPP"><?php echo _("CID Prefix") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_AINFO"></i>
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control" id="VQ_CIDPP" name="VQ_CIDPP" value="<?php  echo $config['VQ_CIDPP'] ?>">
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_AINFO-help" class="help-block fpbx-help-block"><?php echo _('Caller ID Prefix')?></span>
        </div>
    </div>
    <!--END VQ_AINFO-->


    <!--VQ_AINFO-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_AINFO"><?php echo _("Alert Info") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_AINFO"></i>
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control" id="VQ_AINFO" name="VQ_AINFO" value="<?php  echo $config['VQ_AINFO'] ?>">
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_AINFO-help" class="help-block fpbx-help-block"><?php echo _('Alert Info')?></span>
        </div>
    </div>
    <!--END VQ_AINFO-->

    <!--VQ_JOINMSG-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_JOINMSG"><?php echo _("Join message") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_JOINMSG"></i>
            </div>
            <div class="col-md-7">
                <select class="form-control" id="VQ_JOINMSG" name="VQ_JOINMSG">
                <?php 
                    $recordings = \FreePBX::Recordings()->getAllRecordings();
                    array_unshift($recordings, array('filename'=>'','displayname'=>'--'));
                    foreach($recordings as $recording) {?>
                    <option value="<?php echo $recording['filename']?>" <?php echo ($config['VQ_JOINMSG'] == $recording['filename']) ? 'SELECTED': ''?>><?php echo $recording['displayname']?></option>
                <?php } ?>
                </select>
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_JOINMSG-help" class="help-block fpbx-help-block"><?php echo _('Queue join message')?></span>
        </div>
    </div>
    <!--END VQ_JOINMSG-->

    <!--VQ_RETRY-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_RETRY"><?php echo _("No retries on timeout") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_RETRY"></i>
            </div>
            <div class="col-md-7">
                <input type="radio" name="VQ_RETRY" id="VQ_RETRYyes" value="1" <?php echo ($config['VQ_RETRY'])?"CHECKED":""?>>
                <label for="VQ_RETRYyes"><?php echo _("Yes");?></label>
                <input type="radio" name="VQ_RETRY" id="VQ_RETRYno" value="" <?php echo ($config['VQ_RETRY'])?"":"CHECKED"?>>
                <label for="VQ_RETRYno"><?php echo _("No");?></label>
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_RETRY-help" class="help-block fpbx-help-block"><?php echo _('No retries on timeout; will exit this application and go to the next step')?></span>
        </div>
    </div>
    <!--END VQ_RETRY-->

    <!--VQ_OPTIONS-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_OPTIONS"><?php echo _("Continue on hangup") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_OPTIONS"></i>
            </div>
            <div class="col-md-7">
                <input type="radio" name="VQ_OPTIONS" id="VQ_OPTIONSyes" value="1" <?php echo ($config['VQ_OPTIONS'])?"CHECKED":""?>>
                <label for="VQ_OPTIONSyes"><?php echo _("Yes");?></label>
                <input type="radio" name="VQ_OPTIONS" id="VQ_OPTIONSno" value="" <?php echo ($config['VQ_OPTIONS'])?"":"CHECKED"?>>
                <label for="VQ_OPTIONSno"><?php echo _("No");?></label>
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_OPTIONS-help" class="help-block fpbx-help-block"><?php echo _('Continue in the dialplan if the callee hangs up')?></span>
        </div>
    </div>
    <!--END VQ_OPTIONS-->

    <!--VQ_GOSUB-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_GOSUB"><?php echo _("Go Sub") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_GOSUB"></i>
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control" id="VQ_GOSUB" name="VQ_GOSUB" value="<?php  echo $config['VQ_GOSUB'] ?>">
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_GOSUB-help" class="help-block fpbx-help-block"><?php echo _("Run a gosub on the called party's channel (the queue member) once the parties are connected.")?></span>
        </div>
    </div>
    <!--END VQ_GOSUB-->

    <!--VQ_AGI-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_AGI"><?php echo _("AGI") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_AGI"></i>
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control" id="VQ_AGI" name="VQ_AGI" value="<?php  echo $config['VQ_AGI'] ?>">
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_AGI-help" class="help-block fpbx-help-block"><?php echo _("Will setup an AGI script to be executed on the calling party's channel once they are connected to a queue member")?></span>
        </div>
    </div>
    <!--END VQ_AGI-->

    <!--VQ_POSITION_ENABLED-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_POSITION_ENABLED"><?php echo _("Set position") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_POSITION_ENABLED"></i>
            </div>
            <div class="col-md-7">
                <input type="radio" name="VQ_POSITION_ENABLED" id="VQ_POSITION_ENABLEDyes" value="1" <?php echo ($config['VQ_POSITION_ENABLED'])?"CHECKED":""?>>
                <label for="VQ_POSITION_ENABLEDyes"><?php echo _("Yes");?></label>
                <input type="radio" name="VQ_POSITION_ENABLED" id="VQ_POSITION_ENABLEDno" value="" <?php echo ($config['VQ_POSITION_ENABLED'])?"":"CHECKED"?>>
                <label for="VQ_POSITION_ENABLEDno"><?php echo _("No");?></label>
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_POSITION_ENABLED-help" class="help-block fpbx-help-block"><?php echo _('Allows to specify a position for the caller')?></span>
        </div>
    </div>
    <!--END VQ_POSITION_ENABLED-->
    <!--VQ_POSITION-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_POSITION"><?php echo _("Position") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_POSITION"></i>
            </div>
            <div class="col-md-7">
                <input type="number" min="0" max="1000" class="form-control" id="VQ_POSITION" name="VQ_POSITION" value="<?php echo $config['VQ_POSITION'] ?>">
            </div>
        </div>
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="VQ_POSITION-help" class="help-block fpbx-help-block"><?php echo _("Attempt to enter the caller into the queue at the numerical position specified")?></span>
        </div>
    </div>
    <!--END VQ_POSITION-->

    <!--VQ_CONFIRMMSG-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_CONFIRMMSG"><?php echo _("Call Confirm Announce") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_CONFIRMMSG"></i>
            </div>
            <div class="col-md-7">
                <select class="form-control" id="VQ_CONFIRMMSG" name="VQ_CONFIRMMSG">
                <?php 
                    $recordings = \FreePBX::Recordings()->getAllRecordings();
                    array_unshift($recordings, array('filename'=>'','displayname'=>'--'));
                    foreach($recordings as $recording) {?>
                    <option value="<?php echo $recording['filename']?>" <?php echo ($config['VQ_CONFIRMMSG'] == $recording['filename']) ? 'SELECTED': ''?>><?php echo $recording['displayname']?></option>
                <?php } ?>
                </select>
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_CONFIRMMSG-help" class="help-block fpbx-help-block"><?php echo _('Call Confirm Announce')?></span>
        </div>
    </div>
    <!--END VQ_CONFIRMMSG-->

    <!--VQ_AANNOUNCE-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_AANNOUNCE"><?php echo _("Agent announce") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_AANNOUNCE"></i>
            </div>
            <div class="col-md-7">
                <select class="form-control" id="VQ_AANNOUNCE" name="VQ_AANNOUNCE">
                <?php 
                    $recordings = \FreePBX::Recordings()->getAllRecordings();
                    array_unshift($recordings, array('filename'=>'','displayname'=>'--'));
                    foreach($recordings as $recording) {?>
                    <option value="<?php echo $recording['filename']?>" <?php echo ($config['VQ_AANNOUNCE'] == $recording['filename']) ? 'SELECTED': ''?>><?php echo $recording['displayname']?></option>
                <?php } ?>
                </select>
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_AANNOUNCE-help" class="help-block fpbx-help-block"><?php echo _('Agent announce overrides the announcement that is played to the queue agent before they’re bridged to the caller')?></span>
        </div>
    </div>
    <!--END VQ_AANNOUNCE-->

    <!--VQ_MOH-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_MOH"><?php echo _("Music on hold") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_MOH"></i>
            </div>
            <div class="col-md-7">
                <select class="form-control" id="VQ_MOH" name="VQ_MOH">
                <?php 
                    $musicCategories = \FreePBX::Music()->getCategories();
                    array_unshift($musicCategories, array('category'=>'','categorydisplay'=>'--'));
                    foreach($musicCategories as $category) {?>
                    <option value="<?php echo $category['category']?>" <?php echo ($config['VQ_MOH'] == $category['category']) ? 'SELECTED': ''?>><?php echo (isset($category['categorydisplay'])) ? $category['categorydisplay'] : $category['category']?></option>
                <?php } ?>
                </select>
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_MOH-help" class="help-block fpbx-help-block"><?php echo _('Overrides music on hold category')?></span>
        </div>
    </div>
    <!--END VQ_MOH-->

    <!--END VQ_MAXWAIT_ENABLED-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_MAXWAIT_ENABLED"><?php echo _("Set max wait override") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_MAXWAIT_ENABLED"></i>
            </div>
            <div class="col-md-7">
                <input type="radio" name="VQ_MAXWAIT_ENABLED" id="VQ_MAXWAIT_ENABLEDyes" value="1" <?php echo ($config['VQ_MAXWAIT_ENABLED'])?"CHECKED":""?>>
                <label for="VQ_MAXWAIT_ENABLEDyes"><?php echo _("Yes");?></label>
                <input type="radio" name="VQ_MAXWAIT_ENABLED" id="VQ_MAXWAIT_ENABLEDno" value="" <?php echo ($config['VQ_MAXWAIT_ENABLED'])?"":"CHECKED"?>>
                <label for="VQ_MAXWAIT_ENABLEDno"><?php echo _("No");?></label>
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_MAXWAIT_ENABLED-help" class="help-block fpbx-help-block"><?php echo _('Allows to override queue maxwait')?></span>
        </div>
    </div>
    <!--END VQ_MAXWAIT_ENABLED-->

    <!--VQ_MAXWAIT-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_MAXWAIT"><?php echo _("Max wait") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_MAXWAIT"></i>
            </div>
            <div class="col-md-7">
                <input type="number" min="0" max="1000" class="form-control" id="VQ_MAXWAIT" name="VQ_MAXWAIT" value="<?php echo $config['VQ_MAXWAIT'] ?>">
            </div>
        </div>
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="VQ_MAXWAIT-help" class="help-block fpbx-help-block"><?php echo _("Override queue max waiting time")?></span>
        </div>
    </div>
    <!--END VQ_MAXWAIT-->

    <!--END VQ_DEST_ENABLED-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_DEST_ENABLED"><?php echo _("Override fail destination") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_DEST_ENABLED"></i>
            </div>
            <div class="col-md-7">
                <input type="radio" name="VQ_DEST_ENABLED" id="VQ_DEST_ENABLEDyes" value="1" <?php echo ($config['VQ_DEST_ENABLED'])?"CHECKED":""?>>
                <label for="VQ_DEST_ENABLEDyes"><?php echo _("Yes");?></label>
                <input type="radio" name="VQ_DEST_ENABLED" id="VQ_DEST_ENABLEDno" value="" <?php echo ($config['VQ_DEST_ENABLED'])?"":"CHECKED"?>>
                <label for="VQ_DEST_ENABLEDno"><?php echo _("No");?></label>
            </div>
        </div>
        <div class="col-md-12">
            <span id="VQ_DEST_ENABLED-help" class="help-block fpbx-help-block"><?php echo _('Allows to override destination on fail')?></span>
        </div>
    </div>
    <!--END VQ_DEST_ENABLED-->
    <!--VQ_DEST-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="VQ_DEST"><?php echo _("Fail destination") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="VQ_DEST"></i>
            </div>
            <div class="col-md-7">
                <?php echo drawselects($config['VQ_DEST'],'VQ_DEST',false,false)?>
            </div>
        </div>
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="VQ_DEST-help" class="help-block fpbx-help-block"><?php echo _("Destination on fail")?></span>
        </div>
    </div>
    <!--END VQ_DEST-->

    <!--DEST-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="DEST"><?php echo _("Destionation Queue") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="DEST"></i>
            </div>
            <div class="col-md-7">
                <select class="form-control" id="DEST" name="DEST">
                <?php
                    $queues = \FreePBX::Queues()->listQueues(false);
                    foreach( $queues as $queue ) {?>
                        <option value="<?php echo 'ext-queues,'.$queue[0].',1'?>" <?php echo ($config['DEST'] == 'ext-queues,'.$queue[0].',1') ? 'SELECTED': ''?>> <?php echo $queue[0].' - '. $queue[1]?></option>
                    <?php } ?>
                </select>

            </div>
        </div>
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="DEST-help" class="help-block fpbx-help-block"><?php echo _("The destination queue")?></span>
        </div>
    </div>
    <!--END DEST-->
</div>
</form>
