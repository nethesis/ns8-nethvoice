<?php

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

function queueoptions_destinations() {
    global $amp_conf;
    $results = \FreePBX::Queueoptions()->queueoptions_get();
    if (isset($results)) {
	foreach($results as $queue) {
            $x = '';
	    $extens[] = array('destination' => 'queueoptions-'.$queue['id'].',s,1','description' => $queue['name'], 'category' => 'QueueOptions', 'id' => $queue['id'],'edit_url' => 'config.php?display=queueoptions&view=form&id='.$queue['id']);
	}
        return $extens;
    }
}

function queueoptions_getdestinfo($dest) {
    global $active_modules;
    if (substr(trim($dest),0,14 == 'queueoptions-')) {
        $id = preg_replace('/queueoptions-([0-9]*),.*/','${1}',$dest);
        return array('description' => "QueueOptions", 'edit_url' => 'config.php?display=queueoptions&view=form&id='.$id);
    }
    return array('description' => "QueueOptions", 'edit_url' => 'config.php?display=queueoptions');
}

// provide hook for queue module
function queueoptions_hook_queues($viewing_itemid, $target_menuid) {
    if ($target_menuid != 'queues' or $_REQUEST['view'] != 'form' or !isset($_REQUEST['extdisplay'])) {
        return false;
    }
    $dbh = \FreePBX::Database();
    $sql = 'SELECT `data` FROM `queues_details` WHERE `id` = ? AND `keyword` = "lazymembers"';
    $sth = $dbh->prepare($sql);
    $sth->execute(array(
        $viewing_itemid,
    ));
    $res = $sth->fetchAll(\PDO::FETCH_ASSOC)[0]['data'];
    if ($res === "yes") {
        $enabled = TRUE;
    } else {
        $enabled = FALSE;
    }
    $hookhtml = '
                <!--LazyMembers HOOK-->
                <div class="row">
                <div class="form-group">
                    <div class="col-md-3">
                        <label class="control-label" for="LazyMembers">'._("Enable Lazy Members for this queue").'</label>
                        <i class="fa fa-question-circle fpbx-help-icon" data-for="LazyMembers"></i>
                    </div>
                    <div class="col-md-9">
                        <span class="radioset">
                        <input type="radio" name="LazyMembers" id="LazyMembersyes" value="1" '.($enabled ? "CHECKED" : "").'>
                        <label for="LazyMembersyes">'._("Yes").'</label>
                        <input type="radio" name="LazyMembers" id="LazyMembersno" value="" '.($enabled ? "" : "CHECKED").'>
                        <label for="LazyMembersno">'._("No").'</label>
                        </span>
                    </div>
                    </div>
                    <div class="col-md-12">
                        <span id="LazyMembers-help" class="help-block fpbx-help-block">'._("If enabled, mark user as unavailable for current call if he doesn't answer").'</span>
                    </div>
                    </div>
                <!--END LazyMembers HOOK-->';
            return $hookhtml;
}

