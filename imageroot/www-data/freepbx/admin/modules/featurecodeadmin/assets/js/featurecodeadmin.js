$(function() {
	if($(".has-error").length) {
		$('html,body').animate(
			{
				scrollTop: $(".has-error").offset().top-70
			},'slow');
	}
	$(".enabled").click(function() {
		$(this).parents(".element-container").removeClass("has-error");
	});
	$(".custom").click(function() {
		$(this).parents(".element-container").removeClass("has-error");
		var id = $(this).data("for"), input = $("#" + id);
		if (input.length === 0) {
			return;
		}
		if ($(this).is(":checked")) {
			input.prop("readonly", false);
			input.val(input.data("custom"));
		} else {
			input.data("custom", input.val());
			input.prop("readonly", true);
			input.val(input.data("default"));
		}
	});

	//bind like this for popovers!
	$("form[name=frmAdmin]")[0].onsubmit = function() {
		var msgErrorMissingFC = _("Please enter a Feature Code or uncheck Customize"),
		fcs = [],
		error = null;

		$(".code").each(function(i, v) {
			var input = $(v);
			fcs.push(input.val());
			if (!input.prop("readonly") && input.val().trim() === "") {
				error = { "item": input, "message": msgErrorMissingFC };
				return false;
			}
		});

		if (error !== null) {
			return warnInvalid(error.item, error.message);
		} else {
			return true;
		}
	};
});
