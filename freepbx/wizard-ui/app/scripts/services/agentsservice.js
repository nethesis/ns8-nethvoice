'use strict';

angular.module('nethvoiceWizardUiApp').service('AgentsService', function ($http) {
  var csrf;
  var base = customConfig.BASE_API_URL + '/agents';
  this.clear = function () { csrf = undefined; };
  this.request = function (method, path, data, params) {
    return $http({method: method, url: base + path, data: data, params: params,
      cache: false, timeout: 10000,
      headers: method === 'PUT' || method === 'DELETE' || method === 'POST' ? {'X-Agents-CSRF': csrf} : {}})
      .then(function (response) { return response.data; });
  };
  this.access = function () {
    return this.request('GET', '/access').then(function (data) { csrf = data.csrf; return data; });
  };
  this.mutate = function (method, path, data) {
    var self = this;
    return this.access().then(function () { return self.request(method, path, data); });
  };
});
