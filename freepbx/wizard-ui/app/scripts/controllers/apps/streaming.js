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
 * "door_phone" (the MAC) instead of receiving it; the credential fields are
 * not shown for a source linked to a door phone. The profile of a new source
 * follows the user of its extension ("Base" without an extension) until the
 * administrator changes it.
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
    // The DTMF gates of a door phone source: a code its relays accept
    $scope.doorDtmfPattern = /^[0-9A-Da-d*#]{1,16}$/;
    $scope.doorPhones = [];
    $scope.doorPhonesLoading = false;
    $scope.doorPhonesError = false;

    // Stream presets of devices verified with NethVoice, for manual sources.
    // The only place with brand data: provisioned door phones take their
    // streams from the Tancredi model ("streams" of the door phone API).
    $scope.devicePresets = [
      {
        id: 'fanvil-i',
        name: 'Fanvil i-series',
        port: 554,
        streams: { main: '/h264/stream.live0', sub: '/h264/stream.live1', main_label: '', sub_label: '640x480' }
      }
    ];

    var findPreset = function (id) {
      for (var i = 0; i < $scope.devicePresets.length; i++) {
        if ($scope.devicePresets[i].id === id) {
          return $scope.devicePresets[i];
        }
      }
      return null;
    };

    // "rtsp://host:port" + path + query of a RTSP URL
    var splitRtspUrl = function (url) {
      var m = /^(rtsps?:\/\/[^\/?#]+)([^?#]*)(.*)$/i.exec(url || '');
      return m ? { base: m[1], path: m[2], rest: m[3] } : null;
    };

    // The quality choice is shown only for RTSP URLs of a device with a main
    // and a sub stream
    $scope.showQuality = function (s) {
      return !!(s && s.streams && s.streams.main && s.streams.sub && $scope.isRtsp(s));
    };

    var detectQuality = function (s) {
      var parts = splitRtspUrl(s.url);
      if (!s.streams || !parts) {
        return null;
      }
      if (parts.path === s.streams.main) {
        return 'main';
      }
      if (parts.path === s.streams.sub) {
        return 'sub';
      }
      return 'custom';
    };

    $scope.qualityLabel = function (s, quality) {
      var label = s && s.streams ? s.streams[quality + '_label'] : '';
      var text = $filter('translate')(quality === 'main' ? 'High (main stream)' : 'Standard (sub stream, for slow connections)');
      return label ? text + ' - ' + label : text;
    };

    // Rewrite only the path of the URL; a custom path is left alone
    $scope.qualityChanged = function (s) {
      if (s.quality !== 'main' && s.quality !== 'sub') {
        return;
      }
      var parts = splitRtspUrl(s.url);
      if (!parts) {
        return;
      }
      s.url = parts.base + s.streams[s.quality] + parts.rest;
      $scope.urlChanged(s);
    };

    // Manual sources: fill port and path of a known device, keep the host
    $scope.deviceTypeChanged = function (s) {
      var preset = findPreset(s.deviceType);
      if (!preset) {
        s.streams = null;
        s.quality = null;
        return;
      }
      var host = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@\/?#]*@)?(\[[^\]]+\]|[^:\/?#]+)/i.exec(s.url || '');
      s.streams = angular.copy(preset.streams);
      s.quality = 'main';
      s.url = 'rtsp://' + (host ? host[1] : '192.0.2.10') + ':' + preset.port + preset.streams.main;
      $scope.urlChanged(s);
    };

    // Device type of a stored manual source, from its port and path
    var detectDeviceType = function (s) {
      var parts = splitRtspUrl(s.url);
      if (!parts) {
        return '';
      }
      for (var i = 0; i < $scope.devicePresets.length; i++) {
        var preset = $scope.devicePresets[i];
        if ((parts.path === preset.streams.main || parts.path === preset.streams.sub) && /:554$/.test(parts.base)) {
          return preset.id;
        }
      }
      return '';
    };

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
        profiles: [],
        deviceType: '',
        streams: null,
        quality: null
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

    // Most gates of a source: one per relay for a door phone whose model
    // declares its relays (Fanvil i6x), the general limit otherwise
    $scope.gateLimit = function (s) {
      return s && s.door_phone && s.doorMaxGates ? s.doorMaxGates : $scope.maxGates;
    };

    // Source linked to a door phone: the gate N opens the relay N of the
    // door phone ("door_gates" of the door phone, null if it has no such relay)
    $scope.doorGate = function (s, index) {
      if (!s || !s.door_phone || !s.doorGates) {
        return null;
      }
      return s.doorGates[index] || null;
    };

    // The DTMF code of a door phone relay comes from the door phone
    // provisioning: shown, not changed here
    $scope.doorGateCodeLocked = function (s, gate, index) {
      var doorGate = $scope.doorGate(s, index);
      return gate.type === 'dtmf' && !!(doorGate && doorGate.code);
    };

    // Give the gates of a door phone source the code of their relay and, for
    // URL gates still empty, propose the URL and the user that open it
    var syncDoorGates = function (s) {
      (s.gates || []).forEach(function (gate, index) {
        var doorGate = $scope.doorGate(s, index);
        if (!doorGate) {
          return;
        }
        if (gate.type === 'dtmf' && doorGate.code) {
          gate.code = doorGate.code;
        } else if (gate.type === 'url' && !gate.url && doorGate.url) {
          gate.url = doorGate.url;
          gate.method = 'GET';
          if (!gate.username && doorGate.user) {
            gate.username = doorGate.user;
          }
        }
      });
    };

    // http:// URL gate with a username: the credentials travel in clear text
    $scope.gateClearText = function (gate) {
      return gate.type === 'url' && !!gate.username && /^http:\/\//i.test(gate.url || '');
    };

    $scope.gateTypeChanged = function (s) {
      syncDoorGates(s);
    };

    $scope.addGate = function () {
      if ($scope.newSource.gates.length >= $scope.gateLimit($scope.newSource)) {
        return;
      }
      $scope.newSource.gates.push({
        name: $filter('translate')('Door') + ' ' + ($scope.newSource.gates.length + 1),
        type: 'dtmf',
        code: '',
        method: 'GET'
      });
      syncDoorGates($scope.newSource);
    };

    $scope.removeGate = function (index) {
      $scope.newSource.gates.splice(index, 1);
      syncDoorGates($scope.newSource);
    };

    $scope.moveGate = function (index, delta) {
      var gates = $scope.newSource.gates;
      var target = index + delta;
      if (target < 0 || target >= gates.length) {
        return;
      }
      var gate = gates.splice(index, 1)[0];
      gates.splice(target, 0, gate);
      syncDoorGates($scope.newSource);
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
      $scope.newSource.profiles = $scope.defaultProfiles(null);
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
      copy.streams = null;
      copy.quality = null;
      copy.deviceType = '';
      if (copy.door_phone) {
        // Linked to a door phone: its streams come from its model
        ApplicationService.allDoorPhones().then(function (res) {
          (res.data || []).forEach(function (d) {
            if (d.mac === copy.door_phone && d.streams) {
              copy.streams = d.streams;
              copy.streamsFromDoorPhone = true;
              copy.quality = detectQuality(copy);
            }
            if (d.mac === copy.door_phone) {
              copy.doorGates = d.door_gates || [];
              copy.doorMaxGates = d.max_gates || null;
              syncDoorGates(copy);
            }
          });
        }, function (err) {
          console.log(err);
        });
      } else {
        copy.deviceType = detectDeviceType(copy);
        var preset = findPreset(copy.deviceType);
        if (preset) {
          copy.streams = angular.copy(preset.streams);
          copy.quality = detectQuality(copy);
        }
      }
      $scope.newSource = copy;
      $scope.checkReachability(copy);
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
        // The stored password of a door phone goes only to the address the
        // door phone registers from: for another address it must be typed
        if (s.door_phone && err && err.status === 400 && err.data && err.data.field === 'secret') {
          s.doorPasswordRequired = true;
        }
        console.log(err);
      });
    };

    // Credential fields of a source linked to a door phone: hidden while the
    // PBX can use the door phone password, shown when it must be typed (the
    // door phone is not registered, or the URL is not its address)
    $scope.showCredentials = function (s) {
      return !s.door_phone || !!s.doorPasswordRequired || (!s.onMod && !s.doorPhoneRegistered);
    };

    // Can the PBX open a TCP connection to the device of the URL? A LAN
    // address is not reachable from a PBX in the cloud. Only the response
    // for the current URL is kept.
    var reachabilityTimer = null;
    // The check depends only on the device endpoint: "host:port" with the
    // default port of the scheme
    var defaultPorts = { http: '80', https: '443', rtsp: '554', rtsps: '322' };
    var reachabilityKey = function (s) {
      var m = /^([a-z]+):\/\/(?:[^@\/?#]*@)?(\[[^\]]+\]|[^:\/?#]+)(?::(\d+))?/i.exec(s.url || '');
      if (!m || !defaultPorts[m[1].toLowerCase()]) {
        return null;
      }
      return m[2].toLowerCase() + ':' + (m[3] || defaultPorts[m[1].toLowerCase()]);
    };

    $scope.checkReachability = function (s) {
      if (!s) {
        return;
      }
      var key = reachabilityKey(s);
      if (!s.url || !$scope.urlPattern.test(s.url) || !key) {
        s.reachability = null;
        s.reachabilityKey = null;
        return;
      }
      var url = s.url;
      var request = { url: url };
      if (s.door_phone) {
        request.door_phone = s.door_phone;
      }
      s.reachabilityKey = key;
      s.reachabilityChecking = true;
      ApplicationService.videoSourceReachability(request).then(function (res) {
        // a response for another endpoint is stale
        if (s.reachabilityKey === key) {
          s.reachability = res.data || null;
          s.reachabilityChecking = false;
        }
      }, function (err) {
        if (s.reachabilityKey === key) {
          s.reachability = null;
          s.reachabilityChecking = false;
        }
        console.log(err);
      });
    };

    // The {{port}} placeholder cannot be written inside a template expression
    $scope.forwardPortText = function (s) {
      return $filter('translate')('Forward the port of the device ({{port}}) on its router, allow it only from the public IP address of the PBX and type the public address in the URL', {
        port: s && s.reachability ? s.reachability.port : ''
      });
    };

    // Check again a while after the administrator stops typing the URL
    $scope.urlChanged = function (s) {
      $scope.sourceChanged(s);
      // A device preset never applies to a JPEG snapshot URL
      if (!s.streamsFromDoorPhone && s.deviceType && /^https?:\/\//i.test(s.url || '')) {
        s.deviceType = '';
        s.streams = null;
      }
      s.quality = detectQuality(s);
      // Same host and port (e.g. only the path changed): keep the result
      if (s.reachabilityKey && reachabilityKey(s) === s.reachabilityKey) {
        if (reachabilityTimer) {
          $timeout.cancel(reachabilityTimer);
          reachabilityTimer = null;
        }
        return;
      }
      s.reachability = null;
      s.reachabilityKey = null;
      if (reachabilityTimer) {
        $timeout.cancel(reachabilityTimer);
      }
      reachabilityTimer = $timeout(function () {
        $scope.checkReachability(s);
      }, 800);
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
        s.streams = p.streams || null;
        s.streamsFromDoorPhone = !!p.streams;
        s.quality = detectQuality(s);
        s.user = p.user || '';
        s.has_secret = !!p.has_secret;
        s.door_phone = p.door_phone;
        s.doorPhoneIp = p.ip;
        s.doorPhoneRegistered = !!p.registered;
        s.credentialsGenerated = !!p.credentials_generated;
        s.profiles = $scope.defaultProfiles(s.exten);
        s.gates = (p.gates || []).map(function (gate, index) {
          return {
            name: $filter('translate')('Door') + ' ' + (index + 1),
            type: gate.type,
            code: gate.code,
            method: 'GET'
          };
        });
        s.doorGates = p.door_gates || [];
        s.doorMaxGates = p.max_gates || null;
        syncDoorGates(s);
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

    // CTI profile of the user of each extension (main and device extensions)
    $scope.extensionProfiles = {};
    $scope.getExtensionProfiles = function () {
      UserService.list(false).then(function (res) {
        var map = {};
        (res.data || []).forEach(function (user) {
          if (user.profile === undefined || user.profile === null || user.profile === '') {
            return;
          }
          if (user.default_extension) {
            map[String(user.default_extension)] = user.profile;
          }
          (user.devices || []).forEach(function (device) {
            if (device.extension) {
              map[String(device.extension)] = user.profile;
            }
          });
        });
        $scope.extensionProfiles = map;
      }, function (err) {
        $scope.extensionProfiles = {};
        console.log(err);
      });
    };

    var findProfile = function (match) {
      for (var i = 0; i < $scope.allProfiles.length; i++) {
        if (match($scope.allProfiles[i])) {
          return $scope.allProfiles[i];
        }
      }
      return null;
    };

    // Profiles of a new source: those of the user of the extension, the
    // "Base" profile (found by name) without an extension
    $scope.defaultProfiles = function (exten) {
      var profile = null;
      if (exten !== undefined && exten !== null && exten !== '' && $scope.extensionProfiles[String(exten)] !== undefined) {
        var id = String($scope.extensionProfiles[String(exten)]);
        profile = findProfile(function (p) { return String(p.id) === id; });
      }
      if (!profile) {
        profile = findProfile(function (p) { return String(p.name || '').toLowerCase() === 'base'; });
      }
      return profile ? [profile.id] : [];
    };

    $scope.extenChanged = function (s) {
      if (!s.onMod && !s.profilesTouched) {
        s.profiles = $scope.defaultProfiles(s.exten);
      }
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
      $scope.getExtensionProfiles();
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
