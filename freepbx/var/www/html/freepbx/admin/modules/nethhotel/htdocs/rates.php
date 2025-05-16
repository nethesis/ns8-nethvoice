<?php
 require_once("config.inc.php");
 require_once("session.inc.php");
 require_once("utils.inc.php");
 require_once("functions.inc.php");
 require("translations.php");
 
 printHeader(_("Management rooms"),("rates.js"));
 printTitle(_("Management rooms"), _("Rates")); ?>

 <div id='contentPane'>

<?php
 printMenu($sections,RATES);
?>
  <div id='content'>
	
<h3 style="clear: both"><?php echo _("Rates");?></h3><!--Tariffe-->
	<div style='padding: 10px;'>
	
	<?php echo _("All durations are expressed in seconds.");?><!--Tutte le durate temporali sono espresse in secondi.-->
	<?php echo _("All currencies are expressed in Euro cents.");?><!--Tutte sono espresse in Centesemi di Euro.-->
	
	<div>
	<span style='font-weight: bold'>N.B.</span><?php echo _(" Calls to numbers that do not fit any rate are automatically blocked.");?>
	</div><!-- Le chiamate verso numeri che non rietrano tariffa sono automaticamente bloccate-->
	</div>
	<div style='float: right; padding 5px; margin: 5px;'><a href='#ajax-addRate'><img src="images/add.png" title=<?php echo _("Add rate");?> label="Aggiungi tariffa"/></a></div><!--Aggiungi tariffa-->
	
	<div id='table'>
	  <?php
	    loadRates();
	  ?>
	</div>
	</div>
  </div>
 </div>

 <div id="rateDialog" title=<?php echo _("Rate");?>><!--Tariffa-->
	<div id='rateSettings'>
	<form>
		<p style="margin-top: 10px; margin-bottom: 10px; display: none; font-style:italic" id="validateRate"></p>
		<label for="name"><?php echo _("Name: ");?></label><!--Nome: -->
		<input type="text" name="name" size="20" id="name" class="text ui-widget-content ui-corner-all" /> 
		<br/><br/>
	
		<label for="answer_duration"><?php echo _("Duration connection fee: ");?></label><!--Durata scatto alla risposta: -->
		<input type="text" name="answer_duration" size="5" id="answer_duration" class="text ui-widget-content ui-corner-all" /><?php echo _(" seconds");?><!-- secondi-->
		<br/><br/>
		<label for="answer_price"><?php echo _("Cost connection fee: ");?></label><!--Costo scatto alla risposta: -->
		<input type="text" name="answer_price" size="5" id="answer_price" class="text ui-widget-content ui-corner-all"/><?php echo _(" Euro cents");?><!-- centesemi di €-->
		<br/><br/>
		
		<label for="duration"><?php echo _("Fee duration: ");?></label><!--Durata scatto: -->
		<input type="text" name="duration" size="5" id="duration" class="text ui-widget-content ui-corner-all" /><?php echo _(" seconds");?>
		<br/><br/>
		<label for="price"><?php echo _("Fee cost: ");?></label><!--Costo scatto: -->
		<input type="text" name="price" size="5" id="price" class="text ui-widget-content ui-corner-all" /><?php echo _(" Euro cents");?>
		<br/><br/>

		<label for="pattern"><?php echo _("Pattern: ");?></label>
		<input type="text" name="pattern" size="20" id="pattern" class="text ui-widget-content ui-corner-all"/>
		<span id='hbutton'><a href='#'><img src='images/help.png'/></a></span>
		<div id='help' class='help' style='display:none; padding: 3px; margin: 5px;'>
		<?php echo _("The pattern identifies the type of number called.");?><!--Il pattern identifica il tipo di numero chiamato.-->
		<br/><span style='font-weight: bold'><?php echo _("Rules:");?></span><br/><!--Regole-->
	        <span style='font-weight: bold'>X</span><?php echo _(" corresponds to a number 0 to 9");?><br/><!-- corrisponde ad un numero da 0 a 9-->
	        <span style='font-weight: bold'>N</span><?php echo _(" corresponds to a number 2 to 9");?><br/><!-- corrisponde ad un numero da 2 a 9-->
	        <span style='font-weight: bold'>Z</span><?php echo _(" corresponds to a number 1 to 9");?><br/><!-- corrisponde ad un numero da 1 a 9-->
	        <span style='font-weight: bold'>.</span><?php echo _(" corresponds to one or more numbers");?><br/><!-- corrisponde a uno o più numeri-->
	        <br/><span style='font-weight: bold'><?php echo _("Examples:");?></span><br/><!--Esempi:-->
	        <span style='font-weight: bold'>1xx</span><?php echo _(": All three digit numbers starting with 1");?><br/><!--: Tutti i numeri di tre cifre che inziano per 1-->
	        <span style='font-weight: bold'>800.</span><?php echo _(": All the numbers of any length starting with 800");?>
		</div><!--: Tutti i numeri di qualsiasi lunghezza che iniziano con 800-->
		<br/><br/>

		<label for='enabled'><?php echo _("Enable calls:");?></label> <input type="checkbox" name="enabled" id="enabled"/><!--Abilita chiamate:-->
		<input type='hidden' name='id' id='id' value=''/>
		<input type='hidden' name='action' id='action' value=''/>
		
		</div>
	</form>
	</div>
 </div>

<?php// printFooter(); ?>
