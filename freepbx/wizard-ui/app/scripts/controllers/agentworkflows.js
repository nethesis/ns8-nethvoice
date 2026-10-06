'use strict';

angular.module('nethvoiceWizardUiApp').controller('AgentWorkflowsCtrl', function (
  $scope, $routeParams, $location, $timeout, $window, $translate, AgentsService, WorkflowEditor
) {
  var vm = this, alive = true, canvas, generation = 0, undo = [], redo = [], latest;
  vm.page = $routeParams.runId ? 'run' : $location.path() === '/agents/data' ? 'data' : $routeParams.agentId ? 'editor' : 'catalog';
  vm.kind = $routeParams.kind || 'agent'; vm.blocks = []; vm.templates = []; vm.agents = []; vm.sources = [];
  vm.loading = true; vm.listMode = false; vm.connection = {}; vm.inputBinding = {}; vm.creation = {};
  vm.test = {caller: {phone: '', name: '', origin: 'external'}, input: {}, fixtures: {}};
  vm.group = {};
  vm.data = {resource_id: '', expected_revision: 0, settings: {name: '', format: 'csv', mapping: {resident_id: 'resident_id', name: 'name', phone: 'phone', period: 'period', amount: 'amount', currency: 'currency', verification_code: 'verification_code'},
    country_code: '39', decimal_separator: '.', header_row: 1, delimiter: ',', refresh_seconds: 0}};
  $scope.view.changeRoute = true;
  // Build an allowlisted workflow API path.
  function path(suffix) { return '/application/workflows' + suffix; }
  // Show a safe request error and clear sensitive views.
  function fail(error) {
    if (!alive) { return; }
    vm.error = error.data && error.data.error || 'workflows_unavailable';
    vm.errorNode = error.data && error.data.node_id;
    if (error.status === 401 || error.status === 403) { vm.graph = null; vm.preview = null; vm.testResult = null; }
  }
  // Send a bounded request through the administrator gateway.
  function request(method, suffix, data) {
    vm.error = null;
    var requestedGeneration = generation;
    return (method === 'GET' ? AgentsService.request(method, path(suffix)) : AgentsService.mutate(method, path(suffix), data)).then(function (result) {
      if (!alive || requestedGeneration !== generation) { throw {status: 401, data: {error: 'unauthorized'}}; }
      return result;
    }).catch(function (error) { fail(error); throw error; });
  }
  // Create the diagram view and connect its change handlers.
  function attach() {
    if (!alive || (vm.page !== 'editor' && vm.page !== 'run') || !vm.graph) { return; }
    if (vm.selected) { vm.select(vm.selected.id); }
    if (canvas) { canvas.destroy(); canvas = null; }
    $timeout(function () {
      var element = document.getElementById('workflow-canvas');
      if (!alive || !element || !vm.graph) { return; }
      canvas = WorkflowEditor.attach(element, vm.graph, vm.blocks, function () { $scope.$evalAsync(vm.changed); }, function (key) { $scope.$evalAsync(function () { vm.select(key); }); }, vm.page === 'run', vm.steps);
      canvas.fit();
    });
  }
  // Reload the current agent inventory or run view.
  function refresh() {
    return request('GET', '/inventory').then(function (data) {
      if (!alive) { return; }
      vm.agents = data.agents; vm.sources = data.data_sources; vm.versions = data.versions; vm.bindings = data.bindings || [];
      vm.blocks = data.blocks;
      vm.routingObjects = data.routing_objects || []; vm.operations = data.connector_operations || [];
      vm.reusables = data.definitions.filter(function (row) { return row.kind === 'subflow' && row.published_version > 0 && row.enabled; });
      if (vm.page === 'editor' && !vm.graph) {
        var row = data.definitions.filter(function (item) { return item.agent_id === $routeParams.agentId && item.kind === vm.kind; })[0];
        if (row) { vm.graph = angular.copy(row.draft); vm.revision = row.revision; vm.version = row.active_version; vm.enabled = row.enabled; latest = angular.toJson(vm.graph); attach(); }
      }
      if (vm.page === 'run') {
        return request('GET', '/runs/' + $routeParams.runId).then(function (row) {
          vm.run = row; vm.graph = row.definition; vm.steps = row.steps; vm.version = row.version; attach();
        });
      }
    });
  }
  // Open the selected agent definition.
  vm.open = function (agent) {
    $location.path('/agents/build/' + agent.kind + '/' + agent.agent_id);
  };
  // Create a draft or stored record from checked input.
  vm.create = function () {
    var seed = vm.templates.filter(function (t) { return t.agent_id === vm.creation.template; })[0] || vm.templates[0];
    var graph = angular.copy(seed);
    graph.agent_id = vm.creation.agent_id; graph.name = vm.creation.name || graph.name;
    return request('PUT', '/definitions/' + (vm.creation.kind || 'agent') + '/' + encodeURIComponent(graph.agent_id), {definition: graph, expected_revision: 0}).then(function () {
      $location.path('/agents/build/' + (vm.creation.kind || 'agent') + '/' + graph.agent_id);
    });
  };
  // Record a draft edit and update undo history.
  vm.changed = function () {
    var now = angular.toJson(vm.graph);
    if (now === latest) { return; }
    if (latest) { undo.push(latest); if (undo.length > 50) { undo.shift(); } }
    latest = now; redo = []; vm.dirty = true; vm.validated = false;
    if (canvas) { canvas.labels(); }
  };
  // Restore the previous local graph edit.
  vm.undo = function () {
    if (!undo.length) { return; }
    redo.push(angular.toJson(vm.graph)); vm.graph = angular.fromJson(undo.pop()); latest = angular.toJson(vm.graph); vm.dirty = true; attach();
  };
  // Restore the next local graph edit.
  vm.redo = function () {
    if (!redo.length) { return; }
    undo.push(angular.toJson(vm.graph)); vm.graph = angular.fromJson(redo.pop()); latest = angular.toJson(vm.graph); vm.dirty = true; attach();
  };
  // Apply the requested diagram zoom action.
  vm.zoom = function (direction) { if (canvas) { canvas[direction](); } };
  // Render the current graph again.
  vm.redraw = function () { vm.changed(); if (canvas) { canvas.render(); } };
  vm.refresh = refresh;
  // Return the named outcomes used by the block.
  vm.ports = function (node) { return WorkflowEditor.ports(node, vm.blocks); };
  // Load the selected block into the inspector.
  vm.select = function (key) {
    vm.selected = vm.graph.nodes.filter(function (n) { return n.id === key; })[0];
    vm.selectedOperation = vm.selected && (vm.operations || []).filter(function (operation) { return angular.equals(operation.reference, vm.selected.config.operation); })[0];
    vm.selectedBlock = vm.selected && vm.blocks.filter(function (b) { return b.type === vm.selected.type; })[0];
    vm.configFields = vm.selectedBlock ? Object.keys(vm.selectedBlock.config_schema.properties || {}) : [];
  };
  // Set the selected published connector operation.
  vm.chooseOperation = function () { if (vm.selectedOperation) { vm.selected.config.operation = angular.copy(vm.selectedOperation.reference); vm.changed(); } };
  // Check whether the selected operation is granted.
  vm.operationGranted = function () { return vm.selectedOperation && vm.graph.tool_grants.indexOf(vm.selectedOperation.id) >= 0; };
  // Add or remove the selected operation grant.
  vm.toggleOperationGrant = function () {
    if (!vm.selectedOperation) { return; }
    var index = vm.graph.tool_grants.indexOf(vm.selectedOperation.id);
    if (index < 0) { vm.graph.tool_grants.push(vm.selectedOperation.id); } else { vm.graph.tool_grants.splice(index, 1); }
    vm.changed();
  };
  // Check whether a router target is enabled by its policy.
  vm.routerEnabled = function (target) {
    var cfg = vm.selected.config;
    return cfg.overrides && cfg.overrides[target.id] !== undefined ? cfg.overrides[target.id] : !!(cfg.defaults && cfg.defaults[target.type]);
  };
  // Change the override for one router target.
  vm.toggleRouter = function (target) {
    vm.selected.config.overrides = vm.selected.config.overrides || {};
    vm.selected.config.overrides[target.id] = !vm.routerEnabled(target); vm.changed();
  };
  // Set the defaults for all router target types.
  vm.routerSetAll = function (enabled) { vm.selected.config.defaults = {extension: enabled, queue: enabled, ivr: enabled, agent: enabled}; vm.selected.config.overrides = {}; vm.changed(); };
  // Return the initial monitoring capture and retention policy.
  function defaults(schema) {
    if (schema.enum) { return schema.enum[0]; }
    if (schema.type === 'object') { var obj = {}; angular.forEach(schema.properties || {}, function (value, key) { if ((schema.required || []).indexOf(key) >= 0) { obj[key] = defaults(value); } }); return obj; }
    return schema.type === 'array' ? [] : schema.type === 'boolean' ? false : schema.type === 'integer' ? schema.minimum || 1 : '';
  }
  // Add a typed block to the draft graph.
  vm.add = function (block) {
    var id = block.type.replace(/\./g, '_') + '_' + Date.now().toString(36);
    var config = defaults(block.config_schema);
    if (block.type === 'conversation.collect' || block.type === 'conversation.decision') {
      config.output_schema = {type: 'object', properties: {}, required: [], additionalProperties: false}; config.outcomes = ['success']; config.max_turns = 5; config.tools = [];
    }
    vm.graph.nodes.push({id: id, type: block.type, version: block.version, name: block.type, config: config, inputs: {}});
    vm.graph.layout[id] = {x: 120, y: 120}; vm.changed(); vm.select(id); if (canvas) { canvas.render(); }
  };
  // Remove the selected block and its edges.
  vm.remove = function () {
    var id = vm.selected.id;
    vm.graph.nodes = vm.graph.nodes.filter(function (n) { return n.id !== id; });
    vm.graph.edges = vm.graph.edges.filter(function (e) { return e.source !== id && e.target !== id; });
    delete vm.graph.layout[id]; vm.selected = null; vm.changed(); if (canvas) { canvas.render(); }
  };
  // Copy the selected block with a new ID.
  vm.duplicate = function () {
    var copy = angular.copy(vm.selected); copy.id += '_' + Date.now().toString(36); copy.name += ' (copy)';
    if (copy.id.length > 48) { copy.id = 'copy_' + Date.now().toString(36); }
    vm.graph.nodes.push(copy); vm.changed(); vm.select(copy.id); if (canvas) { canvas.render(); }
  };
  // Connect one named block outcome to its target.
  vm.connect = function () {
    var edge = angular.copy(vm.connection);
    if (!edge.source || !edge.outcome || !edge.target || edge.source === edge.target) { return; }
    vm.graph.edges = vm.graph.edges.filter(function (e) { return e.source !== edge.source || e.outcome !== edge.outcome; });
    vm.graph.edges.push(edge); vm.changed(); if (canvas) { canvas.render(); }
  };
  // Remove the selected graph edge.
  vm.disconnect = function (edge) { vm.graph.edges.splice(vm.graph.edges.indexOf(edge), 1); vm.changed(); if (canvas) { canvas.render(); } };
  // List the source block outcomes for a new edge.
  vm.connectionPorts = function () {
    return vm.graph ? vm.ports(vm.graph.nodes.filter(function (node) { return node.id === vm.connection.source; })[0] || {type: ''}) : [];
  };
  // Add a literal or block-output input binding.
  vm.addInput = function () {
    var input = vm.inputBinding;
    if (!input.name || !/^[a-z][a-z0-9_-]{0,47}$/.test(input.name)) { return; }
    var value = input.value || '';
    if (input.valueType === 'number') { value = Number(value); if (!isFinite(value)) { return; } }
    if (input.valueType === 'boolean') { value = value === 'true'; }
    var binding = input.mode === 'literal' ? {value: value} : {node: input.node, path: input.path || ''};
    if (input.mode !== 'literal' && input.optional) { binding.optional = true; binding.default = input.value === undefined || input.value === '' ? null : value; }
    vm.selected.inputs[input.name] = binding;
    vm.inputBinding = {}; vm.changed();
  };
  // Remove the selected block input binding.
  vm.removeInput = function (key) { delete vm.selected.inputs[key]; vm.changed(); };
  // Save the checked draft or settings.
  vm.save = function () {
    vm.saving = true;
    return request('PUT', '/definitions/' + vm.kind + '/' + vm.graph.agent_id, {definition: vm.graph, expected_revision: vm.revision}).then(function (result) {
      vm.revision = result.revision; vm.dirty = false; vm.saved = true;
    }).finally(function () { vm.saving = false; });
  };
  // Check the graph, fields and referenced resources.
  vm.validate = function () {
    if (canvas) { canvas.render(); }
    return request('POST', '/validate', {definition: vm.graph}).then(function (result) { vm.validated = result.valid; vm.tools = result.tools; });
  };
  // Validate and publish an immutable definition version.
  vm.publish = function () {
    return vm.save().then(vm.validate).then(function () {
      return request('POST', '/definitions/' + vm.kind + '/' + vm.graph.agent_id + '/publish', {expected_revision: vm.revision});
    }).then(function (result) { vm.version = result.version; vm.revision = result.revision; vm.published = true; });
  };
  // Enable or disable the selected published definition.
  vm.activate = function (agent, enabled) {
    var id = agent ? agent.agent_id : vm.graph.agent_id, kind = agent ? agent.kind : vm.kind;
    return request('POST', '/definitions/' + kind + '/' + id + '/activate', {version: agent ? agent.version : vm.version, enabled: enabled,
      expected_revision: agent ? agent.revision : vm.revision}).then(function (result) {
      if (!agent) { vm.revision = result.revision; vm.enabled = enabled; }
      return refresh();
    });
  };
  // Run the graph with mock conversation fixtures.
  vm.runTest = function () {
    var fixtures = {}; vm.graph.nodes.forEach(function (node) {
      if (node.type === 'conversation.decision' || node.type === 'conversation.collect') {
        var entry = vm.test.fixtures[node.id];
        if (entry) { fixtures[node.id] = {outcome: entry.outcome || 'success', output: entry.output || {}}; }
      }
    });
    var catalog = vm.graph.nodes.filter(function (node) { return node.type === 'pbx.catalog'; })[0];
    var destinations = catalog ? vm.routingObjects.filter(function (target) {
      return target.ready && ((catalog.config.overrides || {})[target.id] !== undefined ? catalog.config.overrides[target.id] : (catalog.config.defaults || {})[target.type]);
    }) : [];
    return request('POST', '/test', {definition: vm.graph, fixtures: fixtures, input: vm.test.input, caller: vm.test.caller, destinations: destinations}).then(function (result) { vm.testResult = result; });
  };
  // Create a reusable graph from the selected blocks.
  vm.saveReusable = function () {
    var copy = angular.copy(vm.graph); copy.agent_id = vm.reusableId; copy.name = vm.reusableName || copy.name;
    var selected = copy.nodes.filter(function (node) { return vm.group[node.id]; });
    if (selected.length) {
      var keys = selected.map(function (node) { return node.id; });
      var internal = copy.edges.filter(function (edge) { return keys.indexOf(edge.source) >= 0 && keys.indexOf(edge.target) >= 0; });
      var entries = selected.filter(function (node) { return !internal.some(function (edge) { return edge.target === node.id; }); });
      var exits = selected.filter(function (node) { return !internal.some(function (edge) { return edge.source === node.id; }); });
      if (entries.length !== 1 || exits.length !== 1 || selected.some(function (node) { return node.type.indexOf('start.') === 0 || node.type === 'end'; })) {
        vm.error = 'reusable_single_entry_exit_required'; return;
      }
      var inputProperties = {}, required = [], counter = 0;
      selected.forEach(function (node) { angular.forEach(node.inputs, function (binding) {
        if (binding.node && keys.indexOf(binding.node) < 0) {
          var name = 'input_' + (++counter); inputProperties[name] = {}; required.push(name);
          binding.node = 'subflow_input'; binding.path = name;
        }
      }); });
      copy.input_schema = {type: 'object', properties: inputProperties, required: required, additionalProperties: false};
      copy.output_schema = {type: 'object', properties: {value: {type: 'object'}}, required: ['value'], additionalProperties: false};
      copy.nodes = [{id: 'subflow_input', name: 'Inputs', type: 'start.api', version: 1, config: {}, inputs: {}}].concat(selected).concat([
        {id: 'subflow_result', name: 'Result', type: 'end', version: 1, config: {}, inputs: {value: {node: exits[0].id, path: ''}}}]);
      copy.edges = internal.concat([{source: 'subflow_input', outcome: 'success', target: entries[0].id},
        {source: exits[0].id, outcome: vm.ports(exits[0])[0], target: 'subflow_result'}]);
    }
    return request('PUT', '/definitions/subflow/' + copy.agent_id, {definition: copy, expected_revision: 0}).then(function () { return refresh(); });
  };
  // List output fields that later blocks may select.
  vm.outputFields = function () {
    var node = vm.graph.nodes.filter(function (n) { return n.id === vm.inputBinding.node; })[0];
    if (!node) { return []; }
    var block = vm.blocks.filter(function (b) { return b.type === node.type; })[0];
    var operation = (vm.operations || []).filter(function (item) { return angular.equals(item.reference, node.config.operation); })[0];
    var schema = node.config.output_schema || (operation && operation.output_schema) || (block && block.output_schema) || {};
    var fields = [''];
    // Collect nested schema paths within the depth limit.
    function walk(contract, prefix, depth) {
      if (depth > 4) { return; }
      angular.forEach(contract.properties || {}, function (child, key) { var path = prefix ? prefix + '.' + key : key; fields.push(path); walk(child, path, depth + 1); });
    }
    walk(schema, '', 0);
    if (node.type === 'data.lookup') { fields = fields.concat(['row', 'row.resident_id', 'row.name', 'row.amount', 'row.currency', 'row.period']); }
    if (node.type === 'logic.map') { fields = fields.concat(Object.keys(node.inputs)); }
    if (node.type === 'logic.merge') {
      angular.forEach(node.inputs, function (binding) { var source = vm.graph.nodes.filter(function (candidate) { return candidate.id === binding.node; })[0]; if (source && source.type === 'logic.map') { fields = fields.concat(Object.keys(source.inputs)); } });
    }
    return fields;
  };
  // Add a pinned reusable block to the graph.
  vm.addReusable = function (resource) {
    vm.add({type: 'subflow', version: 1, config_schema: {type: 'object'}});
    vm.selected.config = {resource: {resource_id: resource.agent_id, version: resource.active_version}};
    vm.selected.name = resource.draft.name; vm.changed(); if (canvas) { canvas.render(); }
  };
  // List published versions for the current definition.
  vm.publishedVersions = function () { return (vm.versions || []).filter(function (row) { return vm.graph && row.agent_id === vm.graph.agent_id && row.kind === vm.kind && !row.revoked; }); };
  // Load the selected publication into the local draft.
  vm.loadPublishedVersion = function () {
    return request('GET', '/definitions/' + vm.kind + '/' + vm.graph.agent_id + '/versions/' + vm.version).then(function (result) {
      vm.graph = angular.copy(result.definition); vm.changed(); vm.selected = null; attach();
    });
  };
  // Load the selected data source settings.
  vm.editData = function (resource) { vm.data = {resource_id: resource.resource_id, expected_revision: resource.revision, settings: angular.copy(resource.settings)}; vm.content = null; vm.preview = null; };
  // Read the selected file for a bounded data upload.
  vm.fileSelected = function (files) {
    var file = files[0]; if (!file || file.size > 10 * 1024 * 1024) { vm.error = 'upload_too_large'; return; }
    // Read the uploaded file as base64 content for the data source.
    var reader = new FileReader(); reader.onload = function (event) { $scope.$evalAsync(function () { vm.content = event.target.result.split(',')[1]; vm.filename = file.name; }); }; reader.readAsDataURL(file);
  };
  // Validate and preview the source mapping.
  vm.previewData = function () { return request('POST', '/data/preview', {settings: vm.data.settings, content: vm.content}).then(function (result) { vm.preview = result; }); };
  // Save the data source settings.
  vm.saveData = function () {
    return request('PUT', '/data/' + vm.data.resource_id, {settings: vm.data.settings, expected_revision: vm.data.expected_revision}).then(function (result) { vm.data.expected_revision = result.revision; return refresh(); });
  };
  // Queue ingestion of a new immutable data version.
  vm.publishData = function () {
    return vm.saveData().then(function () {
      var input = {expected_revision: vm.data.expected_revision};
      var remote = vm.data.settings.format === 'google_sheets' || vm.data.settings.format === 'google_csv';
      if (!remote) { input.content = vm.content; }
      return request('POST', '/data/' + vm.data.resource_id + (remote ? '/refresh' : '/publish'), input);
    }).then(function (result) {
      if (!result.job_id) { vm.data.expected_revision = result.revision; return refresh(); }
      vm.ingestionJob = result;
      // Read the data ingestion job until it finishes.
      function poll() {
        if (!alive) { return; }
        return request('GET', '/jobs/' + result.job_id).then(function (job) {
          vm.ingestionJob = job;
          if (job.state === 'ready') { vm.data.expected_revision = job.result.revision; return refresh(); }
          if (job.state === 'failed' || job.state === 'interrupted') { vm.error = job.error_code; return refresh(); }
          return $timeout(poll, 1000);
        });
      }
      return poll();
    });
  };
  // Delete and revoke the selected data version.
  vm.revokeData = function (resource) { return request('DELETE', '/data/' + resource.resource_id + '/versions/' + resource.published_version).then(refresh); };
  // Download the current graph definition.
  vm.exportGraph = function () {
    var blob = new Blob([angular.toJson(vm.graph, true)], {type: 'application/json'}), anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob); anchor.download = vm.graph.agent_id + '.json'; anchor.click(); URL.revokeObjectURL(anchor.href);
  };
  // Ask the browser to confirm departure when the draft has unsaved changes.
  var beforeUnload = function (event) { if (vm.dirty) { event.preventDefault(); event.returnValue = ''; } };
  $window.addEventListener('beforeunload', beforeUnload);
  $scope.$on('$locationChangeStart', function (event) {
    if ($scope.login.isLogged && vm.dirty && !$window.confirm($translate.instant('Builder.discard_changes'))) { event.preventDefault(); }
  });
  var unwatch = $scope.$watch('login.isLogged', function (logged) {
    generation++;
    if (!logged) { if (canvas) { canvas.destroy(); canvas = null; } vm.dirty = false; vm.graph = null; vm.preview = null; vm.content = null; vm.testResult = null; vm.agents = []; vm.sources = []; vm.routingObjects = []; return; }
    var current = generation;
    AgentsService.access().then(function () { return refresh(); }).then(function () {
      return request('GET', '/catalog').then(function (data) { if (alive && current === generation) { vm.templates = data.templates; } });
    }).catch(fail).finally(function () { vm.loading = false; $scope.view.changeRoute = false; });
  });
  $scope.$on('$destroy', function () { alive = false; unwatch(); if (canvas) { canvas.destroy(); } $window.removeEventListener('beforeunload', beforeUnload); vm.content = null; vm.preview = null; vm.testResult = null; });
});

angular.module('nethvoiceWizardUiApp').directive('workflowFile', function () {
  // Pass selected files to the workflow controller and release the listener.
  return {restrict: 'A', link: function (scope, element, attrs) {
    // Notify the editor that the field value changed.
    function change(event) { scope.$apply(function () { scope.$eval(attrs.workflowFile, {$files: event.target.files}); }); }
    element.on('change', change); scope.$on('$destroy', function () { element.off('change', change); });
  }};
});
