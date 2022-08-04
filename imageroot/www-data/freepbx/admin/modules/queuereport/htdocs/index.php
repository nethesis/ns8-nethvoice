<?php
header('Content-Type: text/html; charset=utf-8');
$supported_langs = array('en', 'it');
require_once 'includes/config.inc.php';
require_once 'includes/utils.inc.php';
require_once 'includes/ajax_report.inc.php';
require_once 'includes/phplivex.php';
require_once 'modules/traduzione.php';
session_start();
setOrderAndPage(1, DEFAULT_ORDER);
?>
<html>
<head>

<title><?php if (isset($brand_conf['BRAND'])) {
    echo $brand_conf['BRAND'];
} else {
    echo _('Queue report');
}
?></title>
 <meta http-equiv="Content-Type" content="text/html">

     <link href="assets/css/semantic.min.css" rel="stylesheet" type="text/css"/>
     <link rel="stylesheet" type="text/css" href="assets/css/jquery.jqplot.min.css" />
     <link rel="stylesheet" type="text/css" href="assets/css/jquery-ui-1.7.custom.css"/>
     <link href="https://fonts.googleapis.com/css?family=Open+Sans:300,300i,400,400i,600,600i,700,700i,800" rel="stylesheet">
     <link href="assets/css/nethesis.css" rel="stylesheet" type="text/css"/>

    <link rel="icon" href="../images/favicon.ico" type="image/x-icon"/>

    <script type="text/javascript" src="assets/js/jquery-1.7.1.min.js"></script>
    <script src="assets/js/filter.js" type="text/javascript"></script>
    <script src="assets/js/jquery-ui-1.7.1.custom.min.js" language='javascript' type="text/javascript"></script>
    <script language="javascript" type="text/javascript" src="assets/js/jquery.jqplot.min.js"></script>
    <script type="text/javascript" src="assets/js/jquery.ui.datepicker-it.js"></script>
    <script type="text/javascript" src="assets/js/semantic.min.js"></script>
    <script type="text/javascript" src="assets/js/nethesis.js"></script>
    <script type="text/javascript" src="assets/js/plugins/jqplot.categoryAxisRenderer.min.js"></script>
    <script type="text/javascript" src="assets/js/plugins/jqplot.cursor.min.js"></script>
    <script type="text/javascript" src="assets/js/plugins/jqplot.canvasAxisTickRenderer.min.js"></script>
    <script type="text/javascript" src="assets/js/plugins/jqplot.canvasTextRenderer.min.js"></script>
    <script type="text/javascript" src="assets/js/plugins/jqplot.highlighter.min.js"></script>
    <script type="text/javascript" src="assets/js/plugins/jqplot.barRenderer.min.js"></script>
    <script type="text/javascript" src="assets/js/plugins/jqplot.pieRenderer.min.js"></script>

    <script type='text/javascript'>
    var loading = "<div class='loading'><img class='ui avatar image' src='assets/img/loader.gif'/><div class='loading_text'><?php echo _('Loading...');?></div></div>";
    $(document).ready(function() {
        $('#page_body').html(loading);
        $('#page_body').load('modules/dashboard.php');
        $('a.menu-list-item').click(function(e) {
            e.preventDefault();
            $('#page_body').html(loading);
            //console.debug($(this).attr('href'));
            $('#page_body').load($(this).attr('href'));
            $('a.menu-list-item').removeClass('current');
            $(this).addClass('current');
        });
    });
    </script>
</head>
<body>

<div id="page">
    <div id="pageHeader" class="ui inverted borderless huge fixed menu">
        <div class="item">
            <button id="sidebar-button" class="ui left floated inverted black icon button">
                <i class="content icon"></i>
            </button>
        </div>
        <h1 id="ModuleTitle"><?php echo _('Queue report')?></h1>
        <h2><?php echo _('Queue report')?></h2>
    </div> <!-- pageHeader -->
    <div id="allWrapper" class="ui bottom attached segment pushable" style="display: block">
        <div id="main_menu" class="ui sidebar inverted vertical fixed menu visible">
            <a class="menu-list-item item current" href='modules/dashboard.php'><i class="dashboard icon"></i>Dashboard</a>
            <div class="item">
                <div class="header"><i class="right-float block layout icon"></i> <?php echo _('General');?></div> <!--Generale-->
                <div class="ui inverted vertical menu">
                    <a class="menu-list-item item" href='modules/riepilogo.php'><?php echo _('Summary');?></a> <!--Riepilogo-->
                    <a class="menu-list-item item" href='modules/agente.php'><?php echo _('By agent');?></a><!--Per Agente-->
                    <a class="menu-list-item item" href='modules/sessioni.php'><?php echo _('By session');?></a><!--Per Agente-->
                    <a class="menu-list-item item" href='modules/chiamante.php'><?php echo _('By caller');?></a> <!--Per Chiamante-->
                    <a class="menu-list-item item" href='modules/chiamata.php'><?php echo _('By call');?></a> <!--Per Chiamata-->
                    <a class="menu-list-item item" href='modules/ivr.php'><?php echo _('IVR');?></a>
                </div>
            </div>
            <a class="menu-list-item item" href='modules/performance.php'><i class="line chart icon"></i>Performance</a>
            <div class="item">
                <div class='header'><i class="right-float map signs icon"></i> <?php echo _('Distribution');?></div><!--Distribuzione-->
                <div class="ui inverted vertical menu">
                    <a class="menu-list-item item" href='modules/oraria.php'><?php echo _('Hourly');?></a><!--Oraria-->
                    <a class="menu-list-item item" href='modules/geografica.php'><?php echo _('Geographic')?></a><!--Geografica-->
                </div>
            </div>
            <div class="item">
                <div class='header'> <i class="right-float bar chart icon"></i><?php echo _('Graphic');?></div><!--Grafici-->
                <div class="ui inverted vertical menu">
                    <a class="menu-list-item item" href='modules/grafici_carico.php'><?php echo _('Load');?></a><!--Carico-->
                    <a class="menu-list-item item" href='modules/grafici_oraria.php'><?php echo _('By hour');?></a><!--Per ora-->
                    <a class="menu-list-item item" href='modules/grafici_agente.php'><?php echo _('By agent');?></a><!--Per agente-->
                    <a class="menu-list-item item" href='modules/grafici_geo.php'><?php echo _('By area');?></a><!--Per zona-->
                    <a class="menu-list-item item" href='modules/grafici_oraria_coda.php'><?php echo _('Queue position');?></a><!--Posizione coda-->
                    <a class="menu-list-item item" href='modules/grafici_oraria_durata.php'><?php echo _('Average duration');?></a><!--Durata media-->
                    <a class="menu-list-item item" href='modules/grafici_oraria_attesa.php'><?php echo _('Average wait');?></a><!--Attesa media-->
                </div>
            </div>
        </div> <!-- main_menu -->
        <div id="page_body" class="pusher">
        </div>
    </div> <!-- allWrapper -->
  </div> <!-- page -->

<footer>
    <a id="product" title="<?php echo _('Queue Report');?>" href="config.php"></a>
</footer>

</body>
</html>
