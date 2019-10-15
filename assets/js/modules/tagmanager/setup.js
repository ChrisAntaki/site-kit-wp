/**
 * TagmanagerSetup component.
 *
 * Site Kit by Google, Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * External dependencies
 */
import Button from 'GoogleComponents/button';
import Link from 'GoogleComponents/link';
import data, { TYPE_MODULES } from 'GoogleComponents/data';
import ProgressBar from 'GoogleComponents/progress-bar';
import { Select, Option } from 'SiteKitCore/material-components';
import SvgIcon from 'GoogleUtil/svg-icon';
import PropTypes from 'prop-types';
import { toggleConfirmModuleSettings } from 'GoogleUtil';
/**
 * Internal dependencies
 */
import { getExistingTag } from '../../util';

const { __, sprintf } = wp.i18n;
const { Component, Fragment } = wp.element;
const {
	removeFilter,
	addFilter,
} = wp.hooks;

class TagmanagerSetup extends Component {
	constructor( props ) {
		super( props );

		const {
			accountId,
			containerId,
		} = googlesitekit.modules.tagmanager.settings;

		this.state = {
			isLoading: true,
			accounts: [],
			containers: [],
			errorCode: false,
			errorMsg: '',
			refetch: false,
			selectedAccount: accountId ? accountId : 0,
			selectedContainer: containerId ? containerId : 0,
			containersLoading: false,
			blockedFromCompleting: false,
			existingTag: false,
		};

		this.handleSubmit = this.handleSubmit.bind( this );
		this.renderAccountDropdownForm = this.renderAccountDropdownForm.bind( this );
		this.handleAccountChange = this.handleAccountChange.bind( this );
		this.handleContainerChange = this.handleContainerChange.bind( this );
		this.refetchAccount = this.refetchAccount.bind( this );
	}

	async componentDidMount() {
		this._isMounted = true;

		const existingTag = await getExistingTag( 'tagmanager' );

		this.setState( { existingTag } );

		if ( existingTag ) {
			// Verify the user has access to existing tag if found. If no access request will return 403 error and catch err.
			try {
				const { container } = await data.get( TYPE_MODULES, 'tagmanager', 'tag-permission', { tag: existingTag } );
				// User has permission if they have Admin status on the container's account, or "Publish" capability on the container itself (admins have this capability implicitly).
				if ( 'publish' !== container ) {
					throw {
						code: 'tag_manager_existing_tag_permission',
						message: sprintf(
							__(
								'We\'ve detected there\'s already an existing Tag Manager tag on your site (%s), but your account doesn\'t seem to have the necessary access to this container. You can either remove the existing tag and connect to a different account, or request access to this container from your team.',
								'google-site-kit'
							),
							existingTag
						),
						blockedFromCompleting: true,
					};
				}
				await this.requestTagManagerAccounts();
			} catch ( err ) {
				this.setState(
					{
						isLoading: false,
						errorCode: err.code,
						errorMsg: err.message,
						errorReason: err.data && err.data.reason ? err.data.reason : false,
						blockedFromCompleting: !! err.blockedFromCompleting,
					}
				);
			}
		} else {
			await this.requestTagManagerAccounts();
		}

		// Handle save hook from the settings page.
		addFilter( 'googlekit.SettingsConfirmed',
			'googlekit.TagmanagerSettingsConfirmed',
			( chain, module ) => {
				if ( 'tagmanager' !== module.replace( '-module', '' ) ) {
					return chain;
				}
				const { isEditing } = this.props;
				if ( isEditing ) {
					return this.handleSubmit();
				}
			} );

		this.toggleConfirmChangesButton();
	}

	componentDidUpdate() {
		const { refetch } = this.state;

		if ( refetch ) {
			this.requestTagManagerAccounts();
		}

		this.toggleConfirmChangesButton();
	}

	componentWillUnmount() {
		this._isMounted = false;

		removeFilter( 'googlekit.SettingsConfirmed', 'googlekit.TagmanagerSettingsConfirmed' );
	}

	/**
	 * Toggle confirm changes button disable/enable depending on the changed settings.
	 */
	toggleConfirmChangesButton() {
		if ( ! this.props.isEditing ) {
			return;
		}

		const settingsMapping = {
			selectedContainer: 'containerId',
			selectedAccount: 'selectedAccount',
		};

		toggleConfirmModuleSettings( 'tagmanager', settingsMapping, this.state );
	}

