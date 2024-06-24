'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:AppsCardsCtrl
 * @description
 * # AppsCardsCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular.module('nethvoiceWizardUiApp')
  .controller('AppsCardsCtrl', function ($scope, ProfileService, ApplicationService) {
    $scope.allProfiles = [];
    $scope.allSources = [];
    $scope.allTemplates = [];
    $scope.allCards = [];
    $scope.allDBTypes = [];
    $scope.supportedColors = {
      'red': '#db2828',
      'orange': '#f2711c',
      'yellow': '#fbbd08',
      'olive': '#b5cc18',
      'green': '#21ba45',
      'teal': '#00b5ad',
      'blue': '#2185d0',
      'violet': '#6435c9',
      'purple': '#a333c8',
      'pink': '#e03997',
      'brown': '#a5673f'
    };
    $scope.mapColors = {
      'red': 'red-600',
      'orange': 'yellow-600',
      'yellow': 'yellow-500',
      'olive': 'lime-800',
      'green': 'emerald-600',
      'teal': 'green-400',
      'blue': 'blue-600',
      'violet': 'violet-500',
      'purple': 'purple-600',
      'pink': 'pink-500',
      'brown': 'yellow-800'
    };

    $scope.sourcePortMap = {
      "mssql:7_1": '1433',
      "mssql:7_2": '1433',
      "mssql:7_3_A": '1433',
      "mssql:7_3_B": '1433',
      "mssql:7_4": '1433',
      "mysql": '3306',
      "postgres": '5432'
    };

    $scope.newSource = {
      verified: false,
      isChecking: false,
      checked: false,
      showPass: false
    };

    $scope.newTemplate = {
      html: '',
      custom: true
    };

    $scope.newCard = {
      query: ''
    };

    $scope.updatePort = function () {
      $scope.newSource.port = $scope.sourcePortMap[$scope.newSource.type];
    };

    $scope.isCustomerCardsWizard = function (step) {
      var status = true;
      if (step == 1) {
        status = $scope.allSources.length == 0 && $scope.allTemplates.length == 0 && $scope.allCards.length == 0;
      }
      if (step == 2) {
        status = $scope.allTemplates.length == 0 && $scope.allCards.length == 0;
      }
      if (step == 3) {
        status = $scope.allCards.length == 0;
      }
      return status;
    };

    $scope.togglePass = function (g) {
      g.showPass = !g.showPass;
    };

    $scope.setColor = function (g, color) {
      g.onSaveColor = true;
      var oldColor = g.color;
      g.color = color;
      RegExp.quote = function (str) {
        return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
      };
      var replace = oldColor;
      var re = new RegExp(RegExp.quote(replace), "g");

      g.html = g.html.replace('bg-' + $scope.mapColors[oldColor], 'bg-' + $scope.mapColors[color]);
    };

    $scope.editorOnChange = function (e) {
      setTimeout(function () {
        var _editor = e[1];
        _editor.resize();
      }, 200);
    };

    $scope.getDBName = function (type) {
      return $scope.allDBTypes[type];
    };

    $scope.getSourceName = function (id) {
      var obj = $scope.allSources.filter(function (val) {
        return val.id == id;
      })[0];
      return obj && obj.name;
    };

    $scope.getAllDBTypes = function () {
      ApplicationService.allDBTypes().then(function (res) {
        $scope.allDBTypes = res.data;
      }, function (err) {
        console.log(err);
      });
    };

    $scope.getAllSources = function (reload) {
      $scope.view.changeRoute = reload;
      ApplicationService.allSources().then(function (res) {
        $scope.allSources = res.data;
        $scope.view.changeRoute = false;
        for (var s in $scope.allSources) {
          $scope.checkConnection($scope.allSources[s]);
        }
      }, function (err) {
        console.log(err);
        $scope.view.changeRoute = false;
      });
    };

    $scope.getAllTemplates = function (reload) {
      $scope.view.changeRoute = reload;
      ApplicationService.allTemplates().then(function (res) {
        $scope.allTemplates = res.data;
        for (var t in $scope.allTemplates) {
          $scope.allTemplates[t].html = atob($scope.allTemplates[t].html);
        }
        $scope.view.changeRoute = false;
      }, function (err) {
        console.log(err);
        $scope.view.changeRoute = false;
      });
    };

    $scope.getAllCards = function (reload) {
      $scope.view.changeRoute = reload;
      ApplicationService.allCards().then(function (res) {
        $scope.allCards = res.data;
        for (var t in $scope.allCards) {
          $scope.allCards[t].query = atob($scope.allCards[t].query);
          $scope.allCards[t].template = $scope.allCards[t].template.custom ? $scope.allCards[t].template.name + '_custom' : $scope.allCards[t].template.name;
        }
        $scope.view.changeRoute = false;
      }, function (err) {
        console.log(err);
        $scope.view.changeRoute = false;
      });
    };

    $scope.getAllProfiles = function () {
      ProfileService.allProfiles().then(function (res) {
        $scope.allProfiles = res.data;
      }, function (err) {
        console.log(err);
      });
    };

    $scope.checkConnection = function (s) {
      s.isChecking = true;
      ApplicationService.checkConnectionSource(s).then(function (res) {
        s.checked = true;
        s.isChecking = false;
        s.verified = true;
      }, function (err) {
        s.checked = true;
        s.isChecking = false;
        s.verified = false;
        console.log(err);
      });
    };

    $scope.saveSource = function (s) {
      s.onSave = true;
      // clean useless data
      delete s.checked;
      delete s.isChecking;
      delete s.onSave;
      delete s.onMod;
      delete s.verified;
      delete s.showPass;
      if (s.id) {
        ApplicationService.updateSource(s.id, s).then(function (res) {
          s.onSave = false;
          $scope.getAllSources(false);
          $scope.onSaveSuccessSource = true;
          $scope.onSaveErrorSource = false;
          $scope.allSources.push(s);
          $scope.newSource = {
            verified: false,
            isChecking: false,
            checked: false
          };
          $('#newSourceModal').modal('hide');
          if ($scope.isCustomerCardsWizard(2)) {
            setTimeout(function () {
              $('#newTemplateModal').modal('show');
            }, 500);
          }
        }, function (err) {
          s.onSave = false;
          $scope.onSaveSuccessSource = false;
          $scope.onSaveErrorSource = true;
          $('#newSourceModal').modal('hide');
          console.log(err);
        });
      } else {
        ApplicationService.createSource(s).then(function (res) {
          s.onSave = false;
          $scope.getAllSources(false);
          $scope.onSaveSuccessSource = true;
          $scope.onSaveErrorSource = false;
          $scope.allSources.push(s);
          $scope.newSource = {
            verified: false,
            isChecking: false,
            checked: false
          };
          $('#newSourceModal').modal('hide');
          if ($scope.isCustomerCardsWizard(3)) {
            setTimeout(function () {
              $('#newCardModal').modal('show');
            }, 500);
          }
        }, function (err) {
          s.onSave = false;
          $scope.onSaveSuccessSource = false;
          $scope.onSaveErrorSource = true;
          $('#newSourceModal').modal('hide');
          console.log(err);
        });
      }
    };
    $scope.modifySource = function (s) {
      s.onMod = true;
      $scope.newSource = s;
    };
    $scope.checkSourceDeps = function (s) {
      $('#cardSourceDepsModal').modal('show');
      $scope.cardDeps = s;
      $scope.cardDeps.loading = true;
      ApplicationService.sourceDeps(s.id).then(function (res) {
        $scope.cardDeps.dependencies = res.data;
        $scope.cardDeps.loading = false;
      }, function (err) {
        $scope.cardDeps.loading = false;
        console.log(err);
      });
    };
    $scope.deleteSource = function (s) {
      s.onSave = true;
      ApplicationService.deleteSource(s.id).then(function (res) {
        s.onSave = false;
        $scope.getAllSources(false);
        $('#cardSourceDepsModal').modal('hide');
      }, function (err) {
        s.onSave = false;
        console.log(err);
      });
    };
    $scope.cancelSource = function (s) {
      $scope.newSource = {
        verified: false,
        isChecking: false,
        checked: false
      };

      s = $scope.newSource;
      s.onMod = false;
    };

    $scope.saveTemplate = function (s) {
      s.onSave = true;
      s.html = btoa(s.html);
      // clean useless data
      delete s.objects;
      delete s.onSave;
      delete s.onMod;
      delete s.onSaveColor;
      delete s.color;
      if (s.onMod && s.name == s.old_name) {
        ApplicationService.updateTemplate(s.old_name, s).then(function (res) {
          s.onSave = false;
          $scope.getAllTemplates(false);
          $scope.onSaveSuccessTemplate = true;
          $scope.onSaveErrorTemplate = false;
          $scope.allTemplates.push(s);
          $scope.newTemplate = {
            html: '',
            custom: true
          };
          $('#newTemplateModal').modal('hide');
        }, function (err) {
          s.onSave = false;
          $scope.onSaveSuccessTemplate = false;
          $scope.onSaveErrorTemplate = true;
          $('#newTemplateModal').modal('hide');
          console.log(err);
        });
      } else {
        ApplicationService.createTemplate(s).then(function (res) {
          s.onSave = false;
          $scope.getAllTemplates(false);
          $scope.onSaveSuccessTemplate = true;
          $scope.onSaveErrorTemplate = false;
          $scope.allTemplates.push(s);
          $scope.newTemplate = {
            html: '',
            custom: true
          };
          $('#newTemplateModal').modal('hide');
        }, function (err) {
          s.onSave = false;
          $scope.onSaveSuccessTemplate = false;
          $scope.onSaveErrorTemplate = true;
          $('#newTemplateModal').modal('hide');
          console.log(err);
        });
      }
    };
    $scope.switchResultsData = function (t) {
      var template = '';
      var t = t.split('_')[0];
      switch (t) {
        case 'table':
          template = JSON.stringify([{
            "Col_1": "Val_1",
            "Col_2": "Val_2"
          }, {
            "Col_1": "Val_3",
            "Col_2": "Val_4"
          }]);
          break;
        case 'identity':
          template = JSON.stringify([{
            "name": "John Doe",
            "type": "public",
            "extension": "200",
            "homephone": "555894512",
            "workphone": "78960012",
            "cellphone": "340784512",
            "url": "http://google.com",
            "company": "Google Inc."
          }]);;
          break;
        case 'statistics':
          template = JSON.stringify([{
            "key": "value"
          }]);
          break;
        case 'lastcalls':
          template = JSON.stringify([{
            "date": "18/04/2017",
            "time": "09:50:25",
            "billsec": "15:23:56",
            "clid": "John Doe",
            "dst": "Marilyn Monroe"
          }]);
          break;
      }
      return template;
    };
    $scope.modifyTemplate = function (s) {
      s.onMod = true;
      s.old_name = s.name;
      s.objects = s.custom ? '[{"name": "John", "lastname": "Doe"}]' : $scope.switchResultsData(s.name);
      $scope.newTemplate = s;
    };
    $scope.checkTemplateDeps = function (s) {
      $('#cardTemplateDepsModal').modal('show');
      $scope.cardDeps = s;
      $scope.cardDeps.loading = true;
      ApplicationService.templateDeps(s.name).then(function (res) {
        $scope.cardDeps.dependencies = res.data;
        $scope.cardDeps.loading = false;
      }, function (err) {
        $scope.cardDeps.loading = false;
        console.log(err);
      });
    };
    $scope.deleteTemplate = function (s) {
      s.onSave = true;
      ApplicationService.deleteTemplate(s.name).then(function (res) {
        s.onSave = false;
        $scope.getAllTemplates(false);
        $('#cardTemplateDepsModal').modal('hide');
      }, function (err) {
        s.onSave = false;
        console.log(err);
      });
    };
    $scope.cancelTemplate = function (s) {
      $scope.newTemplate = {
        html: '<% for(var i=0; i<results.length; i++){ %><%= results[i].name %> <strong><%= results[i].lastname %></strong><% } %>',
        custom: true,
        objects: JSON.stringify([{
          name: "John",
          lastname: "Doe"
        }])
      };
      s = $scope.newTemplate;
      s.onMod = false;
    };

    $scope.saveCard = function (s) {
      s.onSave = true;
      s.query = btoa(s.query);
      // clean useless data
      delete s.onSave;
      delete s.onMod;
      delete s.render_html;
      delete s.isChecking;
      delete s.permission_id;
      if (s.id) {
        ApplicationService.updateCard(s.id, s).then(function (res) {
          s.onSave = false;
          $scope.getAllCards(false);
          $scope.onSaveSuccessCard = true;
          $scope.onSaveErrorCard = false;
          $scope.allCards.push(s);
          $scope.newCard = {
            query: ''
          };
          $('#newCardModal').modal('hide');
        }, function (err) {
          s.onSave = false;
          $scope.onSaveSuccessCard = false;
          $scope.onSaveErrorCard = true;
          $('#newCardModal').modal('hide');
          console.log(err);
        });
      } else {
        ApplicationService.createCard(s).then(function (res) {
          s.onSave = false;
          $scope.getAllCards(false);
          $scope.onSaveSuccessCard = true;
          $scope.onSaveErrorCard = false;
          $scope.allCards.push(s);
          $scope.newCard = {
            query: ''
          };
          $('#newCardModal').modal('hide');
        }, function (err) {
          s.onSave = false;
          $scope.onSaveSuccessCard = false;
          $scope.onSaveErrorCard = true;
          $('#newCardModal').modal('hide');
          console.log(err);
        });
      }

    };
    $scope.modifyCard = function (s) {
      s.onMod = true;
      s.render_html = '';
      $scope.newCard = s;
      $scope.updatePreview(s);
    };
    $scope.deleteCard = function (s) {
      s.onSave = true;
      ApplicationService.deleteCard(s.id).then(function (res) {
        s.onSave = false;
        $scope.getAllCards(false);
      }, function (err) {
        s.onSave = false;
        console.log(err);
      });
    };
    $scope.cancelCard = function (s) {
      $scope.newCard = {
        query: '',
        render_html: ''
      };
      s = $scope.newCard;
      s.onMod = false;
    };

    $scope.setPreview = function (g) {
      var tmpl = '';
      for (var t in $scope.allTemplates) {
        if (g.template == $scope.allTemplates[t].name) {
          tmpl = $scope.allTemplates[t].html;
        }
      }
      g.html = tmpl;
      g.render_html = '';
      $scope.ccard = g;
    };
    $scope.updatePreview = function (g) {
      g.isChecking = true;
      ApplicationService.customerCardPreview({
        dbconn_id: g.dbconn_id,
        template: g.template,
        query: btoa(g.query)
      }).then(function (res) {

        g.render_html = '<style>body{overflow: auto !important; padding: 5px !important;}</style><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css"/>' + atob(res.data.html);
        g.isChecking = false;
      }, function (err) {
        g.isChecking = false;
        g.render_html = '';
        console.log(err);
      });
    };
    $scope.setTemplatePreview = function (g) {
      g.objects = '[{"name": "John", "lastname": "Doe"}]';
    };
    $scope.setDuplicate = function (g) {
      $scope.duplicated = g;
      $scope.duplicated.old_name = g.name;
    };
    $scope.duplicateTemplate = function (g) {
      g.name = g.name;
      g.custom = true;
      $scope.saveTemplate(g);
      $('#duplicateTemplateModal').modal('hide');
    };

    $scope.$on( "$routeChangeSuccess", function(event, next, current) {
      if (next.templateUrl === 'views/apps/cards.html') {
        $scope.getAllDBTypes();
        $scope.getAllProfiles();
        $scope.getAllSources(true);
        $scope.getAllTemplates(true);
        $scope.getAllCards(true);
      }
    });

    $scope.$on('loginCompleted', function (event, args) {
      $scope.getAllDBTypes();
      $scope.getAllProfiles();
      $scope.getAllSources(true);
      $scope.getAllTemplates(true);
      $scope.getAllCards(true);
    });
  });
