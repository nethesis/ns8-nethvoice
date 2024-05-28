'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:FinalCtrl
 * @description
 * # FinalCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('FinalCtrl', function ($scope, $filter, UserService) {
    $scope.wizard.isWizard = false;
    $scope.customConfig = customConfig;

    $scope.generatePDF = function () {
      var columns = [{
          title: $filter('translate')('Extension'),
          dataKey: "default_extension"
        }, {
          title: $filter('translate')('Fullname'),
          dataKey: "displayname"
        },
        {
          title: $filter('translate')('Username'),
          dataKey: "username"
        },
        {
          title: $filter('translate')('Voicemail Password'),
          dataKey: "voicemailpwd"
        }
      ];
      if ($scope.mode.isLdap) {
        columns.push({
          title: "Password",
          dataKey: "password"
        });
      }
      var rows = [];

      UserService.retrieveFinalInfo().then(function (res) {
        rows = res.data;
        var doc = new jsPDF('l', 'pt');
        doc.autoTable(columns, rows, {
          theme: 'grid',
          margin: {
            top: 100
          },
          styles: {
            fontSize: 12,
            cellPadding: 15
          },
          headerStyles: {
            fillColor: [63, 156, 53]
          },
          addPageContent: function (data) {
            doc.text($filter('translate')('Final wizard report'), 40, 30);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text($filter('translate')('Header Report 1'), 40, 60);
            doc.text($filter('translate')('Header Report 2'), 40, 80);
            doc.setFontSize(11);
            doc.text(customConfig.BRAND_NAME, data.settings.margin.left, doc.internal.pageSize.height - 20);
          }
        });
        doc.save('wizard_report.pdf');
      }, function (err) {
        console.log(err);
      });
    };

  });
