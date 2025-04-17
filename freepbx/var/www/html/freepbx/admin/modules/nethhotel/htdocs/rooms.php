<?php
 require_once("config.inc.php");
 require_once("session.inc.php");
 require_once("utils.inc.php");
 require("translations.php");
 
 printHeader (_("Management rooms"),('rooms.js'));
?>
<style type="text/css">@import "css/jquery.timeentry.css";</style> 
<script type="text/javascript" src="js/jquery.timeentry.js"></script>
<script type="text/javascript" src="js/jquery.timeentry-it.js"></script>

<?php printTitle(_("Management rooms"), _("Room")); ?>

<div id='contentPane'>
<?php
require_once("functions.inc.php");
printMenu($sections,ROOMS);

echo "<div id='content'>";
$ntabs='0';
loadRooms($ntabs);
echo "</div>";
$groups = getGroupList();

?>
</div>
<!-- hack per evitare il flash del dialog -->
<div style="display: none">

<div id="alarmDialog" title=<?php echo _("Wake up");?>><!--Sveglia-->
	<form>
	<label for='alarmEnabled'><?php echo _("Enable alarm clock");?></label> <input type="checkbox" name="alarmEnabled" id="alarmEnabled"/><!--Abilita sveglia-->
	</form>
	<div id='alarmSettings'>
	<p style="margin-top: 10px; margin-bottom: 10px;" id="validateAlarm"><?php echo _("Enter the time for the alarm in the format hh:mm.");?></p>
	<!--Inserire l'ora di attivazione della sveglia nel formato hh:mm.-->
	<form>
		<label for="hour"><?php echo _("Hour ");?></label><!--Ora -->
		<input type="text" name="hour" size="6" id="hour" class="text ui-widget-content ui-corner-all" />
		<br/><br/>
		<label for="start"><?php echo _("Day ");?></label><input type="text" name="start" size="10" id="start" class="text ui-widget-content ui-corner-all"><br/><br/><!--Giorno -->
		<label for='alarmRepeat'><?php echo _("Repeat ");?></label> <input type="checkbox" name="alarmRepeat" id="alarmRepeat"/><!--Ripeti -->
		<div id='interval' style='display: none'>
		<p style='margin-top: 5px; margin-left: 5px;'><?php echo _(" for  ");?><input type="text" size="2" name="days" id="days" value='1' class="text ui-widget-content ui-corner-all" /><?php echo _(" day ");?></p> 
		<input type="hidden" name="ext" id="ext-alarm"/>
		</div>
		<div id='enableGroupContainer'><br/><label for='enableGroup'><?php echo _("Enable alarm for entire group ");?></label> <input type="checkbox" name="enableGroup" id="enableGroup"/></div>
	</form><!--Abilita sveglia per tutto il grupo -->
	</div>
</div>

<div id="confirmDisable" title=<?php echo _("Deactivate alarm");?>><!--Disattiva sveglia-->
	<p><span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span><?php echo _("Disable the alarm?");?></p><!--Dissativare la sveglia?-->
	<form>
	<div id='disableGroupContainer'><label for='disableGroup'><?php echo _("Disable alarm for entire group ");?></label><!--Disabilita sveglia per tutto il grupo --> <input type="checkbox" name="disableGroup" id="disableGroup"/></div>
	<input type="hidden" name="ext" id="ext-alarm-dis"/>
	</form>
</div>

<div id="confirmCheckout" title=<?php echo _("Check-out room");?>><!--Check-out camera-->
	<p><span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span><?php echo _("To check-out?");?></p><!--Effetuare il check-out?-->
        <div id="alertCost" style="color: red;"></div>
	<form>
	<input type="hidden" name="ext" id="ext-checkout"/>
	</form>
</div>

<div id="checkInDialog" title=<?php echo _("Check-in room");?>><!--Check-in camera-->
	<p><?php echo _("Customer language");?></p>
        <select>
            <?php
                $options = getOptions();
                foreach ($supported_audio_langs as $lang) {
                    $selected='';
                    if ($options['reception_lang'] == $lang) {
                        $selected = 'selected';
                    }
                    echo "<option value=\"$lang\" $selected>$lang</option>";
                }
            ?>
        </select>
	<form>
	    <input type="hidden" name="ext" id="ext-checkin"/>
	</form>
</div>

<div id="changeRoomLangDialog" title=<?php echo _("Change language");?>><!--Check-in camera-->
        <p><?php echo _("Language");?></p>
        <select>
            <?php
                foreach ($supported_audio_langs as $lang) {
                    $selected='';
                    if ($options['reception_lang'] == $lang) {
                        $selected = 'selected';
                    }
                    echo "<option value=\"$lang\" $selected>$lang</option>";
                }
            ?>
        </select>
        <form>
            <input type="hidden" name="ext" id="ext-change-room-lang"/>
            <!--input type="hidden" name="ext" id="ext-checkout"/-->
        </form>
</div>

<div id="confirmCleanroom" title=<?php echo _("Room cleaning");?>><!--Pulizia camera-->
        <p><span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span><?php echo _("Room cleaning done?");?></p><!--Pulizia camera effetuata?-->
        <form>
        <input type="hidden" name="ext" id="ext-cleanroom"/>
        </form>
</div>

<div id="reportDialog" title=<?php echo _("Report Costs");?>><!--Report Costi-->
	<div id='print'>
	<table><tbody id="report"></tbody></table>
	</div>
</div>

<div id="extraSet" title=<?php echo _("Extra management");?>><!--Gestione Extra-->
        <table><tbody id="showExtra"></tbody></table>
</div>

<div id="surnameDialog" title=<?php echo _("Name");?>/><!--Nome-->
        <form>
        <label for='surname'><?php echo _("Name");?></label><!--Nome-->
                <input type="text" name="contact" size="20" id="contact" class="text ui-widget-content ui-corner-all" />
        </form>
        </div>

</div>


<div id="groupDialog" title=<?php echo _("Group");?>><!--Gruppo-->
    <?php echo _("The room belongs to the group:");?><!--La camera appartiene al gruppo:-->
	<form>
	<label for='group'><?php echo _("Group");?></label><!--Gruppo--> 
	<select name="group" id="group">
	<option value='-1'><?php echo _("None");?></option><!--Nessuno-->
	<?php
	    foreach($groups as $group)
	    {
	        echo "<option value='{$group['id']}'>{$group['name']}</option>\n";
	    }
	?>
	</select>
	</form>
	</div>

</div>

<div class="contextMenu" id="menu">
<ul>
    <li id="showSurname"><?php echo _("Name");?></li><!--Nome-->
    <li id="checkin">Check-in</li>
    <li id="checkout">Check-out</li>
    <li id='enableAlarm' class="alarm separator"><?php echo _("Enable Alarm Clock");?></li><!--Abilita Sveglia-->
    <li id='editAlarm' ><?php echo _("Edit Alarm");?></li><!--Modifica Sveglia-->
    <li id='disableAlarm' class=" separator"><?php echo _("Disable Alarm");?></li><!--Disabilita Sveglia-->
    <li id='disableAlarmAlert' class=" separator"><?php echo _("Disable Alarm Alert");?></li><!--Disabilita allarme sveglia fallita-->
    <li id='displayExtra' class="report separator"><?php echo _("Extra Management");?></li><!--Gestione Extra-->
    <li id='showReport' class="report separator"><?php echo _("Report Costs");?></li><!--Report Costi-->
</ul>
</div>


<?php 

printAlarms();
//printFooter(); 
