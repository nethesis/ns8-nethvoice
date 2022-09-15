$(document).ready(function() {
	$('.sortable').sortable(	{
		update: function(event, ui) {
			//console.log(ui.item.find('input').val(), ui.item.index())
			ui.item.find('input').val(ui.item.index());
		},
	});
	$('#ajaxsubmit').on('click',function(e){
//validate minregexpire maxregexpire
		if(parseInt($('#minregexpire').val()) > parseInt($('#maxregexpire').val())){
			alert("Minregexpire is Greater than Maxregexpire");
			return false;
		}

		$.ajax({
			type: 'POST',
			url: 'ajax.php?module=iaxsettings&command=savesettings',
			data: $('#editIax').serialize(),
			success: function (data) {
				if(data.status === true){
					location.reload();
				}else{
					if(Array.isArray(data.message)){
						data.message.forEach(function(entry) {
							fpbxToast(entry,'error','error');
						});
					}
				}
			}
		});
	});
});

$(document).ready(function(){

	/* Add a Custom Var / Val textbox */
	$("#iax-custom-add").click(function(){
		addCustomField("","");
	});

	/* Initialize Video Support settings and show/hide */
	if (document.getElementById("videosupport-no").checked) {
		$(".video-codecs").hide();
	}
	$("#videosupport-yes").click(function(){
		$(".video-codecs").show();
	});
	$("#videosupport-no").click(function(){
		$(".video-codecs").hide();
	});

	/* Initialize Jitter Buffer settings and show/hide */
	if (document.getElementById("jitterbuffer-no").checked) {
		$(".jitter-buffer").hide();
	}
	$("#jitterbuffer-yes").click(function(){
		$("#jitterbuffer").removeClass("hidden");
	});
	$("#jitterbuffer-no").click(function(){
		$("#jitterbuffer").addClass("hidden");
	});
});

var theForm = document.editIax;
/* Insert a iax_setting/iax_value pair of text boxes */
function addCustomField(key, val) {
	var idx = $(".iax-custom").size();
	var idxp = idx - 1;
	$("#iax-custom-buttons").prepend('<div class="form-inline"><input type="text" id="iax_custom_key_'+idx+'" name="iax_custom_key_'+idx+'" class="iax-custom form-control" value="'+key+'"> = <input type="text" id="iax_custom_val_'+idx+'" name="iax_custom_val_'+idx+'" class="form-control" value="'+val+'"></div>');
}