	/**
	 * Request Tag Manager accounts.
	 */
	async requestTagManagerAccounts() {
		try {
			const {
				selectedAccount,
				selectedContainer,
			} = this.state;

			const queryArgs = {
				accountId: selectedAccount,
			};

			let errorCode = false;
			let errorMsg = '';
			const responseData = await data.get( TYPE_MODULES, 'tagmanager', 'accounts-containers', queryArgs );

			if ( ! selectedAccount && 0 === responseData.accounts.length ) {
				errorCode = 'accountEmpty';
				errorMsg = __(
					'We didn’t find an associated Google Tag Manager account, would you like to set it up now? If you’ve just set up an account please re-fetch your account to sync it with Site Kit.',
					'google-site-kit'
				);
			}

			// Verify if user has access to the selected account.
			if ( selectedAccount && ! responseData.accounts.find( ( account ) => account.accountId === selectedAccount ) ) {
				data.invalidateCacheGroup( TYPE_MODULES, 'tagmanager', 'accounts-containers' );
				errorCode = 'insufficientPermissions';
				errorMsg = __( 'You currently don\'t have access to this Google Tag Manager account. You can either request access from your team, or remove this Google Tag Manager snippet and connect to a different account.', 'google-site-kit' );
			}

			const chooseContainer = {
				containerId: 0,
				publicId: 0,
			};
			responseData.containers.push( chooseContainer );

			if ( this._isMounted ) {
				const accountId = responseData.accounts[ 0 ] ? responseData.accounts[ 0 ].accountId : null;
				const publicId = responseData.containers[ 0 ] ? responseData.containers[ 0 ].publicId : null;

				this.setState( {
					isLoading: false,
					accounts: responseData.accounts,
					selectedAccount: ( selectedAccount ) ? selectedAccount : accountId,
					containers: responseData.containers,
					selectedContainer: ( selectedContainer ) ? selectedContainer : publicId,
					refetch: false,
					errorCode,
					errorMsg,
				} );
			}
		} catch ( err ) {
			if ( this._isMounted ) {
				this.setState( {
					isLoading: false,
					errorCode: err.code,
					errorMsg: err.message,
					refetch: false,
				} );
			}
		}
	}

	/**
	 * Request Tag Manager accounts.
	 *
	 * @param {string} selectedAccount The account ID to get containers from.
	 */
	async requestTagManagerContainers( selectedAccount ) {
		try {
			const queryArgs = {
				accountId: selectedAccount,
			};

			const responseData = await data.get( TYPE_MODULES, 'tagmanager', 'containers', queryArgs );

			const chooseContainer = {
				containerId: 0,
				publicId: 0,
			};
			responseData.push( chooseContainer );
			if ( this._isMounted ) {
				this.setState( {
					containersLoading: false,
					containers: responseData,
					selectedContainer: responseData[ 0 ].publicId,
					errorCode: false,
				} );
			}
		} catch ( err ) {
			if ( this._isMounted ) {
				this.setState( {
					errorCode: err.code,
					errorMsg: err.message,
				} );
			}
		}
	}

	async handleSubmit() {
		const {
			selectedAccount,
			selectedContainer,
		} = this.state;

		const { finishSetup } = this.props;

		try {
			const optionData = {
				accountId: selectedAccount,
				containerId: selectedContainer,
			};

			const responseData = await data.set( TYPE_MODULES, 'tagmanager', 'settings', optionData );
			if ( finishSetup ) {
				finishSetup();
			}

			googlesitekit.modules.tagmanager.settings = {
				accountId: responseData.accountId,
				containerId: responseData.containerId,
			};

			if ( this._isMounted ) {
				this.setState( {
					isSaving: false,
				} );
			}
		} catch ( err ) {
			if ( this._isMounted ) {
				this.setState( {
					isLoading: false,
					errorCode: err.code,
					errorMsg: err.message,
				} );
			}

			// Catches error in handleButtonAction from <SettingsModules> component.
			return new Promise( ( resolve, reject ) => {
				reject( err );
			} );
		}
	}

	static createNewAccount( e ) {
		e.preventDefault();
		window.open( 'https://marketingplatform.google.com/about/tag-manager/', '_blank' );
	}

	handleAccountChange( index, item ) {
		const { selectedAccount } = this.state;
		const selectValue = item.getAttribute( 'data-value' );

		if ( selectValue === selectedAccount ) {
			return;
		}

		if ( this._isMounted ) {
			this.setState( {
				containersLoading: true,
				selectedAccount: selectValue,
			} );
		}

		this.requestTagManagerContainers( selectValue );
	}

	handleContainerChange( index, item ) {
		const { selectedContainer } = this.state;
		const selectValue = item.getAttribute( 'data-value' );

		if ( selectValue === selectedContainer ) {
			return;
		}

		if ( this._isMounted ) {
			this.setState( {
				selectedContainer: selectValue,
			} );
		}
	}

	refetchAccount( e ) {
		e.preventDefault();
		if ( this._isMounted ) {
			this.setState( {
				isLoading: true,
				refetch: true,
				errorCode: false,
			} );
		}
	}

