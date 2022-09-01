<?php

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

// provide hook for routing
function pin_hook_core($viewing_itemid, $target_menuid) {
    if ($target_menuid != 'routing' or $_REQUEST['view'] != 'form') {
        return false;
    }
    $dbh = \FreePBX::Database();
    $sql = 'SELECT `enabled` FROM `pin_protected_routes` WHERE `route_id` = ?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array(
        $_REQUEST['id'],
    ));
    $enabled = $sth->fetchAll(\PDO::FETCH_ASSOC)[0]['enabled'];
    $hookhtml = '
                <!--PIN HOOK-->
                <div class="row">
                <div class="form-group">
                    <div class="col-md-3">
                        <label class="control-label" for="EnablePIN">'._("Enable User PIN for this route").'</label>
                        <i class="fa fa-question-circle fpbx-help-icon" data-for="EnablePIN"></i>
                    </div>
                    <div class="col-md-9">
                        <span class="radioset">
                        <input type="radio" name="EnablePIN" id="EnablePINyes" value="1" '.($enabled ? "CHECKED" : "").'>
                        <label for="EnablePINyes">'._("Yes").'</label>
                        <input type="radio" name="EnablePIN" id="EnablePINno" value="" '.($enabled ? "" : "CHECKED").'>
                        <label for="EnablePINno">'._("No").'</label>
                        </span>
                    </div>
                    </div>
                    <div class="col-md-12">
                        <span id="EnablePIN-help" class="help-block fpbx-help-block">'._('Enable User PIN for this route. Custom PINs are configurable on pin module page').'</span>
                    </div>
                    </div>
                <!--END PIN HOOK-->';
            return $hookhtml;
}


