<?php
$cal = FreePBX::Calendar();
//Gives an array of names used for validation later
echo '<script> var calnames='.json_encode($cal->getCalendarNames()).'</script>';
echo $cal->showCalendarPage();