	renderSettingsInfo() {
		const {
			isLoading,
			selectedAccount,
			selectedContainer,
		} = this.state;

		if ( isLoading ) {
			return <ProgressBar />;
		}

		return (
			<Fragment>
				<div className="googlesitekit-settings-module__meta-items">
					<div className="googlesitekit-settings-module__meta-item">
						<p className="googlesitekit-settings-module__meta-item-type">
							{ __( 'Account', 'google-site-kit' ) }
						</p>
						<h5 className="googlesitekit-settings-module__meta-item-data">
							{ selectedAccount || false }
						</h5>
					</div>
					<div className="googlesitekit-settings-module__meta-item">
						<p className="googlesitekit-settings-module__meta-item-type">
							{ __( 'Container ID', 'google-site-kit' ) }
						</p>
						<h5 className="googlesitekit-settings-module__meta-item-data">
							{ selectedContainer || false }
						</h5>
					</div>
				</div>
			</Fragment>
		);
	}

	renderAccountDropdownForm() {
		const {
			accounts,
			selectedAccount,
			containers,
			selectedContainer,
			isLoading,
			containersLoading,
			blockedFromCompleting,
		} = this.state;

		const {
			onSettingsPage,
		} = this.props;

		if ( isLoading ) {
			return <ProgressBar />;
		}

		// If blocked, don't display anything else. The user can then click cancel.
		if ( blockedFromCompleting ) {
			return null;
		}

		if ( 0 >= accounts.length ) {
			return (
				<Fragment>
					<div className="googlesitekit-setup-module__action">
						<Button onClick={ TagmanagerSetup.createNewAccount }>{ __( 'Create an account', 'google-site-kit' ) }</Button>

						<div className="googlesitekit-setup-module__sub-action">
							<Link onClick={ this.refetchAccount }>{ __( 'Re-fetch My Account', 'google-site-kit' ) }</Link>
						</div>
					</div>
				</Fragment>
			);
		}

		return (
			<Fragment>
				<p>{ __( 'Please select your Tag Manager account and container below, the snippet will be inserted automatically into your site.', 'google-site-kit' ) }</p>
				<div className="googlesitekit-setup-module__inputs">
					<Select
						enhanced
						name="accounts"
						label={ __( 'Account', 'google-site-kit' ) }
						value={ selectedAccount }
						onEnhancedChange={ this.handleAccountChange }
						outlined
					>
						{ accounts.map( ( account ) =>
							<Option
								key={ account.accountId }
								value={ account.accountId }>
								{ account.name }
							</Option> ) }
					</Select>

					{ containersLoading ? ( <ProgressBar small /> ) : (
						<Select
							enhanced
							name="containers"
							label={ __( 'Container', 'google-site-kit' ) }
							value={ selectedContainer }
							onEnhancedChange={ this.handleContainerChange }
							outlined
						>
							{ containers.map( ( container ) =>
								<Option
									key={ container.containerId }
									value={ container.publicId }>
									{
										0 === container.publicId ?
											__( 'Set up a new container', 'google-site-kit' ) :
											container.publicId
									}
								</Option> ) }
						</Select>
					) }
				</div>

				{ /*Render the continue and skip button.*/ }
				{
					! onSettingsPage &&
					<div className="googlesitekit-setup-module__action">
						<Button onClick={ this.handleSubmit }>{ __( 'Confirm & Continue', 'google-site-kit' ) }</Button>
					</div>
				}

			</Fragment>
		);
	}

	/**
	 * Render Error or Notice format depending on the errorCode.
	 */
	renderErrorOrNotice() {
		const {
			errorCode,
			errorMsg,
		} = this.state;

		const {
			onSettingsPage,
		} = this.props;

		if ( 0 === errorMsg.length ) {
			return null;
		}

		const showErrorFormat = onSettingsPage && 'insufficientPermissions' === errorCode ? false : true; // default error format.

		return (
			<div className={ showErrorFormat ? 'googlesitekit-error-text' : '' }>
				<p>{
					showErrorFormat ?

						/* translators: %s: Error message */
						sprintf( __( 'Error: %s', 'google-site-kit' ), errorMsg ) :
						errorMsg
				}</p>
			</div>
		);
	}

	render() {
		const {
			onSettingsPage,
			isEditing,
		} = this.props;

		return (
			<div className="googlesitekit-setup-module googlesitekit-setup-module--tag-manager">
				{
					! onSettingsPage &&
					<Fragment>
						<div className="googlesitekit-setup-module__logo">
							<SvgIcon id="tagmanager" width="33" height="33" />
						</div>
						<h2 className="
							googlesitekit-heading-3
							googlesitekit-setup-module__title
						">
							{ __( 'Tag Manager', 'google-site-kit' ) }
						</h2>
					</Fragment>
				}

				{ this.renderErrorOrNotice() }

				{ isEditing && this.renderAccountDropdownForm() }

				{ ! isEditing && this.renderSettingsInfo() }

			</div>
		);
	}
}

TagmanagerSetup.propTypes = {
	onSettingsPage: PropTypes.bool,
	finishSetup: PropTypes.func,
	isEditing: PropTypes.bool,
};

TagmanagerSetup.defaultProps = {
	onSettingsPage: true,
	isEditing: false,
};

export default TagmanagerSetup;
