'use strict';
/* global Drawflow */

// Drawflow is an interchangeable view over canonical nodes/edges/layout.
angular.module('nethvoiceWizardUiApp').factory('WorkflowEditor', function () {
  function ports(node, blocks) {
    if (node.type === 'conversation.collect' || node.type === 'conversation.decision') {
      return (node.config.outcomes || []).concat(['error', 'timeout']);
    }
    var block = blocks.filter(function (b) { return b.type === node.type; })[0];
    return block ? block.outcomes : [];
  }
  function attach(element, graph, blocks, changed, selected, readOnly, steps) {
    var surface = document.createElement('div');
    surface.style.height = '100%'; surface.style.width = '100%'; surface.tabIndex = 0;
    element.appendChild(surface);
    var editor = new Drawflow(surface); // locally bundled, pinned 0.0.60
    var rendering = false;
    var ids = {}, reverse = {};
    editor.reroute = true; editor.zoom_min = 0.15; editor.start(); if (readOnly) { editor.editor_mode = 'view'; }
    editor.precanvas.style.transformOrigin = '0 0';
    function notify() { if (!rendering) { changed(); } }
    editor.on('nodeSelected', function (id) { selected(reverse[id]); });
    editor.on('nodeMoved', function (id) {
      if (rendering) { return; }
      var item = editor.getNodeFromId(id);
      graph.layout[reverse[id]] = {x: item.pos_x, y: item.pos_y}; notify();
    });
    editor.on('nodeRemoved', function (id) {
      if (rendering) { return; }
      var key = reverse[id];
      graph.nodes = graph.nodes.filter(function (node) { return node.id !== key; });
      graph.edges = graph.edges.filter(function (edge) { return edge.source !== key && edge.target !== key; }); notify();
    });
    editor.on('connectionCreated', function (edge) {
      if (rendering) { return; }
      var key = reverse[edge.output_id], target = reverse[edge.input_id];
      var node = graph.nodes.filter(function (n) { return n.id === key; })[0];
      var outcome = ports(node, blocks)[parseInt(edge.output_class.replace('output_', ''), 10) - 1];
      if (key === target || graph.edges.some(function (e) { return e.source === key && e.outcome === outcome; })) {
        rendering = true; editor.removeSingleConnection(edge.output_id, edge.input_id, edge.output_class, edge.input_class); rendering = false;
        return;
      }
      graph.edges.push({source: key, outcome: outcome, target: target}); notify();
    });
    editor.on('connectionRemoved', function (edge) {
      if (rendering) { return; }
      var key = reverse[edge.output_id], target = reverse[edge.input_id];
      var node = graph.nodes.filter(function (n) { return n.id === key; })[0];
      var outcome = ports(node, blocks)[parseInt(edge.output_class.replace('output_', ''), 10) - 1];
      graph.edges = graph.edges.filter(function (e) { return e.source !== key || e.target !== target || e.outcome !== outcome; }); notify();
    });
    function render() {
      rendering = true; ids = {}; reverse = {}; editor.clear();
      graph.nodes.forEach(function (node, index) {
        var label = document.createElement('div'), title = document.createElement('strong'), type = document.createElement('span');
        title.textContent = node.name; type.textContent = node.type;
        label.appendChild(title); label.appendChild(type);
        var outcomes = ports(node, blocks);
        outcomes.forEach(function (port) { var line = document.createElement('small'); line.textContent = port; label.appendChild(line); });
        var position = graph.layout[node.id] || {x: 80 + index * 240, y: 100};
        var step = (steps || []).filter(function (s) { return s.node_id === node.id && !s.subflow_path; }).pop();
        var state = step ? (step.status === 'failed' ? 'failed' : step.status === 'completed' ? 'completed' : 'running') : 'pending';
        var id = editor.addNode(node.type, node.type.indexOf('start.') === 0 ? 0 : 1, outcomes.length,
          position.x, position.y, 'workflow-node workflow-' + state, {}, label.outerHTML);
        ids[node.id] = id; reverse[id] = node.id;
      });
      graph.edges.forEach(function (edge) {
        var node = graph.nodes.filter(function (n) { return n.id === edge.source; })[0];
        if (!node || !ids[edge.target]) { return; }
        var port = ports(node, blocks).indexOf(edge.outcome);
        if (port >= 0) { editor.addConnection(ids[edge.source], ids[edge.target], 'output_' + (port + 1), 'input_1'); }
      });
      rendering = false;
    }
    function fit() {
      var positions = graph.nodes.map(function (node) { return graph.layout[node.id] || {x: 0, y: 0}; });
      if (!positions.length) { return; }
      var minX = Math.min.apply(null, positions.map(function (p) { return p.x; })), minY = Math.min.apply(null, positions.map(function (p) { return p.y; }));
      var maxX = Math.max.apply(null, positions.map(function (p) { return p.x + 250; })), maxY = Math.max.apply(null, positions.map(function (p) { return p.y + 220; }));
      editor.zoom = Math.max(0.15, Math.min(1, (element.clientWidth - 60) / (maxX - minX), (element.clientHeight - 60) / (maxY - minY)));
      editor.canvas_x = 30 - minX * editor.zoom; editor.canvas_y = 30 - minY * editor.zoom;
      editor.zoom_last_value = editor.zoom; editor.zoom_refresh();
    }
    render();
    return {render: render, labels: function () {
      graph.nodes.forEach(function (node) { var title = surface.querySelector('#node-' + ids[node.id] + ' strong'); if (title) { title.textContent = node.name; } });
    }, zoomIn: function () { editor.zoom_in(); }, zoomOut: function () { editor.zoom_out(); },
      fit: fit,
      destroy: function () {
        editor.editor_mode = 'fixed'; editor.clear();
        surface.remove();
      }};
  }
  return {attach: attach, ports: ports};
});
