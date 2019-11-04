/**
 * AnalyticsSetup component.
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
import data, { TYPE_MODULES } from 'GoogleComponents/data';
import PropTypes from 'prop-types';
import Button from 'GoogleComponents/button';
import ProgressBar from 'GoogleComponents/progress-bar';
import Link from 'GoogleComponents/link';
import Radio from 'GoogleComponents/radio';
import Switch from 'GoogleComponents/switch';
import { Select, Option } from 'SiteKitCore/material-components';
import SvgIcon from 'GoogleUtil/svg-icon';
import {
	sendAnalyticsTrackingEvent,
	getExistingTag,
	toggleConfirmModuleSettings,
} from 'GoogleUtil';

const { __, sprintf } = wp.i18n;
const { Component, Fragment } = wp.element;
const {
	removeFilter,
	addFilter,
} = wp.hooks;

class AnalyticsSetup extends Component {
	constructor( props ) {
		super( props );
		const {
			accountID,
			internalWebPropertyID,
			profileID,
			propertyID,
			useSnippet,
			ampClientIDOptIn,
		} = googlesitekit.modules.analytics.settings;

		this.state = {
			isLoading: true,
			isSaving: false,
			propertiesLoading: false,
			profilesLoading: false,
			useSnippet: useSnippet || false,
			errorCode: false,
			errorMsg: '',
			errorReason: false,
			accounts: [],
			properties: [],
			profiles: [],
			selectedAccount: accountID,
			selectedProperty: propertyID,
			selectedProfile: profileID,
			selectedinternalWebProperty: internalWebPropertyID,
			ampClientIDOptIn,
			existingTag: false,
		};

		this.handleAccountChange = this.handleAccountChange.bind( this );
		this.handlePropertyChange = this.handlePropertyChange.bind( this );
		this.handleProfileChange = this.handleProfileChange.bind( this );
		this.processAccountChange = this.processAccountChange.bind( this );
		this.processPropertyChange = this.processPropertyChange.bind( this );
		this.handleSubmit = this.handleSubmit.bind( this );
		this.handleRadioClick = this.handleRadioClick.bind( this );
		this.handleAMPClientIDSwitch = this.handleAMPClientIDSwitch.bind( this );
		this.handleRefetchAccount = this.handleRefetchAccount.bind( this );
	}

	async componentDidMount() {
		const {
			isOpen,
			onSettingsPage,
		} = this.props;
		this._isMounted = true;

		// If on settings page, only run the rest if the module is "open".
		if ( onSettingsPage && ! isOpen ) {
			return;
		}

		const existingTagProperty = await getExistingTag( 'analytics' );

		if ( existingTagProperty && existingTagProperty.length ) {
			// Verify the user has access to existing tag if found. If no access request will return 403 error and catch err.
			try {
				const existingTagData = await data.get( TYPE_MODULES, 'analytics', 'tag-permission', { tag: existingTagProperty } );
				await this.getAccounts( existingTagData );
			} catch ( err ) {
				this.setState(
					{
						isLoading: false,
						errorCode: err.code,
						errorMsg: err.message,
						errorReason: err.data && err.data.reason ? err.data.reason : false,
					}
				);
			}
		} else {
			await this.getAccounts();
		}

		// Handle save hook from the settings page.
		addFilter( 'googlekit.SettingsConfirmed',
			'googlekit.AnalyticsSettingsConfirmed',
			( chain, module ) => {
				if ( 'analytics' !== module.replace( '-module', '' ) ) {
					return chain;
				}
				const { isEditing } = this.props;
				if ( isEditing ) {
					return this.handleSubmit();
				}
			} );
	}

	componentWillUnmount() {
		this._isMounted = false;

		removeFilter( 'googlekit.SettingsConfirmed', 'googlekit.AnalyticsSettingsConfirmed' );
	}

	componentDidUpdate() {
		this.toggleConfirmChangesButton();
	}

	/**
	 * Toggle confirm changes button disable/enabble depending on the changed settings.
	 */
	toggleConfirmChangesButton() {
		if ( ! this.props.isEditing ) {
			return;
		}

		const settingsMapping = {
			selectedAccount: 'accountID',
			selectedProperty: 'propertyID',
			selectedProfile: 'profileID',
			selectedinternalWebProperty: 'internalWebPropertyID',
			useSnippet: 'useSnippet',
			ampClientIDOptIn: 'ampClientIDOptIn',
		};

		toggleConfirmModuleSettings( 'analytics', settingsMapping, this.state );
	}

	handleAccountChange( index, item ) {
		const { selectedAccount } = this.state;
		const selectValue = item.getAttribute( 'data-value' );

		if ( selectValue === selectedAccount ) {
			return;
		}

		// The selected value is string.
		if ( '0' === selectValue ) {
			this.setState( {
				selectedAccount: selectValue,
				selectedProperty: '-1',
				selectedProfile: '-1',
				properties: [ {
					id: '-1',
					name: __( 'Select an account', 'google-site-kit' ),
				} ],
				profiles: [ {
					id: '-1',
					name: __( 'Select an account', 'google-site-kit' ),
				} ],
			} );
			return;
		}

		this.setState( {
			propertiesLoading: true,
			profilesLoading: true,
			selectedAccount: selectValue,
		} );

		// Track selection.
		sendAnalyticsTrackingEvent( 'analytics_setup', 'account_change', selectValue );

		this.processAccountChange( selectValue );
	}

	handlePropertyChange( index, item ) {
		const { selectedProperty } = this.state;
		const selectValue = item.getAttribute( 'data-value' );

		if ( selectValue === selectedProperty ) {
			return;
		}

		// The selected value is string.
		if ( '0' === selectValue ) {
			this.setState( {
				selectedProperty: selectValue,
				selectedProfile: selectValue,
				profiles: [ {
					id: 0,
					name: __( 'Setup a New Profile', 'google-site-kit' ),
				} ],
			} );
			return;
		}

		this.setState( {
			profilesLoading: true,
			selectedProperty: selectValue,
		} );

		// Track selection.
		sendAnalyticsTrackingEvent( 'analytics_setup', 'property_change', selectValue );

		this.processPropertyChange( selectValue );
	}

	handleProfileChange( index, item ) {
		const selectValue = item.getAttribute( 'data-value' );

		this.setState( {
			selectedProfile: selectValue,
		} );

		// Track selection.
		sendAnalyticsTrackingEvent( 'analytics_setup', 'profile_change', selectValue );
	}

	async getAccounts( existingTagData = false ) {
		let {
			selectedAccount,
			selectedProperty,
			selectedProfile,
			useSnippet,
		} = this.state;
		const {
			isEditing,
			onSettingsPage,
		} = this.props;
		const {
			errorCode,
		} = this.state;
		let newState = {};

		try {
			// Send existing tag data to get account.
			const queryArgs = existingTagData ? {
				existingAccountID: existingTagData.accountId, // Capitalization rule exception: `accountId` is a property of an API returned value.
				existingPropertyID: existingTagData.propertyId, // Capitalization rule exception: `propertyId` is a property of an API returned value.
			} : {};

			const responseData = await data.get( TYPE_MODULES, 'analytics', 'accounts-properties-profiles', queryArgs );
			if ( 0 === responseData.accounts.length ) {
				newState = {
					...newState,
					errorCode: 'no_account',
					errorReason: 'noAccount',
				};

				// clear the cache.
				data.invalidateCacheGroup( TYPE_MODULES, 'analytics', 'accounts-properties-profiles' );
			} else if ( ! selectedAccount ) {
				let matchedProperty = null;
				if ( responseData.matchedProperty ) {
					matchedProperty = responseData.matchedProperty;
				}

				if ( matchedProperty ) {
					selectedAccount = matchedProperty.accountId; // Capitalization rule exception: `accountId` is a property of an API returned value.
					selectedProperty = matchedProperty.id;
					const matchedProfile = responseData.profiles.find( ( profile ) => {
						return profile.accountId === selectedAccount; // Capitalization rule exception: `accountId` is a property of an API returned value.
					} );
					if ( matchedProfile ) {
						selectedProfile = matchedProfile.id;
					}
				} else {
					responseData.accounts.unshift( {
						id: 0,
						name: __( 'Select one...', 'google-site-kit' ),
					} );
				}
			} else if ( selectedAccount && ! responseData.accounts.find( ( account ) => account.id === selectedAccount ) ) {
				data.invalidateCacheGroup( TYPE_MODULES, 'analytics', 'accounts-properties-profiles' );

				responseData.accounts.unshift( {
					id: 0,
					name: __( 'Select one...', 'google-site-kit' ),
				} );

				if ( isEditing ) {
					selectedAccount = '0';
					selectedProperty = '-1';
					selectedProfile = '-1';
				}

				newState = {
					...newState,
					errorCode: 'insufficient_permissions',
					errorReason: 'insufficientPermissions',
				};
			}

			const chooseAccount = {
				id: '-1',
				name: __( 'Select an account', 'google-site-kit' ),
			};

			if ( ! this.state.existingTag ) {
				responseData.properties.push( {
					id: 0,
					name: __( 'Setup a New Property', 'google-site-kit' ),
				} );
			}

			responseData.profiles.push( {
				id: 0,
				name: __( 'Setup a New Profile', 'google-site-kit' ),
			} );

			// Ensure snippet is inserted while setting up the module unless there is an existing tag.
			if ( ! onSettingsPage ) {
				useSnippet = existingTagData ? false : true;
			}

			newState = {
				...newState,
				isLoading: false,
				accounts: responseData.accounts,
				errorCode: errorCode || newState.errorCode,
				selectedAccount,
				selectedProperty,
				selectedProfile,
				properties: [ chooseAccount ],
				profiles: [ chooseAccount ],
				existingTag: existingTagData ? existingTagData.propertyID : false,
				useSnippet,
			};

			if ( selectedAccount && '0' !== selectedAccount ) {
				newState = Object.assign( newState, {
					properties: responseData.properties,
					profiles: responseData.profiles,
					selectedinternalWebProperty: ( responseData.properties[ 0 ] ) ? responseData.properties[ 0 ].internalWebPropertyID : 0,
				} );
			}
		} catch ( err ) {
			newState = {
				isLoading: false,
				errorCode: err.code,
				errorMsg: err.message,
				errorReason: err.data && err.data.reason ? err.data.reason : false,
			};
		}

		return new Promise( ( resolve ) => {
			if ( this._isMounted ) {
				this.setState( newState, resolve );
			} else {
				resolve();
			}
		} );
	}

	async processAccountChange( selectValue ) {
		try {
			const queryArgs = {
				accountID: selectValue,
			};

			const responseData = await data.get( TYPE_MODULES, 'analytics', 'properties-profiles', queryArgs );

			const chooseProperty = {
				id: 0,
				name: __( 'Setup a New Property', 'google-site-kit' ),
			};
			responseData.properties.push( chooseProperty );
			const chooseProfile = {
				id: 0,
				name: __( 'Setup a New Profile', 'google-site-kit' ),
			};
			responseData.profiles.push( chooseProfile );

			this.setState( {
				propertiesLoading: false,
				profilesLoading: false,
				properties: responseData.properties,
				profiles: responseData.profiles,
				selectedAccount: selectValue,
				selectedProperty: responseData.properties[ 0 ].id,
				selectedinternalWebProperty: responseData.properties[ 0 ].internalWebPropertyID,
				selectedProfile: responseData.profiles[ 0 ].id,
				errorCode: false,
			} );
		} catch ( err ) {
			this.setState( {
				errorCode: err.code,
				errorMsg: err.message,
			} );
		}
	}

	async processPropertyChange( selectValue ) {
		const { selectedAccount } = this.state;

		try {
			const queryArgs = {
				accountID: selectedAccount,
				propertyID: selectValue,
			};

			const responseData = await data.get( TYPE_MODULES, 'analytics', 'profiles', queryArgs );

			this.setState( {
				profilesLoading: false,
				profiles: responseData,
				selectedProperty: selectValue,
				selectedinternalWebProperty: responseData[ 0 ].internalWebPropertyID,
				selectedProfile: responseData[ 0 ].id,
				errorCode: false,
			} );
		} catch ( err ) {
			this.setState( {
				errorCode: err.code,
				errorMsg: err.message,
			} );
		}
	}

	async handleSubmit( e ) {
		if ( e ) {
			e.preventDefault();
		}

		if ( ! this.state.selectedAccount || '-1' === this.state.selectedAccount ) {
			return;
		}

		const {
			selectedAccount,
			selectedProperty,
			selectedProfile,
			useSnippet,
			selectedinternalWebProperty,
			accounts,
			properties,
			profiles,
			ampClientIDOptIn,
		} = this.state;

		this.setState( {
			isSaving: true,
		} );

		const {
			finishSetup,
		} = this.props;

		// Ensure that values of `0` are not treated as false-y, causing an error to
		// appear.
		// See: https://github.com/google/site-kit-wp/issues/398#issuecomment-540024321
		const profileID = selectedProfile || ( profiles[ 0 ].id || profiles[ 0 ].id === 0 ? profiles[ 0 ].id.toString() : null );
		const propertyID = selectedProperty || ( properties[ 0 ].id || properties[ 0 ].id === 0 ? properties[ 0 ].id.toString() : null );
		let internalWebPropertyID;
		if ( propertyID === '0' ) {
			internalWebPropertyID = '0';
		} else {
			// Capitalization rule exception: `internalWebPropertyId` is a property of an API returned value.
			internalWebPropertyID = selectedinternalWebProperty || ( properties[ 0 ].internalWebPropertyId || properties[ 0 ].internalWebPropertyId === 0 ? properties[ 0 ].internalWebPropertyId.toString() : null );
		}

		const analyticAccount = {
			accountID: selectedAccount || accounts[ 0 ].id || null,
			profileID,
			propertyID,
			internalWebPropertyID,
			useSnippet: useSnippet || false,
			ampClientIDOptIn: ampClientIDOptIn || false,
		};

		try {
			const response = await data.set( TYPE_MODULES, 'analytics', 'settings', analyticAccount );

			data.invalidateCacheGroup( TYPE_MODULES, 'analytics', 'accounts-properties-profiles' );
			await this.getAccounts();

			googlesitekit.modules.analytics.settings.accountID = response.accountID;
			googlesitekit.modules.analytics.settings.profileID = response.profileID;
			googlesitekit.modules.analytics.settings.propertyID = response.propertyID;
			googlesitekit.modules.analytics.settings.internalWebPropertyID = response.internalWebPropertyID;
			googlesitekit.modules.analytics.settings.useSnippet = response.useSnippet;
			googlesitekit.modules.analytics.settings.ampClientIDOptIn = response.ampClientIDOptIn;

			// Track event.
			sendAnalyticsTrackingEvent( 'analytics_setup', 'analytics_configured' );

			if ( finishSetup ) {
				finishSetup();
			}

			if ( this._isMounted ) {
				this.setState( {
					isSaving: false,
					selectedAccount: response.accountID,
					selectedProfile: response.profileID,
					selectedProperty: response.propertyID,
					selectedinternalWebProperty: response.internalWebPropertyID,
				} );
			}
		} catch ( err ) {
			this.setState( {
				isSaving: false,
				errorCode: err.code,
				errorMsg: err.message,
			} );
		}
	}

	static createNewAccount( e ) {
		e.preventDefault();
		sendAnalyticsTrackingEvent( 'analytics_setup', 'new_analytics_account' );

		window.open( 'https://analytics.google.com/analytics/web/?#/provision/SignUp', '_blank' );
	}

	handleRadioClick( e ) {
		const value = e.target.value;
		const useSnippet = ( '1' === value );
		this.setState( {
			useSnippet,
		} );

		sendAnalyticsTrackingEvent( 'analytics_setup', useSnippet ? 'analytics_tag_enabled' : 'analytics_tag_disabled' );
	}

	handleAMPClientIDSwitch( ) {
		this.setState( {
			ampClientIDOptIn: ! this.state.ampClientIDOptIn,
		} );
	}

	handleRefetchAccount() {
		this.setState( {
			isLoading: true,
			errorCode: false,
			errorMsg: '',
		} );

		this.getAccounts();
	}

	renderAutoInsertSnippetForm() {
		const {
			useSnippet,
			isSaving,
			ampClientIDOptIn,
			existingTag,
		} = this.state;

		const {
			isEditing,
			onSettingsPage,
		} = this.props;
		const disabled = ! isEditing;
		const { ampEnabled } = window.googlesitekit.admin;
		const useSnippetSettings = window.googlesitekit.modules.analytics.settings.useSnippet;

		return (
			<div className="googlesitekit-setup-module__inputs googlesitekit-setup-module__inputs--multiline">
				{
					( isEditing || isSaving ) &&
						<Fragment>
							{ onSettingsPage &&
								<Fragment>
									{ ! useSnippetSettings && ! existingTag &&
										<Fragment>
											<p className="googlesitekit-setup-module__text--no-margin">{ __( 'Currently there is no Analytics snippet placed on your site, so no stats are being gathered. Would you like Site Kit to insert the Analytics snippet? You can change this setting later.', 'google-site-kit' ) }</p>
										</Fragment>
									}
									{ useSnippetSettings &&
										<p className="googlesitekit-setup-module__text--no-margin">{ __( 'Do you want to remove the Analytics snippet inserted by Site Kit?', 'google-site-kit' ) }</p>
									}
								</Fragment>
							}
							{ onSettingsPage && ! existingTag && ! useSnippet && useSnippetSettings &&
								<p>{ __( 'If the code snippet is removed, you will no longer be able to gather Analytics insights about your site.', 'google-site-kit' ) }</p>
							}
						</Fragment>
				}
				{ onSettingsPage &&
					<Fragment>
						{ existingTag &&
							<p>{ __( 'Placing two tags at the same time is not recommended.', 'google-site-kit' ) }</p>
						}
						<Radio
							onClick={ this.handleRadioClick }
							id="useSnippetTrue"
							name="useSnippet"
							value="1"
							checked={ useSnippet }
							disabled={ disabled }
						>
							{ ! useSnippetSettings ? __( 'Insert snippet', 'google-site-kit' ) : __( 'Not at this time', 'google-site-kit' ) }
						</Radio>
						<Radio
							onClick={ this.handleRadioClick }
							id="useSnippetFalse"
							name="useSnippet"
							value="0"
							checked={ ! useSnippet }
							disabled={ disabled }
						>
							{ useSnippetSettings ? __( 'Remove snippet', 'google-site-kit' ) : __( 'Not at this time', 'google-site-kit' ) }
						</Radio>
					</Fragment>
				}
				{ useSnippet && ampEnabled &&
					<div className="googlesitekit-setup-module__input">
						<Switch
							id="ampClientIDOptIn"
							label={ __( 'Opt in AMP Client ID', 'google-site-kit' ) }
							onClick={ this.handleAMPClientIDSwitch }
							checked={ ampClientIDOptIn }
							hideLabel={ false }
						/>
						<p>
							{ ampClientIDOptIn ?
								__( 'Sessions will be combined across AMP/non-AMP pages.', 'google-site-kit' ) + ' ' :
								__( 'Sessions will be tracked separately between AMP/non-AMP pages.', 'google-site-kit' ) + ' '
							}
							<Link href="https://support.google.com/analytics/answer/7486764" external inherit>{ __( 'Learn more', 'google-site-kit' ) }</Link>
						</p>
					</div>
				}
			</div>
		);
	}

	accountsDropdown() {
		const {
			accounts,
			selectedAccount,
			existingTag,
		} = this.state;

		const {
			isEditing,
		} = this.props;

		let disabled = ! isEditing;
		if ( existingTag && selectedAccount ) {
			disabled = true;
		}

		return (
			<Select
				enhanced
				name="accounts"
				value={ selectedAccount || '0' }
				onEnhancedChange={ this.handleAccountChange }
				label={ __( 'Account', 'google-site-kit' ) }
				disabled={ disabled }
				outlined
			>
				{ accounts.map( ( account, id ) =>
					<Option
						key={ id }
						value={ account.id }
					>
						{ account.name }
					</Option> ) }
			</Select>
		);
	}

	hasAccessToExistingTagProperty() {
		const {
			existingTag,
			selectedProfile,
		} = this.state;

		return existingTag && selectedProfile;
	}

	renderForm() {
		const {
			isLoading,
			propertiesLoading,
			profilesLoading,
			accounts,
			properties,
			profiles,
			selectedAccount,
			selectedProperty,
			selectedProfile,
			useSnippet,
			existingTag,
			errorCode,
		} = this.state;

		const {
			onSettingsPage,
			isEditing,
		} = this.props;
		const disabledProfile = ! isEditing;

		let disabledProperty = ! isEditing;
		if ( existingTag && selectedProperty ) {
			disabledProperty = true;
		}

		const { setupComplete } = googlesitekit.modules.analytics;

		if ( isLoading ) {
			return <ProgressBar />;
		}

		if ( 'google_analytics_existing_tag_permission' === errorCode ) {
			return null;
		}

		if ( 0 >= accounts.length ) {
			if ( ! isEditing ) {
				return __( 'No account found.', 'google-site-kit' );
			}
			if ( ! setupComplete || isEditing ) {
				return (
					<Fragment>
						<div className="googlesitekit-setup-module__action">
							<Button onClick={ AnalyticsSetup.createNewAccount }>{ __( 'Create an account', 'google-site-kit' ) }</Button>

							<div className="googlesitekit-setup-module__sub-action">
								<Link onClick={ this.handleRefetchAccount }>{ __( 'Re-fetch My Account', 'google-site-kit' ) }</Link>
							</div>
						</div>
					</Fragment>
				);
			}
		}

		if ( ! isEditing ) {
			let tagStateMessage = useSnippet ? __( 'Snippet is inserted', 'google-site-kit' ) : __( 'Snippet is not inserted', 'google-site-kit' );
			if ( existingTag ) {
				tagStateMessage = __( 'Inserted by another plugin or theme', 'google-site-kit' );
			}

			return (
				<Fragment>
					<div className="googlesitekit-settings-module__meta-items">
						<div className="googlesitekit-settings-module__meta-item">
							<p className="googlesitekit-settings-module__meta-item-type">
								{ __( 'Account', 'google-site-kit' ) }
							</p>
							<h5 className="googlesitekit-settings-module__meta-item-data">
								{ selectedAccount || accounts[ 0 ].name || false }
							</h5>
						</div>
						<div className="googlesitekit-settings-module__meta-item">
							<p className="googlesitekit-settings-module__meta-item-type">
								{ __( 'Property', 'google-site-kit' ) }
							</p>
							<h5 className="googlesitekit-settings-module__meta-item-data">
								{ selectedProperty || properties[ 0 ].name || false }
							</h5>
						</div>
						<div className="googlesitekit-settings-module__meta-item">
							<p className="googlesitekit-settings-module__meta-item-type">
								{ __( 'View', 'google-site-kit' ) }
							</p>
							<h5 className="googlesitekit-settings-module__meta-item-data">
								{ selectedProfile || profiles[ 0 ].name || false }
							</h5>
						</div>
					</div>
					<div className="googlesitekit-settings-module__meta-items">
						<div className="
							googlesitekit-settings-module__meta-item
							googlesitekit-settings-module__meta-item--nomargin
						">
							<p className="googlesitekit-settings-module__meta-item-type">
								{ __( 'Analytics Code Snippet', 'google-site-kit' ) }
							</p>
							<h5 className="googlesitekit-settings-module__meta-item-data">
								{ tagStateMessage }
							</h5>
						</div>
					</div>
				</Fragment>
			);
		}

		return (
			<Fragment>
				{ ! onSettingsPage && 0 < accounts.length && ! existingTag &&
					<p>{ __( 'Please select the account information below. You can change this view later in your settings.', 'google-site-kit' ) }</p>
				}
				<div className="googlesitekit-setup-module__inputs">
					{ this.accountsDropdown() }
					{ propertiesLoading ? ( <ProgressBar small /> ) : (
						<Select
							enhanced
							name="properties"
							value={ selectedProperty || selectedProperty === 0 ? selectedProperty.toString() : '-1' }
							onEnhancedChange={ this.handlePropertyChange }
							label={ __( 'Property', 'google-site-kit' ) }
							disabled={ disabledProperty }
							outlined
						>
							{ properties.map( ( property, id ) =>
								<Option
									key={ id }
									value={ property.id }>
									{ property.name }
								</Option> ) }

						</Select>
					) }
					{ profilesLoading ? ( <ProgressBar small /> ) : (
						<Select
							enhanced
							name="profiles"
							value={ selectedProfile || selectedProfile === 0 ? selectedProfile.toString() : '-1' }
							onEnhancedChange={ this.handleProfileChange }
							label={ __( 'View', 'google-site-kit' ) }
							disabled={ disabledProfile }
							outlined
						>
							{ profiles.map( ( profile, id ) =>
								<Option
									key={ id }
									value={ profile.id }>
									{ profile.name }
								</Option> ) }

						</Select>
					) }
				</div>

				{ /*Render the auto snippet toggle form.*/ }
				{ this.renderAutoInsertSnippetForm() }

				{ /*Render the continue and skip button.*/ }
				{
					! onSettingsPage &&
					<div className="googlesitekit-setup-module__action">
						<Button
							disabled={ ! this.state.selectedAccount }
							onClick={ this.handleSubmit }>{ __( 'Configure Analytics', 'google-site-kit' ) }</Button>
					</div>
				}
			</Fragment>
		);
	}

	renderErrorOrNotice() {
		const {
			errorCode,
			errorMsg,
			errorReason,
			accounts,
		} = this.state;

		const {
			onSettingsPage,
		} = this.props;

		if ( ! errorCode ) {
			return null;
		}

		let showErrorFormat = true; // default error message.
		let message = errorMsg;

		switch ( true ) {
			case 'google_analytics_existing_tag_permission' === errorCode:
				showErrorFormat = false;
				break;
			case onSettingsPage && errorCode && 'insufficientPermissions' === errorReason:
				showErrorFormat = false;
				message = __( 'You currently don\'t have access to this Google Analytics account. You can either request access from your team, or remove this Google Analytics snippet and connect to a different account.', 'google-site-kit' );
				break;
			case ! onSettingsPage && 0 === accounts.length:
				showErrorFormat = false;
				message = __( 'Looks like you don\'t have an Analytics account yet. Once you create it, click on "Re-fetch my account" and Site Kit will locate it.', 'google-site-kit' );
				break;
		}

		if ( 0 === message.length ) {
			return null;
		}

		return (
			<div className={ showErrorFormat ? 'googlesitekit-error-text' : '' }>
				<p>{
					showErrorFormat ?

						/* translators: %s: Error message */
						sprintf( __( 'Error: %s', 'google-site-kit' ), message ) :
						message
				}</p>
			</div>
		);
	}

	render() {
		// The description section is hidden when displaying on the settings page.
		const { onSettingsPage } = this.props;
		const {
			existingTag,
		} = this.state;

		if ( ! onSettingsPage ) {
			sendAnalyticsTrackingEvent( 'analytics_setup', 'configure_analytics_screen' );
		}

		return (
			<div className="googlesitekit-setup-module googlesitekit-setup-module--analytics">
				{
					! onSettingsPage &&
						<Fragment>
							<div className="googlesitekit-setup-module__logo">
								<SvgIcon id="analytics" width="33" height="33" />
							</div>
							<h2 className="
								googlesitekit-heading-3
								googlesitekit-setup-module__title
							">
								{ __( 'Analytics', 'google-site-kit' ) }
							</h2>
						</Fragment>
				}

				{ this.hasAccessToExistingTagProperty() && existingTag !== googlesitekit.admin.trackingID &&
					<p>{ sprintf( __( 'An existing analytics tag was found on your site with the id %s. If later on you decide to replace this tag, Site Kit can place the new tag for you. Make sure you remove the old tag first.', 'google-site-kit' ), existingTag ) }</p>
				}

				{ this.renderErrorOrNotice() }

				{ this.renderForm() }
			</div>
		);
	}
}

AnalyticsSetup.propTypes = {
	onSettingsPage: PropTypes.bool,
	finishSetup: PropTypes.func,
	isEditing: PropTypes.bool,
};

AnalyticsSetup.defaultProps = {
	onSettingsPage: true,
	isEditing: false,
};

export default AnalyticsSetup;
