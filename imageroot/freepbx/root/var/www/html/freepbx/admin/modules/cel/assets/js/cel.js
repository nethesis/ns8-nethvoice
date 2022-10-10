function format(value){
	html = '<button type="button" class="btn btn-info btn-lg" data-toggle="modal" data-target="#callpreview" >show</button>';
	return html;
}
$("#report").on("click-cell.bs.table", function(event, field, value, row) {
    $("#cel-detail-grid").bootstrapTable('load', row.moreinfo)
});

function queryParams(params){
        var formData = $("#cel").serialize();
        $.each(formData.split('&'), function(k,v) {
                var parts = v.split('=');
                params[parts[0]] = parts[1]
        })
        return params;
}
$("#refresh").click(function(e) {
        $('#report').bootstrapTable('refresh');
})

function dateFormatter(val, row){
	unixtimestamp = parseInt(row.timestamp);
	return moment.unix(unixtimestamp).tz(timezone).format(datetimeformat);
}

function durationFormatter(val, row){
	return row.duration;
}
function playFormatter(val,row){
		if (typeof val == 'undefined') { return;}
		if(val =='undefined'){return;}

	return '<div id="jquery_jplayer_'+row.id+'" class="jp-jplayer" data-container="#jp_container_'+row.id+'" data-uniqueid="'+row.uniqueid+'"></div><div id="jp_container_'+row.id+'" data-player="jquery_jplayer_'+row.id+'" class="jp-audio-freepbx" role="application" aria-label="media player">'+
		'<div class="jp-type-single">'+
			'<div class="jp-gui jp-interface">'+
				'<div class="jp-controls">'+
					'<i class="fa fa-play jp-play"></i>'+
					'<i class="fa fa-undo jp-restart"></i>'+
				'</div>'+
				'<div class="jp-progress">'+
					'<div class="jp-seek-bar progress">'+
						'<div class="jp-current-time" role="timer" aria-label="time">&nbsp;</div>'+
						'<div class="progress-bar progress-bar-striped active" style="width: 100%;"></div>'+
						'<div class="jp-play-bar progress-bar"></div>'+
						'<div class="jp-play-bar">'+
							'<div class="jp-ball"></div>'+
						'</div>'+
						'<div class="jp-duration" role="timer" aria-label="duration">&nbsp;</div>'+
					'</div>'+
				'</div>'+
				'<div class="jp-volume-controls">'+
					'<i class="fa fa-volume-up jp-mute"></i>'+
					'<i class="fa fa-volume-off jp-unmute"></i>'+
				'</div>'+
			'</div>'+
			'<div class="jp-no-solution">'+
				'<span>Update Required</span>'+
				sprintf(_("You are missing support for playback in this browser. To fully support HTML5 browser playback you will need to install programs that can not be distributed with the PBX. If you'd like to install the binaries needed for these conversions click <a href='%s'>here</a>"),"http://wiki.freepbx.org/display/FOP/Installing+Media+Conversion+Libraries")+
			'</div>'+
		'</div>'+
	'</div>';
}
$(function() {
$('#report').on("post-body.bs.table", function () {
	 bindPlayers();
	});
});

function bindPlayers() {
	$(".jp-jplayer").each(function() {
		var container = $(this).data("container"),
		player = $(this),
		uniqueid = $(this).data("uniqueid");
		$(this).jPlayer({
			ready: function() {
				$(container + " .jp-play").click(function() {
					if(!player.data("jPlayer").status.srcSet) {
						$(container).addClass("jp-state-loading");
						$.ajax({
							type: 'POST',
							url: "ajax.php",
							data: {module: "cel", command: "gethtml5", uniqueid: uniqueid},
							dataType: 'json',
							timeout: 30000,
							success: function(data) {
								if(data.status) {
									player.on($.jPlayer.event.error, function(event) {
										$(container).removeClass("jp-state-loading");
										//alert("bkvkxb");
										console.log(event);
									});
									player.one($.jPlayer.event.canplay, function(event) {
										$(container).removeClass("jp-state-loading");
										player.jPlayer("play");
									});
									player.jPlayer( "setMedia", data.files);
								} else {
									alert(data.message);
									$(container).removeClass("jp-state-loading");
								}
							}
						});
					}
				});
				var $this = this;
				$(container).find(".jp-restart").click(function() {
					if($($this).data("jPlayer").status.paused) {
						$($this).jPlayer("pause",0);
					} else {
						$($this).jPlayer("play",0);
					}
				});
			},
			timeupdate: function(event) {
				$(container).find(".jp-ball").css("left",event.jPlayer.status.currentPercentAbsolute + "%");
			},
			ended: function(event) {
				$(container).find(".jp-ball").css("left","0%");
			},
			swfPath: "/js",
			supplied: supportedHTML5,
			cssSelectorAncestor: container,
			wmode: "window",
			useStateClassSkin: true,
			autoBlur: false,
			keyEnabled: true,
			remainingDuration: true,
			toggleDuration: true
		});
		$(this).on($.jPlayer.event.play, function(event) {
			$(this).jPlayer("pauseOthers");
		});
	});

	var acontainer = null;
	$('.jp-play-bar').mousedown(function (e) {
		acontainer = $(this).parents(".jp-audio-freepbx");
		updatebar(e.pageX);
	});
	$(document).mouseup(function (e) {
		if (acontainer) {
			updatebar(e.pageX);
			acontainer = null;
		}
	});
	$(document).mousemove(function (e) {
		if (acontainer) {
			updatebar(e.pageX);
		}
	});

	//update Progress Bar control
	var updatebar = function (x) {
		var player = $("#" + acontainer.data("player")),
				progress = acontainer.find('.jp-progress'),
				maxduration = player.data("jPlayer").status.duration,
				position = x - progress.offset().left,
				percentage = 100 * position / progress.width();

		//Check within range
		if (percentage > 100) {
			percentage = 100;
		}
		if (percentage < 0) {
			percentage = 0;
		}

		player.jPlayer("playHead", percentage);

		//Update progress bar and video currenttime
		acontainer.find('.jp-ball').css('left', percentage+'%');
		acontainer.find('.jp-play-bar').css('width', percentage + '%');
		player.jPlayer.currentTime = maxduration * percentage / 100;
	};
}
