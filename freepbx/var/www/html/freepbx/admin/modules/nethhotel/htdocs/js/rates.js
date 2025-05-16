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

    $('#hbutton').click(function() {
        if ($('#help').is(':visible'))
            $('#help').hide('normal');
        else
            $('#help').show('normal');
    });


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
        if (link[1] === 'addRate') {
            $('#duration').attr('value', '');
            $('#price').attr('value', '');
            $('#answer_duration').attr('value', '');
            $('#answer_price').attr('value', '');
            $('#pattern').attr('value', '');
            $('#enabled').attr('checked', '');
            $('#name').attr('value', '');

            $('#action').attr('value', 'addRate');
            $('#id').attr('value', '');

            $('#pattern').removeClass('ui-state-error');
            $('#name').removeClass('ui-state-error');
            $('#validateRate').hide();
            $('#help').hide();

            $('#rateDialog').dialog('open');
        }
        if (link[1] === 'editRate') {
            $.get("action.php", {
                action: 'detailRate',
                id: link[2]
            }, setRate);

            $('#action').attr('value', 'editRate');
            $('#id').attr('value', link[2]);

            $('#pattern').removeClass('ui-state-error');
            $('#name').removeClass('ui-state-error');
            $('#validateRate').hide();
            $('#help').hide();


            $('#rateDialog').dialog('open');
        }
        if (link[1] === 'deleteRate') {
            startWaiting();
            $.get("action.php", {
                action: 'deleteRate',
                id: link[2]
            }, function(data) {
                $('#table').load("action.php?action=loadRate", stopWaiting);
            });
        }


        return true;
    });

    var buttons = {};
    buttons[gettextTrans('Save')] = function() {
        startWaiting();
        bValid = true;

        if ($('#enabled').is(':checked'))
            en = 1;
        else
            en = 0;

        bValid = bValid && checkEmpty($('#name'), "The name can not be empty", $('#validateRate')); //Il nome non può essere vuoto
        bValid = bValid && checkEmpty($('#pattern'), "The pattern can not be empty", $('#validateRate')); //Il pattern non può essere vuoto
        $('#validateRate').show();

        if (bValid) {
            $('#rateDialog').dialog('close');
            $.get("action.php", {
                action: $('#action').val(),
                id: $('#id').val(),
                name: $('#name').val(),
                duration: $('#duration').val(),
                price: $('#price').val(),
                answer_duration: $('#answer_duration').val(),
                answer_price: $('#answer_price').val(),
                pattern: $('#pattern').val(),
                enabled: en
            }, function(data) {
                $('#table').load("action.php?action=loadRate", stopWaiting);
            });
        }
    };
    buttons[gettextTrans('Cancel')] = function() {
        $(this).dialog('close');
        stopWaiting();
    };
    $("#rateDialog").dialog({
        bgiframe: true,
        autoOpen: false,
        width: 500,
        modal: true,
        buttons: buttons,
        close: function() {},
    });


    //set alarm dialog fields
    function setRate(xml) {
        $(xml).find('response').each(function() {
            $('#duration').attr('value', $(this).find('duration').text());
            $('#price').attr('value', $(this).find('price').text());
            $('#answer_duration').attr('value', $(this).find('answer_duration').text());
            $('#answer_price').attr('value', $(this).find('answer_price').text());
            $('#pattern').attr('value', $(this).find('pattern').text());
            $('#name').attr('value', $(this).find('name').text());

            if ($(this).find('enabled').text() == "1") {
                $('#enabled').attr('checked', 'checked');
            } else {
                $('#enabled').removeAttr('checked');
            }
        });
    }

}); //end ready function