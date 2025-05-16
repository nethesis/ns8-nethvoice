<?php
 require_once("config.inc.php");
 require_once("session.inc.php");
 require_once("utils.inc.php");
 require_once("functions.inc.php");
 require("translations.php");
 
 printHeader(_("Management rooms"),("extra.js"));
 printTitle(_("Management rooms"),("Extra")); 
?>
<div id='contentPane'>

<?php
 printMenu($sections,EXTRA);
?>
<div id='content'>
  
        <h3 style="clear: both"><?php echo _("Rates");?></h3><!--Tariffe-->
	<div style='padding: 10px;'>
	
	<?php echo _("All currencies are expressed in Euro format 00.00");?><!--Tutte le valute sono espresse in Euro nel formato 00.00-->
        <br/>
       <?php echo _("The code is two-digit numbers.");?><!--I codice sono numeri a due cifre.-->

	</div>
	<div style='float: right; padding 5px; margin: 5px;'><a href='#ajax-newExtra'><img src="images/add.png" title=<?php echo _("Add extra");?> label="Aggiungi extra"/></a></div><!--Aggiungi extra-->
	
	<div id='table'>
 
	  <?php
	    loadExtra();
	  ?>
	</div>
	
	</div>
</div>
</div>

<div id="extraDialog" title="Extra">
	<div id='extraSettings'>
	<form>
		<p style="margin-top: 10px; margin-bottom: 10px; display: none; font-style:italic" id="validateExtra"></p>
		<label for="name"><?php echo _("Name: ");?></label><!--Nome: -->
		<input type="text" name="name" size="20" id="name" class="text ui-widget-content ui-corner-all" /> 
		<br/><br/>
	
		<label for="price"><?php echo _("Cost: ");?></label><!--Costo: -->
		<input type="text" name="price" size="5" id="price" class="text ui-widget-content ui-corner-all" />  €
		<br/><br/>

		<label for=code"><?php echo _("Code: ");?> </label><!--Codice: -->
		<input type="text" name="code" size="20" id="code" class="text ui-widget-content ui-corner-all"/>
		<br/><br/>

		<label for='enabled'><?php echo _("Qualified:");?></label><!--Abilitato--> <input type="checkbox" name="enabled" id="enabled"/>
		<input type='hidden' name='id' id='id' value=''/>
		<input type='hidden' name='action' id='action' value=''/>
		
		</div>
	</form>
	</div>
</div>

<?php //printFooter(); ?>
