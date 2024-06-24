'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.ProvGlobalsService
 * @description
 * # ProvGlobalsService
 * Service in the nethvoiceWizardUiApp.
 * Globals in UI and Backend are Defaults
 */

angular.module('nethvoiceWizardUiApp')
  .service('ProvGlobalsService', function ($q, RestService, GenericPhoneUtilsService) {

    this.pinned = function () {
      return {
        "name": "Pinned",
        "data": [{
            "variable": "provisioning_url_scheme",
            "default_value": "",
            "description": "Encryption",
            "type": "list",
            "options":  [
              {
                "text": "Enabled",
                "value": "https"
              },
              {
                "text": "Disabled",
                "value": "http"
              }
            ]
          },
          {
            "variable": "hostname",
            "default_value": "",
            "description": "PBX address",
            "type": "input"
          },
          {
            "variable": "adminpw",
            "default_value": "",
            "description": "Admin password",
            "type": "password"
          },
          {
            "variable": "userpw",
            "default_value": "",
            "description": "User password",
            "type": "password"
          }
        ]
      }
    }

    this.preferences = function () {
      return {
        "name": "Preferences",
        "data": [{
            "variable": "language",
            "description": "Phone language",
            "type": "list",
            "options": GenericPhoneUtilsService.getLanguages()
          },
          {
            "variable": "provisioning_freq",
            "description": "Provisioning scheduling",
            "type": "list",
            "options": [
              {
                "text": "everyday",
                "value": "everyday"
              },
              {
                "text": "never_prov_freq",
                "value": "never"
              }
            ]
          },
          {
            "variable": "tonezone",
            "description": "Tone zone",
            "type": "list",
            "options": GenericPhoneUtilsService.getToneZones()
          },
        ]
      }
    }

    this.phonebook = function () {
      return {
        "name": "ldap_phonebook_title",
        "data": [
          {
            "variable": "ldap_server",
            "description": "ldap_server",
            "type": "input"
          },
          {
            "variable": "ldap_port",
            "description": "ldap_port",
            "type": "input"
          },
          {
            "variable": "ldap_user",
            "description": "ldap_user",
            "type": "input"
          },
          {
            "variable": "ldap_password",
            "description": "ldap_password",
            "type": "password"
          },
          {
            "variable": "ldap_tls",
            "description": "ldap_tls",
            "type": "list",
            "options": [
              {
                "text": "ldap_tls_none",
                "value": "none"
              },
              {
                "text": "ldap_tls_starttls",
                "value": "starttls"
              },
              {
                "text": "ldap_tls_tls",
                "value": "ldaps"
              }
            ]
          },
          {
            "variable": "ldap_base",
            "description": "ldap_base",
            "type": "input"
          },
          {
            "variable": "ldap_name_filter",
            "description": "ldap_name_filter",
            "type": "input"
          },
          {
            "variable": "ldap_number_filter",
            "description": "ldap_number_filter",
            "type": "input"
          },
          {
            "variable": "ldap_name_attr",
            "description": "ldap_name_attr",
            "type": "input"
          },
          {
            "variable": "ldap_name_display",
            "description": "ldap_name_display",
            "type": "input"
          },
          {
            "variable": "ldap_mainphone_number_attr",
            "description": "ldap_mainphone_number_attr",
            "type": "input"
          },
          {
            "variable": "ldap_mobilephone_number_attr",
            "description": "ldap_mobilephone_number_attr",
            "type": "input"
          },
          {
            "variable": "ldap_otherphone_number_attr",
            "description": "ldap_otherphone_number_attr",
            "type": "input"
          }
        ]
      }
    }

  })