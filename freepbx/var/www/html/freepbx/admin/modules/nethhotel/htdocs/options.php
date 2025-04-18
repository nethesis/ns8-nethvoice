<?php
 require_once("config.inc.php");
 require_once("session.inc.php");
 require_once("utils.inc.php");
 require_once("functions.inc.php");
 require("translations.php");

 printHeader (_("Management rooms"),("options.js"));
 printTitle (_("Management rooms"), _("Options"));
?>
<div id='contentPane'>
<?php
 printMenu($sections,OPTIONS);

 $options = getOptions();
?>
<div id='content'>
	<h3><?php echo _("General Options");?></h3><!--Opzioni Generali-->
	<div style='margin: 10px; padding: 10px; float:left'>
	<form>
	  <label for='prefix'><?php echo _("Prefix ");?></label><!--Prefisso -->
	  <input type="text" name="prefix" size="1" id="prefix" class="text ui-widget-content ui-corner-all" value='<?php echo $options['prefix']; ?>' />
		<span style='font-size: 90%; margin-left: 10px'><?php echo _("(Return the same prefix in Routes in output)");?></span>	<br/><br/><!--(Riportare lo stesso prefisso nelle Rotte in Uscita)-->

	  <label for='ext_pattern'><?php echo _("Internal pattern ");?></label><!--Pattern interni -->
	  <input type="text" name="ext_pattern" size="5" id="ext_pattern" class="text ui-widget-content ui-corner-all" value='<?php echo $options['ext_pattern']; ?>'/>
	  <span id='hbutton'><a href='#'><img src='images/help.png'/></a></span><br/><br/>
	  <div id='help' class='help' style='display:none; padding: 3px; margin-bottom:10px'>
		<?php echo _("The internal pattern describes the format that identifies the interiors.");?><!--Il pattern interni descrive il formato che identifica gli interni-->
		<br/><span style='font-weight: bold'><?php echo _("Rules:");?></span><br/><!--Regole:-->
	        <span style='font-weight: bold'>X</span><?php echo _(" corresponds to a number 0 to 9");?><br/><!-- corrisponde ad un numero da 0 a 9-->
	        <span style='font-weight: bold'>N</span><?php echo _(" corresponds to a number 2 to 9");?><br/><!-- corrisponde ad un numero da 2 a 9-->
	        <span style='font-weight: bold'>Z</span><?php echo _(" corresponds to a number 1 to 9");?><br/><!-- corrisponde ad un numero da 1 a 9-->
	        <span style='font-weight: bold'>.</span><?php echo _(" corresponds to one or more numbers");?><br/><!-- corrisponde a uno o più numeri-->
	        <span style='font-weight: bold'>[x-y]</span><?php echo _(" corresponds to an interval of numbers between x e y");?><br/><!-- corrisponde ad un intervalo di numeri fra x e y-->

	        <br/><span style='font-weight: bold'><?php echo _("Examples:");?></span><br/><!--Esempi:-->
	        <span style='font-weight: bold'>[1-2]xx</span><?php echo _(": All three digit numbers starting with 1 or 2");?><br/><!--: Tutti i numeri di tre cifre che iniziano per 1 o 2-->
	        <span style='font-weight: bold'>5x</span><?php echo _(": All two digit numbers starting with 5");?>
	  </div><!--: Tutti i numeri di due cifre che iniziano per 5-->
	  <label for='internal_call'><?php echo _("Enable calls between rooms ");?></label> <input type="checkbox" name="internal_call" id="internal_call" <?php echo $options['internal_call']?'checked="checked"':''; ?>/><br/><br/><!--Abilita chiamate fra camere -->
	  <label for='groupcalls'><?php echo _("Enable calls between rooms of the same group");?></label> <input type="checkbox" name="groupcalls" id="groupcalls" <?php echo $options['groupcalls']?'checked="checked"':''; ?>/><br/><br/><!--Abilita chiamate fra camere dello stesso gruppo-->
	  <label for='externalcalls'><?php echo _("Enable external call from rooms");?></label> <input type="checkbox" name="externalcalls" id="externalcalls" <?php echo $options['externalcalls']?'checked="checked"':''; ?>/><br/><br/><!--Abilita chiamate esterne -->
	  <label for='internal_call_nocheckin'><?php echo _("Enable calls between rooms that have not performed the check-in ");?></label> <input type="checkbox" name="internal_call_nocheckin" id="internal_call_nocheckin" <?php echo $options['internal_call_nocheckin']?'checked="checked"':''; ?>/><br/><br/><!--Abilita chiamate fra camere che non hanno eseguito il check-in -->
	  <label for='reception'><?php echo _("Internal to alarm clock doesn't answer ");?></label><!--Interno per allarmi sveglia non risposta -->
	  <input type="text" name="reception" size="5" id="reception" class="text ui-widget-content ui-corner-all" value='<?php echo $options['reception']; ?>'/><br/><br/>
	  <label for='enableclean'><?php echo _("Enable rooms cleaning");?></label> <input type="checkbox" name="enableclean" id="enableclean" <?php if (!isset($options['enableclean'])||$options['enableclean']==1) echo 'checked="checked"'; ?>/><br/><br/><!--Abilita codice pulizia camere-->
          <label for='clean'><?php echo _("Enable code cleaning rooms");?></label> <input type="checkbox" name="clean" id="clean" <?php echo $options['clean']?'checked="checked"':''; ?>/><br/><br/><!--Abilita codice pulizia camere-->

          <!-- reception language used for audio messages -->
          <div>
    	      <label><?php echo _("Reception audio messages language");?></label>
              <select id="reception-lang-select">
              <?php
                  $receptionLang = getReceptionAudioLang();
                  foreach ($supported_audio_langs as $lang) {
                      echo "<option value=\"$lang\"";
                          if ($receptionLang === $lang)
                              echo " selected";
                      echo ">$lang</option>";
                  }
              ?>
              </select>
          </div>

	  <input type='submit' id='saveOptions' value=<?php echo _('Save');?> style='padding: 3px; margin-top: 5px' class="ui-state-default ui-corner-all"/>
	</form>
	</div>

	<div id='success' style='float: left; margin-top: 20px; margin-left: 100px; display: none'>
         <img src='images/ok.png'/>
        </div>
</div>
</div>

<?php// printFooter(); ?>
