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

    var d = new Date();
    d.setDate(d.getDate() - 7);
    var curr_date = d.getDate();
    if (curr_date < 10)
        curr_date = '0' + curr_date;
    var curr_month = d.getMonth();
    curr_month++; //i mesi partono da zero
    if (curr_month < 10)
        curr_month = '0' + curr_month;
    var curr_year = d.getFullYear();
    var lastweek = (curr_date + "/" + curr_month + "/" + curr_year);

    var enableFilter = true;

    d = new Date();
    curr_date = d.getDate();
    if (curr_date < 10)
        curr_date = '0' + curr_date;
    var curr_month = d.getMonth();
    curr_month++; //i mesi partono da zero
    if (curr_month < 10)
        curr_month = '0' + curr_month;
    var curr_year = d.getFullYear();
    var today = (curr_date + "/" + curr_month + "/" + curr_year);



    $("#result").bind("click", function(e) {
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
        if (link[1] === 'report') {
            id = link[2];
            start = link[3];
            end = link[4];
            $('#report').load('report.php?ext=' + id + '&start=' + start + '&end=' + end);
            $('#historyDialog').dialog('option', 'title', 'Report - Camera: ' + id);
            $('#historyDialog').dialog('open');
        }
        return true;
    });

    $("#filter").bind("click", function(e) {
        var link, element = $(e.target);

        if (element.is("a"))
            link = String(element.attr('href')).split("-");

        if (!link || link[0] !== "#ajax")
            return true;
        if (link[1] === 'filter') {
            if (enableFilter) {
                $("#search").hide();
                $("#filter a").html("Enable filter"); //Abilita filtro
            } else {
                $("#search").show();
                $("#filter a").html("Disable filter"); //Disabilita filtro
            }

            enableFilter = !enableFilter;
            filter();

        }
        return true;
    });

    var buttons = {};
    buttons[gettextTrans('Print')] = function() {
        printPartOfPage('print', gettextTrans('Call report - Room: ') + id);
    };
    buttons[gettextTrans('Close')] = function() {
        $(this).dialog('close');
    };
    $("#historyDialog").dialog({
        bgiframe: true,
        autoOpen: false,
        height: 500,
        width: 700,
        modal: true,
        buttons: buttons
    });

    $('#start').attr('value', lastweek);
    $('#start').datepicker();
    $('#end').attr('value', today);
    $('#end').datepicker();

    $('#room').change(function() {
        filter();
    });

    $('#start').change(function() {
        filter();
    });

    $('#end').change(function() {
        filter();
    });


    function filter() {
        startWaiting();
        if (enableFilter) {
            ext = $('#room').attr('value');
            sstart = $('#start').attr('value');
            eend = $('#end').attr('value');
            $('#result').load('filter_history.php?ext=' + ext + '&start=' + sstart + '&end=' + eend);
        } else
            $('#result').load('filter_history.php');
        stopWaiting();
    }

    filter();
}); //end ready function