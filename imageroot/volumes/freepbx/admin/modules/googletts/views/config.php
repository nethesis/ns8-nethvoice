<!--
#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of GoogleTTS FreePBX module.
#
#    GoogleTTS module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    GoogleTTS module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with GoogleTTS module.  If not, see <http://www.gnu.org/licenses/>.
#
-->

<?php
$options = googletts_get_options();
$google_api_key = $options['API_KEY'];
?>


<form action="config.php?display=googletts" method="post" class="fpbx-submit" id="hwform" name="hwform">
<input type="hidden" name="display" value="googletts">
<input type="hidden" name="action" value="saveapikey">


<!--API KEY-->
<div class="element-container">
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="google_api_key"><?php echo _("Google API Key") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="google_api_key"></i>
            </div>
            <div class="col-md-7">
                <input id="google_api_key" type="text" class="form-control" name="google_api_key" value="<?php echo $google_api_key?>">
            </div>
        </div>
        <div class="col-md-12">
            <span id="google_api_key-help" class="help-block fpbx-help-block"><?php echo _('Your Google API Key to use TTS API. https://cloud.google.com/docs/authentication/api-keys#creating_an_api_key')?></span>
        </div>
    </div>
</div>
<!--END API KEY-->

</form>
