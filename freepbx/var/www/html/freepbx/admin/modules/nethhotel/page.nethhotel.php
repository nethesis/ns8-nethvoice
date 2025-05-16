<?php
//PHPLICENSE 

$action = $_REQUEST['action'];
$extdisplay=$_REQUEST['extdisplay'];  //the extension we are currently displaying
$dispnum = "nethhotel"; //used for switch on config.php

//check if the extension is within range for this user
if (isset($account) && !checkRange($account)){
	echo "<script>javascript:alert('"._("Warning! Extension")." $account "._("is not allowed for your account.")."');</script>";
} else {
	
	//if submitting form, update database
	switch ($action) {
		case "add":
			nethhotel_add($extdisplay);
		break;
		case "delete":
			nethhotel_del($extdisplay);
		break;
	}
}

//this function needs to be available to other modules (those that use goto destinations)
//therefore we put it in globalfunctions.php
$rooms = nethhotel_list();
$exts = nethhotel_ext_list();
if ($extdisplay) 
  $is_room = nethhotel_get($extdisplay);
else
  $is_room = false;
$delURL = $_REQUEST['PHP_SELF'].'?'.$_SERVER['QUERY_STRING'].'&action=delete';
?>

<!-- right side menu -->
<div class="rnav">
  <ul>
    <li><a id="<?php echo ($extdisplay=='' ? 'current':'') ?>" href="config.php?display=<?php echo $dispnum?>"><?php echo _("Add Room")?></a></li>
<?php
	foreach ($rooms as $room) {
		echo "<li><a id=\"".($extdisplay==$room ? 'current':'')."\" href=\"config.php?display=".$dispnum."&extdisplay=$room&action=confirm_delete\">$room</a></li>";
	}
?>
  </ul>
</div>


<div class="content">
<h2><?php echo _("Rooms Management")." ". $extdisplay; ?></h2>
<?php
if ($action == 'delete') {
	echo '<br><h3>'._("Room").' '.$extdisplay.' '._('deleted').'!</h3><br/>';
} else if ($action == 'add'){
	echo '<br><h3>'._("Room").' '.$extdisplay.' '._('added').'!</h3><br/>';
} else if ($action=="confirm_delete")
{
    echo "<p>".sprintf(_("Remove %s from rooms context?"),$extdisplay)."</p>";
    echo '<p> <form autocomplete="off" name="editMM" action="'.$_REQUEST['PHP_SELF'].'" method="get" style="float: left; margin-right: 40px">
              <input type="hidden" name="action" value=""/>
              <input type="hidden" name="display" value="'.$dispnum.'"/>
              <input type="submit" value="'._('Cancel').'"/>
              </form>
             <form autocomplete="off" name="editMM" action="'.$_REQUEST['PHP_SELF'].'" method="post">
              <input type="hidden" name="extdisplay" value="'.$extdisplay.'"/>
              <input type="hidden" name="action" value="delete"/>
              <input type="submit" value="'._('Ok').'"/>
              </form>';
}
     if ($action!="")
       return;
     if ($extdisplay)
	echo "<p><a href='$delURL'>"._("Remove from rooms context").": $extdisplay</a></p>";
     else {
       
 
?>
	<form autocomplete="off" name="editMM" action="<?php $_REQUEST['PHP_SELF'] ?>" method="post">
	<input type="hidden" name="display" value="<?php echo $dispnum?>">
	<input type="hidden" name="action" value="add">
	<table>
	<tr><td colspan="2"><h5><?php echo _("Add Room"); ?><hr></h5></td></tr>
	<tr>
		<td><?php echo _("Extension:")?></td>
		<td><select name="extdisplay" >
<?php
  if ($exts)
    foreach ($exts as $ext) {
        echo "<option value='$ext'>$ext</option>";
    }
?>
        </select>    
        </td>
	</tr>
	<tr>
		<td colspan="2"><br><h6><input name="Submit" type="submit" value="<?php echo _("Add")?>"></h6></td>		
	</tr>
	</table>
	</form>
<?php	
           }	
