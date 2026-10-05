'use strict';

angular.module('nethvoiceWizardUiApp').directive('agentFieldHelp', function ($document, $rootScope) {
  var active;
  function closeOnEscape(event) {
    if (event.keyCode === 27 && active) { active.$applyAsync(active.closeHelp); }
  }
  $document.on('keydown', closeOnEscape);
  $rootScope.$on('$destroy', function () { $document.off('keydown', closeOnEscape); });
  return {
    restrict: 'E',
    scope: {field: '@', help: '@'},
    template: '<button type="button" class="agents-help-button" ' +
      'aria-label="{{\'Agents.help_for\' | translate:{field: (field | translate)} }}" aria-describedby="{{helpId}}" ' +
      'uib-popover="{{help | translate}}" popover-trigger="\'none\'" ' +
      'popover-is-open="helpOpen" popover-placement="auto top" ' +
      'popover-append-to-body="true" popover-animation="false" popover-class="agents-field-tooltip" ' +
      'ng-mouseenter="showHelp()" ng-mouseleave="leaveHelp()" ' +
      'ng-focus="showHelp()" ng-blur="closeHelp()" ' +
      'ng-click="showHelp()" ng-keydown="helpKey($event)">' +
      '<span aria-hidden="true">?</span></button>' +
      '<span class="sr-only" id="{{helpId}}">{{help | translate}}</span>',
    link: function (scope, element) {
      scope.helpId = 'agents-field-help-' + scope.$id;
      scope.showHelp = function () {
        if (active && active !== scope) { active.helpOpen = false; }
        active = scope; scope.helpOpen = true;
      };
      scope.closeHelp = function () {
        scope.helpOpen = false;
        if (active === scope) { active = null; }
      };
      scope.leaveHelp = function () {
        if ($document[0].activeElement !== element.find('button')[0]) { scope.closeHelp(); }
      };
      scope.helpKey = function (event) {
        if (event.keyCode === 27) { scope.closeHelp(); event.stopPropagation(); }
      };
      function closeOutside(event) {
        if (scope.helpOpen && !element[0].contains(event.target)) {
          scope.$applyAsync(scope.closeHelp);
        }
      }
      $document.on('click', closeOutside);
      scope.$on('$destroy', function () {
        scope.closeHelp(); $document.off('click', closeOutside);
      });
    }
  };
});

