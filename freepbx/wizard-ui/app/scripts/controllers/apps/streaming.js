'use strict';

/**
 * @ngdoc function
 * @name nethvoiceWizardUiApp.controller:AppsStreamingCtrl
 * @description
 * # AppsStreamingCtrl
 * Controller of the nethvoiceWizardUiApp
 *
 * Video sources: "image" sources (http(s):// JPEG polled by the CTI) and
 * "rtsp" sources (rtsp(s):// streams served by the video gateway), with
 * optional credentials and a list of gates (door openers) opened by DTMF or
 * by an HTTP request. Passwords are write-only: the API returns only
 * has_secret / has_password, and an empty password keeps the stored one.
 * TLS certificates are verified unless "tls_skip_verify" is set: the option
 * is shown, and sent as true, only when the source URL or a URL gate uses TLS.
 * With the option the PBX pins the certificate each TLS device presents when
 * the source is saved ("tls_fingerprint" of the source and of its gates);
 * "tls_unpinned" flags a source saved by an older version without them.
 * A source can be created from a provisioned door phone: the PBX generates
 * the RTSP password of the device and the form references it by
 * "door_phone" (the MAC) instead of receiving it.
 */
angular.module('nethvoiceWizardUiApp')
  .controller('AppsStreamingCtrl', function ($scope, $filter, $timeout, ProfileService, ApplicationService, UserService) {
    $scope.allSources = [];
    $scope.allProfiles = [];
    $scope.currentSource = {};
    $scope.users = [];
    $scope.gateway = {};
    $scope.maxGates = 10;
    $scope.urlPattern = /^(https?|rtsps?):\/\/[^\s]+$/i;
    $scope.httpPattern = /^https?:\/\/[^\s]+$/i;
    $scope.dtmfPattern = /^[0-9A-Da-d*#+]{1,30}$/;
    $scope.doorPhones = [];
    $scope.doorPhonesLoading = false;
    $scope.doorPhonesError = false;

    var reasonMessages = {
      auth_failed: 'Wrong username or password',
      connection_refused: 'Connection refused: check the address, the port and the port-forward of the device',
      timeout: 'The device does not answer: check the address and the firewall',
      not_found: 'Stream not found: check the path in the URL',
      tls_error: 'TLS certificate not valid',
      unsupported: 'Unsupported URL or stream',
      address_not_allowed: 'Address not allowed: the PBX itself and link-local addresses cannot be video sources',
      unknown: 'Connection error'
    };

    var emptySource = function () {
      return {
        verified: false,
        isChecking: false,
        checked: false,
        onMod: false,
        user: '',
        secret: '',
        tls_skip_verify: false,
        gates: [],
        profiles: []
      };
    };
    $scope.newSource = emptySource();

    $scope.isRtsp = function (s) {
      return !!(s && s.url && /^rtsps?:\/\//i.test(s.url));
    };

    // The TLS option matters only if the PBX contacts the device over TLS:
    // rtsps:// or https:// source URL, or at least one https:// URL gate
    $scope.tlsRelevant = function (s) {
      if (!s) {
        return false;
      }
      if (s.url && /^(rtsps|https):\/\//i.test(s.url)) {
        return true;
      }
      return (s.gates || []).some(function (gate) {
        return gate.type === 'url' && !!gate.url && /^https:\/\//i.test(gate.url);
      });
    };

    $scope.tlsSkipVerify = function (s) {
      return $scope.tlsRelevant(s) && !!s.tls_skip_verify;
    };

    $scope.reasonMessage = function (reason) {
      return reasonMessages[reason] || reasonMessages.unknown;
    };

    $scope.hasWarning = function (check, warning) {
      return !!(check && check.warnings && check.warnings.indexOf(warning) >= 0);
    };

    $scope.codecDescription = function (check) {
      if (!check || !check.video) {
        return '';
      }
      var text = check.video.codec.toUpperCase();
      if (check.video.width && check.video.height) {
        text += ' ' + check.video.width + 'x' + check.video.height;
      }
      if (check.audio) {
        text += ', ' + check.audio.codec.toUpperCase();
        if (check.audio.sample_rate) {
          text += ' ' + check.audio.sample_rate + ' Hz';
        }
      }
      return text;
    };

    // Payload of POST/PUT /cti/streaming: only what the API reads
    $scope.sourcePayload = function (s) {
      return {
        currentDescr: s.onMod ? s.currentDescr : undefined,
        descr: s.descr,
        url: s.url,
        user: s.user || '',
        secret: s.user ? (s.secret || '') : '',
        exten: s.exten,
        tls_skip_verify: $scope.tlsSkipVerify(s),
        profiles: s.profiles,
        door_phone: s.door_phone ? s.door_phone : undefined,
        gates: (s.gates || []).map(function (gate) {
          var item = {
            id: gate.id,
            name: gate.name,
            type: gate.type
          };
          if (gate.type === 'dtmf') {
            item.code = gate.code;
          } else {
            item.url = gate.url;
            item.method = gate.method || 'GET';
            item.username = gate.username || '';
            item.password = gate.username ? (gate.password || '') : '';
          }
          return item;
        })
      };
    };

    $scope.addGate = function () {
      if ($scope.newSource.gates.length >= $scope.maxGates) {
        return;
      }
      $scope.newSource.gates.push({
        name: $filter('translate')('Door') + ' ' + ($scope.newSource.gates.length + 1),
        type: 'dtmf',
        code: '',
        method: 'GET'
      });
    };

    $scope.removeGate = function (index) {
      $scope.newSource.gates.splice(index, 1);
    };

    $scope.moveGate = function (index, delta) {
      var gates = $scope.newSource.gates;
      var target = index + delta;
      if (target < 0 || target >= gates.length) {
        return;
      }
      var gate = gates.splice(index, 1)[0];
      gates.splice(target, 0, gate);
    };

    // A different URL or different credentials must be checked again
    $scope.sourceChanged = function (s) {
      s.verified = false;
      s.checked = false;
      s.check = null;
      s.preview = null;
    };

    $scope.selectSource = function (s) {
      $scope.currentSource = s;
    };

    var saveCompleted = function (s) {
      s.onSave = false;
      $scope.onSaveSuccessSource = true;
      $scope.onSaveErrorSource = false;
      $scope.onSaveErrorMessage = '';
      $scope.newSource = emptySource();
      $scope.getSourceList();
      $('#newSourceModal').modal('hide');
    };

    var saveFailed = function (s, err) {
      s.onSave = false;
      $scope.onSaveSuccessSource = false;
      $scope.onSaveErrorSource = true;
      $scope.onSaveErrorMessage = err && err.data && err.data.status ? err.data.status : '';
      $('#newSourceModal').modal('hide');
      console.log(err);
    };

    $scope.saveSource = function (s) {
      s.onSave = true;
      var payload = $scope.sourcePayload(s);
      if (s.onMod) {
        ApplicationService.updateVideoSource(s.currentDescr, payload).then(function () {
          saveCompleted(s);
        }, function (err) {
          saveFailed(s, err);
        });
      } else {
        ApplicationService.createVideoSource(payload).then(function () {
          saveCompleted(s);
        }, function (err) {
          saveFailed(s, err);
        });
      }
    };

    $scope.deleteSource = function (s) {
      s.onSave = true;
      ApplicationService.deleteVideoSource(s.descr).then(function (res) {
        s.onSave = false;
        $scope.getSourceList();
        $('#deleteModal').modal('hide');
      }, function (err) {
        s.onSave = false;
        console.log(err);
      });
    };

    $scope.cancelSource = function () {
      $scope.newSource = emptySource();
    };

    $scope.modifySource = function (s) {
      var copy = angular.copy(s);
      copy.onMod = true;
      copy.currentDescr = s.descr;
      copy.secret = '';
      copy.gates = (copy.gates || []).map(function (gate) {
        gate.password = '';
        gate.method = gate.method || 'GET';
        return gate;
      });
      // GET /cti/streaming returns the profile ids as strings, /cti/profiles as
      // numbers and ng-options compares them strictly: use the ids of
      // allProfiles, so the stored profiles appear selected. Unknown ids are
      // kept as they are, a save must not drop them.
      copy.profiles = (copy.profiles || []).map(function (id) {
        for (var i in $scope.allProfiles) {
          if (String($scope.allProfiles[i].id) === String(id)) {
            return $scope.allProfiles[i].id;
          }
        }
        return id;
      });
      $scope.newSource = copy;
    };

    $scope.checkConnection = function (s) {
      s.isChecking = true;
      var request = {
        url: s.url,
        user: s.user || '',
        secret: s.user ? (s.secret || '') : '',
        tls_skip_verify: $scope.tlsSkipVerify(s),
        details: true
      };
      // Stored source: the API uses the stored password if none is typed and
      // reports a change of the device certificate pinned by the gateway
      var storedDescr = s.currentDescr || (s.permission ? s.descr : null);
      if (storedDescr) {
        request.descr = storedDescr;
      }
      if (s.door_phone) {
        // Linked to a door phone: the API uses the password of the door phone
        request.door_phone = s.door_phone;
      }
      ApplicationService.checkConnectionVideoSource(request).then(function (res) {
        var check = res.data || {};
        s.checked = true;
        s.isChecking = false;
        s.check = check;
        s.verified = !!check.success;
        s.preview = check.image ? 'data:' + (check.mime || 'image/jpeg') + ';base64,' + check.image : null;
      }, function (err) {
        s.checked = true;
        s.isChecking = false;
        s.verified = false;
        s.check = { success: false, reason: 'unknown', message: err && err.data && err.data.status ? err.data.status : '' };
        console.log(err);
      });
    };

    // Door phone sources: can the PBX open a TCP connection to the address
    // of the URL? A LAN address is not reachable from a PBX in the cloud.
    var reachabilityTimer = null;
    $scope.checkReachability = function (s) {
      if (!s || !s.door_phone || s.onMod || !$scope.isRtsp(s)) {
        if (s) {
          s.reachability = null;
        }
        return;
      }
      var url = s.url;
      s.reachabilityChecking = true;
      ApplicationService.videoSourceReachability({ url: url, door_phone: s.door_phone }).then(function (res) {
        if (s.url === url) {
          s.reachability = res.data || null;
          s.reachabilityChecking = false;
        }
      }, function (err) {
        if (s.url === url) {
          s.reachability = null;
          s.reachabilityChecking = false;
        }
        console.log(err);
      });
    };

    // Check again a while after the administrator stops typing the URL
    $scope.urlChanged = function (s) {
      $scope.sourceChanged(s);
      if (!s.door_phone || s.onMod) {
        return;
      }
      if (reachabilityTimer) {
        $timeout.cancel(reachabilityTimer);
      }
      reachabilityTimer = $timeout(function () {
        $scope.checkReachability(s);
      }, 800);
    };

    // Leave the credentials of the door phone: the source gets its own user
    // and password (the API unlinks the source when a password is typed)
    $scope.useDifferentCredentials = function (s) {
      s.door_phone = null;
      s.user = '';
      s.secret = '';
      s.has_secret = false;
      s.reachability = null;
      $scope.sourceChanged(s);
    };

    $scope.usePublicAddress = function (s) {
      if (s.reachability && s.reachability.public_url) {
        s.url = s.reachability.public_url;
        $scope.sourceChanged(s);
        $scope.checkReachability(s);
      }
    };

    // Door phones provisioned by the PBX (model with the door phone flag)
    $scope.getDoorPhones = function () {
      $scope.doorPhonesLoading = true;
      $scope.doorPhonesError = false;
      ApplicationService.allDoorPhones().then(function (res) {
        $scope.doorPhones = res.data || [];
        $scope.doorPhonesLoading = false;
      }, function (err) {
        $scope.doorPhones = [];
        $scope.doorPhonesLoading = false;
        $scope.doorPhonesError = true;
        console.log(err);
      });
    };

    // Fill the new source form from a door phone, generating its RTSP
    // credentials on the first use
    $scope.useDoorPhone = function (d) {
      d.onPrepare = true;
      $scope.doorPhonesError = false;
      ApplicationService.prepareDoorPhone(d.mac).then(function (res) {
        var p = res.data || {};
        var s = emptySource();
        s.descr = p.descr;
        s.exten = p.exten;
        s.url = p.url || '';
        s.user = p.user || '';
        s.has_secret = !!p.has_secret;
        s.door_phone = p.door_phone;
        s.doorPhoneIp = p.ip;
        s.doorPhoneRegistered = !!p.registered;
        s.credentialsGenerated = !!p.credentials_generated;
        s.passwordIsAdmin = !!p.password_is_admin;
        s.gates = (p.gates || []).map(function (gate, index) {
          return {
            name: $filter('translate')('Door') + ' ' + (index + 1),
            type: gate.type,
            code: gate.code,
            method: 'GET'
          };
        });
        d.onPrepare = false;
        $scope.newSource = s;
        // Open the form once the list is closed: two modals at once break the backdrop
        $('#doorPhoneModal').one('hidden.bs.modal', function () {
          $('#newSourceModal').modal('show');
        }).modal('hide');
        $scope.checkReachability(s);
      }, function (err) {
        d.onPrepare = false;
        $scope.doorPhonesError = true;
        console.log(err);
      });
    };

    $scope.getSourceList = function () {
      ApplicationService.allVideoSources().then(function (res) {
        $scope.allSources = res.data;
        $scope.view.changeRoute = false;
        for (var s in $scope.allSources) {
          $scope.checkConnection($scope.allSources[s]);
        }
      }, function (err) {
        $scope.allSources = [];
        $scope.view.changeRoute = false;
        console.log(err);
      });
    };

    $scope.getGatewayInfo = function () {
      ApplicationService.videoSourcesGateway().then(function (res) {
        $scope.gateway = res.data || {};
      }, function (err) {
        $scope.gateway = {};
        console.log(err);
      });
    };

    $scope.getUserList = function () {
      $scope.view.changeRoute = true;
      ApplicationService.allExtensions().then(function (res) {
        $scope.users = res.data;
        $scope.getSourceList();
      }, function (err) {
        $scope.users = [];
        $scope.view.changeRoute = false;
        console.log(err);
      });
    };

    $scope.getAllProfiles = function () {
      ProfileService.allProfiles().then(function (res) {
        $scope.allProfiles = res.data;
      }, function (err) {
        $scope.view.changeRoute = false;
        console.log(err);
      });
    };

    var pageInitialized = false;

    var initializePage = function () {
      if (pageInitialized) {
        return;
      }
      pageInitialized = true;
      $scope.getUserList();
      $scope.getAllProfiles();
      $scope.getGatewayInfo();
    };

    $scope.$on( "$routeChangeSuccess", function(event, next, current) {
      if (next.templateUrl === 'views/apps/streaming.html') {
        initializePage();
      }
    });

    $scope.$on('loginCompleted', function (event, args) {
      initializePage();
    });

    if ($scope.login && $scope.login.isLogged) {
      initializePage();
    }
  });
