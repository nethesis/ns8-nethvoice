function loadGroups() {
    console.log("loadGroups");
}

function gettextTrans(text) {
    var t = "";

    $.ajax({
        dataType: "json",
        url: "action.php?",
        async: false,
        data: {
            action: 'gettext',
            untranslated: JSON.stringify(new Array(text))
        },
        success: function(data) {
            for (first in data) {
                t = data[first];
                break;
            }
        }
    });
    return t;
}

$(document).ready(function() { //start ready function
});
$('.delete-group-img').live('click', function(){
    $.ajax({
        url: "action.php?",
        async: false,
        data: {
            action: 'deleteGroup',
            group_id: $(this).attr('data-group-id')
        },
        success: function() {
            updatePage();
        }
    });
});

$('.edit-group-img').live('click', function(){
    console.log(".edit-group-img click");
    $.ajax({
        url: "action.php?",
        async: false,
        data: {
            action: 'getGroupsDialog',
            group_id: $(this).attr('data-group-id')
        },
        success: function(html) {
            $('body').append(html);
            $("#add-group-dialog").dialog({
              autoOpen: false,
              modal: true,
              buttons: {
                  "Save": function() {
                      var groupcalls = 0;
                      var roomscalls = 0;
                      var externalcalls = 0;
                      if(document.getElementById('group_groupcalls_dial').checked){ groupcalls = 1; }
                      if(document.getElementById('group_roomscalls_dial').checked){ roomscalls = 1; }
                      if(document.getElementById('group_externalcalls_dial').checked){ externalcalls = 1;}
                      var rooms_in_group = new Array();
                      $('.multiselect').find('input:checked').each(function(){ rooms_in_group.push($(this).val());});
                      $.ajax({
                          url: "action.php?",
                          async: false,
                          data: {
                              action: 'saveGroupsDialog',
                              group_name: $('#group_name_dial').val(),
                              groupcalls: groupcalls,
                              roomscalls: roomscalls,
                              externalcalls: externalcalls,
                              group_note: $('#group_note_dial').val(),
                              rooms_in_group: JSON.stringify(rooms_in_group),
                              group_id: $('#add-group-dialog').attr('data-gid'),
                          },
                          success: function() {
                              $("#add-group-dialog").dialog( "close" );
                          }
                      });
                  },
                  "Cancel": function() { $( this ).dialog( "close" );}
              },
              close: function (){
                  $( this ).dialog( "destroy" );
                  $( this ).remove();
                  updatePage();
              },
            });
            $( function() {
                $( "#rooms_in_group_sortable, #rooms_not_in_any_group_sortable" ).sortable({
                    connectWith: ".connectedSortable"
                }).disableSelection();
            } );
            $("#add-group-dialog").dialog("open");
        }
    });
});



$('#add-new-group-img').live('click', function(){
    $.ajax({
        url: "action.php?",
        async: false,
        data: {
            action: 'getGroupsDialog',
        },
        success: function(html) {
            $('body').append(html);
            $("#add-group-dialog").dialog({
              autoOpen: false,
              modal: true,
              buttons: {
                  "Save": function() {
                      var groupcalls = 0;
                      var roomscalls = 0;
                      var externalcalls = 0;
                      if(document.getElementById('group_groupcalls_dial').checked){ groupcalls = 1; }
                      if(document.getElementById('group_roomscalls_dial').checked){ roomscalls = 1; }
                      if(document.getElementById('group_externalcalls_dial').checked){ externalcalls = 1;}
                      var rooms_in_group = new Array();
                      $('.multiselect').find('input:checked').each(function(){ rooms_in_group.push($(this).val());});
                      $.ajax({
                          url: "action.php?",
                          async: false,
                          data: {
                              action: 'saveGroupsDialog',
                              group_name: $('#group_name_dial').val(),
                              groupcalls: groupcalls,
                              roomscalls: roomscalls,
                              externalcalls: externalcalls,
                              group_note: $('#group_note_dial').val(),
                              rooms_in_group: JSON.stringify(rooms_in_group),
                              group_id: $('#add-group-dialog').attr('data-gid'),
                          },
                          success: function() {
                              $("#add-group-dialog").dialog( "close" );
                          }
                      });
                  },
                  "Cancel": function() { $( this ).dialog( "close" );}
              },
              close: function (){
                  $( this ).dialog( "destroy" );
                  $( this ).remove();
                  updatePage();
              },
            });
            $( function() {
                $( "#rooms_in_group_sortable, #rooms_not_in_any_group_sortable" ).sortable({
                    connectWith: ".connectedSortable"
                }).disableSelection();
            } );

            $("#add-group-dialog").dialog("open");
        }
    });
});

