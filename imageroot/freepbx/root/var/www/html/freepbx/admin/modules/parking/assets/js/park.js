if($("#parkext").length) {
	var parkext = Number($('#parkext').val());
	delete extmap[parkext]
	var parkpos = Number($('#parkpos').val());
	var numslots = Number($('#numslots').val());
	var parkend = (parkpos + numslots - 1)
	var usedslots = [];
	for(var i=parkpos;i<=parkend;i++) {
		usedslots[i] = i;
		delete extmap[i]
	}
	parking_check_inputs();

	$('#parkform').submit(function() {
		if(!$('#parkext').val()) {
			warnInvalid($('#parkext'),_('Parking Lot Extension can not be blank!'));
			return false;
		}
		if(Number($('#parkext').val()) > 2147483647) {
			warnInvalid($('#parkext'),_('Parking Lot Extension can not be larger than 2147483647!'));
			return false;
		}
		if($('#parkext').val().trim().charAt(0) == "0") {
			warnInvalid($('#parkext'),_('Parking Lot Extension can not start with a leading 0!'));
			return false;
		}
		if(!$('#name').val()) {
			warnInvalid($('#name'),_('Parking Lot Name can not be blank!'));
			return false;
		}
		if(!$('#parkpos').val()) {
			warnInvalid($('#parkpos'), _('Parking Lot Starting Position can not be blank!'));
			return false;
		}
		if(Number($('#parkpos').val()) > 2147483647) {
			warnInvalid($('#parkpos'),_('Parking Starting Position can not be larger than 2147483647!'));
			return false;
		}
		if($('#parkpos').val().trim().charAt(0) == "0") {
			warnInvalid($('#parkpos'),_('Parking Lot Starting Position can not start with a leading 0!'));
			return false;
		}
		if(!$('#goto0').val()) {
			warnInvalid($('#goto0'),_('You must select a valid destination'));
			return false;
		}

		if(stop) {
			alert(_("You have errors on the form. Please correct them before continuing"));
			return false;
		}
	});
}

var stop = false;
$('#parkpos').bind("keyup", function(){
	parking_check_inputs($(this));
});
$('#numslots').bind("change", function(){
	parking_check_inputs($(this));
});

function parking_check_inputs(self) {
	self = (typeof self === "undefined") ? $('#parkpos') : self;
	var id = self.attr("id");
	var new_parkext = Number($('#parkext').val());
	var new_parkpos = Number($('#parkpos').val());
	var new_numslots = Number($('#numslots').val());
	var new_parkend = (new_parkpos + new_numslots - 1);
	var style = '';
	stop = false;

	$('#parkpos').removeClass("duplicate-exten").parents(".form-group").removeClass("has-warning").find(".input-warn").remove();
	$('#numslots').removeClass("duplicate-exten").parents(".form-group").removeClass("has-warning").find(".input-warn").remove();

	if(new_parkext === new_parkpos) {
		//setTimeout to beat the standard extendisplay check
		setTimeout(function() {
			self.addClass("duplicate-exten").before('<i class="fa fa-exclamation-triangle input-warn" data-toggle="tooltip" data-placement="left" title="'+_("Parking Lot Extension and Starting Position can not be the same!")+'" '+style+'></i>').parents(".form-group").addClass("has-warning");
			self.parents(".form-group").find(".input-warn").tooltip();
			stop = true;
		},100);
		return;
	}

	var range = new_parkpos+"-"+new_parkend;
	for(var i=new_parkpos;i<=new_parkend;i++) {
		switch(true) {
			case new_parkext == i:
				var text = (id == 'parkext') ? sprintf(_('Parking Slot: %s').i) : sprintf(_('Parking Lot Extension: %s'),i);
				self.addClass("duplicate-exten").before('<i class="fa fa-exclamation-triangle input-warn" data-toggle="tooltip" data-placement="left" title="'+text+'" '+style+'></i>').parents(".form-group").addClass("has-warning");
				self.parents(".form-group").find(".input-warn").tooltip();
				stop = true;
			break;
			case (typeof extmap[i] !== "undefined"):
				self.addClass("duplicate-exten").before('<i class="fa fa-exclamation-triangle input-warn" data-toggle="tooltip" data-placement="left" title="'+sprintf(_("%s already in use by: %s"),i,extmap[i])+'" '+style+'></i>').parents(".form-group").addClass("has-warning");
				self.parents(".form-group").find(".input-warn").tooltip();
				stop = true;
			break;
			case i > 2147483647:
				self.addClass("duplicate-exten").before('<i class="fa fa-exclamation-triangle input-warn" data-toggle="tooltip" data-placement="left" title="'+_('Parking Starting Position/Slots can not be larger than 2147483647!')+'" '+style+'></i>').parents(".form-group").addClass("has-warning");
				self.parents(".form-group").find(".input-warn").tooltip();
				stop = true;
			break;
		}
		if(stop) {
			break;
		}
	}
	$("#slotrange").text(range);

	if($('#parkpos').val() && $('#parkext').val()) {
		if(Number($('#parkpos').val()) != new_parkend) {
			$('#slotslist').html('('+$('#parkpos').val()+'-'+new_parkend+')');
		} else {
			$('#slotslist').html('('+$('#parkpos').val()+')');
		}
	}
}
