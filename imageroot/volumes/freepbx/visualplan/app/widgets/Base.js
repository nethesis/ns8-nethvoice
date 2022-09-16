/**
 * This script is used to:
 * - create figures in after drop and form save
 */

Base = draw2d.shape.layout.VerticalLayout.extend({

    NAME: "Base",

    init: function (attr) {
        this.tooltip = null;

        this._super($.extend({
            width: 50,
            height: 50
        }, attr));

        this.classLabel = new draw2d.shape.basic.Label({
            text: "ClassName",
            stroke: 0,
            padding: 10,
            resizeable: true,
            bold: true,
            fontColor: "#ffffff",
            fontSize: 14
        });
        this.add(this.classLabel);
    },

    addEntity: function (txt, type, optionalIndex) {
        var padding = {
            left: 30,
            top: 5,
            right: 30,
            bottom: 5
        };
        var bgColor = "#f7f7f7";

        if (type == "input") {
            padding = {
                left: 10,
                top: 5,
                right: 50,
                bottom: 5
            };
        }
        if (type == "output") {
            padding = {
                left: 50,
                top: 5,
                right: 10,
                bottom: 5
            };
        }

        if (type === "list") {
            if (txt && txt !== "") {

                if (txt.includes('from-queue')) {
                    txt = txt.replace(/Local\//g, "\n").replace(/@from-queue\/n/g, "");
                }
                var membersCheck = txt.match(/-?\d+(,\d+|#|)/g);
                var members = "";
                if (membersCheck) {
                    switch (optionalIndex) {
                        case 'ext-group':
                            members = txt.replace(/-/g, " ").match(/\d+(#|)/g);
                            break;
                        case 'ext-queues':
                            members = txt.replace(/-/g, " ").match(/\d+(,\d+|)/g);
                            break;
                        default:
                            members = txt.replace(/-/g, " ").match(/-?\d+(,\d+|#|)/g);
                            break;
                    }
                    txt = members.join("\n");
                }
            }

            padding = {
                left: 40,
                top: 5,
                right: 10,
                bottom: 5
            };
            bgColor = "#ffffff";
        }

        // create label
        var label = new draw2d.shape.basic.Label({
            text: txt,
            stroke: 0,
            bgColor: bgColor,
            padding: padding,
            fontColor: "#4a4a4a",
            resizeable: true,
            userData: {
                name: this.id.split("%")[0]
            }
        });

        // create port
        if (type === "input" || type == "output") {
            var port = label.createPort(type);
            port.setWidth(14);
            port.setHeight(14);
            port.setName(type + "_" + label.id);
            if (type == "output") {
                port.setMaxFanOut(1);
            }
        }

        // add context menu
        this.contextMenu(label, this);

        if ($.isNumeric(optionalIndex)) {
            this.add(label, null, optionalIndex + 1);
        } else {
            this.add(label);
        }

        return label;
    },

    contextMenu: function (label, table) {
        var idType = table.id.split("%")[0];

        switch (idType) {
            case "ivr":
                label.on("contextmenu", function (emitter, event) {
                    var items = {};
                    if (isNaN(emitter.text)) {
                        items["add"] = {
                            name: languages[browserLang]["base_add_ivr_opt_string"]
                        };
                    } else {
                        items["add"] = {
                            name: languages[browserLang]["base_add_ivr_opt_string"]
                        };
                        items["delete"] = {
                            name: languages[browserLang]["base_delete_ivr_opt_string"] + " " + emitter.text
                        };
                    }
                    $.contextMenu({
                        selector: 'body',
                        itemClickEvent: "click",
                        events: {
                            hide: function () {
                                $.contextMenu('destroy');
                            }
                        },
                        callback: $.proxy(function (key, options) {
                            switch (key) {
                                case "add":
                                    var cNum = table.children.data.length - 5;
                                    var dialog = $('<div id="modalCreation"></div>')
                                        .dialog({
                                            position: 'center',
                                            autoOpen: false,
                                            resizable: false,
                                            width: 500,
                                            modal: true,
                                            close: function (ev, ui) {
                                                $(this).dialog('destroy').remove();
                                            },
                                            buttons: {
                                                Cancel: function () {
                                                    $(this).dialog('destroy').remove();
                                                },
                                                Save: function (e) {
                                                    var ivrVal = $('#ivr-option').val();

                                                    // update values
                                                    setTimeout(function () {
                                                        table.addEntity(ivrVal, "output", "false");
                                                    }, 10);

                                                    $('#modalCreation').dialog('destroy').remove();
                                                }
                                            },
                                            title: languages[browserLang]["base_ivr_option_string"]
                                        });
                                    $(".ui-dialog-titlebar").css("background", "#7f8c8d");
                                    // inject html
                                    var html = "";
                                    html += '<div class="form-horizontal">';
                                    html += '<div class="form-group">';
                                    html += '<label class="col-sm-4 control-label label-creation">' + languages[browserLang]["view_number_string"] + ': </label>';
                                    html += '<div class="col-sm-7">';
                                    html += '<input autofocus type="number" value="" usable id="ivr-option" class="form-control input-creation"></input>';
                                    html += '</div>';
                                    html += '</div>';
                                    dialog.html(html);

                                    // show dialog
                                    dialog.dialog("open");
                                    $('.ui-widget-overlay').bind('click', function () {
                                        dialog.dialog('destroy').remove();
                                    });
                                    break;
                                case "delete":
                                    if (table.children.data.length > 5) {
                                        var cmd = new draw2d.command.CommandDelete(emitter);
                                        emitter.getCanvas().getCommandStack().execute(cmd);
                                    }
                                    break;
                                default:
                                    break;
                            }
                        }, this),
                        position: function (opt, x, y) {
                            var scrollTopVal = app.view.getScrollArea().scrollTop();
                            var scrollLeftVal = app.view.getScrollArea().scrollLeft();
                            opt.$menu.css({
                                top: event.y / app.view.getZoom() + 25 - scrollTopVal,
                                left: event.x / app.view.getZoom() + 55 - scrollLeftVal
                            });
                        },
                        items: items
                    });
                });
                break;
            case "cqr":
                label.on("contextmenu", function (emitter, event) {
                    var items = {};
                    if (isNaN(emitter.text)) {
                        items["add"] = {
                            name: languages[browserLang]["base_add_ivr_opt_string"]
                        };
                    } else {
                        items["add"] = {
                            name: languages[browserLang]["base_add_ivr_opt_string"]
                        };
                        items["delete"] = {
                            name: languages[browserLang]["base_delete_ivr_opt_string"] + " " + emitter.text
                        };
                    }
                    $.contextMenu({
                        selector: 'body',
                        itemClickEvent: "click",
                        events: {
                            hide: function () {
                                $.contextMenu('destroy');
                            }
                        },
                        callback: $.proxy(function (key, options) {
                            switch (key) {
                                case "add":
                                    var cNum = table.children.data.length - 5;
                                    var dialog = $('<div id="modalCreation"></div>')
                                        .dialog({
                                            position: 'center',
                                            autoOpen: false,
                                            resizable: false,
                                            width: 500,
                                            modal: true,
                                            close: function (ev, ui) {
                                                $(this).dialog('destroy').remove();
                                            },
                                            buttons: {
                                                Cancel: function () {
                                                    $(this).dialog('destroy').remove();
                                                },
                                                Save: function (e) {
                                                    var cqrVal = $('#cqr-option').val();

                                                    // update values
                                                    setTimeout(function () {
                                                        table.addEntity(cqrVal, "output", "false");
                                                    }, 10);

                                                    $('#modalCreation').dialog('destroy').remove();
                                                }
                                            },
                                            title: languages[browserLang]["base_cqr_option_string"]
                                        });
                                    $(".ui-dialog-titlebar").css("background", "#7f8c8d");
                                    // inject html
                                    var html = "";
                                    html += '<div class="form-horizontal">';
                                    html += '<div class="form-group">';
                                    html += '<label class="col-sm-4 control-label label-creation">' + languages[browserLang]["view_number_string"] + ': </label>';
                                    html += '<div class="col-sm-7">';
                                    html += '<input autofocus type="text" value="" usable id="cqr-option" class="form-control input-creation"></input>';
                                    html += '</div>';
                                    html += '</div>';
                                    dialog.html(html);

                                    // show dialog
                                    dialog.dialog("open");
                                    $('.ui-widget-overlay').bind('click', function () {
                                        dialog.dialog('destroy').remove();
                                    });
                                    break;
                                case "delete":
                                    if (table.children.data.length > 5) {
                                        var cmd = new draw2d.command.CommandDelete(emitter);
                                        emitter.getCanvas().getCommandStack().execute(cmd);
                                    }

                                    break;
                                default:
                                    break;
                            }
                        }, this),
                        position: function (opt, x, y) {
                            var scrollTopVal = app.view.getScrollArea().scrollTop();
                            var scrollLeftVal = app.view.getScrollArea().scrollLeft();
                            opt.$menu.css({
                                top: event.y / app.view.getZoom() + 25 - scrollTopVal,
                                left: event.x / app.view.getZoom() + 55 - scrollLeftVal
                            });
                        },
                        items: items
                    });
                });
                break;
        }
    },

    onDrop: function (droppedDomNode, x, y, elements) {
        this.creationSwitch(elements, droppedDomNode[0].id, $(droppedDomNode[0]).text().trim());
    },

    creationSwitch: function (elem, type, title) {
        var randLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        var id = randLetter + Date.now();

        var templateObj = {
            bgColor: "#dbddde",
            name: title,
            type: "Base",
            userData: []
        };

        switch (type) {
            case "app-blackhole":
                templateObj.id = type + "%" + id;
                templateObj.bgColor = "#cf000f";
                templateObj.radius = 20;
                templateObj.entities = [{
                    text: languages[browserLang]["base_hangup_string"],
                    id: "hangup_dest%" + id,
                    type: "input"
                }];
                break;

            case "incoming":
                var sufx = elem[1].value;
                // if (sufx.slice(-1) !== ".")
                //     sufx = sufx + ".";

                templateObj.id = type + "%" + elem[0].value + " / " + sufx;
                templateObj.bgColor = "#87d37c";
                templateObj.radius = 20;
                templateObj.entities = [{
                    text: elem[0].value + " / " + sufx + " ( " + elem[2].value + " )",
                    id: "incoming_route-num%" + id,
                    type: "output"
                }];
                break;

            case "from-did-direct":
                templateObj.id = type + "%" + elem[0].value;
                templateObj.bgColor = "#27ae60";
                templateObj.radius = 20;
                templateObj.entities = [{
                    text: elem[1].value + " ( " + elem[0].value + " )",
                    id: "from-did-direct_dest%" + id,
                    type: "input"
                }];
                break;

            case "ext-local":
                templateObj.id = type + "%" + id;
                templateObj.bgColor = "#16a085";
                templateObj.radius = 20;
                var dynId = (elem[0].value.split("(")[1]).split(")")[0].trim();
                templateObj.entities = [{
                    text: elem[0].value + " - " + languages[browserLang]["base_busy_string"],
                    id: "ext-local%vmb" + dynId,
                    type: "input"
                }, {
                    text: elem[0].value + " - " + languages[browserLang]["base_nomsg_string"],
                    id: "ext-local%vms" + dynId,
                    type: "input"
                }, {
                    text: elem[0].value + " - " + languages[browserLang]["base_unavailable_string"],
                    id: "ext-local%vmu" + dynId,
                    type: "input"
                }];
                break;

            case "ext-group":
                templateObj.id = type + "%" + elem[0].value;
                templateObj.bgColor = "#2980b9";
                templateObj.radius = 0;
                templateObj.entities = [{
                    text: elem[1].value + " ( " + elem[0].value + " )",
                    id: "groups_name%" + id,
                    type: "input"
                }, {
                    text: languages[browserLang]["base_ext_list_string"],
                    id: "groups_listtext%" + id,
                    type: "text"
                }, {
                    text: elem[2].value,
                    id: "groups_lists%" + id,
                    type: "list"
                }, {
                    text: languages[browserLang]["view_strategy_string"] + " ( " + elem[3].value + " )",
                    id: "groups_strategy%" + id,
                    type: "text"
                }, {
                    text: languages[browserLang]["view_ringtime_string"] + " ( " + elem[4].value + " )",
                    id: "groups_ringtime%" + id,
                    type: "text"
                }, {
                    text: languages[browserLang]["base_fail_dest_string"],
                    id: "groups_output%" + id,
                    type: "output"
                }];
                // set group data inside userData
                templateObj.userData = {
                    name: elem[1].value,
                    extension: elem[0].value,
                    list: elem[2].value,
                    strategy: elem[3].value,
                    ringtime: elem[4].value
                };
                break;

            case "ext-queues":
                templateObj.id = type + "%" + elem[0].value;
                templateObj.bgColor = "#9b59b6";
                templateObj.radius = 0;

                if (elem[5].value == 1) {
                    var timeout = "1 " + languages[browserLang]["view_queuesTimeString_second"];
                } else if (elem[5].value < 60) {
                    var timeout = elem[5].value + " " + languages[browserLang]["view_queuesTimeString_seconds"];
                } else {
                    var tmpTimeout = "view_queuesTimeString_minutes_" + elem[5].value;
                    var timeout = languages[browserLang][tmpTimeout];
                }

                if (elem[6].value == 1) {
                    var maxwait = "1 " + languages[browserLang]["view_queuesTimeString_second"];
                } else if (elem[6].value < 60) {
                    var maxwait = elem[6].value + " " + languages[browserLang]["view_queuesTimeString_seconds"];
                } else {
                    var tmpMaxwait = "view_queuesTimeString_minutes_" + elem[6].value;
                    var maxwait = languages[browserLang][tmpMaxwait];
                }

                templateObj.entities = [{
                    text: elem[1].value + " ( " + elem[0].value + " )",
                    id: "queues_name%" + id,
                    type: "input"
                }, {
                    text: languages[browserLang]["base_static_memb_string"],
                    id: "queues_statictext%" + id,
                    type: "text"
                }, {
                    text: elem[2].value,
                    id: "queues_staticlist%" + id,
                    type: "list"
                }, {
                    text: languages[browserLang]["base_dyn_memb_string"],
                    id: "queues_dynamictext%" + id,
                    type: "text"
                }, {
                    text: elem[3].value,
                    id: "queues_dynamiclist%" + id,
                    type: "list"
                }, {
                    text: languages[browserLang]["view_strategy_string"] + " ( " + elem[4].value + " )",
                    id: "queues_dynamicstrategy%" + id,
                    type: "text"
                }, {
                    text: languages[browserLang]["view_agenttimeout_string"] + " ( " + (elem[5].value == '0' ? languages[browserLang]["view_queuesTimeString_unlimited"] : timeout) + " )",
                    id: "queues_dynamicstimeout%" + id + "|" + elem[5].value,
                    type: "text"
                }, {
                    text: languages[browserLang]["view_queuesTimeString_maxWait"] + " ( " + (elem[6].value == '' ? languages[browserLang]["view_queuesTimeString_unlimited"] : maxwait) + " )",
                    id: "queues_dynamicmaxwait%" + id + "|" + elem[6].value,
                    type: "text"
                }, {
                    text: languages[browserLang]["base_fail_dest_string"],
                    id: "queues_output%" + id,
                    type: "output"
                }];
                // set queues data inside userData
                templateObj.userData = {
                    name: elem[1].value,
                    extension: elem[0].value,
                    staticExt: elem[2].value,
                    dynamicExt: elem[3].value,
                    strategy: elem[4].value,
                    timeout: elem[5].value,
                    maxwait: elem[6].value
                };
                break;

            case "ivr":

                templateObj.id = type + "%" + id;
                templateObj.bgColor = "#7f8c8d";
                templateObj.radius = 0;
                templateObj.entities = [{
                    text: elem[0].value + " ( " + elem[1].value + " )",
                    id: "ivr_name%" + id,
                    type: "input"
                }, {
                    text: languages[browserLang]["base_app_announcement_string"] + ": " + elem[2].value,
                    id: "ivr_announc%" + id,
                    type: "text"
                }, {
                    text: languages[browserLang]["base_inv_dest_string"],
                    id: "ivr_invalid-dest%" + id,
                    type: "output"
                }, {
                    text: languages[browserLang]["base_time_dest_string"],
                    id: "ivr_timeout-dest%" + id,
                    type: "output"
                }, {
                    text: languages[browserLang]["base_ivr_suggest_string"],
                    id: "ivr_suggest-dest%" + id,
                    type: "text"
                }];     
                // set ivr data inside userData
                templateObj.userData = {
                    name: elem[0].value,
                    description: elem[1].value,
                    announcement: elem[2].selectedOptions[0].attributes["annid"].value
                };
                break;

            case "cqr":
                templateObj.id = type + "%" + id;
                templateObj.bgColor = "#528ba7";
                templateObj.radius = 0;
                templateObj.entities = [{
                    text: elem[0].value + " ( " + elem[1].value + " )",
                    id: "cqr_name%" + id,
                    type: "input"
                }, {
                    text: languages[browserLang]["base_app_announcement_string"] + ": " + elem[2].value,
                    id: "cqr_announc%" + id,
                    type: "text"
                }, {
                    text: languages[browserLang]["base_def_dest_string"],
                    id: "cqr_default-dest%" + id,
                    type: "output"
                }, {
                    text: languages[browserLang]["base_ivr_suggest_string"],
                    id: "cqr_suggest-dest%" + id,
                    type: "text"
                }];
                // set cqr data inside userData
                templateObj.userData = {
                    name: elem[0].value,
                    description: elem[1].value,
                    announcement: elem[2].selectedOptions[0].attributes["annid"].value
                };
                break;

            case "app-announcement":
                templateObj.id = type + "%" + id;
                templateObj.bgColor = "#f4b350";
                templateObj.radius = 0;
                templateObj.entities = [{
                    text: elem[0].value,
                    id: "announcement_name%" + id,
                    type: "input"
                }, {
                    text: languages[browserLang]["view_recording_string"] + ": " + elem[1].value,
                    id: "announcement_record%" + id,
                    type: "text"
                }, {
                    text: languages[browserLang]["base_destination_string"],
                    id: "announcement_output%" + id,
                    type: "output"
                }];
                // set announcement data inside userData
                templateObj.userData = {
                    description: elem[0].value,
                    announcement: elem[1].selectedOptions[0].attributes["annid"].value
                };

                break;

            case "timeconditions":
                templateObj.id = type + "%" + id;
                templateObj.bgColor = "#D35400";
                templateObj.radius = 0;
                templateObj.entities = [{
                    text: elem[0].value,
                    id: "timeconditions_name%" + id,
                    type: "input"
                }, {
                    text: languages[browserLang]["view_timegroup_string"] + ": " + elem[1].value,
                    id: "timeconditions_record%" + id,
                    type: "text"
                }, {
                    text: languages[browserLang]["base_true_dest_string"],
                    id: "timeconditions_truegoto%" + id,
                    type: "output"
                }, {
                    text: languages[browserLang]["base_false_dest_string"],
                    id: "timeconditions_falsegoto%" + id,
                    type: "output"
                }];
                // set timecondition data inside userData
                templateObj.userData = {
                    name: elem[0].value,
                    time: elem[1].selectedOptions[0].attributes["timeid"].value
                };
                break;

            case "app-daynight":
                templateObj.id = type + "%" + elem[1].value;
                templateObj.bgColor = "#2c3e50";
                templateObj.radius = 0;
                templateObj.entities = [{
                    text: elem[0].value + " ( *28" + elem[1].value + " )",
                    id: "app-daynight_name%" + id,
                    type: "input"
                }, {
                    text: languages[browserLang]["base_normal_flow_string"],
                    id: "app-daynight_truegoto%" + id,
                    type: "output"
                }, {
                    text: languages[browserLang]["base_alternative_flow_string"],
                    id: "app-daynight_falsegoto%" + id,
                    type: "output"
                }];
                // set flow call control data inside userData
                templateObj.userData = {
                    name: elem[0].value,
                    code: elem[1].value
                };
                break;

            case "ext-meetme":
                templateObj.id = type + "%" + elem[0].value;
                templateObj.bgColor = "#65c6bb";
                templateObj.radius = 20;
                templateObj.entities = [{
                    text: elem[1].value + " ( " + elem[0].value + " )",
                    id: "ext-meetme_dest%" + id,
                    type: "input"
                }];
                // set conference data inside userData
                templateObj.userData = {
                    name: elem[1].value,
                    extension: elem[0].value
                };
                break;
        }
        this.setPersistentAttributes(templateObj, type);
    },

    removeEntity: function (index) {
        this.remove(this.children.get(index + 1).figure);
    },

    getEntity: function (index) {
        return this.children.get(index + 1).figure;
    },

    setName: function (name) {
        this.classLabel.setText(name);

        return this;
    },

    getPersistentAttributes: function () {
        var memento = this._super();

        memento.name = this.classLabel.getText();
        memento.entities = [];
        this.children.each(function (i, e) {

            if (i > 0) {
                memento.entities.push({
                    text: e.figure.getText(),
                    id: e.figure.id
                });
            }
        });

        return memento;
    },

    setPersistentAttributes: function (memento, type) {
        this._super(memento);
        this.setName(memento.name);
        if (typeof memento.entities !== "undefined") {
            $.each(memento.entities, $.proxy(function (i, e) {
                var entity = this.addEntity(e.text, e.type, type);
                entity.id = e.id;
                entity.on('click', function (event) {
                    if (event.userData.name === 'ext-queues' && !isNaN(e.id)) {
                        window.open(location.origin + '/freepbx/admin/config.php?display=queues&view=form&extdisplay=' + e.id, '_blank');
                    } else if (event.userData.name === 'from-did-direct' && !isNaN(e.id)) {
                        window.open(location.origin + '/freepbx/admin/config.php?display=extensions&extdisplay=' + e.id, '_blank');
                    } else if (event.userData.name === 'ext-group' && !isNaN(e.id)) {
                        window.open(location.origin + '/freepbx/admin/config.php?display=ringgroups&view=form&extdisplay=GRP-' + e.id, '_blank');
                    } else if (event.userData.name === 'ivr' && !isNaN(e.id)) {
                        window.open(location.origin + '/freepbx/admin/config.php?display=ivr&action=edit&id=' + e.id, '_blank');
                    } else if (event.userData.name === 'cqr' && !isNaN(e.id)) {
                        window.open(location.origin + '/freepbx/admin/config.php?display=nethcqr&action=edit&id_cqr=' + e.id, '_blank');
                    } else if (event.userData.name === 'app-announcement' && !isNaN(e.id)) {
                        window.open(location.origin + '/freepbx/admin/config.php?display=announcement&view=form&extdisplay=' + e.id, '_blank');
                    } else if (event.userData.name === 'timeconditions' && !isNaN(e.id)) {
                        window.open(location.origin + '/freepbx/admin/config.php?display=timeconditions&view=form&itemid=' + e.id, '_blank');
                    } else if (event.userData.name === 'app-daynight' && !isNaN(e.id)) {
                        window.open(location.origin + '/freepbx/admin/config.php?display=daynight&view=form&itemid=' + e.id + '&extdisplay=' + e.id, '_blank');
                    } else if (event.userData.name === 'incoming') {
                        window.open(location.origin + '/freepbx/admin/config.php?display=did&view=form&extdisplay=' + encodeURIComponent(e.id.replace(/ /g,"")), '_blank');
                    } else if (event.userData.name === 'ext-meetme' && !isNaN(e.id.split(' ')[0])) {
                        window.open(location.origin + '/freepbx/admin/config.php?display=conferences&view=form&extdisplay=' + e.id, '_blank');
                    }
                });
                if (e.type == "output")
                    entity.getOutputPort(0).setName("output_" + e.id);

                if (e.type == "input")
                    entity.getInputPort(0).setName("input_" + e.id);

            }, this));
        }
        return this;
    }
});

MyConnection = draw2d.Connection.extend({
    NAME: "MyConnection",

    init: function (attr) {
        this._super(attr);
    },

    getPersistentAttributes: function () {
        var memento = this._super();

        if (this.sourceDecorator !== null) {
            memento.source.decoration = this.sourceDecorator.NAME;
        }

        if (this.targetDecorator !== null) {
            memento.target.decoration = this.targetDecorator.NAME;
        }

        return memento;
    },

    setPersistentAttributes: function (memento) {
        this._super(memento);

        if (typeof memento.target.decoration !== "undefined" && memento.target.decoration != null) {
            this.setTargetDecorator(eval("new " + memento.target.decoration));
            this.targetDecorator.setDimension(10, 10);
            this.targetDecorator.setBackgroundColor("#4caf50");
        }
    }
});