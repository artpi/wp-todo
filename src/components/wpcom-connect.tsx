import { useEffect } from 'react';
import { useDataManagerContext } from '../utils/data-manager';
import {
	useAuthRequest,
	ResponseType,
	makeRedirectUri,
} from 'expo-auth-session';
import { Button, Heading } from 'native-base';
import { FontAwesome5 } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

export default function WpcomConnect( { wpcomData }: { wpcomData: any } ) {
	const { setWpcomToken, connectWP } = useDataManagerContext();
	const [ request, response, promptAsync ] = useAuthRequest(
		{
			clientId: '106439',
			responseType: ResponseType.Token,
			redirectUri: makeRedirectUri( {
				scheme: 'wptodo',
				path: 'wpcom-connect',
			} ),
			extraParams: {
				blog: wpcomData.ID,
			},
		},
		{
			authorizationEndpoint:
				'https://public-api.wordpress.com/oauth2/authorize',
			tokenEndpoint: 'https://public-api.wordpress.com/oauth2/token',
		}
	);
	WebBrowser.maybeCompleteAuthSession();
	console.log( 'wpcomData', request );
	useEffect( () => {
		console.log( 'Response', response );
		if ( response?.type === 'success' ) {
			const { access_token } = response.params;
			console.log( 'Access Token:', access_token );
			setWpcomToken( access_token );
			connectWP( access_token, wpcomData );
		}
	}, [ response ] );
	return (
		<>
			<Heading p={ 6 } size="m">
				WordPress.com site detected. Please chose your site while
				connecting on WordPress.com.
			</Heading>
			<Button
				colorScheme="secondary"
				margin={ '10%' }
				size="md"
				borderRadius="full"
				marginLeft={ '6' }
				marginRight={ '6' }
				leftIcon={
					<FontAwesome5
						name="wordpress-simple"
						size={ 24 }
						color={ 'white' }
						opacity={ 0.5 }
					/>
				}
				onPress={ () => promptAsync() }
			>
				{ `Connect to ${ wpcomData.name }` }
			</Button>
		</>
	);
}
