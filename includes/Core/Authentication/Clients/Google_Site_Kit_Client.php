<?php
/**
 * Class Google\Site_Kit\Core\Authentication\Clients\Google_Site_Kit_Client
 *
 * @package   Google\Site_Kit
 * @copyright 2019 Google LLC
 * @license   https://www.apache.org/licenses/LICENSE-2.0 Apache License 2.0
 * @link      https://sitekit.withgoogle.com
 */

namespace Google\Site_Kit\Core\Authentication\Clients;

use Google\Site_Kit\Core\Authentication\Exception\Google_OAuth_Exception;
use Google\Site_Kit_Dependencies\Google_Client;
use Google\Site_Kit_Dependencies\Google\Auth\OAuth2;
use Google\Site_Kit_Dependencies\Google\Auth\HttpHandler\HttpHandlerFactory;
use Google\Site_Kit_Dependencies\Google\Auth\HttpHandler\HttpClientCache;
use Google\Site_Kit_Dependencies\GuzzleHttp\ClientInterface;
use Exception;
use InvalidArgumentException;
use LogicException;

/**
 * Extended Google API client with custom functionality for Site Kit.
 *
 * @since n.e.x.t
 * @access private
 * @ignore
 */
class Google_Site_Kit_Client extends Google_Client {

	/**
	 * Callback to pass a potential exception to while refreshing an access token.
	 *
	 * @since n.e.x.t
	 * @var callable|null
	 */
	protected $token_exception_callback;

	/**
	 * Construct the Google client.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $config Client configuration.
	 */
	public function __construct( array $config = array() ) {
		if ( isset( $config['token_exception_callback'] ) ) {
			$this->setTokenExceptionCallback( $config['token_exception_callback'] );
		}

		unset( $config['token_exception_callback'] );

		parent::__construct( $config );
	}

	/**
	 * Sets the function to be called when fetching an access token results in an exception.
	 *
	 * @since n.e.x.t
	 *
	 * @param callable $exception_callback Function accepting an exception as single parameter.
	 */
	public function setTokenExceptionCallback( callable $exception_callback ) {
		$this->token_exception_callback = $exception_callback;
	}

	/**
	 * Sets whether or not to return raw requests and returns a callback to reset to the previous value.
	 *
	 * @since n.e.x.t
	 *
	 * @param bool $defer Whether or not to return raw requests.
	 * @return callable Callback function that resets to the original $defer value.
	 */
	public function withDefer( $defer ) {
		$orig_defer = $this->shouldDefer();
		$this->setDefer( $defer );

		// Return a function to restore the original refer value.
		return function () use ( $orig_defer ) {
			$this->setDefer( $orig_defer );
		};
	}

	/**
	 * Adds auth listeners to the HTTP client based on the credentials set in the Google API Client object.
	 *
	 * @since n.e.x.t
	 *
	 * @param ClientInterface $http The HTTP client object.
	 * @return ClientInterface The HTTP client object.
	 *
	 * @throws Exception Thrown when fetching a new access token via refresh token on-the-fly fails.
	 */
	public function authorize( ClientInterface $http = null ) {
		if ( $this->isUsingApplicationDefaultCredentials() ) {
			return parent::authorize( $http );
		}

		$token = $this->getAccessToken();
		if ( isset( $token['refresh_token'] ) && $this->isAccessTokenExpired() ) {
			$callback = $this->getConfig( 'token_callback' );

			try {
				$creds = $this->fetchAccessTokenWithRefreshToken( $token['refresh_token'] );
				if ( $callback ) {
					// Due to original callback signature this can only accept the token itself.
					call_user_func( $callback, '', $creds['access_token'] );
				}
			} catch ( Exception $e ) {
				// Pass exception to special callback if provided.
				if ( $this->token_exception_callback ) {
					call_user_func( $this->token_exception_callback, $e );
				}
				throw $e;
			}
		}

		return parent::authorize( $http );
	}

