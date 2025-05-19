function loadRooms() {
    startWaiting();
    var ntab = $('#tabs').tabs('option', 'selected');
    $('#content').load("action.php", {
        action: 'loadRooms',
        ntab: ntab
    }, stopWaiting);
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

    //********** Vars **********//
    var id = "";
    var alarmEnabled = '';
    var alarmFields = $([]);
    var d = new Date();
    d.setDate(d.getDate() + 1);
    var curr_date = d.getDate();
    if (curr_date < 10)
        curr_date = '0' + curr_date;
    var curr_month = d.getMonth();
    curr_month++; //i mesi partono da zero
    if (curr_month < 10)
        curr_month = '0' + curr_month;
    var curr_year = d.getFullYear();
    var tomorrow = (curr_date + "/" + curr_month + "/" + curr_year);

    /* refresh page */
    self.setInterval("loadRooms()", 160000); //1 min


    //********** Check-out dialog **********//
    gettext('Check-out', function(checkoutBtn) {
        gettext('Cancel', function(cancelsBtn) {

            var buttonsCheckout = {};
            buttonsCheckout[checkoutBtn] = function() {
                var ntab = $('#tabs').tabs('option', 'selected');
                $("#confirmCheckout").dialog('close');
                $('#content').load("check-out.php", {
                    ext: id,
                    ntab: ntab
                }, stopWaiting);
            }
            buttonsCheckout[cancelsBtn] = function() {
                $("#confirmCheckout").dialog('close');
                stopWaiting();
            }
            $("#confirmCheckout").dialog({
                bgiframe: true,
                resizable: false,
                autoOpen: false,
                height: 140,
                modal: true,
                overlay: {
                    backgroundColor: '#000',
                    opacity: 0.5
                },
                buttons: buttonsCheckout
            });

            var buttonsCheckin = {};
            buttonsCheckin.Ok = function() {
                var ntab = $('#tabs').tabs('option', 'selected');
                var lang = $('#checkInDialog select').val();
                if (!lang) {
                    lang = 'en';
                }
                $('#checkInDialog').dialog('close');
                $('#content').load('check-in.php', {
                    ext: id,
                    ntab: ntab,
                    lang: lang
                }, stopWaiting);
            }
            buttonsCheckin[cancelsBtn] = function() {
                $("#checkInDialog").dialog('close');
                stopWaiting();
            }
            $("#checkInDialog").dialog({
                bgiframe: true,
                resizable: false,
                autoOpen: false,
                height: 140,
                modal: true,
                overlay: {
                    backgroundColor: '#000',
                    opacity: 0.5
                },
                buttons: buttonsCheckin
            });

            var buttonsChangeLang = {};
            buttonsChangeLang.Ok = function() {
                var ntab = $('#tabs').tabs('option', 'selected');
                var lang = $('#changeRoomLangDialog select').val();
                if (!lang) {
                    lang = 'en';
                }
                $('#changeRoomLangDialog').dialog('close');
                $('#content').load('set-lang.php', {
                    ext: id,
                    ntab: ntab,
                    lang: lang
                }, stopWaiting);
            }
            buttonsChangeLang[cancelsBtn] = function() {
                $("#changeRoomLangDialog").dialog('close');
                stopWaiting();
            }
            $("#changeRoomLangDialog").dialog({
                bgiframe: true,
                resizable: false,
                autoOpen: false,
                height: 140,
                modal: true,
                overlay: {
                    backgroundColor: '#000',
                    opacity: 0.5
                },
                buttons: buttonsChangeLang
            });
        });
    });

    //********** Clean Room dialog **********//
    var buttons = {};
    buttons[gettextTrans('Done')] = function() {
        var ntab = $('#tabs').tabs('option', 'selected');
        $("#confirmCleanroom").dialog('close');
        $('#content').load("clean-room.php", {
            ext: id,
            ntab: ntab
        }, stopWaiting);

    };
    buttons[gettextTrans('Cancel')] = function() {
        $(this).dialog('close');
        stopWaiting();
    };
    $("#confirmCleanroom").dialog({
        bgiframe: true,
        resizable: false,
        autoOpen: false,
        height: 140,
        modal: true,
        overlay: {
            backgroundColor: '#000',
            opacity: 0.5
        },
        buttons: buttons
    });
    //********** Edit alarm dialog **********//
    $('#start').datepicker({
        defaultDate: +1
    });

    var buttons = {};
    buttons[gettextTrans('Save')] = function() {
        startWaiting();
        var bValid = true;
        var ntab = $('#tabs').tabs('option', 'selected');
        d = 1;
        h = $('#hour').val();
        s = $('#start').val();
        if ($('#alarmRepeat').is(':checked')) { //solo se attiva la selezione da-a
            d = $('#days').val();
        }

        if ($('#alarmEnabled').is(':checked'))
            en = 1;
        else
            en = 0;

        if ($('#enableGroup').is(':checked'))
            group = 1;
        else
            group = 0;

        alarmFields.removeClass('ui-state-error');
        if (en == 1) //eseguo il check solo se la sveglia e' abilitata
            bValid = bValid && checkEmpty($('#hour'), "The time can not be empty", $('#validateAlarm')); //L'ora non può essere vuota
        bValid = bValid && checkEmpty($('#start'), "The day can not be empty", $('#validateAlarm')); //Il giorno non può essere vuoto
        if (bValid) {
            $('#alarmDialog').dialog('close');
            $('#content').load('alarm.php', {
                ext: id,
                hour: h,
                start: s,
                days: d,
                action: 'edit',
                enabled: en,
                group: group,
                ntab: ntab
            }, stopWaiting);
        }
    };
    buttons[gettextTrans('Cancel')] = function() {
        $(this).dialog('close');
        stopWaiting();
    };
    $("#alarmDialog").dialog({
        bgiframe: true,
        autoOpen: false,
        height: 330,
        modal: true,
        buttons: buttons,
        close: function() {
            alarmFields.val('').removeClass('ui-state-error');
        },
        open: function(e, ui) { //hack per evitare che il datepicker si apra sotto il dialog
            $(".ui-datepicker").css("z-index", $(this).parents('.ui-dialog').css('z-index') + 1);
        }
    });

    //********** Disable alarm dialog **********//
    var buttons = {};
    buttons[gettextTrans('Deactivate')] = function() {
        $(this).dialog('close');
        var ntab = $('#tabs').tabs('option', 'selected');
        if ($('#disableGroup').is(':checked'))
            disableGroup = 1;
        else
            disableGroup = 0;
        $('#content').load("alarm.php", {
            action: 'disable',
            ext: id,
            disableGroup: disableGroup,
            ntab: ntab
        }, stopWaiting);
    };
    buttons[gettextTrans('Cancel')] = function() {
        $(this).dialog('close');
        stopWaiting();
    }
    $("#confirmDisable").dialog({
        bgiframe: true,
        resizable: false,
        autoOpen: false,
        height: 140,
        modal: true,
        overlay: {
            backgroundColor: '#000',
            opacity: 0.5
        },
        buttons: buttons
    });

    //********** Report dialog **********//
    var buttons = {};
    buttons[gettextTrans('Print')] = function() {
        var surname = $('#name_' + id).text();
        printPartOfPage('print', gettextTrans('Call report - Room: ') + id + ' ' + surname);
    }
    buttons[gettextTrans('Close')] = function() {
        $(this).dialog('close');
    }

    $("#reportDialog").dialog({
        bgiframe: true,
        autoOpen: false,
        height: 500,
        width: 750,
        modal: true,
        buttons: buttons
    });

    //********** Group dialog **********//
    var buttons = {};
    buttons[gettextTrans('Save')] = function() {
        startWaiting();
        var ntab = $('#tabs').tabs('option', 'selected');
        var group = $('#group').val();
        $('#groupDialog').dialog('close');
        $('#content').load('group.php', {
            ext: id,
            action: 'set',
            group: group,
            ntab: ntab
        }, stopWaiting);

    };
    buttons[gettextTrans('Cancel')] = function() {
        $(this).dialog('close');
        stopWaiting();
    };

    $("#groupDialog").dialog({
        bgiframe: true,
        autoOpen: false,
        height: 100,
        modal: true,
        buttons: buttons,
        close: function() {
            alarmFields.val('').removeClass('ui-state-error');
        },
        open: function(e, ui) { //hack per evitare che il datepicker si apra sotto il dialog
            $(".ui-datepicker").css("z-index", $(this).parents('.ui-dialog').css('z-index') + 1);
        }
    });

    //********** Name dialog **********//
    var buttons = {};
    buttons[gettextTrans('Save')] = function() {
        startWaiting();
        var ntab = $('#tabs').tabs('option', 'selected');
        var surname = $('#contact').val();
        $('#surnameDialog').dialog('close');
        $('#content').load('surname.php', {
            ext: id,
            action: 'edit',
            name: surname,
            ntab: ntab
        }, stopWaiting);
    };
    buttons[gettextTrans('Cancel')] = function() {
        $(this).dialog('close');
        stopWaiting();
    };
    $("#surnameDialog").dialog({
        bgiframe: true,
        autoOpen: false,
        height: 100,
        modal: true,
        buttons: buttons,
        close: function() {
            alarmFields.val('').removeClass('ui-state-error');
        }
    });

    //********** Add Extra **********//

    $("#extraSet").dialog({
        bgiframe: true,
        width: 750,
        autoOpen: false,
        modal: true,
        close: function() {
            alarmFields.val('').removeClass('ui-state-error');
        },
        open: function(e, ui) { //hack per evitare che il datepicker si apra sotto il dialog
            $(".ui-datepicker").css("z-index", $(this).parents('.ui-dialog').css('z-index') + 1);
        }
    });

    $('#ButtonSave').live('click', function() {
        startWaiting();
        var name = $('#name').val();
        var num = $('#number').val();
        var ntab = $('#tabs').tabs('option', 'selected');
        extra = '';
        $("#showExtra :checked").each(function() {
            extra = extra + $(this).attr('id') + "/";
        })
        $('#number').val('');
        $('#name').val('');
        $.post('addextra.php', {
            ext: id,
            name: name,
            num: num,
            less: extra,
            ntab: ntab
        }, function() {
            $('#showExtra').load("rooms_extra.php?target=extra&ext=" + id);
        });
    });

    //***************************************************************************************//////

    $("#content").bind("click", function(e) {
        var link, element = $(e.target);
        var ntab = $('#tabs').tabs('option', 'selected');
        if (element.is("img") ||
            element.hasClass('room-lang')) { //utilizza i link che contengono le immagini

            element = element.parents("a");
        }
        if (element.is("a"))
            link = String(element.attr('href')).split("-");
        else if (element.is("input"))
            link = String(element.attr('id')).split("-");


        if (!link || link[0] !== "#ajax")
            return true;
        e.preventDefault();
        if (link[1] === 'checkIn') {
            startWaiting();
            id = link[2];
            $('#checkInDialog').dialog('option', 'title', 'Check-in: ' + link[2]);
            $('#checkInDialog').dialog('open');
            $('#ext-checkin').text(link[2]);
        } else if (link[1] === 'cleanRoom') {
            startWaiting();
            id = link[2];
            $('#confirmCleanroom').dialog('option', 'title', gettextTrans('Clean - Room: ') + link[2]);
            $('#confirmCleanroom').dialog('open');
            $('#ext-cleanroom').text(link[2]);
        } else if (link[1] === 'roomlang') {
            startWaiting();
            id = link[2];
            $('#changeRoomLangDialog').dialog('option', 'title', gettextTrans('Modify language: ') + link[2]);
            $('#changeRoomLangDialog').dialog('open');
            $('#changeRoomLangDialog select').val(link[3]);
        } else if (link[1] === 'checkOut') {
            startWaiting();
            id = link[2];
            $('#confirmCheckout #alertCost').html("");
            $.get("action.php", {
                action: 'checkCost',
                ext: id
            }, setCost);
            $('#confirmCheckout').dialog('option', 'title', gettextTrans('Check-out - Camera: ') + link[2]);
            $('#confirmCheckout').dialog('open');
            $('#ext-checkout').text(link[2]);

        } else if (link[1] === 'extra') {
            id = link[2]
            $('#extraSet').dialog('option', 'title', gettextTrans('Extra - Room: ') + id);
            $('#showExtra').load("rooms_extra.php?target=extra&ext=" + id);
            $('#extraSet').dialog('open');
        } else if (link[1] === 'enableAlarm') {
            startWaiting();
            id = link[2];
            $.ajax({
                url: "group.php",
                data: {
                    action: 'detail',
                    ext: id
                },
                success: setGroup,
                dataType: "xml",
                async: false
            });
            //reset values
            $('#hour').attr('value', '');
            $('#start').attr('value', '');
            $('#days').attr('value', '1');
            $('#alarmRepeat').attr('checked', '');
            $('#interval').hide();
            $('#alarmSettings').show();
            $('#alarmDialog').dialog('option', 'title', gettextTrans('Alarm - Room: ') + id);
            $('#alarmEnabled').attr("checked", "checked");
            $('#enableGroup').attr('checked', '');
            $('#start').attr('value', tomorrow);
            if ($('#group').attr('value') != "-1")
                $('#enableGroupContainer').show();
            else
                $('#enableGroupContainer').hide();

            $('#alarmDialog').dialog('open');
        } else if (link[1] === 'editAlarm') {
            startWaiting();
            //load current values
            id = link[2];
            $.ajax({
                url: "group.php",
                data: {
                    action: 'detail',
                    ext: id
                },
                success: setGroup,
                dataType: "xml",
                async: false
            });
            $('#enableGroup').attr('checked', '');
            if ($('#group').attr('value') != "-1")
                $('#enableGroupContainer').show();
            else
                $('#enableGroupContainer').hide();

            $('#alarmDialog').dialog('option', 'title', gettextTrans('Alarm - Room: ') + id);
            $.get("alarm.php", {
                action: 'detail',
                ext: id
            }, setAlarm);
            $('#alarmDialog').dialog('open');
        } else if (link[1] === 'disableAlarm') {
            startWaiting();
            //load current values
            id = link[2];
            $.ajax({
                url: "group.php",
                data: {
                    action: 'detail',
                    ext: id
                },
                success: setGroup,
                dataType: "xml",
                async: false
            });
            $('#disableGroup').attr('checked', '');
            if ($('#group').attr('value') != "-1")
                $('#disableGroupContainer').show();
            else
                $('#disableGroupContainer').hide();

            $('#confirmDisable').dialog('option', 'title', gettextTrans('Alarm - Room: ') + id);
            $('#confirmDisable').dialog('open');
        } else if (link[1] === 'report') {
            id = link[2];
            var surname = $('#name_' + id).text();
            $('#reportDialog').dialog('option', 'title', gettextTrans('Report - Room: ') + id + ' ' + surname);
            $('#report').load("report.php?target=report&ext=" + id);
            $('#reportDialog').dialog('open');
        } else if (link[1] === 'editGroup') {
            startWaiting();
            id = link[2];
            //reset values
            $.get("group.php", {
                action: 'detail',
                ext: id
            }, setGroup);
            $('#groupDialog').dialog('option', 'title', gettextTrans('Gruppo - Room: ') + id);
            $('#groupDialog').dialog('open');

        } else if (link[1] === 'editSurname') {
            startWaiting();
            id = link[2];
            $('#surnameDialog').dialog('option', 'title', gettextTrans('Name - Room: ') + id); //Nome - Camera: 
            $('#surnameDialog').dialog('open');
            $('#contact').val($('#name_' + id).text().trim());
        } else if (link[1] === 'disableAlarmAlert') {
            startWaiting();
            id = link[2];
        }

        return true;
    });


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


    //set alarm dialog fields
    function setAlarm(xml) {
        $(xml).find('response').each(function() {
            $('#hour').attr('value', $(this).find('hour').text());
            if ($(this).find('enabled').text() == "1") {
                $('#alarmEnabled').attr('checked', 'checked');
                $('#alarmSettings').show();
            } else {
                $('#alarmEnabled').removeAttr('checked');
                $('#alarmSettings').hide();
            }

            $('#start').attr('value', $(this).find('start').text());
            $('#days').attr('value', $(this).find('days').text());

            if ($(this).find('days').text() > 1) {
                $('#alarmRepeat').attr('checked', "1");
                $('#interval').show();
            } else {
                $('#alarmRepeat').attr('checked', '');
                $('#interval').hide();
            }

        });
    }

    //set group dialog fields
    function setGroup(xml) {
        $(xml).find('response').each(function() {
            $('#group').attr('value', $(this).find('group').text());
        });
    }

    //set alarm cost
    function setCost(xml) {
        if (xml == 'true') {   //ATTENZIONE costi da saldare
            $.get("action.php", {
                action: "getTranslation",
                string: "WARNING costs to be paid"
            }, function(resp) {
                $('#alertCost').text(resp);
            });
        }
    }

    //context menu
    $('#content').contextMenu('menu', {
        bindings: {
            'cleanroom': function(t) {
                startWaiting();
                $('#confirmCleanroom').dialog('option', 'title', gettextTrans('Clean - Room: ') + id);
                $('#confirmCleanroom').dialog('open');
                $('#ext-cleanroom').text(id);
            },
            'checkin': function(t) {
                startWaiting();
                $('#content').load("check-in.php", {
                    ext: id
                }, stopWaiting);
            },
            'checkout': function(t) {
                startWaiting();
                $('#confirmCheckout').dialog('option', 'title', gettextTrans('Check-out - Room: ') + id);
                $('#confirmCheckout').dialog('open');
                $('#ext-checkout').text(id);
            },
            'enableAlarm': function(t) {
                startWaiting();
                //reset values
                $('#hour').attr('value', '');
                $('#start').attr('value', '');
                $('#days').attr('value', '1');
                $('#alarmRepeat').attr('checked', '');
                $('#interval').hide("blind");
                $('#alarmSettings').show();

                $('#alarmDialog').dialog('option', 'title', gettextTrans('Alarm - Room: ') + id);
                $('#alarmEnabled').attr("checked", "checked");
                $('#alarmDialog').dialog('open');
                $('#start').attr('value', tomorrow);
            },
            'editAlarm': function(t) {
                startWaiting();
                //load current values
                $('#alarmDialog').dialog('option', 'title', gettextTrans('Alarm - Room: ') + id);
                $.get("alarm.php", {
                    action: 'detail',
                    ext: id
                }, setAlarm);
                $('#alarmDialog').dialog('open');
            },
            'disableAlarm': function(t) {
                startWaiting();
                //load current values
                $('#confirmDisable').dialog('option', 'title', gettextTrans('Alarm - Room: ') + id);
                $('#confirmDisable').dialog('open');
            },
            'disableAlarmAlert': function(t) {
                startWaiting();
                $.get("alarm.php", {
                    action: 'disableAlarmAlert',
                    ext: id
                });
                $('#alarmFailed'+id).remove();
            },
            'showReport': function(t) {
                var surname = $('#name_' + id).text();
                $('#reportDialog').dialog('option', 'title', gettextTrans('Report - Room: ') + id + ' ' + surname);
                $('#report').load("report.php?target=report&ext=" + id);
                $('#reportDialog').dialog('open');
            },
            'displayExtra': function(t) {
                $('#extraSet').dialog('option', 'title', gettextTrans('Extra - Room: ') + id);
                $('#extra').load("rooms_extra.php?target=extra&ext=" + id);
                $('#extraSet').dialog('open');
            },
            'showSurname': function(t) {
                startWaiting();
                $('#surnameDialog').dialog('option', 'title', gettextTrans('Name - Room: ') + id);
                $('#surnameDialog').dialog('open');
                $('#contact').val($('#name_' + id).text());
            }
        },

        onShowMenu: function(e, menu) {
            if ($(e.target).is('.action')) {
                id = $(e.target).parent().parent().parent().attr('id');
            } else if (!$(e.target).is('.room'))
                id = $(e.target).parent().attr('id');
            else
                id = $(e.target).attr('id');
            if ($(e.target).is('.free') || $(e.target).parents().is('.free')) {
                $('#checkout, #displayExtra, #showReport, #enableAlarm, #editAlarm, #disableAlarm, #disableAlarmAlert, #showSurname', menu).remove();
            }
            if ($(e.target).is('.occupied') || $(e.target).parents().is('.occupied')) {
                $('#checkin', menu).remove();
            }
            if ($(e.target).is('.alarmEnabled') || $(e.target).parents().is('.alarmEnabled')) {
                $('#enableAlarm', menu).remove();
            }
            if ($(e.target).is('.alarmDisabled') || $(e.target).parents().is('.alarmDisabled')) {
                $('#disableAlarm, #editAlarm', menu).remove();
            }
            if (! $(e.target).is('.alarmFailed') && ! $(e.target).parents().is('.alarmFailed')) {
                $('#disableAlarmAlert', menu).remove();
            }
            return menu;


        }
    });

});
