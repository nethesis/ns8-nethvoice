'use strict';

angular.module('nethvoiceWizardUiApp').controller('AgentsCtrl', function (
  $scope, $routeParams, $location, $interval, $document, $q, AgentsService
) {
  var vm = this;
  var alive = true;
  var initialized = false;
  var pollBusy = false;
  var generation = 0;
  var cursor;
  var eventCursor;
  vm.page = $routeParams.runId ? 'detail' : ($location.path() === '/agents/settings' ? 'settings' : 'overview');
  vm.filters = {agent: '', provider: '', outcome: '', correlation: '', execution_kind: '', tool_error: false};
  vm.outcomes = ['active', 'completed', 'handed_off', 'fallback', 'failed', 'interrupted', 'unknown', 'cancelled'];
  vm.runs = []; vm.events = []; vm.inventory = []; vm.hours = 24; vm.onFirstPage = true;
  vm.loading = true;
  $scope.view.changeRoute = true;

  function clear() {
    generation++;
    vm.runs = []; vm.events = []; vm.inventory = []; vm.conversation = null;
    vm.apiResult = null; vm.run = null; vm.overview = null; vm.policy = null; vm.sync = null;
    AgentsService.clear();
  }
  function fail(error) {
    if (!alive) { return; }
    vm.error = error.status === 401 || error.status === 403 ? 'unauthorized' :
      error.status === 404 ? 'not_found' : error.status === 409 ? 'conflict' :
      error.status === 400 || error.status === 422 ? 'invalid' : 'unavailable';
    vm.conversation = null;
    if (vm.run && vm.run.status === 'active') { vm.run.status = 'unknown'; vm.run.complete = false; }
    if (vm.overview) { vm.overview = null; }
    angular.forEach(vm.runs, function (run) { if (run.status === 'active') { run.status = 'unknown'; run.complete = false; } });
    if (vm.error === 'unauthorized') { clear(); initialized = false; }
  }
  vm.time = function (timestamp) { return timestamp ? new Date(timestamp * 1000) : null; };
  vm.duration = function (run) { if (!run.ended && run.status !== 'active') { return null; } return Math.max(0, Math.round(((run.ended || Date.now() / 1000) - run.started))); };
  vm.configurationUrl = function (agent) { return '/freepbx/admin/config.php?display=satellite_agents&tab=' + agent; };

  vm.loadRuns = function (next) {
    if (vm.runsLoading) { return; }
    var params = {limit: 50};
    angular.forEach(vm.filters, function (value, key) { if (value && key !== 'after' && key !== 'before') { params[key] = value; } });
    if (vm.filters.after) { params.after = vm.filters.after.getTime() / 1000; }
    if (vm.filters.before) { params.before = vm.filters.before.getTime() / 1000; }
    if (next && cursor) { params.cursor = cursor; }
    var current = generation;
    vm.runsLoading = true; vm.error = null;
    return AgentsService.request('GET', '/runs', null, params).then(function (data) {
      if (!alive || current !== generation) { return; }
      vm.runs = data.items; cursor = data.next_cursor; vm.hasNext = !!cursor; vm.onFirstPage = !next;
    }, fail).finally(function () { vm.runsLoading = false; });
  };
  vm.loadEvents = function (next) {
    if (vm.eventsLoading || vm.events.length >= 2000) { return; }
    vm.eventsLoading = true;
    var current = generation;
    return AgentsService.request('GET', '/runs/' + encodeURIComponent($routeParams.runId) + '/events', null,
      {limit: 100, cursor: next ? eventCursor : undefined}).then(function (data) {
      if (!alive || current !== generation) { return; }
      vm.events = next ? vm.events.concat(data.items) : data.items;
      eventCursor = data.next_cursor; vm.moreEvents = !!eventCursor;
    }, fail).finally(function () { vm.eventsLoading = false; });
  };
  function loadDetail() {
    var current = generation;
    return AgentsService.request('GET', '/runs/' + encodeURIComponent($routeParams.runId)).then(function (data) {
      if (alive && current === generation) { vm.run = data; if (vm.error === 'unavailable') { vm.error = null; } }
    }, fail);
  }
  function loadOverview() {
    var current = generation;
    return AgentsService.request('GET', '/overview', null, {hours: vm.hours}).then(function (data) {
      if (alive && current === generation) { vm.overview = data; vm.sync = data.configuration_sync; if (vm.error === 'unavailable') { vm.error = null; } }
    }, fail);
  }
  vm.refresh = function () {
    vm.error = null;
    return loadOverview();
  };
  vm.showTranscript = function () {
    vm.transcriptLoading = true;
    var current = generation;
    return AgentsService.request('GET', '/runs/' + encodeURIComponent($routeParams.runId) + '/transcript').then(function (data) {
      if (alive && current === generation) { vm.conversation = data; }
    }, fail).finally(function () { vm.transcriptLoading = false; });
  };
  vm.showApiResult = function () {
    var current = generation;
    return AgentsService.request('GET', '/application/runs/' + encodeURIComponent($routeParams.runId) + '/result').then(function (data) {
      if (alive && current === generation) { vm.apiResult = data; }
    }, fail);
  };
  vm.hideApiResult = function () { vm.apiResult = null; };
  vm.cancelApiRun = function () {
    return AgentsService.mutate('POST', '/application/runs/' + encodeURIComponent($routeParams.runId) + '/cancel', {})
      .then(function () { return loadDetail(); }, fail);
  };
  vm.hideTranscript = function () { vm.conversation = null; };
  vm.deleteTranscript = function () {
    vm.deleting = true;
    var current = generation;
    return AgentsService.mutate('DELETE', '/runs/' + encodeURIComponent($routeParams.runId) + '/transcript').then(function () {
      if (!alive || current !== generation) { return; }
      vm.conversation = null; vm.confirmDelete = false; return loadDetail();
    }, fail).finally(function () { vm.deleting = false; });
  };
  vm.savePolicy = function () {
    vm.saving = true; vm.error = null; vm.saved = false;
    var current = generation;
    var input = angular.copy(vm.policy);
    delete input.capture_versions;
    input.expected_revision = vm.sync.desired_revision;
    return AgentsService.mutate('PUT', '/policy', input).then(function (data) {
      if (!alive || current !== generation) { return; }
      vm.policy = data.policy; vm.sync = data.sync; vm.saved = true; vm.applied = data.applied;
    }, fail).finally(function () { vm.saving = false; });
  };
  function initialize() {
    if (initialized || !$scope.login || !$scope.login.isLogged) { return; }
    initialized = true; vm.loading = true;
    var current = generation;
    AgentsService.access().then(function () {
      if (!alive || current !== generation || !$scope.login.isLogged) { return; }
      return $q.all([
        AgentsService.request('GET', '/agents').then(function (data) {
          if (alive && current === generation) { vm.inventory = data.items; }
        }),
        AgentsService.request('GET', '/policy').then(function (data) {
          if (alive && current === generation) { vm.policy = data.policy; vm.sync = data.sync; }
        }),
        vm.page === 'detail' ? $q.all([loadDetail(), vm.loadEvents(false)]) :
          vm.page === 'overview' ? $q.all([loadOverview(), vm.loadRuns(false)]) : $q.when()
      ]);
    }).catch(fail).finally(function () {
      if (alive) { vm.loading = false; $scope.view.changeRoute = false; }
    });
  }
  var unwatch = $scope.$watch('login.isLogged', function (logged) {
    if (logged) { initialize(); } else { clear(); initialized = false; }
  });
  var poll = $interval(function () {
    if (!initialized || vm.loading || !$scope.login.isLogged || $document[0].hidden || pollBusy || vm.page === 'settings') { return; }
    pollBusy = true;
    var operation = vm.page === 'detail' ? loadDetail() : loadOverview();
    operation.finally(function () { pollBusy = false; });
  }, 5000);
  $scope.$on('$destroy', function () { alive = false; $interval.cancel(poll); unwatch(); clear(); });
});
