if($("#idTime").length) {
	var time = $("#idTime").data("time");
	var timezone = $("#idTime").data("zone");
	var updateTime = function() {
		$("#idTime").text(moment.unix(time).tz(timezone).format('HH:mm:ss z'));
		time = time + 1;
	};

	setInterval(updateTime,1000);
}

$("#duplicate").click(function(e){
    e.preventDefault();
    e.stopPropagation();
    $('input[name="action"]').val("duplicate");
    $("#extdisplay").val("");
    $("#edit").submit();
});

$(document).ready(function(){
    $(".remove_section").click(function(){
        if (confirm( _("This section will be removed from this time group and all current settings including changes will be updated. OK to proceed?"))) {
            $(this).parent().parent().prev().remove();
            $(this).closest('form').submit();
        }
    });
    $("#edit").on('submit',function(){
        var ret = true;
        // We don't need to check the name, function 'duplicate' already gives an unique description
        if ($("#action").val() == 'duplicate'){
            ret = true;
        } else {
            $.map(JSON.parse(timegrouplist), function(tg, i) {
                if (tg.description == $("#description").val() && tg.description != currenttimegroup){
                    warnInvalid($("#description"),_("Please use a unique description. The description already exists."));
                    ret = false;
                }
            });
        }
        return ret;
    });
});
//table
$("#tgrnav").on('click-row.bs.table',function(e,row,elem){
	window.location = '?display=timegroups&view=form&extdisplay='+row.value;
});

function actionFormatter(value){
	var html = '';
	html += '<a href="?display=timegroups&view=form&extdisplay='+value+'"><i class="fa fa-edit"></i></a>&nbsp;';
	html += '<a href="?display=timegroups&action=del&extdisplay='+value+'" class="delAction"><i class="fa fa-trash"></i></a>';
	return html;
}
function linkFormatter(value){
	html = '<a href="?display=timegroups&view=form&extdisplay='+value[1]+'"><i class="fa fa-pencil"></i>&nbsp'+_("Edit: ")+value[0]+'</a>';
	return html;
}
$(document).on('click',"#addTime",function(e){
	e.preventDefault();
	var nextid = Math.max.apply(Math,$.map($("#timerows span"), function(n, i){
 		return n.id.match(/\d+/);
	}));
	nextid++;
	var curelem = $(this).parent().find('span').last();
	var curid = $(curelem).attr('id').match(/\d+/);
	curid = parseInt(curid,10);
	var span = $(this).parent().find('span').last();
	$("#addTime").remove();
	var newspan	= span.clone();
	newspan.attr('id','fstimes['+nextid+']');
	var items = newspan.children();
	items.find('select').each(function(){
		$(this).children().removeAttr("selected");
		$(this).attr('name',$(this).attr('name').replace(/\d+/,nextid) );
		$(this).attr('id',$(this).attr('id').replace(/\d+/,nextid) );
		});
	items.find('label').each(function(){
		$(this).attr('for',$(this).attr('for').replace(/\d+/,nextid));
	});
	newspan.appendTo('#timerows');
	$("#timerows").append('<a href="#" id="addTime"><i class="fa fa-plus"></i> '+_("Add Time")+'</a>');
});
$(document).on('click',".delTG",function(e){
	e.preventDefault();
	var rulecount = $(".delTG").length;
	var elem = $(this).parent();
	if(rulecount > 1){
		elem.remove();
	}else{
		alert(_("Cannot remove the only rule. At least 1 rule is required."));
	}
});
