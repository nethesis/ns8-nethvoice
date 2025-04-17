<?php
require("translations.php");

function printHeader($title,$jsFile)
{
header("Cache-Control: no-cache,must-revalidate,max-age=0,no-store"); // HTTP/1.1
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT"); // Date in the past
?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title><?php echo $title ?></title>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<link rel="icon" href="images/favicon.ico" type="image/x-icon">
<link rel="stylesheet" type="text/css" href="css/style.css" media="screen" />
<link type="text/css" href="css/jquery-ui-1.7.custom.css" rel="stylesheet" />
<link rel="shortcut icon" href="images/favicon.ico">
<script type="text/javascript" src="js/jquery-1.4.2.min.js"></script>
<script type="text/javascript" src="js/jquery-ui-1.7.1.custom.min.js"></script>
<script type="text/javascript" src="js/ui.accordion.js"></script>
<script type="text/javascript" src="js/ui.datepicker-it.js"></script>
<script type="text/javascript" src="js/utils.js"></script>
<script type="text/javascript" src="js/jquery.contextmenu.r2.js"></script>
<script type="text/javascript" src='js/<?php echo $jsFile; ?>'></script>
</head>
<body>
<div id="wrap">
<?php
}

function printTitleAndMenu($title,$subtitle,$sections,$current)
{
  echo "<div id=\"header\">\n
  <h1><a href=\"#\">"._($title)."</a></h1>\n
  <h2>"._($subtitle)."</h2>\n
  </div>\n";

  echo "<div id=\"breadcrumbs\">\n | ";
  foreach ($sections as $key=>$section)
  {
      if($key == $current)
        echo _($section[0])." | \n";
      else 
        echo "<a href=\"$section[1]\">"._($section[0])."</a> |\n";
  }
  echo "</div>\n<div id=\"right\"> \n";
  
}

function printTitle($title,$subtitle)
{
  echo "<div id=\"header\">\n
  <h1><a href=\"#\">"._($title)."</a></h1>\n
  <div style='float: right;'>
  <a href='/freepbx/admin/config.php?logout=true'>
      <img src='images/logout.png'/>
  </a> </div>
  <h2>"._($subtitle)."</h2>\n
  </div>\n";
}

function printMenu($sections,$current)
{
  echo "<div class='leftMenu' id=\"leftMenu\">\n ";
  foreach ($sections as $key=>$section)
  {
      echo '<div class="option">';
      if($key == $current)
        echo '<img src="images/'.substr($section[1],0,-4).'.png" title="'._($section[0]).'" alt="'._($section[0]).'"/>';
      else 
        echo "<a href=\"$section[1]\">".'<img src="images/'.substr($section[1],0,-4).'.png" title="'._($section[0]).'" alt="'._($section[0]).'"/>'."</a> \n";
      echo "<div class='label'>"._($section[0])."</div>";
      echo '</div>';
  }
  echo "</div>\n";

}



function printFooter()
{
   echo "<div id=\"clear\"> </div>\n
	<div id=\"footer\">
	Copyright &copy; <a href=\"http://www.nethesis.it\">Nethesis</a>
	<span style='float: right; font-size: smaller; display: none' id='waiting'><img src='images/loader.gif'></span>
	</div>
	</div>
	</body>
	</html>";

}

