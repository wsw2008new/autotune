"use strict";

var $ = require('jquery'),
    _ = require('underscore'),
    Backbone = require('backbone'),
    models = require('../models'),
    helpers = require('../helpers'),
    logger = require('../logger'),
    BaseView = require('./base_view'),
    ace = require('brace'),
    pym = require('pym.js'),
    slugify = require("underscore.string/slugify"),
    pymParent,
    pymParentNew,
    data,
    theme;
    // gapi;

require('brace/mode/javascript');
require('brace/mode/html');
require('brace/theme/textmate');
require('brace/theme/chrome');

function pluckAttr(models, attribute) {
  return _.map(models, function(t) { return t.get(attribute); });
}

var EditProject = BaseView.extend(require('./mixins/actions'), require('./mixins/form'), {
  template: require('../templates/project.ejs'),
  events: {
    'change :input': 'stopListeningForChanges',
    'change form': 'pollChange',
    'click #savePreview': 'savePreview',
    'click #getAuth': 'getAuth'
  },
  //
  // getAuth: function(){
  //
  //   var SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
  //
  //   /**
  //    * Check if current user has authorized this application.
  //    */
  //   function checkAuth() {
  //     gapi.auth.authorize(
  //       {
  //         'client_id': CLIENT_ID,
  //         'scope': SCOPES.join(' '),
  //         'immediate': true
  //       }, handleAuthResult);
  //   }
  //
  //   /**
  //    * Handle response from authorization server.
  //    *
  //    * @param {Object} authResult Authorization result.
  //    */
  //   function handleAuthResult(authResult) {
  //     var authorizeDiv = document.getElementById('authorize-div');
  //     if (authResult && !authResult.error) {
  //       // Hide auth UI, then load client library.
  //       authorizeDiv.style.display = 'none';
  //       loadDriveApi();
  //     } else {
  //       // Show auth UI, allowing the user to initiate authorization by
  //       // clicking authorize button.
  //       authorizeDiv.style.display = 'inline';
  //     }
  //   }
  //
  //   /**
  //    * Load Drive API client library.
  //    */
  //   function loadDriveApi() {
  //     gapi.client.load('drive', 'v2', listFiles);
  //   }
  //
  //   /**
  //    * Print files.
  //    */
  //   function listFiles() {
  //     var request = gapi.client.drive.files.list({
  //         'maxResults': 10
  //       });
  //
  //       request.execute(function(resp) {
  //         // appendPre('Files:');
  //         var files = resp.items;
  //         if (files && files.length > 0) {
  //           for (var i = 0; i < files.length; i++) {
  //             var file = files[i];
  //             logger.debug(file.title, file.id);
  //             // appendPre(file.title + ' (' + file.id + ')');
  //           }
  //         } else {
  //           // appendPre('No files found.');
  //         }
  //       });
  //   }
  //
  //   gapi.auth.authorize(
  //     {client_id: CLIENT_ID, scope: SCOPES, immediate: false},
  //     handleAuthResult);
  //
  // },

  pollChange: function(e){
    var $form = this.$('#projectForm'),
        previewFrame;

    if( this.model.copyProject || this.model.hasInitialBuild() ){
      previewFrame = pymParent;
    } else {
      previewFrame = pymParentNew;
    }

    if ( this.model.blueprint.hasPreviewType('live') ){
      data = $form.alpaca('get').getValue();
      logger.debug('!!!!! form values', data);

      if(data.theme !== theme){
        theme = data.theme;
        var vals = {
          title: data['title'],
          theme: data['theme'],
          data:  data,
          blueprint_id: this.model.blueprint.get('id')
        };

        this.model.set(vals);
        this.render();
      }
      previewFrame.sendMessage('updateData', JSON.stringify(data));
    }
  },

  savePreview: function(){
    this.$('#projectForm form').submit();
  },

  afterInit: function(options) {
    this.disableForm = options.disableForm ? true : false;
    this.copyProject = options.copyProject ? true : false;
    this.listenForChanges();
  },

  listenForChanges: function() {
    if ( !this.model.isNew() && !this.listening ) {
      this.listenTo(this.app.listener,
                    'change:project:' + this.model.id,
                    this.updateStatus, this);
      this.listening = true;
    }
  },

  stopListeningForChanges: function() {
    this.stopListening(this.app.listener);
    this.listening = false;
  },

  updateStatus: function(status) {
    // don't care about the updated step
    if ( status === 'updated' ) { return; }

    logger.debug('Update project status: ' + status);
    if (status === 'built'){
      this.app.view.success('Building complete');
    }

    // fetch the model, re-render the view and catch errors
    var view = this;
    Promise
      .resolve(this.model.fetch())
      .then(function() {
        return view.render();
      }).catch(function(jqXHR) {
        view.app.view.displayError(
          jqXHR.status, jqXHR.statusText, jqXHR.responseText);
      });
  },

  templateData: function() {
    return {
      model: this.model,
      collection: this.collection,
      app: this.app,
      query: this.query,
      copyProject: this.copyProject
    };
  },

  beforeRender: function() {
    this.stopListeningForChanges();
  },

  beforeSubmit: function() {
    this.stopListeningForChanges();
  },

  afterRender: function() {
    var view = this, promises = [], buildData = view.model.buildData();

    if ( view.model.blueprint.hasPreviewType('live') ){
      theme = view.model.get('theme') || 'custom';
      var slug = view.model.blueprint.get('slug'),
          bp_version = view.model.get('blueprint_version') || view.model.blueprint.get('version');

      var preview_url = ['//test.apps.voxmedia.com/at-preview', slug, bp_version, theme, 'preview/'].join('/');
      if ( ! view.model.hasInitialBuild() && ! view.copyProject){
        preview_url += '#new';
      }

      var temp_slug = slug;
      if ( view.copyProject || view.model.hasInitialBuild() ){
        pymParent = new pym.Parent(slug+'__graphic', preview_url);
        pymParent.onMessage('childLoaded', function() {
          pymParent.sendMessage('updateData', JSON.stringify(buildData));
        });
      } else {
        pymParentNew = new pym.Parent(temp_slug+'__graphic', preview_url);
        var uniqBuildVals = _.uniq(_.values(buildData));

        if (!( uniqBuildVals.length === 1 && typeof uniqBuildVals[0] === 'undefined')){
          pymParentNew.onMessage('childLoaded', function() {
            pymParentNew.sendMessage('updateData', JSON.stringify(buildData));
          });
        }

      }
    } else {
      if ( view.model.hasType( 'graphic' ) && view.model.hasInitialBuild() ){
        var previewLink = view.model.get('preview_url');
        if(view.model['_previousAttributes']['preview_url'] && view.model['_previousAttributes']['preview_url'] !==  view.model.get('preview_url')){
          previewLink = view.model['_previousAttributes']['preview_url'];
        }
        pymParent = new pym.Parent(view.model.get('slug')+'__graphic', previewLink);
      }
    }

    // Setup editor for data field
    if ( this.app.hasRole('superuser') ) {
      this.editor = ace.edit('blueprint-data');
      this.editor.setShowPrintMargin(false);
      this.editor.setTheme("ace/theme/textmate");
      this.editor.setWrapBehavioursEnabled(true);

      var session = this.editor.getSession();
      session.setMode("ace/mode/javascript");
      session.setUseWrapMode(true);

      this.editor.renderer.setHScrollBarAlwaysVisible(false);

      this.editor.setValue(
        JSON.stringify( this.model.buildData(), null, "  " ), -1 );

      var debouncedStopListeningForChanges = _.once(
        _.bind(this.stopListeningForChanges, this));
      this.editor.on("change", function() {
        logger.debug('editor content changed');
        debouncedStopListeningForChanges();
      });
    }

    if ( this.model.isPublished() && this.model.blueprint.get('type') === 'graphic' ) {
      var proto = window.location.protocol.replace( ':', '' ),
          embedUrl = this.model.getPublishUrl(proto, 'embed.txt');

      promises.push( Promise
        .resolve( $.get( embedUrl ) )
        .then( function(data) {
          data = data.replace( /(?:\r\n|\r|\n)/gm, '' );
          view.$( '#embed textarea' ).text( data );
        }).catch(function(error) {
          logger.error(error);
        })
      );
    }

    promises.push( new Promise( function(resolve, reject) {
      view.renderForm(resolve, reject);
    } ) );

    return Promise.all(promises)
      .then(function() {
        view.listenForChanges();
      });
  },

  afterSubmit: function() {
    this.listenForChanges();
    if (this.model.hasStatus('building')){
      this.app.view.alert(
        'Building... This might take a moment.', 'notice', false, 16000);
    }
  },

  renderForm: function(resolve, reject) {
    logger.debug('debugging this', this);
    var $form = this.$('#projectForm'),
        button_tmpl = require('../templates/project_buttons.ejs'),
        orig_this = this,
        form_config, config_themes, newProject, populateForm = false;

    if ( this.disableForm ) {
      $form.append(
        '<div class="alert alert-warning" role="alert">Form is disabled</div>');
      return resolve();
    }

    // Prevent return or enter from submitting the form
    $form.keypress(function(event){
      var field_type = event.originalEvent.srcElement.type;
      if (event.keyCode === 10 || event.keyCode === 13){
        if(field_type !== 'textarea'){
          event.preventDefault();
        }
      }
    });

    if ( this.model.isNew() && !this.copyProject ) {
      newProject = true;
      form_config = this.model.blueprint.get('config').form;
      config_themes = this.model.blueprint.get('config').themes || ['generic'];
    } else if (this.copyProject) {
      newProject = true;
      form_config = this.model.get('blueprint_config').form;
      config_themes = this.model.get('blueprint_config').themes || ['generic'];
    } else {
      newProject = false;
      form_config = this.model.get('blueprint_config').form;
      config_themes = this.model.get('blueprint_config').themes || ['generic'];
    }

    if(_.isUndefined(form_config)) {
      this.app.view.error('This blueprint does not have a form!');
      reject('This blueprint does not have a form!');
    } else {
      var themes = this.app.themes.filter(function(theme) {
            if ( _.isEqual(config_themes, ['generic']) ) {
              return true;
            } else {
              return _.contains(config_themes, theme.get('value'));
            }
          }),
          social_chars = {
            "sbnation": 8,
            "theverge": 5,
            "polygon": 7,
            "racked": 6,
            "eater": 5,
            "vox": 9,
            "custom": 0
          },
          schema_properties = {
            "title": {
              "title": "Title",
              "type": "string",
              "required": true
            },
            "theme": {
              "title": "Theme",
              "type": "string",
              "required": true,
              "default": pluckAttr(themes, 'value')[0],
              "enum": pluckAttr(themes, 'value')
            },
            "slug": {
              "title": "Slug",
              "type": "string"
            },
            "tweet_text":{
              "type": "string",
              "minLength": 0
            }
          },
          options_form = {
            "attributes": {
              "data-model": "Project",
              "data-model-id": this.model.isNew() ? '' : this.model.id,
              "data-action": this.model.isNew() ? 'new' : 'edit',
              "data-next": 'show'
            }
          },
          options_fields = {
            "theme": {
              "type": "select",
              "optionLabels": pluckAttr(themes, 'label'),
            },
            "slug": {
              "label": "Slug",
              "validator": function(callback){
                var slugPattern = /^[0-9a-z\-_]{0,60}$/;
                var slug = this.getValue();
                if ( slugPattern.test(slug) ){
                  callback({ "status": true });
                } else if (slugPattern.test(slug.substring(0,60))){
                  this.setValue(slug.substr(0,60));
                  callback({ "status": true });
                } else {
                  callback({
                    "status": false,
                    "message": "Must contain fewer than 60 numbers, lowercase letters, hyphens, and underscores."
                  });
                }
              }
            },
            "tweet_text":{
              "label": "Social share text",
              "constrainMaxLength": true,
              "constrainMinLength": true,
              "showMaxLengthIndicator": true
            }
          };

      // if there is only one theme option, hide the dropdown
      if ( themes.length === 1 ) {
        options_fields['theme']['type'] = 'hidden';
      }

      _.extend(schema_properties, form_config['schema']['properties'] || {});
      if( form_config['options'] ) {
        _.extend(options_form, form_config['options']['form'] || {});
        _.extend(options_fields, form_config['options']['fields'] || {});
      }

      var opts = {
        "schema": {
          "title": this.model.blueprint.get('title'),
          "description": this.model.blueprint.get('config').description,
          "type": "object",
          "properties": schema_properties
        },
        "options": {
          "form": options_form,
          "fields": options_fields,
          "focus": this.firstRender
        },
        "postRender": _.bind(function(control) {
          this.alpaca = control;

          var theme = control.childrenByPropertyId["theme"],
             social = control.childrenByPropertyId["tweet_text"];

          if ( social && social.type !== 'hidden' ) {
            social.schema.maxLength = 140-(26+social_chars[theme.getValue()]);
            social.updateMaxLengthIndicator();

            if ( theme && theme.type !== 'hidden' ) {
              $(theme).on('change', function(){
                social.schema.maxLength = 140 - (
                  26 + social_chars[ theme.getValue() ] );
                social.updateMaxLengthIndicator();
              });
            }
          }

          this.alpaca.childrenByPropertyId["slug"].setValue(
            this.model.get('slug_sans_theme') );

          control.form.form.append(
            helpers.render(button_tmpl, this.templateData()) );

          resolve();
        }, this)
      };

      if( form_config['view'] ) {
        opts.view = form_config.view;
      }

      if(!this.model.isNew() || this.copyProject) {
        populateForm = true;
      } else if (this.model.isNew() && !this.copyProject && !this.hasInitialBuild){
        populateForm = true;
      }

      if(populateForm){
        opts.data = this.model.formData();
        if ( !_.contains(pluckAttr(themes, 'value'), opts.data.theme) ) {
          opts.data.theme = pluckAttr(themes, 'value')[0];
        }
      }
      $form.alpaca(opts);
    }
  },

  formValues: function($form) {
    var control = $form.alpaca('get'), data;

    logger.debug('form values');

    if ( control ) {
      data = control.getValue();
    } else {
      try {
        data = JSON.parse(this.editor.getValue());
      } catch (ex) {
        return {};
      }
    }

    var vals = {
      title: data['title'],
      theme: data['theme'],
      data:  data,
      blueprint_id: this.model.blueprint.get('id')
    };

    if ( data.slug && data.slug.indexOf(data['theme']) !== 0 ) {
      vals.slug = data['theme'] + '-' + data['slug'];
    }

    return vals;
  },

  formValidate: function(inst, $form) {
    var control = $form.alpaca('get'), valid = false;

    logger.debug('form validate');

    if ( control ) {
      valid = control.form.isFormValid();

      if ( !valid ) {
        control.form.refreshValidationState(true);
        $form.find('#validation-error').removeClass('hidden');
      } else {
        $form.find('#resolve-message').removeClass('hidden');
        $form.find('#validation-error').addClass('hidden');
      }
    } else {
      try {
        JSON.parse(this.editor.getValue());
        valid = true;
      } catch (ex) {
        logger.error("Blueprint raw JSON is bad");
      }
    }
    return valid;
  }
} );

module.exports = EditProject;
