<?php

foreach ($modes as $mode => $value) {
	//echo '<a  class="list-group-item" m).'&extdisplay='.urlencode($mode).'">'._($value).'</a>';
	echo '<a href="#'.$mode.'"  class="list-group-item" aria-controls="'.$mode.'" role="tab" data-toggle="tab">'._($value).'</a>';
}
