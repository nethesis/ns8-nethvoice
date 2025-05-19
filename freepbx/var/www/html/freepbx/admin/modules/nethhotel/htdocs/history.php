<?php
 require_once("config.inc.php");
 require_once("session.inc.php");
 require_once("utils.inc.php");
 require_once("functions.inc.php");
 require("translations.php");
 
 printHeader(_("Management rooms"),("history.js"));
 printTitle(_("Management rooms"), _("History")); 
 
 $rooms = getHistoryRooms(); ?>

 <div id='contentPane'>
 <?php
  printMenu($sections,HISTORY);
 ?>

 <div id='content'>
   <div id='search' style='float: left'>
     <fieldset style='width: auto'><legend><?php echo _("Filter");?></legend> <!--Filtro-->
     <label for='start'><?php echo _("From: ");?></label><input type="text" name="start" size="10" id="start" class="text ui-widget-content ui-corner-all"/><!--Dal:-->
     <label for='start'><?php echo _("to: ");?></label><input type="text" name="end" size="10" id="end" class="text ui-widget-content ui-corner-all"/><!--Al:-->
     <label style='margin-left: 50px;' for='room'><?php echo _("Room:");?></label><!--Camera:-->
     <select name="room"  id="room" class="select ui-widget-content ui-corner-all">
     <option value='' id='all'><?php echo _("All");?></option><!--Tutte-->
     <?php
       foreach($rooms as $room)
       echo "<option value='$room'>$room</option>";
     ?>
     </select>
     </fieldset>
   </div>
   <div id='filter' style='float: right; margin: 10px;'><a href='#ajax-filter'><?php echo _("Disable filter");?></a></div><!--Disabilita filtro-->

   <div id='result'>
    <div id="historyDialog" title="Report chiamate">
	<div id='print'>
	<table><tbody id="report"/></table>
	</div>
    </div>
   </div>
 </div>
 </div>
<?php// printFooter(); ?>
