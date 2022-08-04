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

<form action="config.php?display=googletts" method="post" class="fpbx-submit" id="hwform" name="hwform" onsubmit="return checkForm(hwform);">
<input type="hidden" name="display" value="googletts">
<input type="hidden" name="action" value="add">

<div class="element-container">
    <!--NAME-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="name"><?php echo _("Name") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="name"></i>
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control" id="name" name="name" value="">
            </div>
        </div>
        <div class="col-md-12">
            <span id="name-help" class="help-block fpbx-help-block"><?php echo _('The name of the system recording on the file system. If it conflicts with another file then this will overwrite it.')?></span>
        </div>
    </div>
    <!--END NAME-->

    <!--DESCRIPTION-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="description"><?php echo _("Description") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="description"></i>
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control" id="description" name="description" value="">
            </div>
        </div>
        <div class="col-md-12">
            <span id="description-help" class="help-block fpbx-help-block"><?php echo _('Describe this recording')?></span>
        </div>
    </div>
    <!--END DESCRIPTION-->

    <!--LANGUAGE-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="language"><?php echo _("Language") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="language"></i>
            </div>
            <div class="col-md-7">
                <select class="form-control" id="language" name="language">
                <?php $SoundLang = FreePBX::Soundlang();?>
                <?php foreach($SoundLang->getLanguages() as $code => $lang) {?>
                    <option value="<?php echo $code?>" <?php echo ($code == $SoundLang->getLanguage()) ? 'SELECTED': ''?>><?php echo $lang?></option>
                <?php } ?>
                </select>
            </div>
        </div>
        <div class="col-md-12">
            <span id="language-help" class="help-block fpbx-help-block"><?php echo _('Language of recording')?></span>
        </div>
    </div>
    <!--END LANGUAGE-->

    <!--VOICE-->
    <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="voice"><?php echo _("Voice") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="voice"></i>
            </div>
            <div class="col-md-7">
                <select class="form-control" id="voice" name="voice">
                <?php foreach(googletts_getAvailableVoices($SoundLang->getLanguages()) as $voice) {?>
                    <option value="<?php echo $voice[1]?>" <?php echo (substr($voice[0],0,2)==$SoundLang->getLanguage() && strpos($voice[1],'Wavenet') !== FALSE ) ? 'SELECTED': ''?>><?php echo $voice[1].' ('._(strtolower($voice[2])).')'?></option>
                <?php } ?>
                </select>
            </div>
        </div>
        <div class="col-md-12">
            <span id="voice-help" class="help-block fpbx-help-block"><?php echo _('Choose voice that will read the message. Wavenet voices has better quality')?></span>
        </div>
    </div>
    <!--END VOICE-->

    <!--TEXT-->
        <div class="row">
        <div class="form-group">
            <div class="col-md-4">
                <label class="control-label" for="text"><?php echo _("Text") ?></label>
                <i class="fa fa-question-circle fpbx-help-icon" data-for="text"></i>
            </div>
            <div class="col-md-7">
                <input type="textarea" class="form-control" id="text" name="text" value="">
            </div>
        </div>
        <div class="col-md-12">
            <span id="text-help" class="help-block fpbx-help-block"><?php echo _('Text to read')?></span>
        </div>
    </div>
    <!--END TEXT-->

    <!--TRY-->
        <!-- TODO -->
    <!--END TRY-->

</div>
</form>

