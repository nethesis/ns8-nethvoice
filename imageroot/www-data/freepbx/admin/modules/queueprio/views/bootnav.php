<?php
$items = array();
switch ($view) {
  case 'form':
    $items[] = array('url' => '?display=queueprio', 'label' => '<i class="fa fa-list"></i> '._("List Priorities"));
    if(isset($_REQUEST['extdisplay'])){
      $items[] = array('url' => '?display=queueprio&view=form', 'label' => '<i class="fa fa-plus"></i> '._("Add Priority"));
    }
  break;

  default:
    # code...
  break;
}

if(!empty($items)){
  echo '<div class="col-sm-3 hidden-xs bootnav">
          <div class="list-group">';
  foreach($items as $item){
    echo '<a href="'.$item['url'].'" class="list-group-item">'.$item['label'].'</a>';
  }
  echo '  </div>
  </div>';
}
