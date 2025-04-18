//********* Utility *******//
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

function printPartOfPage(elementId, title) {
    var printContent = document.getElementById(elementId);
    var windowUrl = 'about:blank';
    var uniqueName = new Date();
    var windowName = gettextTrans('Print') + uniqueName.getTime();
    if ($.browser.webkit) {
        var printWindow = window.open(windowUrl, windowName);

        printWindow.document.write('<html><head><title>'+gettextTrans('Print')+'</title><link rel="stylesheet" type="text/css" href="css/print.css" media="print" /></head><body>');
        printWindow.document.write('<h2>' + title + '</h2>');
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
    } else {
        var printWindow = window.open(windowUrl, windowName, 'left=5000,top=5000,width=1,height=1');

        printWindow.document.write('<html><head><title>'+gettextTrans('Print')+'</title><link rel="stylesheet" type="text/css" href="css/print.css" media="print" /></head><body>');
        printWindow.document.write('<h2>' + title + '</h2>');
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }
}


function startWaiting() {
    $("#waiting").show();
}

function stopWaiting(res) {
    $("#waiting").hide();
}

function updateTips(tips, msg) {
    tips.show();
    $.get("action.php", {
        action: "getTranslation",
        string: msg
    }, function(resp) {
        tips.text(resp).effect("highlight", {}, 1500);
    });
    //    tips.text(msg).effect("highlight",{},1500);
}

function checkEmpty(o, msg, tips) {
    //alert("checkempty: "+o.val());
    if (o.val().length == 0) {
        o.addClass('ui-state-error');
        updateTips(tips, msg);
        return false;
    } else {
        return true;
    }
}

function checkDefined(o, arr, msg, tips) {
    //alert("checkempty: "+o.val());
    for (x in arr) {
        if (arr[x] == o.val()) {
            o.addClass('ui-state-error');
            updateTips(tips, msg);
            return false;
        }
    }
    return true;
}

function checkMinLength(o, l, msg, tips) {
    if (o.val().length < l) {
        o.addClass('ui-state-error');
        updateTips(tips, msg);
        return false;
    } else
        return true;
}

function gettext(index) {
    var it = new Array();
    it[0] = "Salva";
    it[1] = "Annulla";
    //..

    var en = new Array();
    en[0] = "Save";
    en[1] = "Cancel";
    //...

    var es = new Array();
    es[0] = "Guardar";
    es[1] = "Cancellar";
    //...

    var lang = readCookie('lang');
    if (lang == "it_IT") {
        return it[index];
    } else if (lang == "es_ES") {
        return es[index];
    } else
        return en[index];
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}



var translated;
var untranslated = new Array(
    'Save',
    'Cancel',
    'Enable filter',
    'Disable filter'
);

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