	/**
	 * Fetches an OAuth 2.0 access token by using a temporary code.
	 *
	 * @since 1.0.0
	 * @since n.e.x.t Ported from Google_Site_Kit_Proxy_Client.
	 *
	 * @param string $code Temporary authorization code, or undelegated token code.
	 * @return array Access token.
	 *
	 * @throws InvalidArgumentException Thrown when the passed code is empty.
	 */
	public function fetchAccessTokenWithAuthCode( $code ) {
		if ( strlen( $code ) === 0 ) {
			throw new InvalidArgumentException( 'Invalid code' );
		}

		$auth = $this->getOAuth2Service();
		$auth->setCode( $code );
		$auth->setRedirectUri( $this->getRedirectUri() );

		$http_handler = HttpHandlerFactory::build( $this->getHttpClient() );

		$creds = $this->fetchAuthToken( $auth, $http_handler );
		if ( $creds && isset( $creds['access_token'] ) ) {
			$creds['created'] = time();
			$this->setAccessToken( $creds );
		}

		return $creds;
	}

	/**
	 * Fetches a fresh OAuth 2.0 access token by using a refresh token.
	 *
	 * @since 1.0.0
	 * @since n.e.x.t Ported from Google_Site_Kit_Proxy_Client.
	 *
	 * @param string $refresh_token Optional. Refresh token. Unused here.
	 * @return array Access token.
	 *
	 * @throws LogicException Thrown when no refresh token is available.
	 */
	public function fetchAccessTokenWithRefreshToken( $refresh_token = null ) {
		if ( null === $refresh_token ) {
			$refresh_token = $this->getRefreshToken();
			if ( ! $refresh_token ) {
				throw new LogicException( 'refresh token must be passed in or set as part of setAccessToken' );
			}
		}

		$this->getLogger()->info( 'OAuth2 access token refresh' );
		$auth = $this->getOAuth2Service();
		$auth->setRefreshToken( $refresh_token );

		$http_handler = HttpHandlerFactory::build( $this->getHttpClient() );

		$creds = $this->fetchAuthToken( $auth, $http_handler );
		if ( $creds && isset( $creds['access_token'] ) ) {
			$creds['created'] = time();
			if ( ! isset( $creds['refresh_token'] ) ) {
				$creds['refresh_token'] = $refresh_token;
			}
			$this->setAccessToken( $creds );
		}

		return $creds;
	}

	/**
	 * Fetches an OAuth 2.0 access token using a given auth object and HTTP handler.
	 *
	 * This method is used in place of {@see OAuth2::fetchAuthToken()}.
	 *
	 * @since 1.0.0
	 * @since n.e.x.t Ported from Google_Site_Kit_Proxy_Client.
	 *
	 * @param OAuth2        $auth         OAuth2 instance.
	 * @param callable|null $http_handler Optional. HTTP handler callback. Default null.
	 * @return array Access token.
	 */
	protected function fetchAuthToken( OAuth2 $auth, callable $http_handler = null ) {
		if ( is_null( $http_handler ) ) {
			$http_handler = HttpHandlerFactory::build( HttpClientCache::getHttpClient() );
		}

		$request     = $auth->generateCredentialsRequest();
		$response    = $http_handler( $request );
		$credentials = $auth->parseTokenResponse( $response );
		if ( ! empty( $credentials['error'] ) ) {
			$this->handleAuthTokenErrorResponse( $credentials['error'], $credentials );
		}

		$auth->updateToken( $credentials );

		return $credentials;
	}

	/**
	 * Handles an erroneous response from a request to fetch an auth token.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $error Error code / error message.
	 * @param array  $data  Associative array of full response data.
	 *
	 * @throws Google_OAuth_Exception Thrown with the given $error as message.
	 */
	protected function handleAuthTokenErrorResponse( $error, array $data ) {
		throw new Google_OAuth_Exception( $error );
	}
}
