'use strict';
// Run from an isolated directory with the same compiler plugins as Wizard.
module.exports = function (grunt) {
  var path = require('path'), root = path.resolve(__dirname, '../..'), app = path.join(root, 'freepbx/wizard-ui/app');
  var output = process.env.PHASE5_UI_BUILD_OUTPUT || '/tmp/nv-phase5-ui-dist';
  grunt.initConfig({
    ngtemplates: {dist: {options: {module: 'nethvoiceWizardUiApp', htmlmin: {collapseWhitespace: true}},
      cwd: app, src: ['views/agents/*.html'], dest: output + '/templates.js'}},
    concat: {dist: {src: [app + '/scripts/app.js', app + '/scripts/services/workfloweditor.js',
      app + '/scripts/directives/workflowfields.js', app + '/scripts/controllers/agentworkflows.js',
      app + '/scripts/controllers/agentintegrations.js', output + '/templates.js'], dest: output + '/scripts.js'}},
    ngAnnotate: {dist: {files: [{src: output + '/scripts.js', dest: output + '/scripts.js'}]}},
    cssmin: {dist: {files: [{src: [app + '/styles/agents.css', app + '/styles/workflows.css',app + '/lib/drawflow/drawflow.min.css'], dest: output + '/workflows.min.css'}]}},
    uglify: {dist: {files: [{src: [app + '/lib/drawflow/drawflow.min.js', output + '/scripts.js'], dest: output + '/workflows.min.js'}]}}
  });
  ['grunt-angular-templates','grunt-contrib-concat','grunt-ng-annotate','grunt-contrib-cssmin','grunt-contrib-uglify-es'].forEach(function (plugin) {
    grunt.loadTasks(path.join(process.env.PHASE5_GRUNT_MODULES || '/tmp/nv-phase5-grunt/node_modules', plugin, 'tasks'));
  });
  grunt.registerTask('default',['ngtemplates','concat','ngAnnotate','cssmin','uglify']);
};
