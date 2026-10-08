'use strict';

angular.module('nethvoiceWizardUiApp')
  .filter('osName', function () {
    var names = {
      win32: 'Windows',
      darwin: 'macOS',
      linux: 'Linux'
    };
    return function (input) {
      if (!input) {
        return '';
      }
      return names[String(input).toLowerCase()] || input;
    };
  });
