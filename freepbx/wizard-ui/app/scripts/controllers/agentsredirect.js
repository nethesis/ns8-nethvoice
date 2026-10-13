/* Keep bookmarked Wizard URLs usable during the standalone UI migration. */
angular.module('nethvoiceWizardUiApp').controller('AgentsRedirectCtrl', function ($window, $location, $routeParams) {
  var path = $location.path();
  var destinations = { '/agents': '/activity', '/agents/settings': '/settings/history', '/agents/build': '/agents', '/agents/data': '/sources', '/agents/connectors': '/settings/connections', '/agents/api': '/settings/api-access' };
  var target = destinations[path] || '/agents';
  if ($routeParams.agentId) { target = ($routeParams.kind === 'subflow' ? '/workflows/' : '/agents/') + encodeURIComponent($routeParams.agentId) + '/general'; }
  if ($routeParams.runId) { target = '/activity/' + encodeURIComponent($routeParams.runId); }
  $window.location.replace('/freepbx/satellite/agents/#' + target);
});
