<?php
 require_once("config.inc.php");
 require_once("session.inc.php");
 require_once("utils.inc.php");
 require_once("functions.inc.php");
 require("translations.php");
 
 printHeader(_("Management rooms"),("codes.js"));
 printTitle(_("Management rooms"), _("Short Numbers")); 
 echo "<script type='text/javascript'>\nvar codes=new Array();\n</script>";
?>
 <div id='contentPane'>

<?php
 printMenu($sections,CODES);
?>

  <div id='content'>
	<h3 style="clear: both"><?php echo _("Short Numbers");?></h3><!--Numeri Brevi-->
	<div style='padding: 10px;'>
	
	<?php echo _("Short numbers used by rooms.");?> <!--Numeri brevi utilizzabili dalla camere.-->
	
	</div>
	<div style='float: right; padding 5px; margin: 5px;'><a href='#ajax-addCode'><img src="images/add.png" title=<?php echo _("Add Short Number");?> label="Aggiungi Numero Breve"/></a></div><!--Aggiungi Numero Breve-->
	<div id='table'>
	  <?php
	    loadCodes();
	  ?>
	</div>
  </div>
 </div>

<div id="codeDialog" title=<?php echo _("Short Number");?>><!--Numero Breve-->
	<div id='codeSettings'>
	<form>
		<p style="margin-top: 10px; margin-bottom: 10px; display: none; font-style:italic" id="validateCode"></p>
		<label for="code"><?php echo _("Short number:");?> </label><!--Numero breve:-->
		<input type="text" name="code" size="3" id="code" class="text ui-widget-content ui-corner-all" /> 
		<br/><br/>
	
		<label for="note"><?php echo _("Description:");?> </label><!--Descrizione:-->
		<input type="text" name="note" size="30" id="note" class="text ui-widget-content ui-corner-all"/>
		<br/><br/>

                <label for="timegroup"><?php echo _("Temporal group ");?> </label><!--Gruppo temporale-->
                <div id="SelectTimeGroup"></div>
		<br/><br/>
                 
                <label for="detailgroup"><?php echo _("Details ");?> </label><!--Dettagli-->
                <div id="detailgroup"></div>
		<br/><br/>

		<label for="number"><?php echo _("Destination ");?> </label><!--Destinazione-->
		<input type="text" name="number" size="10" id="number" class="text ui-widget-content ui-corner-all" /> 
		<br/><br/>

		<label for="falsegoto"><?php echo _("Otherwise ");?> </label><!--Altrimenti-->
		<input type="text" name="falsegoto" size="10" id="falsegoto" class="text ui-widget-content ui-corner-all" /> 
		<br/><br/>

		<input type='hidden' name='id' id='id' value=''/>
		<input type='hidden' name='action' id='action' value=''/>
		
		</div>
	</form>
	</div>
</div>

<?php // printFooter(); ?>
