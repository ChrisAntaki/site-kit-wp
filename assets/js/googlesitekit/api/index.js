/**
 * WordPress dependencies
 */
// import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { getKeys, deleteItem } from './cache';
import { createCacheKey } from './index.private';

// Caching is enabled by default.
let cachingEnabled = true;

/**
 * Get Google Site Kit data.
 *
 * Makes a request to this site's WordPress REST API, which will in
 * turn make GET requests to the relevant Google services' APIs.
 *
 * This method automatically handles authentication, so no credentials
 * are required to use this method.
 *
 * @param {string} type        The data to access. One of 'core' or 'modules'.
 * @param {string} identifier  The data identifier, eg. a module slug like `'search-console'`.
 * @param {string} datapoint   The endpoint to request data from.
 * @param {Object} queryParams Query params to send with the request.
 *
 * @return {Promise} A promise for the `fetch` request.
 */
// eslint-disable-next-line no-unused-vars
export const get = async (
	type,
	identifier,
	datapoint,
	queryParams,
	// eslint-disable-next-line no-unused-vars
	{ disableCache = false } = {}
) => {
	throw new Error( 'Not yet implemented.' );
};

/**
 * Set Google Site Kit data.
 *
 * Makes a request to this site's WordPress REST API, which will in
 * turn make requests to the relevant Google services' APIs to save
 * the data sent in the request.
 *
 * This method automatically handles authentication, so no credentials
 * are required to use this method.
 *
 * @param {string} type       The data to access. One of 'core' or 'modules'.
 * @param {string} identifier The data identifier, eg. a module slug like `'adsense'`.
 * @param {string} datapoint  The endpoint to send data to.
 * @param {Object} data       Request data (eg. post data) to send with the request.
 *
 * @return {Promise} A promise for the `fetch` request.
 */
// eslint-disable-next-line no-unused-vars
export const set = async (
	type,
	identifier,
	datapoint,
	data,
	// eslint-disable-next-line no-unused-vars
	{ disableCache = false, queryParams = {} } = {}
) => {
	throw new Error( 'Not yet implemented.' );
};

/**
 * Enable/disable caching.
 *
 * Set the caching to on/off for the entire API library.
 *
 * Individual requests can still be overridden to _disable_ caching,
 * but if caching is turned off it cannot be turned on for a specific request.
 *
 * @param {boolean} shouldUseCache Set to `true` to use this cache across requests; set to `false` to disable caching.
 *
 * @return {boolean} The new caching state (`true` for on, `false` for off).
 */
export const setUsingCache = ( shouldUseCache ) => {
	cachingEnabled = !! shouldUseCache;

	return cachingEnabled;
};

/**
 * Get current caching state for the API.
 *
 * @return {boolean} The current caching state (`true` for on, `false` for off).
 */
export const usingCache = () => {
	return cachingEnabled;
};

/**
 * Invalidate the cache for a specific datapoint or all data.
 *
 * Invalidate cache data for either a specific datapoint, identifier, type, or
 * all data. The more specificity supplied the more granularly cache data will
 * be invalidated.
 *
 * Calling `invalidateCache()` will invalidate _all_ cached data, while calling
 * `invalidateCache( 'modules', 'adsense' )` will invalidate all AdSense data only.
 *
 * @param {string} type       The data type to operate on. One of 'core' or 'modules'.
 * @param {string} identifier The data identifier, eg. a module slug like `'adsense'`.
 * @param {string} datapoint  The endpoint to invalidate cache data for.
 *
 * @return {void}
 */
export const invalidateCache = async ( type, identifier, datapoint ) => {
	const groupPrefix = createCacheKey( type, identifier, datapoint );

	const allKeys = await getKeys();

	allKeys.forEach( ( key ) => {
		if ( key.indexOf( groupPrefix ) === 0 ) {
			deleteItem( key );
		}
	} );
};
