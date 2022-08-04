var CallforwardC = UCPMC.extend({
	init: function(){
		this.stopPropagation = {
			'CFU': {},
			'CFB': {},
			'CF': {},
			'ringtimer': {}
		};
	},
	prepoll: function() {
		var exts = [];
		$(".grid-stack-item[data-rawname=callforward]").each(function() {
			exts.push($(this).data("widget_type_id"));
		});
		return exts;
	},
	poll: function(data) {
		var self = this;
		$.each(data.states, function(extension,data) {
			$.each(data, function(type,number) {
				var state = (number !== false);
				if(typeof self.stopPropagation[type][extension] !== "undefined" && self.stopPropagation[type][extension]) {
					return true;
				}
				var widget = $(".grid-stack-item[data-rawname=callforward][data-widget_type_id='"+extension+"']:visible input[data-type='"+type+"']"),
					sidebar = $(".widget-extra-menu[data-module=callforward][data-widget_type_id='"+extension+"']:visible input[data-type='"+type+"']"),
					sstate = state ? "on" : "off";
				if(widget.length && (widget.is(":checked") !== state)) {
					self.stopPropagation[type][extension] = true;
					widget.bootstrapToggle(sstate);
					if(state) {
						widget.parents(".parent").find(".display").removeClass("hidden").find(".text").text(number);
					} else {
						widget.parents(".parent").find(".display").addClass("hidden").find(".text").text("");
					}
					self.stopPropagation[type][extension] = false;
				}
				if(sidebar.length && (sidebar.is(":checked") !== state)) {
					self.stopPropagation[type][extension] = true;
					sidebar.bootstrapToggle(sstate);
					if(state) {
						sidebar.parents(".parent").find(".display").removeClass("hidden").find(".text").text(number);
					} else {
						sidebar.parents(".parent").find(".display").addClass("hidden").find(".text").text("");
					}
					self.stopPropagation[type][extension] = false;
				}
			});
		});
	},
	displayWidget: function(widget_id,dashboard_id) {
		var self = this;
		$(".grid-stack-item[data-id='"+widget_id+"'][data-rawname=callforward] .widget-content input[type='checkbox']").change(function(e) {
			var name = $(this).prop("name"),
				nice = $(this).data("nice"),
				parent = $(this).parents("."+name),
				type = $(this).data("type"),
				checked = $(this).is(':checked'),
				extension = $(".grid-stack-item[data-id='"+widget_id+"']").data("widget_type_id"),
				widget = $(this),
				sidebar = $(".widget-extra-menu[data-module='callforward'][data-widget_type_id='"+extension+"']:visible input[data-type='"+type+"']");

			if(typeof self.stopPropagation[type][extension] !== "undefined" && self.stopPropagation[type][extension]) {
				return true;
			}

			if(!$(this).is(":checked")) {
				if(sidebar.length && sidebar.is(":checked")) {
					sidebar.bootstrapToggle('off');
					sidebar.parents("."+name).find(".display").addClass("hidden").find(".text").text("");
				}
				self.saveSettings(extension,type,"",function() {
					parent.find(".display").addClass("hidden").find(".text").text("");
				});
				return;
			}

			if(sidebar.length && !sidebar.is(":checked")) {
				sidebar.bootstrapToggle('on');
			}
			self.showDialog(this, extension, function(state, number) {
				if(state == 'off') {
					widget.bootstrapToggle('off');
					parent.find(".display").addClass("hidden").find(".text").text("");
					if(sidebar.length && sidebar.is(":checked")) {
						sidebar.bootstrapToggle('off');
						sidebar.parents("."+name).find(".display").addClass("hidden").find(".text").text("");
					}
				} else {
					if(sidebar.length) {
						sidebar.parents("."+name).find(".display").removeClass("hidden").find(".text").text(number);
					}
					parent.find(".display").removeClass("hidden").find(".text").text(number);
				}
			});
		});
	},
	showDialog: function(el, extension, callback) {
		var nice = $(el).data("nice"),
				type = $(el).data("type"),
				self = this;

		self.stopPropagation[type][extension] = true;
		UCP.showDialog(
			sprintf(_("Set Forwarding for %s"),nice),
			'<label for="cfnumber">'+_("Enter a number")+'</label><input id="cfnumber" name="cfnumber" class="form-control">',
			'<button class="btn btn-primary" id="cfsave">'+_("Save")+'</button>',
			function() {
				var value = '';
				$("#globalModal").one("hide.bs.modal", function() {
					self.stopPropagation[type][extension] = false;
					if(value === '') {
						callback('off','');
					}
				});
				$("#cfsave").click(function(e) {
					e.preventDefault();
					value = $("#cfnumber").val();
					if(value === "") {
						UCP.showAlert(_("A valid number needs to be entered"),"warning");
						return;
					}

					callback('on',value);
					self.stopPropagation[type][extension] = false;
					self.saveSettings(extension, type, value, function(data) {
						if(data.status) {
							UCP.closeDialog();
						} else {
							callback('off','');
							UCP.showAlert(data.message, 'danger');
						}
					});
				});
			}
		);
	},
	saveSettings: function(extension, type, value, callback) {
		var self = this;
		data = {
			ext: extension,
			type: type,
			module: "callforward",
			command: "settings"
		};
		if(value !== "") {
			data.value = value;
		}
		self.stopPropagation[type][extension] = true;
		$.post( UCP.ajaxUrl, data, callback).always(function() {
			self.stopPropagation[type][extension] = false;
		}).fail(function() {
			UCP.showAlert(_('An Unknown error occured'),'danger');
		});
	},
	displayWidgetSettings: function(widget_id,dashboard_id) {
		var self = this,
				extension = $("div[data-id='"+widget_id+"']").data("widget_type_id");
		$("#cfringtimer").change(function() {
			self.saveSettings(extension, 'ringtimer', $(this).val(), function() {
				console.log("saved!");
			});
		});
	},
	displaySimpleWidget: function(widget_id) {
		var self = this;
		$(".widget-extra-menu[data-id='"+widget_id+"'] input[type='checkbox']").change(function(e) {
			var type = $(this).data("type"),
					checked = $(this).is(':checked'),
					extension = $(".widget-extra-menu[data-id='"+widget_id+"']").data("widget_type_id"),
					name = $(this).prop("name"),
					parent = $(this).parents("."+name),
					el = $(".grid-stack-item[data-widget_type_id='"+extension+"'][data-rawname=callforward] .widget-content input[data-type='"+type+"']");

			if(typeof self.stopPropagation[type][extension] !== "undefined" && self.stopPropagation[type][extension]) {
				return true;
			}

			if(!checked) {
				parent.find(".display").addClass("hidden").find(".text").text("");
			}

			if(el.length) {
				if(el.is(":checked") !== checked) {
					var state = checked ? "on" : "off";
					el.bootstrapToggle(state);
				}
			} else {
				if(checked) {
					self.showDialog(this, extension, function(state, number) {
						if(state == 'on') {
							parent.find(".display").removeClass("hidden").find(".text").text(number);
						} else {
							el.bootstrapToggle('off');
							parent.find(".display").addClass("hidden").find(".text").text("");
						}
					});
				} else {
					self.saveSettings(extension, type, '', function(data) {
						if(!data.status) {
							UCP.showAlert(data.message, 'danger');
						}
					});
				}
			}
		});
	},
	displaySimpleWidgetSettings: function(widget_id) {
		this.displayWidgetSettings(widget_id);
	}
});
