'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:ReportmigrationCtrl
 * @description
 * # ReportmigrationCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('ReportmigrationCtrl', function ($scope, $location, $filter, MigrationService) {

    $scope.migration = migrationConfig.LABEL_INFO;
    $scope.report = {};

    $scope.getReport = function () {
      MigrationService.getReport().then(function (res) {
        $scope.view.changeRoute = false;
        $scope.report = res.data;
      }, function (err) {
        console.log(err);
      });
    }

    $scope.generatePDF = function () {
      var doc = new jsPDF('l', 'pt');
      doc.text($filter('translate')('Migration report'), 40, 35);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text($filter('translate')('Header Migration Report 1'), 40, 63);
      doc.setFontSize(11);
      var n = 0; 
      $.each($scope.migration, function(elem, value) {
        value.rows = [];
        for (var func in value.functions) {
          for (var type in $scope.report[value.functions[func]]) {
            for (var msgKey in $scope.report[value.functions[func]][type]) {
              var row = {
               "msg": $scope.report[value.functions[func]][type][msgKey],
               "case": type === "errors" ? "error" : type === "warnings" ? "warning" : type === "infos" ? "info" : type
              };
              value.rows.push(row);
            }
          }
        }
        value.columns = [{
          title: $filter('translate')('Migration') + ": " + $filter('translate')(elem),
          dataKey: "msg"
        }, {
          title: $filter('translate')('Type'),
          dataKey: "case"
        }];
        if (value.rows[0]) {
          if (n === 0) {
            var marginTop = 100;
          } else {
            var marginTop = 20;
          }
          n++;
          doc.autoTable(value.columns, value.rows, {
            startY: doc.autoTableEndPosY() + marginTop,
            theme: 'grid',
            styles: {
              fontSize: 11,
              cellPadding: 10,
              overflow: 'linebreak'
            },
            columnStyles: {
              msg: {
                columnWidth: "auto"
              },
              case: {
                columnWidth: 65
              }
            },
            headerStyles: {
              fillColor: [63, 156, 53]
            }
          });
        }
      }); 
      doc.save('migration_report.pdf');
    };

    $scope.getReport();
    $scope.redirectOnMigrationStatus();

  });
