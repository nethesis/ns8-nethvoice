var FindmefollowC = UCPMC.extend({
	init: function(){
		this.stopPropagation = {};
	},
	prepoll: function() {
		var exts = [];
		$(".grid-stack-item[data-rawname=findmefollow]").each(function() {
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
			var widget = $(".grid-stack-item[data-rawname=findmefollow][data-widget_type_id='"+ext+"']:visible input[name='ddial']"),
				sidebar = $(".widget-extra-menu[data-module='findmefollow'][data-widget_type_id='"+ext+"']:visible input[name='ddial']"),
				sstate = state ? "on" : "off";
			if(widget.length && (widget.is(":checked") !== state)) {
				widget.bootstrapToggle(sstate);
			} else if(sidebar.length && (sidebar.is(":checked") !== state)) {
				sidebar.bootstrapToggle(sstate);
			}
		});
	},
	displayWidget: function(widget_id,dashboard_id) {
		var self = this;
		$(".grid-stack-item[data-id='"+widget_id+"'][data-rawname=findmefollow] .widget-content input[name='ddial']").change(function() {
			var extension = $(".grid-stack-item[data-id='"+widget_id+"'][data-rawname=findmefollow]").data("widget_type_id"),
				el = $(".widget-extra-menu[data-module='findmefollow'][data-widget_type_id='"+extension+"']:visible input[name='ddial']"),
				checked = $(this).is(':checked'),
				name = $(this).prop('name');
			if(el.length && el.is(":checked") !== checked) {
				var state = checked ? "on" : "off";
				el.bootstrapToggle(state);
			}
			self.saveSettings(extension, {key: name, value: checked});
		});
	},
	saveSettings: function(extension, data, callback) {
		var self = this;
		data.ext = extension;
		data.module = "findmefollow";
		data.command = "settings";
		this.stopPropagation[extension] = true;
		$.post(UCP.ajaxUrl, data, callback).always(function() {
			self.stopPropagation[extension] = false;
		});
	},
	displayWidgetSettings: function(widget_id,dashboard_id) {
		var self = this;
		var extension = $("div[data-id='"+widget_id+"']").data("widget_type_id");

		$("#widget_settings .widget-settings-content textarea").blur(function() {
			self.saveSettings(extension, {key: $(this).prop('name'), value: $(this).val()});
		});
		$("#widget_settings .widget-settings-content select").change(function() {
			self.saveSettings(extension, {key: $(this).prop('name'), value: $(this).val()});
		});
		$("#widget_settings .widget-settings-content input[type='checkbox']").change(function() {
			self.saveSettings(extension, {key: $(this).prop('name'), value: $(this).is(':checked')});
		});
	},
	displaySimpleWidget: function(widget_id) {
		var self = this;
		$(".widget-extra-menu[data-id='"+widget_id+"'] input[name='ddial']").change(function() {
			var extension = $(".widget-extra-menu[data-id='"+widget_id+"']").data("widget_type_id"),
				checked = $(this).is(':checked'),
				name = $(this).prop('name'),
				el = $(".grid-stack-item[data-rawname=findmefollow][data-widget_type_id='"+extension+"']:visible input[name='ddial']");

			if(el.length) {
				if(el.is(":checked") !== checked) {
					var state = checked ? "on" : "off";
					el.bootstrapToggle(state);
				}
			} else {
				self.saveSettings(extension, {key: name, value: checked});
			}
		});
	},
	displaySimpleWidgetSettings: function(widget_id) {
		this.displayWidgetSettings(widget_id);
	}
});
