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
        if (link[1] === 'newExtra') {
            $('#price').attr('value', '');
            $('#code').attr('value', '');
            $('#enabled').attr('checked', '');
            $('#name').attr('value', '');

            $('#action').attr('value', 'newExtra');
            $('#id').attr('value', '');

            $('#code').removeClass('ui-state-error');
            $('#name').removeClass('ui-state-error');
            $('#validateExtra').hide();
            $('#help').hide();

            $('#extraDialog').dialog('open');
        }
        if (link[1] === 'editExtra') {
            $.get("action.php", {
                action: 'detailExtra',
                id: link[2]
            }, setExtra);

            $('#action').attr('value', 'editExtra');
            $('#id').attr('value', link[2]);

            $('#code').removeClass('ui-state-error');
            $('#name').removeClass('ui-state-error');
            $('#validateExtra').hide();
            $('#help').hide();


            $('#extraDialog').dialog('open');
        }
        if (link[1] === 'deleteExtra') {
            startWaiting();
            $.get("action.php", {
                action: 'deleteExtra',
                id: link[2]
            }, function(data) {
                $('#table').load("action.php?action=loadExtra", stopWaiting);
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
        bValid = bValid && checkEmpty($('#name'), "The name can not be empty", $('#validaeExtra')); //Il nome non può essere vuoto
        bValid = bValid && checkEmpty($('#code'), "The code can not be empty", $('#valiateExtra')); //Il codice non può essere vuoto
        $('#validateExtra').show();

        if (bValid) {
            $('#extraDialog').dialog('close');
            $.get("action.php", {
                action: $('#action').val(),
                id: $('#id').val(),
                name: $('#name').val(),
                price: $('#price').val(),
                code: $('#code').val(),
                enabled: en
            }, function(data) {
                $('#table').load("action.php?action=loadExtra", stopWaiting);
            });
        }
    };
    buttons[gettextTrans('Cancel')] = function() {
        $(this).dialog('close');
        stopWaiting();
    }
    $("#extraDialog").dialog({
        bgiframe: true,
        autoOpen: false,
        width: 500,
        modal: true,
        buttons: buttons,
        close: function() {},
    });


    //set alarm dialog fields
    function setExtra(xml) {
        $(xml).find('response').each(function() {
            $('#price').attr('value', $(this).find('price').text());
            $('#code').attr('value', $(this).find('code').text());
            $('#name').attr('value', $(this).find('name').text());

            if ($(this).find('enabled').text() == "1") {
                $('#enabled').attr('checked', 'checked');
            } else {
                $('#enabled').removeAttr('checked');
            }
        });
    }

}); //end ready function