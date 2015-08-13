<?php

/**
 * @file
 * Contains \Drupal\entity_embed\Tests\EntityEmbedDialogTest.
 */

namespace Drupal\url_embed\Tests;

use Drupal\editor\Entity\Editor;

/**
 * Tests the url_embed dialog controller and route.
 *
 * @group url_embed
 */
class UrlEmbedDialogTest extends UrlEmbedTestBase {

  /**
   * Tests the URL embed dialog.
   */
  public function testUrlEmbedDialog() {
    // Ensure that the route is not accessible without specifying all the
    // parameters.
    $this->getEmbedDialog();
    $this->assertResponse(404, 'Embed dialog is not accessible without specifying filter format and embed button.');
    $this->getEmbedDialog('custom_format');
    $this->assertResponse(404, 'Embed dialog is not accessible without specifying embed button.');

    // Ensure that the route is not accessible with an invalid embed button.
    $this->getEmbedDialog('custom_format', 'invalid_button');
    $this->assertResponse(404, 'Embed dialog is not accessible without specifying filter format and embed button.');

    // Ensure that the route is not accessible with text format without the
    // button configured.
    // @todo Add coverage for an editor config that doesn't have the button.
    $this->getEmbedDialog('plain_text', 'url');
    $this->assertResponse(403, 'Embed dialog is not accessible with a filter that does not have an editor configuration.');

    // Add an empty configuration for the plain_text editor configuration.
    $editor = Editor::create([
      'format' => 'plain_text',
      'editor' => 'ckeditor',
    ]);
    $editor->save();
    $this->getEmbedDialog('plain_text', 'url');
    $this->assertResponse(403, 'Embed dialog is not accessible with a filter that does not have the embed button assigned to it.');

    // Ensure that the route is accessible with a valid embed button.
    // 'URL' embed button is provided by default by the module and hence the
    // request must be successful.
    $this->getEmbedDialog('custom_format', 'url');
    $this->assertResponse(200, 'Embed dialog is accessible with correct filter format and embed button.');
  }

  /**
   * Retrieves an embed dialog based on given parameters.
   *
   * @param string $filter_format_id
   *   ID of the filter format.
   * @param string $url_embed_button_id
   *   ID of the embed button.
   *
   * @return string
   *   The retrieved HTML string.
   */
  public function getEmbedDialog($filter_format_id = NULL, $url_embed_button_id = NULL) {
    $url = 'url-embed/dialog';
    if (!empty($filter_format_id)) {
      $url .= '/' . $filter_format_id;
      if (!empty($url_embed_button_id)) {
        $url .= '/' . $url_embed_button_id;
      }
    }
    return $this->drupalGet($url);
  }
}
