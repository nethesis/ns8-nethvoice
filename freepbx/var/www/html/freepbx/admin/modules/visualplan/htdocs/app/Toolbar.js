example.Toolbar = Class.extend({

	init: function (elementId, view) {
		this.html = $("#" + elementId);
		this.view = view;
		this.saveInProgress = false;

		// register this class as event listener for the canvas
		// CommandStack. This is required to update the state of
		// the Undo/Redo Buttons.
		//
		view.getCommandStack().addEventListener(this);

		// Register a Selection listener for the state hnadling
		// of the Delete Button
		//
		view.on("select", $.proxy(this.onSelectionChanged, this));

		this.zoomInButton = $("<button id='last_btn' class='mainmenu_btns right_floated'><i class='fa fa-search-plus fa-lg'></i></button>");
		this.html.append(this.zoomInButton);
		this.zoomInButton.button().click($.proxy(function () {
			if (app.view.getZoom() > 1)
				this.view.setZoom(this.view.getZoom() * 0.75, true);
		}, this));

		this.delimiter = $("<span class='toolbar_delimiter'>&nbsp;</span>");
		this.html.append(this.delimiter);

		// Inject the DELETE Button
		//
		this.resetButton = $("<button  class='mainmenu_btns right_floated'>1:1</button>");
		this.html.append(this.resetButton);
		this.resetButton.button().click($.proxy(function () {
			this.view.setZoom(1.2, true);
		}, this));

		this.delimiter = $("<span class='toolbar_delimiter'>&nbsp;</span>");
		this.html.append(this.delimiter);

		// Inject the REDO Button and the callback
		//
		this.zoomOutButton = $("<button  class='mainmenu_btns right_floated'><i class='fa fa-search-minus fa-lg'></i></button>");
		this.html.append(this.zoomOutButton);
		this.zoomOutButton.button().click($.proxy(function () {
			this.view.setZoom(this.view.getZoom() * 1.25, true);
		}, this));

		this.delimiter = $("<span class='toolbar_delimiter'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>");
		this.html.append(this.delimiter);

		this.panButton = $("<button id='canvasPolicy' currentBtn='pan' class='mainmenu_btns'><i class='fa fa-arrows-alt fa-lg'></i></button>");
		this.html.append(this.panButton);
		this.panButton.click($.proxy(function (e) {
			var currentBtn = e.currentTarget.attributes.currentBtn.value;
			var canvas = document.getElementById("canvas");

			if (currentBtn === "pan") {
				e.currentTarget.attributes.currentBtn.value = "box";
				$(e.currentTarget.children[0]).removeAttr('class');
				$(e.currentTarget.children[0]).attr('class', 'fa fa-crosshairs fa-lg');
				canvas.style.cursor = "cell";
				var policy = new draw2d.policy.canvas.BoundingboxSelectionPolicy;
				this.view.installEditPolicy(policy);

				$('#typer').children().html("&nbsp;&nbsp;" + languages[browserLang]["toolbar_select_string"]);
				$('#typer').children().attr('class', 'fa fa-crosshairs fa-3x typing-icon');
				$('#typer').fadeIn("slow");
				setTimeout(function () {
					$('#typer').fadeOut("slow");
				}, 1000);

			} else {
				e.currentTarget.attributes.currentBtn.value = "pan";
				$(e.currentTarget.children[0]).removeAttr('class');
				$(e.currentTarget.children[0]).attr('class', 'fa fa-arrows-alt fa-lg');
				canvas.style.cursor = "move";
				var policy = new draw2d.policy.canvas.PanningSelectionPolicy;
				this.view.installEditPolicy(policy);

				$('#typer').children().html("&nbsp;&nbsp;" + languages[browserLang]["toolbar_pan_string"]);
				$('#typer').children().attr('class', 'fa fa-arrows-alt fa-3x typing-icon');
				$('#typer').fadeIn("slow");
				setTimeout(function () {
					$('#typer').fadeOut("slow");
				}, 1000);
			}
		}, this));

		this.delimiter = $("<span class='toolbar_delimiter'>&nbsp;&nbsp;&nbsp;</span>");
		this.html.append(this.delimiter);

		// Inject the UNDO Button and the callbacks
		//
		this.undoButton = $("<button class='mainmenu_btns'><i class='fa fa-mail-reply fa-lg'></i></button>");
		this.html.append(this.undoButton);
		this.undoButton.click($.proxy(function () {
			this.view.getCommandStack().undo();
		}, this));

		this.delimiter = $("<span class='toolbar_delimiter'>&nbsp;</span>");
		this.html.append(this.delimiter);

		// Inject the REDO Button and the callback
		//
		this.redoButton = $("<button class='mainmenu_btns'><i class='fa fa-mail-forward fa-lg'></i></button>");
		this.html.append(this.redoButton);
		this.redoButton.click($.proxy(function () {
			this.view.getCommandStack().redo();
		}, this));

		this.delimiter = $("<span class='toolbar_delimiter'>&nbsp;&nbsp;&nbsp;</span>");
		this.html.append(this.delimiter);

		// Inject the MODIFY Button
		//
		this.modifyButton = $("<button class='mainmenu_btns'><i class='fa fa-pencil fa-lg'></i></button>");
		this.html.append(this.modifyButton);
		this.modifyButton.click($.proxy(function () {
			var node = this.view.getCurrentSelection();
			try {
				var idExt = node.getUserData().id;
			} catch (e) {
				var idExt = "";
			}
			var typeObj = node.id.split('%')[0].trim();
			var nodeObj = {
				id: typeObj,
				idObj: idExt,
				title: node.children.data[0].figure.text,
				color: node.bgColor.hashString,
				data: node.children.data,
				x: node.x,
				y: node.y,
				width: node.width,
				height: node.height,
				context: node.canvas,
				shape: node.cssClass,
				userData: node.userData
			};
			if (typeObj !== 'ext-local' && typeObj !== 'app-blackhole') {
				this.createDialog(nodeObj, node);
			}
			// var command = new draw2d.command.CommandDelete(node);
			// this.view.getCommandStack().execute(command);
		}, this));

		this.delimiter = $("<span class='toolbar_delimiter'>&nbsp;</span>");
		this.html.append(this.delimiter);

		// Inject the DELETE Button
		//
		this.deleteButton = $("<button class='mainmenu_btns'><i class='fa fa-close fa-lg'></i></button>");
		this.html.append(this.deleteButton);
		this.deleteButton.click($.proxy(function () {
			var node = this.view.getCurrentSelection();
			var command = new draw2d.command.CommandDelete(node);
			this.view.getCommandStack().execute(command);
		}, this));

		this.delimiter = $("<span class='toolbar_delimiter'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>");
		this.html.append(this.delimiter);

		// Inject the Print Button
		//
		this.printButton = $("<button id='printButton' class='mainmenu_btns' download='image.png'><i class='fa fa-print fa-lg'></i></button>");
		this.html.append(this.printButton);
		this.printButton.click($.proxy(function () {

			const svg = document.getElementById('canvas').innerHTML;
			const blob = new Blob([svg.toString()]);
			const element = document.createElement("a");
			element.download = "visualPlan.svg";
			element.href = window.URL.createObjectURL(blob);
			element.click();
			element.remove();

		}, this));

		// Inject the Save Button
		//
		this.saveButton = $("<button class='mainmenu_btns'><i class='fa fa-check fa-lg'></i></button>");
		this.html.append(this.saveButton);
		this.saveButton.click($.proxy(function () {
			if (this.saveInProgress) return;
			this.saveInProgress = true;
			var toolbar = this;
			// Attach stable agent IDs to the VisualPlan blocks.
			function reconcileAgentIds(ids) {
				if (!ids) return;
				toolbar.view.getFigures().each(function (index, figure) {
					if (figure.id.indexOf('satellite-agent-destination%') === 0 &&
						Object.prototype.hasOwnProperty.call(ids, figure.id)) {
						var data = figure.getUserData();
						data.id = ids[figure.id];
						figure.setUserData(data);
					}
				});
			}

			var writer = new draw2d.io.json.Writer();
			writer.marshal(this.view, function (json) {
				// simply data
				for (item in json) {
					if (json[item].type == "Base") {
						delete json[item].width;
						delete json[item].height;
						delete json[item].name;
						delete json[item].alpha;
						delete json[item].cssClass;
						delete json[item].bgColor;
						delete json[item].color;
						delete json[item].stroke;
						delete json[item].radius;
						delete json[item].ports;
					}
					if (json[item].type == "MyConnection") {
						delete json[item].outlineStroke;
						delete json[item].alpha;
						delete json[item].cssClass;
						delete json[item].color;
						delete json[item].stroke;
						delete json[item].outlineColor;
						delete json[item].radius;
						delete json[item].policy;
						delete json[item].router;
						delete json[item].target.decoration;
					}
				}
				if (jQuery.isEmptyObject(json)) {
					toolbar.saveInProgress = false;
					$('#emptier').fadeIn("slow");
					$('#emptier').children().html("&nbsp;&nbsp;" + languages[browserLang]["toolbar_empty_string"]);
					setTimeout(function () {
						$('#emptier').fadeOut("slow");
					}, 5000);
				} else {
					// return;
					$.ajax({
						url: "./create.php?",
						type: "POST",
						contentType: 'application/json',
						headers: { 'X-Satellite-Agent-CSRF': window.visualplanAgentCsrfToken || '' },
						data: JSON.stringify(json),
						beforeSend: function (xhr) {
							$('#loader').show();
						}
					}).done(function (c) {
						$('#loader').hide();
						var resp;
						try {
							resp = typeof c === 'string' ? JSON.parse(c.substring(c.indexOf('{'))) : c;
						} catch (e) {
							resp = { success: false };
						}
						reconcileAgentIds(resp.agentIds);
						toolbar.saveInProgress = false;
						if (resp.success) {
							$('#saver').children().html("&nbsp;&nbsp;" + languages[browserLang]["toolbar_save_string"]);
							$('#saver').fadeIn("slow");
							setTimeout(function () {
								$('#saver').fadeOut("slow");
							}, 3000);
							highlight($('#save_button'));
							if (location.href.indexOf('?did=new_route') !== -1) {
								for (var i = 0; i < json.length; i++) {
									if (json[0].id.indexOf('incoming') === 0) {
										var name = json[0].id.split('%')[1];
										location.replace(location.origin + '/freepbx/visualplan/?did=' + encodeURIComponent(name));
										break;
									}
								}
							} else {
								location.reload();
							}
						} else { //TODO: maybe never executed?
							$('#loader').hide();
							toolbar.saveInProgress = false;
							$('#errorer').children().eq(0).html("&nbsp;&nbsp;" + languages[browserLang]["toolbar_not_save_string"]);
							$('#errorer').children().eq(1).text(resp.error || languages[browserLang]["toolbar_not_save_log_string"]);
							$('#errorer').fadeIn("slow");
							console.clear();
							setTimeout(function () {
								$('#errorer').fadeOut("slow");
							}, 5000);
						}
					}).fail(function (err) {
						$('#loader').hide();
						toolbar.saveInProgress = false;
						reconcileAgentIds(err.responseJSON && err.responseJSON.agentIds);
						$('#errorer').children().eq(0).html("&nbsp;&nbsp;" + languages[browserLang]["toolbar_not_save_string"]);
						$('#errorer').children().eq(1).text(err.responseJSON && err.responseJSON.error || languages[browserLang]["toolbar_not_save_log_string"]);
						$('#errorer').fadeIn("slow");
						setTimeout(function () {
							$('#errorer').fadeOut("slow");
						}, 5000);
					});
				}
			});
		}, this));

		this.delimiter = $("<button id=\"save_button\" class='save_button'><i class='fa fa-circle fa-lg'></i></button>");
		this.html.append(this.delimiter);

		this.disableButton(this.undoButton, true);
		this.disableButton(this.redoButton, true);
		this.disableButton(this.deleteButton, true);

		this.html.append($("<div id='toolbar_hint'></div>"));

		function highlight(obj) {
			obj.fadeIn("slow");
			obj.css("color", "#87D37C");
			setTimeout(function () {
				obj.fadeOut("slow");
			}, 3000);
		}
	},

	/**
	 * @method
	 * Called if the selection in the cnavas has been changed. You must register this
	 * class on the canvas to receive this event.
	 *
	 * @param {draw2d.Figure} figure
	 */
	onSelectionChanged: function (emitter, figure) {
		this.disableButton(this.deleteButton, figure === null);
	},

	/**
	 * @method
	 * Sent when an event occurs on the command stack. draw2d.command.CommandStackEvent.getDetail()
	 * can be used to identify the type of event which has occurred.
	 *
	 * @template
	 *
	 * @param {draw2d.command.CommandStackEvent} event
	 **/
	stackChanged: function (event) {
		this.disableButton(this.undoButton, !event.getStack().canUndo());
		this.disableButton(this.redoButton, !event.getStack().canRedo());
	},

	disableButton: function (button, flag) {
		button.prop("disabled", flag);
		if (flag) {
			button.addClass("disabled");
		} else {
			button.removeClass("disabled");
		}
	},

	createDialog: function (obj, node) {
		if (obj.id === "satellite-agent-destination" && node.getUserData().system_managed) return;
		var thisApp = this;
		var dialog = $('<div id="modalCreation"></div>')
			.dialog({
				position: 'center',
				autoOpen: false,
				resizable: false,
				width: 500,
				modal: true,
				close: function (ev, ui) {
					$(this).dialog('destroy').remove();
				},
				buttons: {
					Cancel: function () {
						$(this).dialog('destroy').remove();
					},
					Save: function () {
						if (obj.id === "satellite-agent-destination" && !obj.context.validateAgentForm()) return;

						// update values
						var usableElems = obj.context.getElemByAttr("usable");
						thisApp.updateValues(usableElems, node, obj);

						$('#modalCreation').dialog('destroy').remove();
					}
				},
				title: obj.title + " " + languages[browserLang]["view_modification_string"]
			});
		$(".ui-dialog-titlebar").css("background", obj.color);

		// inject html
		dialog.html(obj.context.modalCreate(obj, true));

		// show dialog
		dialog.dialog("open");
		$('.ui-widget-overlay').bind('click', function () {
			dialog.dialog('destroy').remove();
		});
	},

	/**
	 * @method
	 * 
	 * Called on form save button click.
	 * Updates figures informations.
	 * 
	 * @param {Object} elems - The inputs values.
	 * @param {Object} node - The draw2d figure.
	 * @param {Object} obj - The saved figure.
	 **/
	updateValues: function (elems, node, obj) {
		switch (obj.id) {
			case "satellite-agent-destination":
				var agentData = node.getUserData();
				agentData.cleverai_flow = elems[0].value;
				agentData.cleverai_trunk_id = Number(elems[1].value);
				node.setUserData(agentData);
				node.children.data[2].figure.setText(languages[browserLang]["view_agent_flow_string"] + ": " + elems[0].value);
				node.children.data[3].figure.setText(languages[browserLang]["view_agent_trunk_string"] + ": " + elems[1].selectedOptions[0].text);
				break;
			case "incoming":
				node.children.data[1].figure.setText(elems[0].value + ' / ' + elems[1].value + ' ( ' + elems[2].value + ' )');
				break;

			case "from-did-direct":
				node.children.data[1].figure.setText(elems[1].value + ' ( ' + elems[0].value + ' )');
				break;

			case "ext-group":
				node.setUserData({
					"name": elems[1].value,
					"extension": elems[0].value,
					"list": elems[2].value,
					"strategy": elems[3].value,
					"ringtime": elems[4].value
				});
				node.children.data[1].figure.setText(elems[1].value + ' ( ' + elems[0].value + ' )');
				node.children.data[3].figure.setText(elems[2].value.match(/\d+(#|)/g).join("\n"));
				node.children.data[4].figure.setText(languages[browserLang]["view_strategy_string"] + ' ( ' + elems[3].value + ' )');
				node.children.data[5].figure.setText(languages[browserLang]["view_ringtime_string"] + ' ( ' + elems[4].value + ' )');
				break;

			case "ext-queues":
				node.setUserData({
					"name": elems[1].value,
					"extension": elems[0].value,
					"staticExt": elems[2].value,
					"dynamicExt": elems[3].value,
					"strategy": elems[4].value,
					"timeout": elems[5].value,
					"maxwait": elems[6].value
				});
				if (elems[5].value == 1) {
					var timeout = "1 " + languages[browserLang]["view_queuesTimeString_second"];
				} else if (elems[5].value < 60) {
					var timeout = elems[5].value + " " + languages[browserLang]["view_queuesTimeString_seconds"];
				} else {
					var tmpTimeout = "view_queuesTimeString_minutes_" + elems[5].value;
					var timeout = languages[browserLang][tmpTimeout];
				}

				if (elems[6].value == 1) {
					var maxwait = "1 " + languages[browserLang]["view_queuesTimeString_second"];
				} else if (elems[6].value < 60) {
					var maxwait = elems[6].value + " " + languages[browserLang]["view_queuesTimeString_seconds"];
				} else {
					var tmpMaxwait = "view_queuesTimeString_minutes_" + elems[6].value;
					var maxwait = languages[browserLang][tmpMaxwait];
				}

				var tmpid = node.children.data[7].figure['id'].split('|')[0].trim();
				node.children.data[7].figure['id'] = tmpid + "|" + elems[5].value;
				var tmpidsec = node.children.data[8].figure['id'].split('|')[0].trim();
				node.children.data[8].figure['id'] = tmpidsec + "|" + elems[6].value;

				node.children.data[1].figure.setText(elems[1].value + ' ( ' + elems[0].value + ' )');
				if (elems[2].value != "") {
					node.children.data[3].figure.setText(elems[2].value.match(/\d+(,\d+|)/g).join("\n"));
				} else {
					node.children.data[3].figure.setText("");
				}
				node.children.data[5].figure.setText(elems[3].value);
				node.children.data[6].figure.setText(languages[browserLang]["view_strategy_string"] + " ( " + elems[4].value + " )");
				node.children.data[7].figure.setText(languages[browserLang]["view_agenttimeout_string"] + " ( " + (elems[5].value == '0' ? languages[browserLang]["view_queuesTimeString_unlimited"] : timeout) + " )");
				node.children.data[8].figure.setText(languages[browserLang]["view_queuesTimeString_maxWait"] + " ( " + (elems[6].value == '' ? languages[browserLang]["view_queuesTimeString_unlimited"] : maxwait) + " )");
				break;

			case "ivr":
				var id = node.getUserData().id;
				node.setUserData({
					"id": id,
					"name": elems[0].value,
					"description": elems[1].value,
					"announcement": elems[2].selectedOptions[0].attributes["annid"].value
				});
				if (id) {
					node.children.data[1].figure.setText(elems[0].value + ' ( ' + elems[1].value + ' )' + ' - ' + id);
				} else {
					node.children.data[1].figure.setText(elems[0].value + ' ( ' + elems[1].value + ' )');
				}
				node.children.data[2].figure.setText(languages[browserLang]["base_app_announcement_string"] + ': ' + elems[2].value);
				break;

			case "cqr":
				var id = node.getUserData().id;
				node.setUserData({
					"id": id,
					"name": elems[0].value,
					"description": elems[1].value,
					"announcement": elems[2].selectedOptions[0].attributes["annid"].value
				});
				if (id) {
					node.children.data[1].figure.setText(elems[0].value + ' ( ' + elems[1].value + ' )' + ' - ' + id);
				} else {
					node.children.data[1].figure.setText(elems[0].value + ' ( ' + elems[1].value + ' )');
				}
				node.children.data[2].figure.setText(languages[browserLang]["base_app_announcement_string"] + ': ' + elems[2].value);
				break;

			case "app-announcement":
				var id = node.getUserData().id;
				node.setUserData({
					"id": id,
					"description": elems[0].value,
					"announcement": elems[1].selectedOptions[0].attributes["annid"].value
				});
				if (id) {
					node.children.data[1].figure.setText(elems[0].value + ' - ' + id);
				} else {
					node.children.data[1].figure.setText(elems[0].value);
				}
				node.children.data[2].figure.setText(languages[browserLang]["view_recording_string"] + ': ' + elems[1].value);
				break;

			case "timeconditions":
				var id = node.getUserData().id;
				node.setUserData({
					"id": id,
					"name": elems[0].value,
					"time": elems[1].selectedOptions[0].attributes["timeid"].value
				});
				if (id) {
					node.children.data[1].figure.setText(elems[0].value + ' - ' + id);
				} else {
					node.children.data[1].figure.setText(elems[0].value);
				}
				node.children.data[2].figure.setText(languages[browserLang]["view_timegroup_string"] + ': ' + elems[1].value);
				break;

			case "app-daynight":
				node.setUserData({
					"name": elems[0].value,
					"code": elems[1].value
				});
				node.children.data[1].figure.setText(elems[0].value + ' ( *28' + elems[1].value + ' )');
				break;
			case "ext-meetme":
				node.setUserData({
					"name": elems[1].value,
					"extension": elems[0].value
				});
				node.children.data[1].figure.setText(elems[1].value + ' ( ' + elems[0].value + ' )');
				break;

		}
	}
});

function hideSidenav() {
	var sidenav = document.getElementById("side-nav");
	var droppable = document.getElementsByClassName("palette_node_element");
	var canvas = document.getElementById("canvas");
	var loader = document.getElementById("loader");
	if (sidenav.style.maxWidth !== "75px") {
		sidenav.style.maxWidth = "75px";
		for (i = 0; i < droppable.length; i++) {
			droppable[i].className += " small";
		}
		canvas.style.left = "75px";
		loader.style.left = "75px";
		$('.palette_node_element').addClass('hide_text');

		$(".ui-widget-overlay").addClass("sm");
		$(".ui-dialog").css("margin-left", "75px");
	} else {
		sidenav.style.maxWidth = "220px";
		for (i = 0; i < droppable.length; i++) {
			droppable[i].classList.remove("small");
		}
		canvas.style.left = "210px";
		loader.style.left = "210px";
		$('.palette_node_element').removeClass('hide_text');
		$(".ui-widget-overlay").removeClass("sm");
		$(".ui-dialog").css("margin-left", "210px");
	};
};

function escapeHtml (string) {
	const entityMap = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
		'/': '&#x2F;',
		'`': '&#x60;',
		'=': '&#x3D;'
	};
	return String(string).replace(/[&<>"'`=\/]/g, function (s) {
		return entityMap[s];
	});
}