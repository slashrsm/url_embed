/**
 * @file
 * Drupal Entity plugin.
 */

(function ($, Drupal, CKEDITOR) {

  "use strict";

  CKEDITOR.plugins.add('drupalurl', {
    // This plugin requires the Widgets System defined in the 'widget' plugin.
    requires: 'widget',

    // The plugin initialization logic goes inside this method.
    beforeInit: function (editor) {
      // Configure CKEditor DTD for custom drupal-url element.
      // @see https://www.drupal.org/node/2448449#comment-9717735
      var dtd = CKEDITOR.dtd, tagName;
      dtd['drupal-url'] = {'#': 1};
      // Register drupal-url element as allowed child, in each tag that can
      // contain a div element.
      for (tagName in dtd) {
        if (dtd[tagName].div) {
          dtd[tagName]['drupal-url'] = 1;
        }
      }

      // Generic command for adding/editing entities of all types.
      editor.addCommand('editdrupalurl', {
        allowedContent: 'drupal-url[*]',
        requiredContent: 'drupal-url[*]',
        modes: { wysiwyg : 1 },
        canUndo: true,
        exec: function (editor, data) {
          data = data || {};

          var existingElement = getSelectedEntity(editor);

          var existingValues = {};
          if (existingElement && existingElement.$ && existingElement.$.firstChild) {
            var entityDOMElement = existingElement.$.firstChild;
            // Populate array with the entity's current attributes.
            var attribute = null, attributeName;
            for (var key = 0; key < entityDOMElement.attributes.length; key++) {
              attribute = entityDOMElement.attributes.item(key);
              attributeName = attribute.nodeName.toLowerCase();
              if (attributeName.substring(0, 15) === 'data-cke-saved-') {
                continue;
              }
              existingValues[attributeName] = existingElement.data('cke-saved-' + attributeName) || attribute.nodeValue;
            }
          }

          var url_button_id = data.id ? data.id : existingValues['url-embed-button'];

          var dialogSettings = {
            title: existingElement ? 'Edit URL' : 'Insert URL',
            dialogClass: 'url-select-dialog',
            resizable: false,
            minWidth: 800
          };

          var saveCallback = function (values) {
            var urlElement = editor.document.createElement('drupal-url');
            var attributes = values.attributes
            for (var key in attributes) {
              urlElement.setAttribute(key, attributes[key]);
            }
            editor.insertHtml(urlElement.getOuterHtml());
            if (existingElement) {
              // Detach the behaviors that were attached when the entity content
              // was inserted.
              runEmbedBehaviors('detach', existingElement.$);
              existingElement.remove();
            }
          };

          // Open the URL embed dialog for corresponding EmbedButton.
          Drupal.ckeditor.openDialog(editor, Drupal.url('url-embed/dialog/url-embed/' + editor.config.drupal.format + '/' + url_button_id), existingValues, saveCallback, dialogSettings);
        }
      });

      // Register the URL embed widget.
      editor.widgets.add('drupalurl', {
        // Minimum HTML which is required by this widget to work.
        allowedContent: 'drupal-url[*]',
        requiredContent: 'drupal-url[*]',

        // Simply recognize the element as our own. The inner markup if fetched
        // and inserted the init() callback, since it requires the actual DOM
        // element.
        upcast: function (element) {
          var attributes = element.attributes;
          if (attributes['data-embed-url'] === undefined) {
            return;
          }
          // Generate an ID for the element, so that we can use the Ajax
          // framework.
          element.attributes.id = generateEmbedId();
          return element;
        },

        // Fetch the rendered entity.
        init: function () {
          var element = this.element;
          var $element = $(element.$);
          // Use the Ajax framework to fetch the HTML, so that we can retrieve
          // out-of-band assets (JS, CSS...).
          var urlEmbedPreview = new Drupal.ajax({
            base: $element.attr('id'),
            element: $element,
            url: Drupal.url('url-embed/preview/' + editor.config.drupal.format + '?' + $.param({
              value: element.getOuterHtml()
            })),
            progress: {type: 'none'},
            // Use a custom event to trigger the call.
            event: 'url_embed_dummy_event'
          });
          urlEmbedPreview.execute();
        },

        // Downcast the element.
        downcast: function (element) {
          // Only keep the wrapping element.
          element.setHtml('');
          // Remove the auto-generated ID.
          delete element.attributes.id;
          return element;
        }
      });

      // Register the toolbar buttons.
      if (editor.ui.addButton) {
        for (var key in editor.config.DrupalUrl_buttons) {
          var button = editor.config.DrupalUrl_buttons[key];
          editor.ui.addButton(button.id, {
            label: button.label,
            data: button,
            click: function(editor) {
              editor.execCommand('editdrupalurl', this.data);
            },
            icon: button.image
          });
        }
      }

      // Register context menu option for editing widget.
      if (editor.contextMenu) {
        editor.addMenuGroup('drupalurl');
        editor.addMenuItem('drupalurl', {
          label: Drupal.t('Edit URL'),
          icon: this.path + 'entity.png',
          command: 'editdrupalurl',
          group: 'drupalurl'
        });

        editor.contextMenu.addListener(function(element) {
          if (isUrlWidget(editor, element)) {
            return { drupalurl: CKEDITOR.TRISTATE_OFF };
          }
        });
      }

      // Execute widget editing action on double click.
      editor.on('doubleclick', function (evt) {
        var element = getSelectedEntity(editor) || evt.data.element;

        if (isUrlWidget(editor, element)) {
          editor.execCommand('editdrupalurl');
        }
      });
    }
  });

  /**
   * Get the surrounding drupalurl widget element.
   *
   * @param {CKEDITOR.editor} editor
   */
  function getSelectedEntity(editor) {
    var selection = editor.getSelection();
    var selectedElement = selection.getSelectedElement();
    if (isUrlWidget(editor, selectedElement)) {
      return selectedElement;
    }

    return null;
  }

  /**
   * Returns whether or not the given element is a drupalurl widget.
   *
   * @param {CKEDITOR.editor} editor
   * @param {CKEDITOR.htmlParser.element} element
   */
  function isUrlWidget (editor, element) {
    var widget = editor.widgets.getByElement(element, true);
    return widget && widget.name === 'drupalurl';
  }

  /**
   * Generates unique HTML IDs for the widgets.
   *
   * @returns {string}
   */
  function generateEmbedId() {
    if (typeof generateEmbedId.counter == 'undefined') {
      generateEmbedId.counter = 0;
    }
    return 'url-embed-' + generateEmbedId.counter++;
  }


  /**
   * Ajax 'url_embed_insert' command: insert the rendered URL.
   *
   * The regular Drupal.ajax.commands.insert() command cannot target elements
   * within iframes. This is a skimmed down equivalent that works whether the
   * CKEditor is in iframe or divarea mode.
   */
  Drupal.AjaxCommands.prototype.url_embed_insert = function(ajax, response, status) {
    var $target = ajax.element;
    // No need to detach behaviors here, the widget is created fresh each time.
    $target.html(response.html);
  };


})(jQuery, Drupal, CKEDITOR);