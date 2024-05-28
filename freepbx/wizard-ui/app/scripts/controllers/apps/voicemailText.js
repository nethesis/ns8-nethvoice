"use strict";

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:AppsVoicemailTextCtrl
 * @description
 * # AppsVoicemailTextCtrl
 * Controller of the nethvoiceWizardUiApp
 */
angular
  .module("nethvoiceWizardUiApp")
  .controller(
    "AppsVoicemailTextCtrl",
    function ($rootScope, $scope, VoicemailTextService) {
      $scope.authorizationAvailable = false;

      $scope.getSpeechStatus = function () {
        VoicemailTextService.getGoogleSpeechStatus().then(
          function (res) {
            let status = res.data;
            if (status === "enabled") {
              $scope.voicemailTextEnabled = true;
            } else {
              $scope.voicemailTextEnabled = false;
            }
          },
          function (err) {
            console.log(err);
          }
        );
      };

      $scope.getAuthenticationFileStatus = function () {
        VoicemailTextService.getGoogleAuthentication().then(
          function (res) {
            $scope.authorizationAvailable = true;
          },
          function (err) {
            console.log(err);
            $scope.authorizationAvailable = false;
          }
        );
      };

      $scope.toggleVoicemailText = function () {
        $scope.voicemailTextEnabled == !$scope.voicemailTextEnabled;
        let status = "";
        $scope.voicemailTextEnabled
          ? (status = "enabled")
          : (status = "disabled");
        VoicemailTextService.sendGoogleSpeechStatus({
          status,
        }).then(
          function (res) {},
          function (err) {
            console.log(err);
          }
        );
      };

      $scope.uploadAuthorizationFile = function (authorizationFileBase64) {
        VoicemailTextService.uploadGoogleAuthorizationFile({
          file: authorizationFileBase64,
        }).then(
          function (res) {
            $scope.authorizationAvailable = true;
          },
          function (err) {
            console.log(err);
          }
        );
      };

      $scope.tempVoicemail = {};

      $scope.errorVoicemailUpload = {
        file: {
          status: false,
          title: "File format error",
          content: "File must be a JSON",
        },
      };

      $scope.googleAuthorizationUpload = function () {
        $("#uploadInput").click();
        $("#uploadInput").change(function (e) {
          if (e.target.files[0].name != undefined) {
            $scope.tempVoicemail.jsonFileName = e.target.files[0].name;
            var reader = new FileReader();
            reader.onload = function (ev) {
              $scope.$apply(function () {
                $scope.tempVoicemail.file64 = ev.target.result;
                $scope.uploadAuthorizationFile(ev.target.result);
                $scope.errorVoicemailUpload.file.status = false;
                $("#uploadInput").val("");
                $("#uploadInput").unbind();
              });
            };

            reader.readAsDataURL(e.target.files[0]);
          } else {
            $scope.$apply(function () {
              $scope.error.fileJson.status = true;
            });
          }
        });
        console.log("che valore ha", $scope.tempVoicemail.file64);
      };

      $scope.getSpeechStatus();
      $scope.getAuthenticationFileStatus();
    }
  );
