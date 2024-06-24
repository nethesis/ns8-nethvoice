'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.ProvFanvilService
 * @description
 * # ProvFanvilService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('ProvFanvilService', function (GenericPhoneService) {

    this.preferences = function (modelMap) {
      return GenericPhoneService.preferences(modelMap)
    }

    this.phonebook = function (modelMap) {
      return GenericPhoneService.phonebook(modelMap)
    }

    this.displayAndRingtones = function (modelMap) {
      return GenericPhoneService.displayAndRingtones(modelMap)
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