/*Edit group alarm*/
$('.edit-group-alarm').live('click', function(){
    $.ajax({
        url: "action.php?",
        async: false,
        data: {
            action: 'setAlarmGroupDialog',
            group_id: $( this ).attr('data-group-id'),
        },
        success: function(html) {
            $('body').append(html);
            $("#setAlarmGroupDialog").dialog({
              autoOpen: false,
              modal: true,
              buttons: {
                  "Ok": function() {
                      var days;
                      if ($('#alarmRepeat').is(':checked')){
                          days = $('#days').val();
                      } else {
                          days = 1;
                      }
                      $.ajax({
                          url: "action.php?",
                          async: false,
                          data: {
                              action: 'setAlarmGroup',
                              group_id: $( this ).attr('data-group-id'),
                              hour: $('#hour').val(),
                              date: $('#start').val(),
                              days: days
                          },
                          success: function() { $("#setAlarmGroupDialog").dialog( "close" );},
                          error: function() { alert('Error'); },
                      });
                  },
                  "Cancel": function() { $( this ).dialog( "close" );}
              },
              close: function (){
                  $( this ).dialog( "destroy" );
                  $( this ).remove();
                  updatePage();
              },
            });
        $("#setAlarmGroupDialog").dialog("open");
        // **** Alarm initialization ***** /
        $('#hour').timeEntry();
        $("#alarmRepeat").click(function() {
            if ($("#alarmRepeat").is(':checked')) {
                if (!$("#interval").is(':visible'))
                    $("#interval").show("blind");
            } else
                $("#interval").hide("blind");
        });

        $("#alarmEnabled").click(function() {
            if ($("#alarmEnabled:checked").val() !== null)
                if (!$("#alarmSettings").is(':visible'))
                    $("#alarmSettings").show("blind");
                else
                    $("#alarmSettings").hide("blind");
        });
        $('#start').datepicker({
                defaultDate: +1,
                beforeShow:function() {
                    $('.ui-datepicker').css({
                        "position": "relative",
                        "z-index": 999999
                    });
                 }
        });
        //////////////////////////////////////
        }
    });
});

/*Delete group alarm*/
$('.delete-group-alarm').live('click', function(){
    $.ajax({
        url: "action.php?",
        async: false,
        data: {
            action: 'deleteAlarmGroupDialog',
            group_id: $( this ).attr('data-group-id'),
        },
        success: function(html) {
            $('body').append(html);
            $("#deleteAlarmGroupDialog").dialog({
              autoOpen: false,
              modal: true,
              buttons: {
                  "Ok": function() {
                      $.ajax({
                          url: "action.php?",
                          async: false,
                          data: {
                              action: 'deleteAlarmGroup',
                              group_id: $( this ).attr('data-group-id'),
                          },
                          success: function() { $("#deleteAlarmGroupDialog").dialog( "close" );}
                      });
                  },
                  "Cancel": function() { $( this ).dialog( "close" );}
              },
              close: function (){
                  $( this ).dialog( "destroy" );
                  $( this ).remove();
                  updatePage();
              }
            });
        $("#deleteAlarmGroupDialog").dialog("open");
        }
    });
});

/*Check out group*/
$('.check-out-group').live('click', function(){
    $.ajax({
        url: "action.php?",
        async: false,
        data: {
            action: 'checkOutGroupDialog',
            group_id: $( this ).attr('data-group-id'),
        },
        success: function(html) {
            $('body').append(html);
            $("#checkOutGroupDialog").dialog({
              autoOpen: false,
              modal: true,
              buttons: {
                  "Ok": function() {
                      $.ajax({
                          url: "action.php?",
                          async: false,
                          data: {
                              action: 'checkOutGroup',
                              group_id: $( this ).attr('data-group-id'),
                          },
                          success: function() { $("#checkOutGroupDialog").dialog( "close" );}
                      });
                  },
                  "Cancel": function() { $( this ).dialog( "close" );}
              },
              close: function (){
                  $( this ).dialog( "destroy" );
                  $( this ).remove();
                  updatePage();
              }
            });
        $("#checkOutGroupDialog").dialog("open");
        }
    });
});

/*Check in group*/
$('.check-in-group').live('click', function(){
    $.ajax({
        url: "action.php?",
        async: false,
        data: {
            action: 'checkInGroupDialog',
            group_id: $( this ).attr('data-group-id'),
        },
        success: function(html) {
            $('body').append(html);
            $("#checkInGroupDialog").dialog({
              autoOpen: false,
              modal: true,
              buttons: {
                  "Ok": function() {
                      $.ajax({
                          url: "action.php?",
                          async: false,
                          data: {
                              action: 'checkInGroup',
                              lang: $('#customer_lang').val(),
                              group_id: $( this ).attr('data-group-id'),
                          },
                          success: function() { $("#checkInGroupDialog").dialog( "close" );}
                      });
                  },

                  "Cancel": function() { $( this ).dialog( "close" );}
              },
              close: function (){
                  $( this ).dialog( "destroy" );
                  $( this ).remove();
                  updatePage();
              }
            });
        $("#checkInGroupDialog").dialog("open");
        }
    });
});

/*Clean group*/
$('.clean-group').live('click', function(){
    $.ajax({
        url: "action.php?",
        async: false,
        data: {
            action: 'cleanGroupDialog',
            group_id: $( this ).attr('data-group-id'),
        },
        success: function(html) {
            $('body').append(html);
            $("#cleanGroupDialog").dialog({
              autoOpen: false,
              modal: true,
              buttons: {
                  "Ok": function() {
                      $.ajax({
                          url: "action.php?",
                          async: false,
                          data: {
                              action: 'cleanGroup',
                              group_id: $( this ).attr('data-group-id'),
                          },
                          success: function() { $("#cleanGroupDialog").dialog( "close" );}
                      });
                  },

                  "Cancel": function() { $( this ).dialog( "close" );}
              },
              close: function (){
                  $( this ).dialog( "destroy" );
                  $( this ).remove();
                  updatePage();
              }
            });
        $("#cleanGroupDialog").dialog("open");
        }
    });
});


function updatePage(){
    $.ajax({
        url: "action.php?",
        async: false,
        data: {
            action: 'loadGroups',
        },
        success: function(html) {
            $("#content").html(html);
        }
    });
}














