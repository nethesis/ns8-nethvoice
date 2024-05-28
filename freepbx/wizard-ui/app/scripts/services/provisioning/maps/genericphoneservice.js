'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.GenericPhoneService
 * @description
 * # GenericPhoneService
 * Service in the nethvoiceWizardUiApp.
 */

angular.module('nethvoiceWizardUiApp')
  .service('GenericPhoneService', function (GenericPhoneUtilsService) {

    this.map = function (variables) {
      let softkey_count = parseInt(variables.cap_softkey_count),
          softkey_type_blacklist = variables.cap_softkey_type_blacklist ? variables.cap_softkey_type_blacklist.split(",") : "",
          linekey_count = parseInt(variables.cap_linekey_count),
          linekey_type_blacklist = variables.linekey_type_blacklist ? variables.linekey_type_blacklist.split(",") : "",
          expmodule_count = parseInt(variables.cap_expmodule_count),
          expkey_count = parseInt(variables.cap_expkey_count),
          expkey_type_blacklist = variables.cap_expkey_type_blacklist ? variables.cap_expkey_type_blacklist.split(",") : "",
          date_formats_blacklist = variables.cap_date_format_blacklist ? variables.cap_date_format_blacklist.split(",") : "",
          dss_transfer_blacklist = variables.cap_dss_transfer_blacklist ? variables.cap_dss_transfer_blacklist.split(",") : "",
          ldap_tls_blacklist = variables.cap_ldap_tls_blacklist ? variables.cap_ldap_tls_blacklist.split(",") : "",
          ringtone_blacklist = variables.cap_ringtone_blacklist ? variables.cap_ringtone_blacklist.split(",") : "",
          ringtone_count = variables.cap_ringtone_count,
          background_cap = variables.cap_background_file,
          screensaver_cap = variables.cap_screensaver_file,
          backlight_time_blacklist = variables.cap_backlight_time_blacklist ? variables.cap_backlight_time_blacklist.split(",") : "",
          screensaver_time_blacklist = variables.cap_screensaver_time_blacklist ? variables.cap_screensaver_time_blacklist.split(",") : "",
          contrast_cap = variables.cap_contrast,
          brightness_cap = variables.cap_brightness

      return {
        "general": {
          "settings": true,
          "password": true,
          "date_format": {
            "blacklist":  date_formats_blacklist
          }
        },
        "network": {},
        "preferences": {
          "dss_transfer": {
            "blacklist": dss_transfer_blacklist
          }
        },
        "displayAndRingtones": {
          "ringtone": {
            "blacklist": ringtone_blacklist,
            "count": parseInt(ringtone_count) + 2,
            "startfrom": -1
          },
          "background_file": {
            "visible": background_cap == "1" ? true : false // set false to hide the variable
          },
          "screensaver_file": {
            "visible": screensaver_cap == "1" ? true : false
          },
          "backlight_time": {
            "blacklist": backlight_time_blacklist,
            "visible": backlight_time_blacklist.length == 16 ? false : true
          },
          "screensaver_time": {
            "blacklist": screensaver_time_blacklist,
            "visible": screensaver_time_blacklist.length == 16 ? false : true
          },
          "contrast": {
            "count": 10,
            "startfrom": 0,
            "visible": contrast_cap == "1" ? true : false
          },
          "brightness": {
            "count": 10,
            "startfrom": 0,
            "visible": brightness_cap == "1" ? true : false
          }
        },
        "phonebook": {
          "ldap": true,
          "ldap_tls": {
            "blacklist": ldap_tls_blacklist
          }
        },
        "provisioning": {
          "provisioning": true
        },
        "softKeys":  {
          "intervals": [
            {
              "start": 1,
              "end": softkey_count
            }
          ],
          "hidden_types": softkey_type_blacklist,
        },
        "lineKeys": {
          "intervals": [
            {
              "start": 1,
              "end": linekey_count
            }
          ],
          "hidden_types": linekey_type_blacklist,
        },
        "expansionKeys":  {
          "modules": expmodule_count,
          "module_keys_count": expkey_count,
          "intervals": [
            {
              "start": 1,
              "end": expkey_count,
            }
          ],
          "hidden_types": expkey_type_blacklist,
        }
      }
    }

    this.displayAndRingtones = function () {
      return {
        "name":"Display and ringtone",
        "items": [
          {
            "variable": "ringtone",
            "description": "Ringtone selection",
            "type": "dynamicselectpicker"
          },
          {
            "variable": "ringtone_file",
            "description": "Custom ringtone management",
            "type": "upload"
          },
          {
            "variable": "background_file",
            "description": "Background image",
            "type": "upload"
          },
          {
            "variable": "screensaver_file",
            "description": "Screensaver image",
            "type": "upload"
          },
          {
            "variable": "backlight_time",
            "description": "Backlight timeout",
            "type": "selectpicker",
            "options": [
              {
                "text": "3 seconds",
                "value": "3"
              },
              {
                "text": "5 seconds",
                "value": "5"
              },
              {
                "text": "7 seconds",
                "value": "7"
              },
              {
                "text": "10 seconds",
                "value": "10"
              },
              {
                "text": "15 seconds",
                "value": "15"
              },
              {
                "text": "30 seconds",
                "value": "30"
              },
              {
                "text": "1 minute",
                "value": "60"
              },
              {
                "text": "2 minutes",
                "value": "120"
              },
              {
                "text": "5 minutes",
                "value": "300"
              },
              {
                "text": "10 minutes",
                "value": "600"
              },
              {
                "text": "20 minutes",
                "value": "1200"
              },
              {
                "text": "30 minutes",
                "value": "1800"
              },
              {
                "text": "40 minutes",
                "value": "2400"
              },
              {
                "text": "50 minutes",
                "value": "3000"
              },
              {
                "text": "1 hour",
                "value": "3600"
              },
              {
                "text": "Always on",
                "value": "0"
              }
            ]
          },
          {
            "variable": "screensaver_time",
            "description": "Screensaver timeout",
            "type": "selectpicker",
            "options": [
              {
                "text": "3 seconds",
                "value": "3"
              },
              {
                "text": "5 seconds",
                "value": "5"
              },
              {
                "text": "7 seconds",
                "value": "7"
              },
              {
                "text": "10 seconds",
                "value": "10"
              },
              {
                "text": "15 seconds",
                "value": "15"
              },
              {
                "text": "30 seconds",
                "value": "30"
              },
              {
                "text": "1 minute",
                "value": "60"
              },
              {
                "text": "2 minutes",
                "value": "120"
              },
              {
                "text": "5 minutes",
                "value": "300"
              },
              {
                "text": "10 minutes",
                "value": "600"
              },
              {
                "text": "20 minutes",
                "value": "1200"
              },
              {
                "text": "30 minutes",
                "value": "1800"
              },
              {
                "text": "40 minutes",
                "value": "2400"
              },
              {
                "text": "50 minutes",
                "value": "3000"
              },
              {
                "text": "1 hour",
                "value": "3600"
              },
              {
                "text": "Disabled",
                "value": "0"
              }
            ]
          },
          {
            "variable": "contrast",
            "description": "Display contrast",
            "type": "dynamicselectpicker"
          },
          {
            "variable": "brightness",
            "description": "Display brightness",
            "type": "dynamicselectpicker"
          }
        ]
      }
    }

    this.preferences = function (modelMap) {
      if (!(modelMap.general.settings || modelMap.general.password)) {
        return;
      }
      var settingsItems = []
      var passwordItems = []
      if (modelMap.general.settings) {
        settingsItems = [
          {
            "variable": "ntp_server",
            "description": "NTP server address",
            "type": "input"
          },
          {
            "variable": "provisioning_freq",
            "description": "Provisioning scheduling",
            "type": "selectpicker",
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
            "variable": "dss_transfer",
            "description": "dss_transfer_label",
            "type": "selectpicker",
            "options": [
              {
                "text": "dss_transfer_verify_label",
                "value": "verify"
              },
              {
                "text": "dss_transfer_attended_label",
                "value": "attended"
              },
              {
                "text": "dss_transfer_blind_label",
                "value": "blind"
              }
            ]
          },
          {
            "variable": "language",
            "description": "Phone language",
            "type": "selectpicker",
            "options": GenericPhoneUtilsService.getLanguages()
          },
          {
            "variable": "timezone",
            "description": "Time zone",
            "type": "bigcombobox",
            "options": GenericPhoneUtilsService.getTimeZones()
          },
          {
            "variable": "tonezone",
            "description": "Tone zone",
            "type": "selectpicker",
            "options": GenericPhoneUtilsService.getToneZones()
          },
          {
            "variable": "time_format",
            "description": "time_format_label",
            "type": "selectpicker",
            "options": [
              {
                "text": "time_format_12h",
                "value": "12"
              },
              {
                "text": "time_format_24h",
                "value": "24"
              }
            ]
          },
          {
            "variable": "date_format",
            "description": "Date format",
            "type": "selectpicker",
            "options": GenericPhoneUtilsService.getDateFormat()
          },
          {
            "variable": "firmware_file",
            "description": "Firmware",
            "type": "upload"
          }
        ]
      }
      return {
        "name": "Preferences",
        "items": settingsItems.concat(passwordItems)
      }
    }
    
    this.network = function (modelMap) {
      return {
        "name":"network_settings_label",
        "items": [
          {
            "variable": "vlan_id_phone",
            "description": "vlan_id_phone_label",
            "type": "input"
          },
          {
            "variable": "vlan_id_pcport",
            "description": "vlan_id_pcport_label",
            "type": "input"
          }
        ]
      }
    }

    this.phonebook = function (modelMap) {

      var ldapItems = [];

      if (modelMap.phonebook.ldap) {
        ldapItems = [
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
            "type": "selectpicker",
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
        ];
      }

      return {
        "name": "ldap_phonebook_title",
        "items": ldapItems
      }
    }


    this.softKeys = function (modelMap) {

      // validate
      if (!modelMap.softKeys.intervals[0].end) {
        return;
      }

      return {
        "name": "Soft keys",
        "items": [
          {
            "description": "Soft key",
            "type": "loop",
            "keys": modelMap.softKeys,
            "data": {
              "items": [
                {
                  "variable": "softkey_type",
                  "description": "Type",
                  "type": "list",
                  "options": [
                    {
                      "text": "N/A",
                      "value": ""
                    },
                    {
                      "text": "Forward",
                      "value": "forward"
                    },
                    {
                      "text": "DND",
                      "value": "dnd"
                    },
                    {
                      "text": "Recall",
                      "value": "recall"
                    },
                    {
                      "text": "Pick up",
                      "value": "pick_up"
                    },
                    {
                      "text": "Speed Dial",
                      "value": "speed_dial"
                    },
                    {
                      "text": "Group Pickup",
                      "value": "group_pickup"
                    },
                    {
                      "text": "History",
                      "value": "history"
                    },
                    {
                      "text": "Menu",
                      "value": "menu"
                    },
                    {
                      "text": "Status",
                      "value": "status"
                    },
                    {
                      "text": "Prefix",
                      "value": "prefix"
                    },
                    {
                      "text": "LDAP",
                      "value": "ldap"
                    }
                  ]
                },
                {
                  "variable": "softkey_value",
                  "description": "Value",
                  "type": "input"
                },
                {
                  "variable": "softkey_label",
                  "description": "progkey_label",
                  "type": "input"
                }
              ]
            }
          }
        ]
      }
    }

    this.lineKeys = function (modelMap) {

      // validate
      if (!modelMap.lineKeys.intervals[0].end) {
        return;
      }

      return {
        "name": "Line keys",
        "items": [
          {
            "description": "Line key",
            "type": "loop",
            "keys": modelMap.lineKeys,
            "data": {
              "items": [
                {
                  "variable": "linekey_type",
                  "description": "Type",
                  "type": "list",
                  "options": [
                    {
                      "text": "N/A",
                      "value": ""
                    },
                    {
                      "text": "Conference",
                      "value": "conference"
                    },
                    {
                      "text": "Forward",
                      "value": "forward"
                    },
                    {
                      "text": "Transfer",
                      "value": "transfer"
                    },
                    {
                      "text": "Hold",
                      "value": "hold"
                    },
                    {
                      "text": "DND",
                      "value": "dnd"
                    },
                    {
                      "text": "Recall",
                      "value": "recall"
                    },
                    {
                      "text": "Direct Pickup",
                      "value": "direct_pickup"
                    },
                    {
                      "text": "DTMF",
                      "value": "dtmf"
                    },
                    {
                      "text": "Dynamic Agent Login/Logout",
                      "value": "queuetoggle"
                    },
                    {
                      "text": "Voice Mail",
                      "value": "voice_mail"
                    },
                    {
                      "text": "Speed Dial",
                      "value": "speed_dial"
                    },
                    {
                      "text": "Line",
                      "value": "line"
                    },
                    {
                      "text": "BLF",
                      "value": "blf"
                    },
                    {
                      "text": "URL",
                      "value": "url"
                    },
                    {
                      "text": "Group Pickup",
                      "value": "group_pickup"
                    },
                    {
                      "text": "Multicast Paging",
                      "value": "multicast_paging"
                    },
                    {
                      "text": "Record",
                      "value": "record"
                    },
                    {
                      "text": "Prefix",
                      "value": "prefix"
                    },
                    {
                      "text": "Phone Lock",
                      "value": "phone_lock"
                    },
                    {
                      "text": "LDAP",
                      "value": "ldap"
                    }
                  ]
                },
                {
                  "variable": "linekey_value",
                  "description": "Value",
                  "type": "input"
                },
                {
                  "variable": "linekey_label",
                  "description": "progkey_label",
                  "type": "input"
                }
              ]
            }
          }
        ]
      }
    }

    this.expansionKeys = function (modelMap) {

      // validate
      if (!modelMap.expansionKeys.modules || !modelMap.expansionKeys.intervals[0].end) {
        return;
      }

      return {
        "name": "expkeys_title",
        "items": [
          {
            "description": "expkey_label",
            "type": "loop",
            "keys": modelMap.expansionKeys,
            "data": {
              "items": [
                {
                  "variable": "expkey_type",
                  "description": "Type",
                  "type": "list",
                  "options": [
                    {
                      "text": "N/A",
                      "value": ""
                    },
                    {
                      "text": "Conference",
                      "value": "conference"
                    },
                    {
                      "text": "Forward",
                      "value": "forward"
                    },
                    {
                      "text": "Transfer",
                      "value": "transfer"
                    },
                    {
                      "text": "Hold",
                      "value": "hold"
                    },
                    {
                      "text": "DND",
                      "value": "dnd"
                    },
                    {
                      "text": "Recall",
                      "value": "recall"
                    },
                    {
                      "text": "Direct Pickup",
                      "value": "direct_pickup"
                    },
                    {
                      "text": "DTMF",
                      "value": "dtmf"
                    },
                    {
                      "text": "Voice Mail",
                      "value": "voice_mail"
                    },
                    {
                      "text": "Speed Dial",
                      "value": "speed_dial"
                    },
                    {
                      "text": "Line",
                      "value": "line"
                    },
                    {
                      "text": "BLF",
                      "value": "blf"
                    },
                    {
                      "text": "URL",
                      "value": "url"
                    },
                    {
                      "text": "Group Pickup",
                      "value": "group_pickup"
                    },
                    {
                      "text": "Multicast Paging",
                      "value": "multicast_paging"
                    },
                    {
                      "text": "Record",
                      "value": "record"
                    },
                    {
                      "text": "Prefix",
                      "value": "prefix"
                    },
                    {
                      "text": "Phone Lock",
                      "value": "phone_lock"
                    },
                    {
                      "text": "LDAP",
                      "value": "ldap"
                    }
                  ]
                },
                {
                  "variable": "expkey_value",
                  "description": "Value",
                  "type": "input"
                },
                {
                  "variable": "expkey_label",
                  "description": "progkey_label",
                  "type": "input"
                }
              ]
            }
          }
        ]
      }
    }
    
  })
