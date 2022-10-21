<!--
#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of RapidCode FreePBX module.
#
#    RapidCode module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any
#    later version.
#
#    RapidCode module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with RapidCode module.  If not, see <http://www.gnu.org/licenses/>.
#
-->

<form action="config.php?display=rapidcode&action=importcsv" method="post" class="fpbx-submit" id="hwform" name="hwform" enctype="multipart/form-data">
<input type="hidden" name='action' value="importcsv">

<div class="element-container">
<!--UPLOAD-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-3">
                <label class="control-label" for="fileupload"><?php echo _("Browse") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="fileupload"></i>
            </div>
            <div class="col-md-9">
                <span class="btn btn-default btn-file"> <?php echo _("Browse")?>
                    <input id="fileupload" type="file" class="form-control" name="csvfile" class="form-control">
                </span>
            </div>
        </div>
    </div>
    <div class="row">
        <div class="col-md-12">
            <span id="fileupload-help" class="help-block fpbx-help-block"><?php echo _("Upload a CSV file")?></span>
        </div>
    </div>
    <div class="row">
        <div class="form-group">
            <div class="col-md-3">
                <span id="filenamelabel" style="display:none;"><?php echo _("Filename:")?></span>
            </div>
            <div class="col-md-9">
                <span id="filename"></span>
            </div>
        </div>
    </div>
<!--END UPLOAD-->
</div>

</form>


