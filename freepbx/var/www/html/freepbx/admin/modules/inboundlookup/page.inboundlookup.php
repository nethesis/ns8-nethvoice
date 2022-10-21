<?php
#
# Copyright (C) 2017 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
$request = $_REQUEST;
$heading = _("InboundLookup");
$pageinfo = _("Resolves outgoing called numbers using MySQL query and saves them in CDR inbound_cnam field");
$content = load_view(__DIR__.'/views/form.php', array('request' => $request));
?>
<div class="container-fluid">
    <h1><?php echo $heading ?></h1>
    <div class="well well-info">
        <?php echo $pageinfo ?>
    </div>
    <div class = "display full-border">
        <div class="row">
            <div class="col-sm-12">
                <div class="fpbx-container">
                    <div class="display full-border">
                        <?php echo $content?>
                        
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
