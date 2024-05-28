'use strict';

/**
 * @ngdoc overview
 * @name nethvoiceWizardUiApp
 * @description
 * # nethvoiceWizardUiApp
 *
 * Main module of the application.
 */

angular
  .module('nethvoiceWizardUiApp', [
    'ngCookies',
    'ngResource',
    'ngRoute',
    'ngSanitize',
    'pascalprecht.translate',
    'ui.bootstrap',
    'as.sortable',
    'patternfly',
    'frapontillo.bootstrap-switch',
    'ui.ace'
  ])
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/dashboard.html',
        controller: 'DashboardCtrl',
        controllerAs: 'dashboard'
      })
      .when('/extensions', {
        templateUrl: 'views/extensions.html',
        controller: 'UsersExtensionsCtrl',
        controllerAs: 'extensions'
      })
      .when('/users', {
        templateUrl: 'views/users.html',
        controller: 'UsersCtrl',
        controllerAs: 'users'
      })
      .when('/trunks', {
        templateUrl: 'views/trunks.html',
        controller: 'TrunksCtrl',
        controllerAs: 'trunks'
      })
      .when('/routes', {
        templateUrl: 'views/routes.html',
        controller: 'RoutesCtrl',
        controllerAs: 'routes'
      })
      .when('/devices', {
        templateUrl: 'views/devices.html',
        controller: 'DevicesCtrl',
        controllerAs: 'devices'
      })
      .when('/devices/inventory', {
        templateUrl: 'views/devices/inventory.html',
        controller: 'DevicesInventoryCtrl',
        controllerAs: 'devices/inventory'
      })
      .when('/devices/models', {
        templateUrl: 'views/devices/models.html',
        controller: 'DevicesModelsCtrl',
        controllerAs: 'devices/models'
      })
      .when('/trunks/physical', {
        templateUrl: 'views/trunks/physical.html',
        controller: 'TrunksPhysicalCtrl',
        controllerAs: 'trunks/physical'
      })
      .when('/trunks/voip', {
        templateUrl: 'views/trunks/voip.html',
        controller: 'TrunksVoipCtrl',
        controllerAs: 'trunks/voip'
      })
      .when('/routes/inbound', {
        templateUrl: 'views/routes/inbound.html',
        controller: 'RoutesInboundCtrl',
        controllerAs: 'routes/inbound'
      })
      .when('/routes/outbound', {
        templateUrl: 'views/routes/outbound.html',
        controller: 'RoutesOutboundCtrl',
        controllerAs: 'routes/outbound'
      })
      .when('/configurations/devices', {
        templateUrl: 'views/configurations/devices.html',
        controller: 'UsersDevicesCtrl',
        controllerAs: 'configurations/devices'
      })
      .when('/configurations/groups', {
        templateUrl: 'views/configurations/groups.html',
        controller: 'UsersGroupsCtrl',
        controllerAs: 'configurations/groups'
      })
      .when('/configurations/profiles', {
        templateUrl: 'views/configurations/profiles.html',
        controller: 'UsersProfilesCtrl',
        controllerAs: 'configurations/profiles'
      })
      .when('/configurations/preferences', {
        templateUrl: 'views/configurations/preferences.html',
        controller: 'ConfigurationsCtrl',
        controllerAs: 'configurations/preferences'
      })
      .when('/configurations/preferencesFreepbx', {
        templateUrl: 'views/configurations/preferencesFreepbx.html',
        controller: 'OtherConfigurationsCtrl',
        controllerAs: 'configurations/preferencesFreepbx'
      })
      .when('/final', {
        templateUrl: 'views/final.html',
        controller: 'FinalCtrl',
        controllerAs: 'final'
      })
      .when('/admin', {
        templateUrl: 'views/admin.html',
        controller: 'AdminCtrl',
        controllerAs: 'admin'
      })
      .when('/admin/settings', {
        templateUrl: 'views/admin/settings.html',
        controller: 'AdminSettingsCtrl',
        controllerAs: 'admin/settings'
      })
      .when('/admin/report', {
        templateUrl: 'views/admin/report.html',
        controller: 'AdminReportCtrl',
        controllerAs: 'admin/report'
      })
      .when('/apps', {
        templateUrl: 'views/apps.html',
        controller: 'AppsCtrl',
        controllerAs: 'apps'
      })
      .when('/apps/cards', {
        templateUrl: 'views/apps/cards.html',
        controller: 'AppsCardsCtrl',
        controllerAs: 'apps/cards'
      })
      .when('/apps/paramurl', {
        templateUrl: 'views/apps/paramurl.html',
        controller: 'AppsParamurlCtrl',
        controllerAs: 'apps/paramurl'
      })
      .when('/apps/cloudServices', {
        templateUrl: 'views/apps/cloudServices.html',
        controller: 'AppsVoicemailTextCtrl',
        controllerAs: 'apps/voicemailText'
      })
      .when('/admin/languages', {
        templateUrl: 'views/admin/languages.html',
        controller: 'AdminLanguagesCtrl',
        controllerAs: 'admin/languages'
      })
      .when('/apps/bulkextensions', {
        templateUrl: 'views/apps/bulkextensions.html',
        controller: 'BulkextensionsCtrl',
        controllerAs: 'bulkextensions'
      })
      .when('/apps/bulkdevices', {
        templateUrl: 'views/apps/bulkdevices.html',
        controller: 'BulkdevicesCtrl',
        controllerAs: 'Bulkdevices'
      })
      .when('/migration', {
        templateUrl: 'views/migration.html',
        controller: 'MigrationCtrl',
        controllerAs: 'migration'
      })
      .when('/migration/users', {
        templateUrl: 'views/migration/users.html',
        controller: 'UsersmigrationCtrl',
        controllerAs: 'usersmigration'
      })
      .when('/migration/config', {
        templateUrl: 'views/migration/config.html',
        controller: 'ConfigmigrationCtrl',
        controllerAs: 'configmigration'
      })
      .when('/migration/cdr', {
        templateUrl: 'views/migration/cdr.html',
        controller: 'CdrmigrationCtrl',
        controllerAs: 'cdrmigration'
      })
      .when('/migration/report', {
        templateUrl: 'views/migration/report.html',
        controller: 'ReportmigrationCtrl',
        controllerAs: 'reportmigration'
      })
      .when('/apps/phonebook', {
        templateUrl: 'views/apps/phonebook.html',
        controller: 'PhonebookCtrl',
        controllerAs: 'phonebook'
      })
      .when('/bulkdevices', {
        templateUrl: 'views/bulkdevices.html',
        controller: 'BulkdevicesCtrl',
        controllerAs: 'bulkdevices'
      })
      .otherwise({
        redirectTo: '/'
      });
  }).config(function ($translateProvider) {
    $translateProvider.useSanitizeValueStrategy(null);
    $translateProvider.useStaticFilesLoader({
      prefix: 'scripts/i18n/locale-',
      suffix: '.json'
    });
    $translateProvider.fallbackLanguage('en');
  });
