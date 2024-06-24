// Karma configuration
// http://karma-runner.github.io/0.12/config/configuration-file.html
// Generated on 2016-11-16 using
// generator-karma 1.0.1

module.exports = function(config) {
  'use strict';

  config.set({
    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // base path, that will be used to resolve files and exclude
    basePath: '../',

    // testing framework to use (jasmine/mocha/qunit/...)
    // as well as any additional frameworks (requirejs/chai/sinon/...)
    frameworks: [
      "jasmine"
    ],

    // list of files / patterns to load in the browser
    files: [
      // bower:js
      'bower_components/jquery/dist/jquery.js',
      'bower_components/angular/angular.js',
      'bower_components/angular-cookies/angular-cookies.js',
      'bower_components/angular-resource/angular-resource.js',
      'bower_components/angular-route/angular-route.js',
      'bower_components/angular-sanitize/angular-sanitize.js',
      'bower_components/bootstrap/dist/js/bootstrap.js',
      'bower_components/bootstrap-combobox/js/bootstrap-combobox.js',
      'bower_components/bootstrap-datepicker/dist/js/bootstrap-datepicker.min.js',
      'bower_components/bootstrap-select/dist/js/bootstrap-select.js',
      'bower_components/bootstrap-switch/dist/js/bootstrap-switch.js',
      'bower_components/bootstrap-touchspin/src/jquery.bootstrap-touchspin.js',
      'bower_components/d3/d3.js',
      'bower_components/c3/c3.js',
      'bower_components/datatables/media/js/jquery.dataTables.js',
      'bower_components/datatables-colreorder/js/dataTables.colReorder.js',
      'bower_components/datatables-colvis/js/dataTables.colVis.js',
      'bower_components/google-code-prettify/bin/prettify.min.js',
      'bower_components/matchHeight/dist/jquery.matchHeight.js',
      'bower_components/moment/moment.js',
      'bower_components/eonasdan-bootstrap-datetimepicker/build/js/bootstrap-datetimepicker.min.js',
      'bower_components/patternfly-bootstrap-treeview/dist/bootstrap-treeview.js',
      'bower_components/patternfly/dist/js/patternfly.js',
      'bower_components/angular-translate/angular-translate.js',
      'bower_components/angular-translate-loader-static-files/angular-translate-loader-static-files.js',
      'bower_components/angular-bootstrap/ui-bootstrap-tpls.js',
      'bower_components/angular-animate/angular-animate.js',
      'bower_components/lodash/lodash.js',
      'bower_components/angular-patternfly/dist/angular-patternfly.js',
      'bower_components/jquery-ui/jquery-ui.js',
      'bower_components/angular-ui-sortable/sortable.js',
      'bower_components/ng-sortable/dist/ng-sortable.js',
      'bower_components/angular-bootstrap-switch/dist/angular-bootstrap-switch.js',
      'bower_components/jspdf/dist/jspdf.debug.js',
      'bower_components/jspdf-autotable/dist/jspdf.plugin.autotable.src.js',
      'bower_components/ace-builds/src-min/ace.js',
      'bower_components/ace-builds/src-min/mode-json.js',
      'bower_components/ace-builds/src-min/mode-sql.js',
      'bower_components/ace-builds/src-min/mode-ejs.js',
      'bower_components/ace-builds/src-min/theme-twilight.js',
      'bower_components/ace-builds/src-min/worker-json.js',
      'bower_components/angular-ui-ace/ui-ace.js',
      'bower_components/clipboard/dist/clipboard.js',
      'bower_components/angular-mocks/angular-mocks.js',
      // endbower
      "app/scripts/**/*.js",
      "test/mock/**/*.js",
      "test/spec/**/*.js"
    ],

    // list of files / patterns to exclude
    exclude: [
    ],

    // web server port
    port: 8080,

    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera
    // - Safari (only Mac)
    // - PhantomJS
    // - IE (only Windows)
    browsers: [
      "PhantomJS"
    ],

    // Which plugins to enable
    plugins: [
      "karma-phantomjs-launcher",
      "karma-jasmine"
    ],

    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: false,

    colors: true,

    // level of logging
    // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
    logLevel: config.LOG_INFO,

    // Uncomment the following lines if you are using grunt's server to run the tests
    // proxies: {
    //   '/': 'http://localhost:9000/'
    // },
    // URL root prevent conflicts with the site root
    // urlRoot: '_karma_'
  });
};
