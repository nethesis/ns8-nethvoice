'use strict';

describe('Controller: AppsStreamingCtrl', function () {

  // load the controller's module
  beforeEach(module('nethvoiceWizardUiApp'));

  var scope, $q, ApplicationService, ProfileService;

  var resolved = function (data) {
    return $q.resolve({ data: data });
  };

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope, _$q_) {
    $q = _$q_;
    scope = $rootScope.$new();
    scope.view = {};
    ApplicationService = {
      allVideoSources: jasmine.createSpy('allVideoSources').and.callFake(function () { return resolved([]); }),
      allExtensions: jasmine.createSpy('allExtensions').and.callFake(function () { return resolved([]); }),
      videoSourcesGateway: jasmine.createSpy('videoSourcesGateway').and.callFake(function () { return resolved({ public_ip: '203.0.113.5' }); }),
      checkConnectionVideoSource: jasmine.createSpy('checkConnectionVideoSource'),
      createVideoSource: jasmine.createSpy('createVideoSource').and.callFake(function () { return resolved(''); }),
      updateVideoSource: jasmine.createSpy('updateVideoSource').and.callFake(function () { return resolved(''); }),
      deleteVideoSource: jasmine.createSpy('deleteVideoSource').and.callFake(function () { return resolved(''); })
    };
    ProfileService = {
      allProfiles: jasmine.createSpy('allProfiles').and.callFake(function () { return resolved([]); })
    };
    $controller('AppsStreamingCtrl', {
      $scope: scope,
      ApplicationService: ApplicationService,
      ProfileService: ProfileService,
      UserService: {}
    });
  }));

  var storedSource = function () {
    return {
      descr: 'Front door',
      type: 'rtsp',
      url: 'rtsp://192.0.2.10:554/live',
      user: 'admin',
      has_secret: true,
      exten: '201',
      profiles: ['1'],
      permission: 'vs_front_door',
      tls_skip_verify: false,
      gates: [
        { id: 7, name: 'Door', type: 'dtmf', code: '*1' },
        { id: 8, name: 'Car gate', type: 'url', url: 'http://192.0.2.10/open', method: 'POST', username: 'gate', has_password: true }
      ]
    };
  };

  it('recognizes RTSP URLs', function () {
    expect(scope.isRtsp({ url: 'rtsps://cam/x' })).toBe(true);
    expect(scope.isRtsp({ url: 'http://cam/x.jpg' })).toBe(false);
    expect(scope.urlPattern.test('rtsp://cam:554/x')).toBe(true);
    expect(scope.urlPattern.test('file:///etc/passwd')).toBe(false);
  });

  it('adds, moves and removes gates', function () {
    scope.cancelSource();
    scope.addGate();
    scope.addGate();
    expect(scope.newSource.gates.map(function (g) { return g.name; })).toEqual(['Door 1', 'Door 2']);
    scope.moveGate(1, -1);
    expect(scope.newSource.gates[0].name).toBe('Door 2');
    scope.moveGate(0, -1);
    expect(scope.newSource.gates[0].name).toBe('Door 2');
    scope.removeGate(0);
    expect(scope.newSource.gates.length).toBe(1);
    for (var i = 0; i < 20; i++) {
      scope.addGate();
    }
    expect(scope.newSource.gates.length).toBe(scope.maxGates);
  });

  it('edits a copy without the stored passwords', function () {
    var source = storedSource();
    scope.modifySource(source);
    expect(scope.newSource).not.toBe(source);
    expect(scope.newSource.onMod).toBe(true);
    expect(scope.newSource.currentDescr).toBe('Front door');
    expect(scope.newSource.secret).toBe('');
    expect(scope.newSource.gates[1].password).toBe('');
    scope.newSource.gates[0].code = '*9';
    expect(source.gates[0].code).toBe('*1');
  });

  it('edits the stored profiles with the ids of /cti/profiles', function () {
    // /cti/profiles returns numeric ids, /cti/streaming string ids
    scope.allProfiles = [{ id: 1, name: 'Base' }, { id: 2, name: 'Standard' }, { id: 3, name: 'Advanced' }];
    var source = storedSource();
    source.profiles = ['3', '1', '99'];
    scope.modifySource(source);
    expect(scope.newSource.profiles).toEqual([3, 1, '99']);
    expect(source.profiles).toEqual(['3', '1', '99']);
    scope.saveSource(scope.newSource);
    expect(ApplicationService.updateVideoSource.calls.mostRecent().args[1].profiles).toEqual([3, 1, '99']);

    source.profiles = undefined;
    scope.modifySource(source);
    expect(scope.newSource.profiles).toEqual([]);
  });

  it('sends only the fields of the API, empty passwords keep the stored ones', function () {
    scope.modifySource(storedSource());
    var payload = scope.sourcePayload(scope.newSource);
    expect(payload.currentDescr).toBe('Front door');
    expect(payload.secret).toBe('');
    expect(payload.has_secret).toBeUndefined();
    expect(payload.gates).toEqual([
      { id: 7, name: 'Door', type: 'dtmf', code: '*1' },
      { id: 8, name: 'Car gate', type: 'url', url: 'http://192.0.2.10/open', method: 'POST', username: 'gate', password: '' }
    ]);
    scope.newSource.user = '';
    scope.newSource.secret = 'leftover';
    expect(scope.sourcePayload(scope.newSource).secret).toBe('');
  });

  it('saves a new source with POST and an existing one with PUT', function () {
    scope.cancelSource();
    scope.newSource.descr = 'Garden';
    scope.newSource.url = 'http://192.0.2.20/snap.jpg';
    scope.saveSource(scope.newSource);
    expect(ApplicationService.createVideoSource).toHaveBeenCalled();
    expect(ApplicationService.createVideoSource.calls.mostRecent().args[0].currentDescr).toBeUndefined();

    scope.modifySource(storedSource());
    scope.newSource.descr = 'Main door';
    scope.saveSource(scope.newSource);
    expect(ApplicationService.updateVideoSource).toHaveBeenCalledWith('Front door', jasmine.objectContaining({ descr: 'Main door', currentDescr: 'Front door' }));
  });

  it('checks a stored source with its stored password and shows the result', function () {
    ApplicationService.checkConnectionVideoSource.and.callFake(function () {
      return resolved({ success: true, image: 'AAAA', mime: 'image/jpeg', video: { codec: 'hevc', width: 1920, height: 1080 }, audio: { codec: 'pcm_mulaw', sample_rate: 8000 }, h265: true, warnings: ['h265'] });
    });
    var source = storedSource();
    scope.checkConnection(source);
    scope.$apply();
    var request = ApplicationService.checkConnectionVideoSource.calls.mostRecent().args[0];
    expect(request).toEqual({ url: 'rtsp://192.0.2.10:554/live', user: 'admin', secret: '', tls_skip_verify: false, details: true, descr: 'Front door' });
    expect(source.verified).toBe(true);
    expect(source.preview).toBe('data:image/jpeg;base64,AAAA');
    expect(source.check.h265).toBe(true);
    expect(scope.codecDescription(source.check)).toBe('HEVC 1920x1080, PCM_MULAW 8000 Hz');
  });

  it('reports the reason of a failed check', function () {
    ApplicationService.checkConnectionVideoSource.and.callFake(function () {
      return resolved({ success: false, reason: 'auth_failed', message: '401 Unauthorized' });
    });
    var source = { url: 'rtsp://192.0.2.10/live', user: 'admin', secret: 'bad' };
    scope.checkConnection(source);
    scope.$apply();
    expect(ApplicationService.checkConnectionVideoSource.calls.mostRecent().args[0].descr).toBeUndefined();
    expect(source.verified).toBe(false);
    expect(scope.reasonMessage(source.check.reason)).toBe('Wrong username or password');
    expect(scope.reasonMessage('something else')).toBe('Connection error');
    expect(scope.reasonMessage('address_not_allowed')).toBe('Address not allowed: the PBX itself and link-local addresses cannot be video sources');
  });

  it('offers the TLS option only when the source or a gate uses TLS', function () {
    expect(scope.newSource.tls_skip_verify).toBe(false);
    expect(scope.tlsRelevant({ url: 'rtsps://cam/x', gates: [] })).toBe(true);
    expect(scope.tlsRelevant({ url: 'HTTPS://cam/x.jpg' })).toBe(true);
    expect(scope.tlsRelevant({ url: 'rtsp://cam/x', gates: [{ type: 'dtmf', code: '1' }, { type: 'url', url: 'http://cam/open' }] })).toBe(false);
    expect(scope.tlsRelevant({ url: 'rtsp://cam/x', gates: [{ type: 'url', url: 'https://cam/open' }] })).toBe(true);
    // a DTMF gate keeps the URL of a previous type in the model: ignored
    expect(scope.tlsRelevant({ url: 'rtsp://cam/x', gates: [{ type: 'dtmf', code: '1', url: 'https://cam/open' }] })).toBe(false);
    expect(scope.tlsRelevant(null)).toBe(false);
  });

  it('sends the TLS option only when it is relevant', function () {
    scope.modifySource(storedSource());
    scope.newSource.tls_skip_verify = true;
    expect(scope.sourcePayload(scope.newSource).tls_skip_verify).toBe(false);
    scope.newSource.gates[1].url = 'https://192.0.2.10/open';
    expect(scope.sourcePayload(scope.newSource).tls_skip_verify).toBe(true);
    scope.newSource.gates[1].url = 'http://192.0.2.10/open';
    scope.newSource.url = 'rtsps://192.0.2.10:322/live';
    expect(scope.sourcePayload(scope.newSource).tls_skip_verify).toBe(true);
    scope.newSource.tls_skip_verify = false;
    expect(scope.sourcePayload(scope.newSource).tls_skip_verify).toBe(false);
  });

  it('checks with the TLS option and reports an untrusted certificate', function () {
    ApplicationService.checkConnectionVideoSource.and.callFake(function () {
      return resolved({ success: false, reason: 'tls_error', message: 'certificate verify failed' });
    });
    var source = { url: 'rtsps://192.0.2.10:322/live', user: '', tls_skip_verify: true, gates: [] };
    scope.checkConnection(source);
    scope.$apply();
    var request = ApplicationService.checkConnectionVideoSource.calls.mostRecent().args[0];
    expect(request.tls_skip_verify).toBe(true);
    expect(request.descr).toBeUndefined();
    expect(source.verified).toBe(false);
    expect(scope.reasonMessage(source.check.reason)).toBe('TLS certificate not valid');

    source.url = 'rtsp://192.0.2.10/live';
    scope.checkConnection(source);
    expect(ApplicationService.checkConnectionVideoSource.calls.mostRecent().args[0].tls_skip_verify).toBe(false);
  });

  it('requires a new check when the URL or the credentials change', function () {
    var source = { verified: true, checked: true, check: { success: true }, preview: 'data:' };
    scope.sourceChanged(source);
    expect(source.verified).toBe(false);
    expect(source.preview).toBe(null);
  });
});
