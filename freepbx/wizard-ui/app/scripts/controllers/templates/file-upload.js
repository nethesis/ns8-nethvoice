'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:FileUploadCtrl
 * @description
 * # FileUploadCtrl
 * Controller of the nethvoiceWizardUiApp
 */

angular.module('nethvoiceWizardUiApp')
  .controller('FileUploadCtrl', function ($scope, ModelService, $filter, $rootScope) {

    $scope.evt = {
      "draghover": false
    }

    $scope.uploadingFiles = {}

    $scope.uploadingError = false
    $scope.uploadingSuccess = false
    $scope.uploadingErrorMsg = ""

    $scope.fileSelection = function () {
      document.querySelector("#dragArea input").click()
    }

    $scope.uploadProgress = function (progress) {
      console.log("UPLOAD PROGRESS: " + progress)
    }

    var uploadingFile = function (file) {
      let fileObj = {
        size: $scope.formatBytes(file.size),
        name: file.name
      }
      $scope.uploadingFiles[file.name] = fileObj
    }

    var validFile = function (file) {
      if (!file.name.match(/^[a-zA-Z0-9\-_\.()]+$/g)) {
        return false
      }
      return true
    }

    var resetSuccessErrors = function () {
      $scope.uploadingErrorMsg = ""
      $scope.uploadingError = false
      $scope.uploadingSuccess = false
    }

    $scope.hideAlertDanger = function () {
      $("#uploadErrorAlert").hide()
    }

    $scope.showAlertDanger = function () {
      $("#uploadErrorAlert").show()
    }

    var uploadSuccess = function () {
      $scope.uploadingFiles = {}
      $scope.uploadingSuccess = true
      document.querySelector("#dragArea input").value = ""
    }

    var uploadError = function (err) {
      $scope.uploadingErrorMsg = err.data.title
      $scope.uploadingFiles = {}
      $scope.uploadingError = true
      $scope.showAlertDanger()
      document.querySelector("#dragArea input").value = ""
    }

    // main functions
    $scope.fileUpload = function (file, uploadProgress) {
      resetSuccessErrors()
      if (!validFile(file)) {
        $scope.uploadingError = true
        $scope.showAlertDanger()
        $scope.uploadingErrorMsg = $filter('translate')('upload_invalid_filename')
        document.querySelector("#dragArea input").value = ""
        $scope.$apply()
        return
      }
      uploadingFile(file)
      switch ($scope.uploadVariable) {
        case "firmware_file":
          ModelService.uploadFirmware(file, uploadProgress).then(function (res) {
            $scope.reloadFirmwaresList()
            uploadSuccess()
          }, function (err) {
            // error feedback
            uploadError(err)
            console.log(err)
          })
          break;
        case "ringtone_file":
          ModelService.uploadRingtone(file, uploadProgress).then(function (res) {
            $scope.reloadRingtonesList()
            uploadSuccess()
          }, function (err) {
            // error feedback
            uploadError(err)
            console.log(err)
          })
          break;
        case "background_file":
          ModelService.uploadBackground(file, uploadProgress).then(function (res) {
            $scope.reloadBackgroundsList()
            uploadSuccess()
          }, function (err) {
            // error feedback
            uploadError(err)
            console.log(err)
          })
          break;
        case "screensaver_file":
          ModelService.uploadScreensaver(file, uploadProgress).then(function (res) {
            $scope.reloadScreensaversList()
            uploadSuccess()
          }, function (err) {
            // error feedback
            uploadError(err)
            console.log(err)
          })
          break;
        default:
          break;
      }
    }

    $scope.fileDelete = function (name) {
      switch ($scope.uploadVariable) {
        case "firmware_file":
          ModelService.deleteFirmware(name).then(function (res) {
            $scope.reloadFirmwaresList()
            $scope.uploadingFiles = {}
          }, function (err) {
            $scope.uploadingFiles = {}
            console.log(err);
          })
          break;
        case "ringtone_file":
          ModelService.deleteRingtone(name).then(function (res) {
            $scope.reloadRingtonesList()
            $scope.uploadingFiles = {}
          }, function (err) {
            $scope.uploadingFiles = {}
            console.log(err);
          })
          break;
        case "background_file":
          ModelService.deleteBackground(name).then(function (res) {
            $scope.reloadBackgroundsList()
            $scope.uploadingFiles = {}
          }, function (err) {
            console.log(err);
            $scope.uploadingFiles = {}
          })
          break;
        case "screensaver_file":
          ModelService.deleteScreensaver(name).then(function (res) {
            $scope.reloadScreensaversList()
            $scope.uploadingFiles = {}
          }, function (err) {
            console.log(err);
            $scope.uploadingFiles = {}
          })
          break;
        default:
          break;
      }
    }

    $scope.$on('uploadModalHidden', function () {
      resetSuccessErrors()
    });

  })