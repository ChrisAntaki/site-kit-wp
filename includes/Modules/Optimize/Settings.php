<?php
/**
 * Class Google\Site_Kit\Modules\Optimize\Settings
 *
 * @package   Google\Site_Kit\Modules\Optimize
 * @copyright 2019 Google LLC
 * @license   https://www.apache.org/licenses/LICENSE-2.0 Apache License 2.0
 * @link      https://sitekit.withgoogle.com
 */

namespace Google\Site_Kit\Modules\Optimize;

use Google\Site_Kit\Core\Modules\Module_Settings;
use Google\Site_Kit\Core\Storage\Setting_With_Legacy_Keys_Trait;

/**
 * Class for Optimize settings.
 *
 * @since n.e.x.t
 * @access private
 * @ignore
 */
class Settings extends Module_Settings {
	use Setting_With_Legacy_Keys_Trait;

	const OPTION = 'googlesitekit_optimize_settings';

	/**
	 * Registers the setting in WordPress.
	 *
	 * @since n.e.x.t
	 */
	public function register() {
		parent::register();

		$this->register_legacy_keys_migration(
			array(
				'AMPExperimentJson' => 'ampExperimentJSON',
				'ampExperimentJson' => 'ampExperimentJSON',
				'optimize_id'       => 'optimizeID',
				'optimizeId'        => 'optimizeID',
			)
		);
	}

	/**
	 * Gets the default value.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	public function get_default() {
		return array(
			'ampExperimentJSON' => '',
			'optimizeID'        => '',
		);
	}
}
