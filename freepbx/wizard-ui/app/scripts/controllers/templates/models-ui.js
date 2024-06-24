'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:ModelsUICtrl
 * @description
 * # ModelsUICtrl
 * Controller of the nethvoiceWizardUiApp
 */

angular.module('nethvoiceWizardUiApp')
  .controller('ModelsUICtrl', function ($scope, $interval, $location, ModelService, PhoneService, UserService, $rootScope) {

    $scope.loadingAction = false
    $scope.selectedAction = ""
    $scope.modelsInfoMsg = ""
    $scope.selectOptionsInterval = ""
    $scope.selectOptionsLimit = 11

    $scope.modelErrors = {
      updateReadOnlyAttribute: false,
      resetChangesNotFound: false,
      deleteChangesNotFound: false
    }

    $scope.modelErrorsSingle = {
      patchSingleVariables: false
    }

    var resetLoadingAction = function (status) {
      $scope.loadingAction = status
      setTimeout(function () {
        $scope.loadingAction = false
        $scope.$apply()
      }, 2500)
    }

    $scope.openActionModal = function (action) {
      $scope.selectedAction = action
      $("#actionsModal").modal("show")
    }

    $scope.isKeysSection = function (keyName) {
      if (keyName.toLowerCase().includes("keys")) {
        return true
      } else {
        return false
      }
    }

    $scope.isExpKeysSection = function (keyName) {
      if (keyName.toLowerCase().includes("exp")) {
        return true
      } else {
        return false
      }
    }

    $scope.ldapToModelVariables = function (res, ldaps) {
      if (ldaps) {
        $scope.currentModel.variables.ldap_port = res["ldaps"].port
        $scope.currentModel.variables.ldap_user = res["ldaps"].user
        $scope.currentModel.variables.ldap_password = res["ldaps"].password
        $scope.currentModel.variables.ldap_tls = res["ldaps"].tls
        $scope.currentModel.variables.ldap_base = res["ldaps"].base
        $scope.currentModel.variables.ldap_name_display = res["ldaps"].name_display
        $scope.currentModel.variables.ldap_mainphone_number_attr = res["ldaps"].mainphone_number_attr
        $scope.currentModel.variables.ldap_mobilephone_number_attr = res["ldaps"].mobilephone_number_attr
        $scope.currentModel.variables.ldap_otherphone_number_attr = res["ldaps"].otherphone_number_attr
        $scope.currentModel.variables.ldap_name_attr = res["ldaps"].name_attr
        $scope.currentModel.variables.ldap_number_filter = res["ldaps"].number_filter
        $scope.currentModel.variables.ldap_name_filter = res["ldaps"].name_filter
        $scope.currentModel.variables.ldap_server = ""
      } else {
        $scope.currentModel.variables.ldap_port = res["ldap"].port
        $scope.currentModel.variables.ldap_user = res["ldap"].user
        $scope.currentModel.variables.ldap_password = res["ldap"].password
        $scope.currentModel.variables.ldap_tls = res["ldap"].tls
        $scope.currentModel.variables.ldap_base = res["ldap"].base
        $scope.currentModel.variables.ldap_name_display = res["ldap"].name_display
        $scope.currentModel.variables.ldap_mainphone_number_attr = res["ldap"].mainphone_number_attr
        $scope.currentModel.variables.ldap_mobilephone_number_attr = res["ldap"].mobilephone_number_attr
        $scope.currentModel.variables.ldap_otherphone_number_attr = res["ldap"].otherphone_number_attr
        $scope.currentModel.variables.ldap_otherphone_number_attr = res["ldap"].otherphone_number_attr
        $scope.currentModel.variables.ldap_name_attr = res["ldap"].name_attr
        $scope.currentModel.variables.ldap_number_filter = res["ldap"].number_filter
        $scope.currentModel.variables.ldap_name_filter = res["ldap"].name_filter
        $scope.currentModel.variables.ldap_server = ""
      }
      $scope.currentModel.inputs = angular.copy($scope.currentModel.variables)
    }

    $scope.modelPhonebookTypeChange = function () {
      $scope.currentModel.changePhonebookType = true
      $scope.currentModel.changed = true
      $scope.modelPhonebookType = document.querySelector("#modelPhonebookType").value
      if ($scope.modelPhonebookType == "ldaps") {
        $scope.ldapToModelVariables($scope.ldapCheckRes, true)
        // force encryption select disabling or enabling
        $("#phonebook-select-4").prop('disabled', true)
      } else if ($scope.modelPhonebookType == "ldap") {
        $scope.ldapToModelVariables($scope.ldapCheckRes, false)
        $("#phoneboook-select-4").prop('disabled', true)
      } else {
        $("#phonebook-select-4").prop('disabled', false)
      }
      setTimeout(function () {
        $("#phonebook-select-4").selectpicker("refresh")
      }, 100)
    }

    $scope.openSection = function (sectionkey) {
      $scope.destroyAllSelects("#modelsContainer", sectionkey)
      delete $scope.currentModel.ui[sectionkey].showingKeys
      $scope.selectOptionsLimit = 12
      $interval.cancel($scope.selectOptionsInterval)
      $scope.selectOptionsInterval = $interval(function (index) {
        $scope.selectOptionsLimit += 10
        if (index == 5 || index == 10  || index == 15 || index == 20 || index == 25 || index == 30 || index == 35 || index == 42) {
          $scope.refreshSelects()
        }
      }, 1000, 43)
      if ($scope.currentModel.openedSection != sectionkey) {
        $scope.currentModel.openedSection = sectionkey
      } else {
        $scope.currentModel.openedSection = ""
        $interval.cancel($scope.selectOptionsInterval)
      }
      if (sectionkey == "phonebook") {
        setTimeout(function () {
          // update ldap type select
          let typeSelect = document.querySelector("#modelPhonebookType")
          if (typeSelect) {
            $scope.$apply()
            $(typeSelect).selectpicker("refresh")
          }
          typeSelect = null
        }, 100)
      }
    }

    $scope.onVariableChanged = function (varName, varType) {
      if (varName.indexOf("ldap_") == 0) {
        $scope.currentModel.changePhonebookType = true
      }
      // sync inputs with variables
      if (varType && varType != "list" && varType != "upload" && varType != "dynamicselectpicker") {
        $scope.currentModel.variables[varName] = angular.copy($scope.currentModel.inputs[varName])
      }
      // set single variables
      if ($scope.currentModel.uiLocation == "configurations") {
        $scope.currentModel.singleVariables[varName] = $scope.currentModel.variables[varName]
      }
      if (varName == "ringtone") {
        setTimeout(function () {
          $scope.$apply()
          $(".model-container .ringtone_file-select").selectpicker("refresh")
        }, 100)
      }
      $scope.$emit('variableChanged')
    }

    $scope.getOptionText = function (options, value) {
      for (var option in options) {
        if (options[option].value == value) {
          return options[option].text
        }
      }
    }

    $scope.openExpKeys = function (expkeyk, sectionkey) {
      delete $scope.currentModel.ui[sectionkey].showingExpKeys
      if ($scope.currentModel.openedExpKeys != expkeyk) {
        $scope.currentModel.openedExpKeys = expkeyk
      } else {
        $scope.currentModel.openedExpKeys = ""
      }
    }

    var restErrStatus = function (key, title) {
      setTimeout(function () {
        $scope.modelErrors[key] = title
        resetLoadingAction("err")
        $scope.$apply()
      }, 1000)
    }

    $scope.refreshSelects = function () {
      $('.model-container select').each(function(){
        if ($(this).hasClass("selectpicker")) {
          $(this).selectpicker('refresh')
        } else if ($(this).hasClass("combobox")) {
          $(this).combobox("refresh")
        }
      })
    }

    $scope.cancelChanges = function () {
      $scope.loadingAction = true
      $scope.currentModel.variables = angular.copy($scope.currentModel.storedVariables)
      $scope.currentModel.inputs = angular.copy($scope.currentModel.storedVariables)
      setTimeout(function () {
        $scope.refreshSelects()
        resetLoadingAction("ok")
        $scope.currentModel.changePhonebookType = false
        $scope.$apply()
        setTimeout(function () {
          $("#actionsModal").modal("hide")
          setTimeout(function () {
            $scope.$emit('curentModelSaved')
          }, 500)
        }, 1500)
      }, 1500)
    }

    $scope.resetChanges = function () {
      $scope.loadingAction = true
      ModelService.getOriginal($scope.currentModel.name).then(function (res) {
        for (var storedVariable in $scope.currentModel.storedVariables) {
          if (!res.data.variables[storedVariable]) {
            res.data.variables[storedVariable] = null
          }
        }
        ModelService.patchModel($scope.currentModel.name, {
          "display_name": $scope.currentModel.name,
          "variables": res.data.variables
        }).then(function (res2) {
          $scope.currentModel.variables = angular.copy(res.data.variables)
          $scope.currentModel.storedVariables = angular.copy(res.data.variables)
          $scope.currentModel.inputs = angular.copy(res.data.variables)
          $scope.currentModel.changePhonebookType = false
          setTimeout(function () {
            $scope.refreshSelects()
            resetLoadingAction("ok")
            $scope.$apply()
            setTimeout(function () {
              $scope.hideModal("actionsModal")
            }, 1500)
          }, 1000)
        }, function (err) {
          console.log(err)
          restErrStatus("resetChangesNotFound", err.data.title)
        })
      }, function (err) {
        console.log(err)
        restErrStatus("resetChangesNotFound", err.data.title)
      })
    }

    $scope.deleteModel = function () {
      $scope.loadingAction = true
      ModelService.deleteModel($scope.currentModel.name).then(function (res) {
        resetLoadingAction("ok")
        setTimeout(function () {
          $scope.hideModal("actionsModal")
          setTimeout(function () {
            $scope.$emit('reloadModels')
          }, 500)
        }, 1500)
      }, function (err) {
        console.log(err)
        restErrStatus("deleteChangesNotFound", err.data.title)
      })
    }

    $scope.hideLineKeysModelsInfoMsg = function () {
      localStorage.setItem('lineKeysModelsInfoMsgHide', true);
      $scope.lineKeysModelsInfoMsgHide = true;
    }
    $scope.lineKeysModelsInfoMsgHide = localStorage.getItem('lineKeysModelsInfoMsgHide');

    $scope.hideLineKeysConfigurationsInfoMsg = function () {
      localStorage.setItem('lineKeysConfigurationsInfoMsgHide', true);
      $scope.lineKeysConfigurationsInfoMsgHide = true;
    }
    $scope.lineKeysConfigurationsInfoMsgHide = localStorage.getItem('lineKeysConfigurationsInfoMsgHide');

    $scope.hideModelsInfoMsg = function () {
      localStorage.setItem('modelsInfoMsgHide', true)
      $scope.modelsInfoMsg = true
    }

    var getModelsInfoMsg = function () {
      $scope.modelsInfoMsg = localStorage.getItem('modelsInfoMsgHide')
    }

    var getGlobals = function () {
      ModelService.getDefaults().then(function (res) {
        $scope.currentModel.globals = angular.copy(res.data)
        // add globals to variables
        for (var globalVariables in res.data) {
          if (!$scope.currentModel.variables[globalVariables]) {
            $scope.currentModel.variables[globalVariables] = angular.copy(res.data[globalVariables])
          }
        }
        $scope.refreshSelects()
      }, function (err) {
        console.log(err)
      })
    }

    var resetErrMessage = function () {
      $scope.modelErrors.updateReadOnlyAttribute = false
      $scope.modelErrors.resetChangesNotFound = false
      $scope.modelErrors.deleteChangesNotFound = false
    }

    // save function for model variables
    $scope.saveCurrentModel = function () {
      resetErrMessage()
      $scope.loadingAction = true
      for (var variable in $scope.currentModel.variables) {
        // remove globals from variables
        if (!$scope.currentModel.storedVariables[variable] && $scope.currentModel.variables[variable] == $scope.currentModel.globals[variable]) {
          if (variable.indexOf("ldap_") == 0) {
            if (!$scope.currentModel.changePhonebookType) {
              delete $scope.currentModel.variables[variable]
            }
          } else {
            delete $scope.currentModel.variables[variable]
          }
        }
        // manage empty variables and convert "null" strings to null
        if ($scope.currentModel.variables[variable] == "" || $scope.currentModel.variables[variable] == "null") {
          $scope.currentModel.variables[variable] = null
        }
      }
      ModelService.patchModel($scope.currentModel.name, {
        "display_name": $scope.currentModel.display_name,
        "variables": $scope.currentModel.variables
      }).then(function (res) {
        resetLoadingAction("ok")
        $scope.currentModel.changePhonebookType = false
        setTimeout(function () {
          $scope.hideModal("saveChangesConfirm")
          setTimeout(function () {
            $scope.$emit('curentModelSaved')
          }, 500)
        },2000)
        getVariables()
      }, function (err) {
        console.log(err)
        restErrStatus("updateReadOnlyAttribute", err.data.title)
      })
    }

    // save function for single variables
    $scope.saveCurrentModelSingle = function () {
      $scope.loadingActionSingle = true
      for (var variable in $scope.currentModel.singleVariables) {
        // manage empty variables and convert "null" strings to null
        if ($scope.currentModel.singleVariables[variable] == "" || $scope.currentModel.singleVariables[variable] == "null") {
          $scope.currentModel.singleVariables[variable] = null
        }
      }
      PhoneService.patchPhone($scope.currentModel.mac, {
        "variables": $scope.currentModel.singleVariables
      }).then(function (res) {
        resetLoadingActionSingle("ok")
        setTimeout(function () {
          $scope.hideModal("singleModelModal")
        },1500)
      }, function (err) {
        $scope.modelErrorsSingle.patchSingleVariables = true
        setTimeout(function () {
          $scope.$apply(function () {
            $scope.modelErrorsSingle.patchSingleVariables = false
          })
        }, 2000)
        console.log(err)
      })
    }

    var resetLoadingActionSingle = function (status) {
      $scope.loadingActionSingle = status
      setTimeout(function () {
        $scope.loadingActionSingle = false
        $scope.$apply()
      }, 2500)
    }

    $scope.openFileUpload = function (variable) {
      $rootScope.uploadVariable = variable
      if (!$scope.isConfigurations) {
        $("#uploadFileModal").modal("show")
      } else {
        $("#singleModelModal").modal("hide").on("hidden.bs.modal", function () {
          $("#singleModelModal").unbind()
          $("#uploadFileModal").modal("show").on("hidden.bs.modal", function () {
            $("#uploadFileModal").unbind()
            $("#singleModelModal").modal("show")
          })
        })
      }
      // manage upload modal hide event
      $("#uploadFileModal").unbind("hidden.bs.modal").on("hidden.bs.modal", function () {
        $rootScope.$broadcast('uploadModalHidden')
      })
    }

    $scope.toggleShowPassword = function (variable) {
      $scope.currentModel.shownPasswords[variable] ? delete $scope.currentModel.shownPasswords[variable] : $scope.currentModel.shownPasswords[variable] = true
    }

    var getVariables = function () {
      ModelService.getModel($scope.currentModel.name).then(function (res) {
        $scope.currentModel.storedVariables = angular.copy(res.data.variables)
        $scope.currentModel.variables = res.data.variables
        getGlobals()
      }, function (err) {
        console.log(err)
        restErrStatus("updateReadOnlyAttribute", err.data.title)
      })
    }

    var getUsers = function () {
      UserService.list(true).then(function (res) {
        for (let user in res.data) {
          if (res.data[user].default_extension == "none") {
            res.data.splice(user, 1)
          }
        }
        $scope.users = res.data
      }, function (err) {
        console.log(err)
      });
    }

    angular.element("#modelsUIUrl").ready(function () {
      getModelsInfoMsg()
      getUsers()
      $scope.getFirmwares()
      $scope.getRingtones()
      $scope.getBackgrounds()
      $scope.getScreensavers()
      $scope.inModal = document.querySelector("#modelsUIUrl").parentNode.parentNode.parentNode.parentNode.parentNode.classList.value.includes("modal")
      $scope.isConfigurations = $location.path() == "/configurations" ? true : false
    })

    $('#saveChangesConfirm').on('hidden.bs.modal', function () {
      $scope.modelErrors.updateReadOnlyAttribute = false
    })

    $('#actionsModal').on('hidden.bs.modal', function () {
      $scope.modelErrors.resetChangesNotFound = false
      $scope.modelErrors.deleteChangesNotFound = false
    })

    // dynamicsearch

    $scope.shownDynamicList = ""

    $scope.openSearchList = function (variable) {
      $scope.shownDynamicList = variable
      $scope.dynamicSearchLimit = $scope.DYNAMIC_SCROLL_PAGE
    }

    $scope.applyDynamicSearch = function (variable, user) {
      let arr = variable.split("_")
      var variableValue = arr[0] + "_value_" + arr[2]
      var variableLabel = arr[0] + "_label_" + arr[2]
      $scope.currentModel.inputs[variableValue] = user.default_extension
      $scope.currentModel.inputs[variableLabel] = user.displayname
      $scope.shownDynamicList = ""
      $scope.onVariableChanged(variableValue, "input")
      $scope.onVariableChanged(variableLabel, "input")
    }

    $rootScope.$on("domclick" ,function (evt, data) {
      if (!data.target.className.includes("dynamicsearch")) {
        $scope.$apply(function () {
          $scope.shownDynamicList = ""
        })
      }
    })

    $scope.DYNAMIC_SCROLL_PAGE = 6
    $scope.dynamicSearchLimit = $scope.DYNAMIC_SCROLL_PAGE

    var dynamicSearchScroll = function () {
      $scope.dynamicSearchLimit += $scope.DYNAMIC_SCROLL_PAGE
      $scope.$apply()
    }
    document.addEventListener('dynamicSearchScroll', dynamicSearchScroll)
    
    $scope.$on('$routeChangeStart', function() {
      document.removeEventListener('dynamicSearchScroll', dynamicSearchScroll)
    })

  })


