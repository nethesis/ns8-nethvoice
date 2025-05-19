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

    $('#groupname').live("change", function() {

        $('#detailgroup').load('action.php', {
            action: 'getTimeGroupsDetailsFromIdGroups',
            id: $(this).val()
        });

        if ($(this).val() == '0') {
            $('#falsegoto').attr('value', '');
            $('#falsegoto').attr('disabled', true);
        } else $('#falsegoto').attr('disabled', false);

    })

    function gettext(text, cb) {
        if (translated === undefined) {
            $.getJSON("action.php?", {
                action: 'gettext',
                untranslated: JSON.stringify(untranslated)
            }, function(data) {
                translated = data;
                if (data[text] === undefined) {
                    cb(text);
                } else {
                    cb(data[text]);
                }
            });
        } else {
            if (translated[text] === undefined) {
                cb(text);
            } else {
                cb(translated[text]);
            }
        }
    }

    function _(text, stringid, element) {
        stringid = stringid || null;
        element = element || null;
        //output text string in span
        //uses gettext callback       
        var id;
        if (translated !== undefined)
            if (translated[text] !== undefined) {
                return translated[text];
            } else {
                return text;
            }
        if (stringid === null) {
            id = 'trs' + text.hashCode();
        } else {
            id = stringid;
        }
        if (element === null) {
            gettext(text, function(translatedtext) {
                $('#' + id).text(translatedtext);
            });
            return '<span id="' + id + '">' + text + '</span>';
        } else {
            gettext(text, function(translatedtext) {
                $('#' + id).attr(element, translatedtext);
            });
            return text;
        }
    }

    $("#content").bind("click", function(e) {
        var link, element = $(e.target);
        if (element.is("img")) //utilizza i link che contengono le immagini
            element = element.parents("a");

        if (element.is("a"))
            link = String(element.attr('href')).split("-");
        else if (element.is("input"))
            link = String(element.attr('id')).split("-");

        if (!link || link[0] !== "#ajax")
            return true;
        e.preventDefault();
        if (link[1] === 'addCode') {
            $("#SelectTimeGroup").load("action.php", {
                action: 'createOptionTimeGroups',
                id: 0
            });
            $('#detailgroup').load('action.php', {
                action: 'getTimeGroupsDetailsFromId',
                id: link[2]
            });
            $('#code').attr('value', '');
            $('#number').attr('value', '');
            $('#note').attr('value', '');
            $('#falsegoto').attr('value', '');
            $('#code').removeClass('ui-state-error');
            $('#number').removeClass('ui-state-error');
            $('#action').attr('value', 'addCode');
            $('#id').attr('value', '');
            $('#code').removeAttr("disabled");
            $('#validateCode').hide();
            $('#codeDialog').dialog('open');
        }
        if (link[1] === 'editCode') {
            $.get("action.php", {
                action: 'detailCode',
                id: link[2]
            }, setCode);
            $('#action').attr('value', 'editCode');
            $('#id').attr('value', link[2]);
            $('#SelectTimeGroup').load('action.php', {
                action: 'createOptionTimeGroups',
                id: link[2]
            });
            $('#detailgroup').load('action.php', {
                action: 'getTimeGroupsDetailsFromId',
                id: link[2]
            });
            $('#code').removeClass('ui-state-error');
            $('#number').removeClass('ui-state-error');
            $('#validateCode').hide();
            $('#code').attr("disabled", true);

            $('#codeDialog').dialog('open');
        }
        if (link[1] === 'deleteCode') {
            startWaiting();
            $.get("action.php", {
                action: 'deleteCode',
                id: link[2]
            }, function(data) {
                $('#table').load("action.php?action=loadCode", stopWaiting);
            });
        }


        return true;
    });

    var buttons = {};
    buttons[gettextTrans('Save')] = function() {
        startWaiting();
        bValid = true;
        if ($('#action').val() != "editCode") { //esegui i controlli su code solo se si sta creando un nuovo numero breve
            bValid = bValid && checkMinLength($('#code'), 1, "Minimal length short number: 1 ", $('#validateCode')); //Lunghezza minima numero breve: 1 
            bValid = bValid && checkEmpty($('#code'), "The code can not be empty", $('#validateCode')); //Il codice non può essere vuoto
            bValid = bValid && checkDefined($('#code'), codes, "Short number already defined", $('#validateCode')); //Numero breve già definito
        }
        bValid = bValid && checkEmpty($('#number'), "The number can not be empty", $('#validateCode')); //Il numero non può essere vuoto
        $('#validateCode').show();
        if (bValid) {
            $('#codeDialog').dialog('close')
            $.get("action.php", {
                action: $('#action').val(),
                id: $('#id').val(),
                code: $('#code').val(),
                number: $('#number').val(),
                note: $('#note').val(),
                falsegoto: $('#falsegoto').val(),
                id_timegroups_groups: $('#groupname').val()
            }, function(data) {
                $('#table').load("action.php?action=loadCode", stopWaiting);
            });
        }
    };
    buttons[gettextTrans('Cancel')] = function() {
        $(this).dialog('close');
        stopWaiting();
    };
    $("#codeDialog").dialog({
        bgiframe: true,
        autoOpen: false,
        width: 300,
        modal: true,
        buttons: buttons
    });
    //set alarm dialog fields
    function setCode(xml) {
        $(xml).find('response').each(function() {
            $('#code').attr('value', $(this).find('code').text());
            $('#number').attr('value', $(this).find('number').text());
            $('#note').attr('value', $(this).find('note').text());
            $('#falsegoto').attr('value', $(this).find('falsegoto').text());
        });

    }

}); //end ready function