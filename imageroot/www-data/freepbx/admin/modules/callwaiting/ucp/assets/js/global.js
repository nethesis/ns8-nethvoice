var CallwaitingC = UCPMC.extend({
	init: function(){
		this.stopPropagation = {};
	},
	prepoll: function() {
		var exts = [];
		$(".grid-stack-item[data-rawname=callwaiting]").each(function() {
			exts.push($(this).data("widget_type_id"));
		});
		return exts;
	},
	poll: function(data) {
		var self = this;
		$.each(data.states, function(ext,state) {
			if(typeof self.stopPropagation[ext] !== "undefined" && self.stopPropagation[ext]) {
				return true;
			}
			var widget = $(".grid-stack-item[data-rawname=callwaiting][data-widget_type_id='"+ext+"']:visible input[name='cwenable']"),
				sidebar = $(".widget-extra-menu[data-module='callwaiting'][data-widget_type_id='"+ext+"']:visible input[name='cwenable']"),
				sstate = state ? "on" : "off";
			if(widget.length && (widget.is(":checked") !== state)) {
				self.stopPropagation[extension] = true;
				widget.bootstrapToggle(sstate);
				self.stopPropagation[extension] = false;
			} else if(sidebar.length && (sidebar.is(":checked") !== state)) {
				self.stopPropagation[extension] = true;
				sidebar.bootstrapToggle(sstate);
				self.stopPropagation[extension] = false;
			}
		});
	},
	displayWidget: function(widget_id,dashboard_id) {
		var self = this;
		$(".grid-stack-item[data-id='"+widget_id+"'][data-rawname=callwaiting] .widget-content input[name='cwenable']").change(function() {
			var extension = $(".grid-stack-item[data-id='"+widget_id+"'][data-rawname=callwaiting]").data("widget_type_id"),
				el = $(".widget-extra-menu[data-module='callwaiting'][data-widget_type_id='"+extension+"']:visible input[name='cwenable']"),
				checked = $(this).is(':checked'),
				name = $(this).prop('name');
			if(el.length && el.is(":checked") !== checked) {
				var state = checked ? "on" : "off";
				el.bootstrapToggle(state);
			}
			self.saveSettings(extension, {enable: checked});
		});
	},
	saveSettings: function(extension, data, callback) {
		var self = this;
		data.ext = extension;
		data.module = "Callwaiting";
		data.command = "enable";
		this.stopPropagation[extension] = true;
		$.post( UCP.ajaxUrl, data, callback).always(function() {
			self.stopPropagation[extension] = false;
		});
	},
	displaySimpleWidget: function(widget_id) {
		var self = this;
		$(".widget-extra-menu[data-id='"+widget_id+"'] input[name='cwenable']").change(function(e) {
			var extension = $(".widget-extra-menu[data-id='"+widget_id+"']").data("widget_type_id"),
				checked = $(this).is(':checked'),
				name = $(this).prop('name'),
				el = $(".grid-stack-item[data-rawname=callwaiting][data-widget_type_id='"+extension+"']:visible input[name='cwenable']");

			if(el.length) {
				if(el.is(":checked") !== checked) {
					var state = checked ? "on" : "off";
					el.bootstrapToggle(state);
				}
			} else {
				self.saveSettings(extension, {enable: checked});
			}
		});
	}
});