angular.module('nethvoiceWizardUiApp').controller('AgentIntegrationsCtrl', function (
  $scope, $location, AgentsService
) {
  var vm = this;
  var alive = true;
  var generation = 0;
  vm.page = $location.path() === '/agents/api' ? 'api' : 'connectors';
  vm.inventory = {resources: [], versions: [], clients: [], secrets: [], grants: [], unresolved_effects: []};
  vm.loading = true; vm.options = []; vm.grantAgent = 'internal'; vm.grantSelection = {};
  vm.secret = {}; vm.client = {scopes: {'runs:create': true, 'runs:read': true, 'runs:cancel': true}, customer_ids: '', expiry_days: 30};
  vm.clientSelection = {};
  vm.test = {action: 'lookup', version: 1};
  $scope.view.changeRoute = true;

  function clear() {
    generation++; vm.token = null; vm.secret = {}; vm.inventory = {};
    vm.testResult = null; vm.test = {}; vm.client = {}; vm.preset = null; vm.connector = null;
    vm.reconciliationResult = null;
    AgentsService.clear();
  }
  function fail(error) {
    vm.error = error.status === 401 || error.status === 403 ? 'unauthorized' :
      error.status === 409 ? 'conflict' : error.status === 400 || error.status === 422 ? 'invalid' :
      error.status === 429 ? 'capacity' : 'unavailable';
    if (vm.error === 'unauthorized') { clear(); }
  }
  function refs(selection) {
    return vm.options.filter(function (option) { return selection[option.key]; })
      .map(function (option) { return angular.copy(option.reference); });
  }
  function selection(references) {
    var chosen = {};
    angular.forEach(references, function (ref) { chosen[ref.connector_id + ":" + ref.version + ":" + ref.operation_id] = true; });
    return chosen;
  }
  function refreshOptions() {
    vm.options = [];
    angular.forEach(vm.inventory.versions, function (version) {
      if (version.kind !== 'connector' || version.revoked) { return; }
      angular.forEach(version.definition.operations, function (op) {
        var ref = {connector_id: version.resource_id, version: version.version, operation_id: op.id};
        vm.options.push({key: ref.connector_id + ":" + ref.version + ":" + ref.operation_id, reference: ref,
          label: version.resource_id + ' / ' + op.id + ' / v' + version.version, write: !op.read_only});
      });
    });
  }
  vm.refresh = function () {
    vm.loading = true; vm.error = null;
    var current = generation;
    return AgentsService.request('GET', '/application/inventory').then(function (data) {
      if (!alive || current !== generation) { return; }
      vm.inventory = data; refreshOptions(); vm.loadGrants();
    }, fail).finally(function () { if (alive) { vm.loading = false; } });
  };
  function mutate(method, path, data) {
    vm.saving = true; vm.error = null; vm.saved = false;
    var current = generation;
    return AgentsService.mutate(method, '/application' + path, data).then(function (result) {
      if (!alive || current !== generation) { return; }
      vm.saved = true; return vm.refresh().then(function () { return result; });
    }, function (error) { fail(error); throw error; }).finally(function () { vm.saving = false; });
  }
  vm.enable = function () { return mutate('PUT', '/settings', {enabled: vm.inventory.enabled}); };
  vm.saveSecret = function () {
    var input = angular.copy(vm.secret); vm.secret.value = '';
    return mutate('POST', '/secrets', input).then(function () { vm.secret = {}; });
  };
  vm.revokeSecret = function (id) { return mutate('DELETE', '/secrets/' + encodeURIComponent(id)); };
  vm.revokeVersion = function (version) {
    return mutate('DELETE', '/versions/' + version.kind + '/' + encodeURIComponent(version.resource_id) + '/' + version.version);
  };
  function objectSchema(properties, required) {
    return {type: 'object', additionalProperties: false, properties: properties, required: required};
  }
  vm.addOperation = function (write) {
    var properties = {customer_id: {type: 'string', minLength: 1, maxLength: 128}};
    if (write) { properties.summary = {type: 'string', maxLength: 200}; properties.description = {type: 'string', maxLength: 4000}; }
    vm.connector.operations.push({id: write ? 'create_ticket' : 'lookup', description: '', method: write ? 'POST' : 'GET',
      path: write ? '/tickets' : '/customers/{customer_id}', read_only: !write, public_voice: false,
      timeout_seconds: 10, identity_field: 'customer_id', idempotency_header: write ? 'Idempotency-Key' : null,
      input: angular.toJson(objectSchema(properties, Object.keys(properties)), true),
      output: angular.toJson(objectSchema({id: {type: 'string', maxLength: 128}}, ['id']), true),
      queryText: '{}', bodyText: angular.toJson(write ? {customer_id: 'customer_id', summary: 'summary', description: 'description'} : {}, true),
      projectionText: '{"id":"id"}'});
  };
  vm.newConnector = function () {
    vm.connectorId = ''; vm.connectorRevision = 0;
    vm.connector = {name: '', origin: '', secret_ref: '', auth: {type: 'bearer'}, networks: '', operations: []};
    vm.addOperation(false);
  };
  vm.newBusinessPreset = function (key) {
    return AgentsService.request('GET', '/application/workflows/catalog').then(function (data) {
      vm.editConnector({resource_id: key, revision: 0, draft: data.connector_presets[key]});
      if (key === 'freshdesk') { vm.connector.origin = ''; }
    }, fail);
  };
  vm.editConnector = function (resource) {
    vm.connectorId = resource.resource_id; vm.connectorRevision = resource.revision;
    vm.connector = angular.copy(resource.draft);
    vm.connector.networks = vm.connector.private_networks.join(', ');
    angular.forEach(vm.connector.operations, function (op) {
      op.input = angular.toJson(op.input_schema, true); op.output = angular.toJson(op.output_schema, true);
      op.queryText = angular.toJson(op.query, true); op.bodyText = angular.toJson(op.body, true); op.projectionText = angular.toJson(op.projection, true);
    });
  };
  vm.saveConnector = function () {
    var definition = angular.copy(vm.connector);
    definition.private_networks = definition.networks ? definition.networks.split(',').map(function (v) { return v.trim(); }) : [];
    delete definition.networks;
    if (definition.auth.type !== 'api_key') { delete definition.auth.header; }
    try {
      angular.forEach(definition.operations, function (op) {
        op.read_only = op.method === 'GET' ? true : !!op.read_only; op.identity_field = op.identity_field || null;
        op.input_schema = angular.fromJson(op.input); op.output_schema = angular.fromJson(op.output);
        op.query = angular.fromJson(op.queryText); op.body = angular.fromJson(op.bodyText); op.projection = angular.fromJson(op.projectionText);
        delete op.input; delete op.output; delete op.queryText; delete op.bodyText; delete op.projectionText;
        if (!op.idempotency_header) { delete op.idempotency_header; }
        if (op.reconcile && !op.reconcile.operation && !op.reconcile.argument && !op.reconcile.result_field) { delete op.reconcile; }
      });
    } catch (error) { vm.error = 'invalid'; return; }
    return mutate('PUT', '/resources/connector/' + encodeURIComponent(vm.connectorId), {definition: definition, expected_revision: vm.connectorRevision})
      .then(function (result) { if (result) { vm.connectorRevision = result.revision; } });
  };
  vm.publish = function (resource) {
    return mutate('POST', '/resources/' + resource.kind + '/' + encodeURIComponent(resource.resource_id) + '/publish', {expected_revision: resource.revision});
  };
  vm.loadGrants = function () {
    var grant = (vm.inventory.grants || []).filter(function (item) { return item.agent_id === vm.grantAgent; })[0];
    vm.grantRevision = grant ? grant.revision : 0; vm.grantSelection = selection(grant ? grant.operations : []);
  };
  vm.saveGrants = function () {
    return mutate('PUT', '/grants/' + vm.grantAgent, {operations: refs(vm.grantSelection), expected_revision: vm.grantRevision});
  };
  vm.editPreset = function () {
    var resource = vm.inventory.resources.filter(function (item) { return item.kind === 'preset'; })[0];
    vm.presetRevision = resource ? resource.revision : 0;
    vm.preset = resource ? angular.copy(resource.draft) : {name: 'Support request', provider: 'openai_responses', model: '', secret_ref: '', prompt: '',
      operations: [], deadline_seconds: 60, max_output_tokens: 4096, result_retention_hours: 24};
    vm.presetSelection = selection(vm.preset.operations);
  };
  vm.savePreset = function () {
    var definition = angular.copy(vm.preset); definition.operations = refs(vm.presetSelection);
    return mutate('PUT', '/resources/preset/support-request', {definition: definition, expected_revision: vm.presetRevision})
      .then(function (result) { if (result) { vm.presetRevision = result.revision; } });
  };
  vm.createClient = function () {
    var input = {client_id: vm.client.id, scopes: Object.keys(vm.client.scopes).filter(function (key) { return vm.client.scopes[key]; }),
      presets: ['support-request'].concat((vm.client.workflow_ids || '').split(',').map(function (id) { return id.trim(); }).filter(Boolean)), operations: refs(vm.clientSelection),
      customer_ids: vm.client.customer_ids.split(',').map(function (id) { return id.trim(); }).filter(Boolean),
      expires: Math.floor(Date.now() / 1000) + vm.client.expiry_days * 86400};
    return mutate('POST', '/clients', input).then(function (result) { if (result) { vm.token = result.token; } });
  };
  vm.revokeClient = function (id) { return mutate('DELETE', '/clients/' + encodeURIComponent(id)); };
  vm.testRun = function () {
    var input = {action: vm.test.action, customer_id: vm.test.customer_id};
    if (input.action === 'create_ticket') { input.summary = vm.test.summary; input.description = vm.test.description; }
    var idempotency = vm.test.idempotency || (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'test-' + Date.now());
    vm.test.idempotency = idempotency;
    return mutate('POST', '/test-runs', {client_id: vm.test.client_id, idempotency_key: idempotency,
      confirm_write: !!vm.test.confirm_write, request: {preset_id: 'support-request', version: vm.test.version, input: input}})
      .then(function (result) { vm.testResult = result; });
  };
  vm.reconcile = function (id) {
    return mutate('POST', '/effects/' + id + '/reconcile', {}).then(function (result) { vm.reconciliationResult = result; });
  };
  var unwatch = $scope.$watch('login.isLogged', function (logged) {
    if (!logged) { clear(); return; }
    AgentsService.access().then(function () { if (alive) { return vm.refresh(); } }).catch(fail)
      .finally(function () { if (alive) { $scope.view.changeRoute = false; } });
  });
  $scope.$on('$destroy', function () { alive = false; unwatch(); clear(); });
});
