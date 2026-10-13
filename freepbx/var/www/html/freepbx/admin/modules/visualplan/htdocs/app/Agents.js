/* SPDX-License-Identifier: GPL-3.0-or-later
 * Adapted native Agent object. Configuration lives exclusively in Agents UI.
 */
(function () {
    var originalDrop = example.View.prototype.onDrop;
    example.View.prototype.onDrop = function (node, x, y, shift, ctrl) {
        if (node.id !== 'satellite-agent-destination') return originalDrop.apply(this, arguments);
        var view = this, lang = languages[browserLang], inventory = {};
        var dialog = $('<div>').attr('id', 'agentPicker');
        var select = $('<select>').attr({'id':'agentSelect','class':'form-control','aria-label':lang.base_agent_string});
        var link = $('<a>').attr({'target':'_blank','rel':'noopener'}).text(lang.agent_configure_string);
        var message = $('<p>').attr('role','status');
        var wrapper = $('<div>').append($('<label>').attr('for','agentSelect').text(lang.agent_select_string), select, link, message);
        dialog.append(wrapper);
        function selected() {
            var item = inventory[select.val()];
            link.attr('href', item ? '/freepbx/agents-ui/#/agents/'+encodeURIComponent(item.userData.agent_id) : '/freepbx/agents-ui/#/agents');
            message.text(item && !item.userData.routable ? lang.agent_not_ready_string : '');
        }
        function refresh() {
            var previous=select.val();
            $.getJSON('./visualize.php?readData=voice-agents').done(function (rows) {
                inventory=rows; select.empty();
                $.each(rows,function(id,item){select.append($('<option>').val(id).text(item.entities[0].text+(item.userData.kind==='builtin'?' ('+lang.agent_builtin_string+')':'')));});
                if(previous && rows[previous]) select.val(previous);
                selected();
            }).fail(function(){message.text(lang.agent_load_error_string); inventory={}; select.empty();});
        }
        select.on('change',selected);
        dialog.dialog({title:lang.base_agent_string,width:500,modal:true,close:function(){ $(window).off('focus.voiceAgentPicker');dialog.dialog('destroy').remove(); },buttons:[
            {text:lang.agent_new_string,click:function(){window.open('/freepbx/agents-ui/#/agents/new','_blank','noopener');}},
            {text:lang.agent_add_string,click:function(){
                var item=inventory[select.val()];
                if(!item || !item.userData.routable){message.text(lang.agent_not_ready_string);return;}
                // Selecting a saved agent reuses its native identity.
                if(view.getFigure(item.id)){message.text(lang.agent_already_added_string);return;}
                item.x=x;item.y=y;
                var figure = new Base();
                figure.setPersistentAttributes(item);
                view.getCommandStack().execute(new draw2d.command.CommandAdd(view,figure,x,y));
                dialog.dialog('close');
            }},
            {text:lang.agent_cancel_string,click:function(){dialog.dialog('close');}}
        ]});
        $(window).on('focus.voiceAgentPicker',refresh); refresh();
    };
    var originalEdit=example.Toolbar.prototype.createDialog;
    example.Toolbar.prototype.createDialog=function(obj,node){
        if(node && node.id.indexOf('satellite-agent-destination%')===0){
            window.open('/freepbx/agents-ui/#/agents/'+encodeURIComponent(node.getUserData().agent_id),'_blank','noopener');return;
        }
        return originalEdit.apply(this,arguments);
    };
    $.ajaxPrefilter(function(options,original,xhr){
        if(/(?:^|\/)create\.php(?:\?|$)/.test(options.url)) xhr.setRequestHeader('X-VisualPlan-Agent-CSRF',window.visualplanAgentCsrf||'');
    });
})();
