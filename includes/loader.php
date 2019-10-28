<?php
/**
 * Plugin config.
 *
 * @package   Google\Site_Kit
 * @copyright 2019 Google LLC
 * @license   https://www.apache.org/licenses/LICENSE-2.0 Apache License 2.0
 * @link      https://sitekit.withgoogle.com
 */

namespace Google\Site_Kit;

// Define global constants.
define( 'GOOGLESITEKIT_PLUGIN_BASENAME', plugin_basename( GOOGLESITEKIT_PLUGIN_MAIN_FILE ) );
define( 'GOOGLESITEKIT_PLUGIN_DIR_PATH', plugin_dir_path( GOOGLESITEKIT_PLUGIN_MAIN_FILE ) );

// Autoload files.
require_once GOOGLESITEKIT_PLUGIN_DIR_PATH . 'includes/vendor/autoload.php';
require_once GOOGLESITEKIT_PLUGIN_DIR_PATH . 'third-party/vendor/autoload.php';

/**
 * Loads vendor files containing functions etc.
 *
 * This integrates with the dependency prefixing script. Its autoloader loads all classes, but not the other files.
 *
 * @since 1.0.0
 * @access private
 */
function autoload_vendor_files() {
	$files = require GOOGLESITEKIT_PLUGIN_DIR_PATH . 'third-party/vendor/composer/autoload_files.php';
	foreach ( $files as $file_identifier => $file ) {
		$file = str_replace( 'third-party/vendor', 'third-party', $file );
		if ( file_exists( $file ) ) {
			require_once $file;
		}
	}
}
autoload_vendor_files();

// Initialize the plugin.
Plugin::load( GOOGLESITEKIT_PLUGIN_MAIN_FILE );

/**
 * WP CLI Commands
 */
if ( defined( 'WP_CLI' ) && WP_CLI ) {
	require_once GOOGLESITEKIT_PLUGIN_DIR_PATH . 'bin/authentication-cli.php';
	require_once GOOGLESITEKIT_PLUGIN_DIR_PATH . 'bin/reset-cli.php';
}
