'use strict';

/**
 * @ngdoc service
 * @name nethvoiceWizardUiApp.CodecService
 * @description
 * # CodecService
 * Service in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .service('CodecService', function ($q, RestService) {
    /**
     * HTTP get request to retrieve sip trunks.
     *
     * @method getSipTrunks
     */
    this.getVoipCodecs = function() {
      return $q(function(resolve, reject) {
        RestService.get('/codecs/voip').then(function(res) {
          resolve(res.data);
        }, function(err) {
          reject(err);
        });
      });
    };
  });
