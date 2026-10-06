'use strict';

angular.module('nethvoiceWizardUiApp').directive('workflowConfigField', function ($compile) {
  return {restrict: 'E', scope: {schema: '=', value: '=', label: '@', changed: '&'}, link: function (scope, element) {
    var type = scope.schema.type;
    var html = '<label class="workflow-field-label">{{label}}</label>';
    if (scope.schema.enum) {
      html += '<select class="form-control" ng-model="value" ng-options="option for option in schema.enum" ng-change="changed()"></select>';
    } else if (type === 'boolean') {
      html += '<input type="checkbox" ng-model="value" ng-change="changed()" aria-label="{{label}}">';
    } else if (type === 'integer' || type === 'number') {
      html += '<input class="form-control" type="number" ng-model="value" min="{{schema.minimum}}" max="{{schema.maximum}}" ng-change="changed()" aria-label="{{label}}">';
    } else if (type === 'array') {
      scope.$watchCollection('value', function (value) { scope.text = (value || []).join(', '); });
      scope.updateArray = function () { scope.value = scope.text.split(',').map(function (x) { return scope.schema.items.type === 'integer' ? Number(x.trim()) : x.trim(); }).filter(function (x) { return x !== ''; }); scope.changed(); };
      html += '<input class="form-control" ng-model="text" ng-change="updateArray()" aria-label="{{label}}" placeholder="{{\'Builder.comma_values\' | translate}}">';
    } else if (type === 'object' && scope.schema.properties) {
      scope.value = scope.value || {}; scope.fields = Object.keys(scope.schema.properties);
      html += '<div class="workflow-nested"><workflow-config-field ng-repeat="field in fields" schema="schema.properties[field]" value="value[field]" label="{{field}}" changed="changed()"></workflow-config-field></div>';
    } else if (type === 'object') {
      scope.value = scope.value || {}; scope.key = ''; scope.newValue = '';
      scope.set = function () {
        if (!scope.key || /^(?:__proto__|prototype|constructor)$/.test(scope.key)) { return; }
        var contract = scope.schema.additionalProperties || {};
        scope.value[scope.key] = contract.type === 'boolean' ? scope.newValue === 'true' : contract.type === 'array' ? scope.newValue.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : scope.newValue;
        scope.key = ''; scope.newValue = ''; scope.changed();
      };
      scope.remove = function (key) { delete scope.value[key]; scope.changed(); };
      html += '<div ng-repeat="(key, entry) in value" class="workflow-map-row"><span>{{key}}: {{entry}}</span><button type="button" class="btn btn-link" ng-click="remove(key)" aria-label="{{\'Builder.remove\' | translate}}">×</button></div>' +
        '<div class="workflow-map-row"><input class="form-control" ng-model="key" placeholder="{{\'Builder.key\' | translate}}" aria-label="{{\'Builder.key\' | translate}}"><input class="form-control" ng-model="newValue" placeholder="{{\'Builder.value\' | translate}}" aria-label="{{\'Builder.value\' | translate}}"><button type="button" class="btn btn-default" ng-click="set()">{{\'Builder.add\' | translate}}</button></div>';
    } else {
      html += '<textarea class="form-control" ng-model="value" maxlength="{{schema.maxLength || 8192}}" ng-change="changed()" aria-label="{{label}}" rows="2"></textarea>';
    }
    element.append($compile(html)(scope));
  }};
});

angular.module('nethvoiceWizardUiApp').directive('workflowSchemaEditor', function () {
  return {restrict: 'E', scope: {schema: '=', changed: '&'}, template:
    '<div class="workflow-schema-row" ng-repeat="(key, field) in schema.properties">' +
    '<strong>{{key}}</strong><select class="form-control" ng-model="field.type" ng-change="changed()" aria-label="{{key}}"><option>string</option><option>integer</option><option>number</option><option>boolean</option></select>' +
    '<label><input type="checkbox" ng-checked="required(key)" ng-click="toggle(key)"> {{\'Builder.required\' | translate}}</label><button type="button" class="btn btn-link" ng-click="remove(key)">×</button></div>' +
    '<div class="workflow-map-row"><input class="form-control" ng-model="newKey" placeholder="{{\'Builder.field_name\' | translate}}" aria-label="{{\'Builder.field_name\' | translate}}"><button type="button" class="btn btn-default" ng-click="add()">{{\'Builder.add_field\' | translate}}</button></div>',
    link: function (scope) {
      scope.schema = scope.schema || {type: 'object', properties: {}, required: [], additionalProperties: false};
      scope.required = function (key) { return (scope.schema.required || []).indexOf(key) >= 0; };
      scope.toggle = function (key) { scope.schema.required = scope.schema.required || []; var index = scope.schema.required.indexOf(key); if (index >= 0) { scope.schema.required.splice(index, 1); } else { scope.schema.required.push(key); } scope.changed(); };
      scope.add = function () { if (!/^[a-z][a-z0-9_]{0,47}$/.test(scope.newKey || '') || /^(?:__proto__|prototype|constructor)$/.test(scope.newKey)) { return; } scope.schema.properties[scope.newKey] = {type: 'string', maxLength: 1024}; scope.newKey = ''; scope.changed(); };
      scope.remove = function (key) { delete scope.schema.properties[key]; scope.schema.required = (scope.schema.required || []).filter(function (x) { return x !== key; }); scope.changed(); };
    }};
});
