<?php
/*check auth*/
include_once '/etc/freepbx.conf';
session_start();
if (!isset($_SESSION['AMP_user']) || !$_SESSION['AMP_user']->checkSection('visualplan')) {
    header("location: /freepbx/wizard");
    exit(1);
}
?>

<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
	<title>Visual Plan</title>
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="viewport" content="width=device-width, minimum-scale=1.0" />
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<!-- stylesheet include -->
	<link type="text/css" rel="stylesheet" href="assets/css/application.css" />
	<link type="text/css" rel="stylesheet" href="assets/css/spinner.css" />
	<link type="text/css" rel="stylesheet" href="assets/css/contextmenu.css" />
	<link type="text/css" rel="stylesheet" href="assets/css/font-awesome.css" />
	<link type="text/css" rel="stylesheet" href="assets/css/jquery-ui.css" />
	<link rel="stylesheet" type="text/css" href="assets/css/bootstrap.min.css">
	<link rel="stylesheet" type="text/css" href="assets/css/bootstrap-select.min.css">
	<link rel="stylesheet" type="text/css" href="assets/css/patternfly.min.css">
	<link rel="stylesheet" type="text/css" href="assets/css/patternfly-additions.min.css">
	<!-- languages -->
	<script type="text/javascript">
		var languages = {};
	</script>
	<script src="i18n/en.js"></script>
	<script src="i18n/it.js"></script>
	<!-- js library include -->
	<script src="lib/shifty.js"></script>
	<script src="lib/raphael.js"></script>
	<script src="lib/jquery-1.10.2.min.js"></script>
	<script src="lib/adapter-latest.js"></script>
	<script src="lib/jquery.autoresize.js"></script>
	<script src="lib/jquery-ui-1.8.23.custom.min.js"></script>
	<script src="lib/jquery-touch_punch.js"></script>
	<script src="lib/jquery.contextMenu.js"></script>
	<script src="lib/jquery.browser.js"></script>
	<script src="lib/audioRecorder.js"></script>
	<script src="lib/rgbcolor.js"></script>
	<script src="lib/canvg.js"></script>
	<script src="lib/Class.js"></script>
	<script src="lib/json2.js"></script>
	<script src="lib/pathfinding-browser.min.js"></script>
	<script src="lib/draw2d.js"></script>
	<script src="lib/dagre.min.js"></script>
	<script src="lib/svg-pan-zoom.min.js"></script>
	<script src="lib/bootstrap.min.js"></script>
	<script src="lib/patternfly.min.js"></script>
	<script src="lib/bootstrap-select.min.js"></script>
	<!-- application js -->
	<script src="app/Application.js"></script>
	<script src="app/View.js"></script>
	<script src="app/Toolbar.js"></script>
	<!-- widgets -->
	<script src="app/widgets/Base.js"></script>
	<script type="text/javascript">
		/**
		 * @method
		 * Factory method to provide a default connection for all drag&drop connections. You
		 * can override this method and customize this for your personal purpose.
		 *
		 * @param {draw2d.Port} sourcePort port of the source of the connection
		 * @param {draw2d.Port} targetPort port of the target of the connection
		 * @template
		 * @returns {draw2d.Connection}
		 */
		draw2d.Configuration.factory.createConnection = function (sourcePort, targetPort) {
			var c = new MyConnection({
				targetDecorator: new draw2d.decoration.connection.ArrowDecorator(),
				color: "#4caf50",
				stroke: 2,
				outlineStroke: 1,
				router: new draw2d.layout.connection.SplineConnectionRouter()
			});
			c.targetDecorator.setDimension(10, 10);
			c.targetDecorator.setBackgroundColor("#4caf50");

			return c;
		};

		var prefLang = localStorage.getItem('preferredLanguage');
		var app = null;
		if (prefLang) {
			var browserLang = prefLang.replace(/\"/g, '');
		} else {
			var browserLang = navigator.language || navigator.userLanguage;
			browserLang = browserLang.split("-")[0];
		}
		if (browserLang != "en" && browserLang != "it") {
			browserLang = "en";
		}

		var now = new Date();
		var time = now.getTime() + 1000 * 86400;
		now.setTime(time);
		document.cookie = "lang=" + browserLang + ";expires=" + now.toGMTString();

		$(window).load(function () {

			// set widget name
			$('#incoming').text(languages[browserLang]["base_incoming_string"]);

			$('#ext-group').text(languages[browserLang]["base_ext_group_string"]);
			$('#ext-queues').text(languages[browserLang]["base_ext_queues_string"]);
			$('#ivr').text(languages[browserLang]["base_ivr_string"]);
			$('#cqr').text(languages[browserLang]["base_cqr_string"]);
			$('#app-announcement').text(languages[browserLang]["base_app_announcement_string"]);
			$('#timeconditions').text(languages[browserLang]["base_timeconditions_string"]);
			$('#app-daynight').text(languages[browserLang]["base_app_daynight_string"]);

			$('#from-did-direct').text(languages[browserLang]["base_from_did_direct_string"]);
			$('#ext-local').text(languages[browserLang]["base_ext_local_string"]);
			$('#ext-meetme').text(languages[browserLang]["base_ext_meetme_string"]);
			$('#app-blackhole').text(languages[browserLang]["base_hangup_string"]);

			app = new example.Application();
			var id = window.location.search.replace("?", "").split("=")[1];

			if (id != "new_route") {
				$.ajax({
					url: "./visualize.php?id=" + id,
					context: document.body,
					beforeSend: function (xhr) {
						$('#loader').show();
					}
				}).done(function (c) {
					try {
						var jsonDocument = JSON.parse(c);
						var g = new dagre.graphlib.Graph();
						g.setGraph({});
						g.setDefaultEdgeLabel(function () {
							return {};
						});
						g.graph().rankdir = "LR";

						for (var i in jsonDocument) {
							if (jsonDocument[i].type === "Base") {
								g.setNode(jsonDocument[i].id, {
									width: 350,
									height: 200
								});
							}

							if (jsonDocument[i].type === "MyConnection") {
								g.setEdge(jsonDocument[i].source.node, jsonDocument[i].target.node);
							}
						};

						dagre.layout(g);

						g.nodes().forEach(function (v) {
							jsonDocument[v].x = g.node(v).x;
							jsonDocument[v].y = g.node(v).y;
						});

						var reader = new draw2d.io.json.Reader();
						reader.unmarshal(app.view, jsonDocument);

						$('#loader').hide();

						var zoomLevel = g.nodes().length / 5.9 > 1.2 ? g.nodes().length / 5.9 : 1.1;
						app.view.setZoom(zoomLevel, 0, 0, true);
						$('tspan:contains("' + languages[browserLang]["base_details_string"] + '")').css('cursor','pointer').css('text-decoration','underline');

					} catch (e) {
						$('#loader').hide();
					}
				});
			}
		});
  	</script>
</head>

<body id="container">
	<div id="toolbar" class="navbar-default">
		<button id="hamburger" onclick="hideSidenav()">
			<span class="icon-bar"></span>
			<span class="icon-bar"></span>
			<span class="icon-bar"></span>
		</button>
		<span id="logo">Visual Plan</span>
	</div>
	<div id="saver" class="saving">
		<i class='fa fa-check fa-3x saving-icon'></i>
	</div>
	<div id="typer" class="typing">
		<i class='fa fa-check fa-3x typing-icon'></i>
	</div>
	<div id="errorer" class="erroring">
		<i class='fa fa-close fa-3x close-icon'></i>
		<p class="error-par"></p>
	</div>
	<div id="emptier" class="empting">
		<i class='fa fa-close fa-3x close-icon'></i>
	</div>
	<div id="side-nav">
		<div id="layer_elements"></div>
		<div id="layer_header" class="highlight panetitle blackgradient">
			<!-- Cerchio -->
			<div data-shape="Base" data-radius="20" id="incoming" class="palette_node_element draw2d_droppable startWidget" title="drag&amp;drop the table into the canvas..">
			</div>
			<div data-shape="Base" id="ext-group" class="palette_node_element draw2d_droppable" title="drag&amp;drop the table into the canvas..">
			</div>
			<div data-shape="Base" id="ext-queues" class="palette_node_element draw2d_droppable" title="drag&amp;drop the table into the canvas..">
			</div>
			<div data-shape="Base" id="ivr" class="palette_node_element draw2d_droppable" title="drag&amp;drop the table into the canvas..">
			</div>
			<div data-shape="Base" id="cqr" class="palette_node_element draw2d_droppable" title="drag&amp;drop the table into the canvas..">
			</div>
			<div data-shape="Base" id="app-announcement" class="palette_node_element draw2d_droppable" title="drag&amp;drop the table into the canvas..">
			</div>
			<div data-shape="Base" id="timeconditions" class="palette_node_element draw2d_droppable" title="drag&amp;drop the table into the canvas..">
			</div>
			<div data-shape="Base" id="app-daynight" class="palette_node_element draw2d_droppable" title="drag&amp;drop the table into the canvas..">
			</div>
			<!-- -->
			<!-- Cerchio -->
			<div data-shape="Base" data-radius="20" id="from-did-direct" class="palette_node_element draw2d_droppable endWidget" title="drag&amp;drop the table into the canvas..">
			</div>
			<div data-shape="Base" data-radius="20" id="ext-local" class="palette_node_element draw2d_droppable endWidget" title="drag&amp;drop the table into the canvas..">
			</div>
			<div data-shape="Base" data-radius="20" id="ext-meetme" class="palette_node_element draw2d_droppable endWidget" title="drag&amp;drop the table into the canvas..">
			</div>
			<div data-shape="Base" data-radius="20" id="app-blackhole" class="palette_node_element draw2d_droppable endWidget" title="drag&amp;drop the table into the canvas..">
			</div>
			<!-- -->
		</div>
	</div>
	<div id="canvas">
	</div>
	<div id="loader" class="loading">Loading&#8230;</div>
	</pre>
	<footer>
		<p>
			<a href="http://www.nethvoice.it" target="_blank">Copyright © 2016</a>
		</p>
		<p class="right_floated">
			<a href="http://nethvoice.docs.nethesis.it/it/latest/amministrazione.html#visual-plan-ref-label" target="_blank">Documentazione</a>
		</p>
	</footer>
</body>
</html>
