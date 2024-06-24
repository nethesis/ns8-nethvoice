'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.ProvAkuvoxService
 * @description
 * # ProvAkuvoxService
 * Service in the nethvoiceWizardUiApp.
 */

angular.module('nethvoiceWizardUiApp')
  .service('ProvAkuvoxService', function (GenericPhoneService) {

    this.preferences = function (modelMap) {
      return GenericPhoneService.preferences(modelMap)
    }

    this.displayAndRingtones = function (modelMap) {
      return GenericPhoneService.displayAndRingtones(modelMap)
    }

    this.phonebook = function (modelMap) {
      return GenericPhoneService.phonebook(modelMap)
    }

    this.network = function (modelMap) {
      return GenericPhoneService.network(modelMap)
    }

    this.softKeys = function (modelMap) {
      return GenericPhoneService.softKeys(modelMap)
    }

    this.lineKeys = function (modelMap) {
      return GenericPhoneService.lineKeys(modelMap)
    }

    this.expansionKeys = function (modelMap) {
      return GenericPhoneService.expansionKeys(modelMap)
    }

  })
