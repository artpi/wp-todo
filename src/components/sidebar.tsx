import React, { useCallback, useState } from 'react';
import {
	Box,
	HStack,
	VStack,
	ScrollView,
	Center,
	Avatar,
	Heading,
	IconButton,
	useColorModeValue,
	Link,
	Text,
	Switch,
	Badge,
	Divider,
} from 'native-base';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import AnimatedColorBox from './animated-color-box';
import ThemeToggle from './theme-toggle';
import { Feather } from '@expo/vector-icons';
import MenuButton from './menu-button';
import * as Linking from 'expo-linking';
import { getWPAdminUrlForCPT } from '../utils/wpapi';
import { useDataManagerContext } from '../utils/data-manager';

function countTodos( todos, taxonomy ) {
	return todos.filter( ( t ) =>
		t.terms
			? t.terms.indexOf( taxonomy.id ) !== -1
			: []
	).length;
}

function compactTerms( terms, todos ) {
	const indexes = {};
	const parents = [];
	terms.forEach( ( t ) => {
		t.children = [];
		t.todoCount = countTodos( todos, t );
		t.totalChildrenCount = t.todoCount;
		indexes[ t.id ] = t;
	} );
	terms.forEach( ( t ) => {
		if ( t.parent && t.parent > 0 && indexes[ t.parent ] ) {
			indexes[ t.parent ].children.push( t );
			indexes[ t.parent ].totalChildrenCount += t.todoCount;
		} else {
			parents.push( t );
		}
	} );
	return parents;
}

const Term = ( { taxonomy, showEmpty, state, navigation, icon, indent = 0 } ) => {
	if ( ! icon ) {
		icon = 'check-circle';
	}
	return (
		<>
		<MenuButton
			indent={ indent > 1 ? ( indent - 1 ) * 4: 0 }
			active={
				state.routes[ state.index ]
					.params &&
				state.routes[ state.index ].params
					?.term === taxonomy.slug
			}
			onPress={ () => {
				navigation.navigate( 'Main', {
					term: taxonomy.slug,
				} );
			} }
			icon={ indent === 0 ? icon : null }
			key={ taxonomy.slug }
			justifyContent={ 'space-between' }
			endIcon={
				<Badge
					colorScheme="default"
					rounded="full"
					variant="solid"
					alignSelf="flex-end"
				>
					{ taxonomy.todoCount }
				</Badge>
			}
		>
			{ taxonomy.name }
		</MenuButton>
		{ taxonomy.children && taxonomy.children.filter( ( t ) => ( showEmpty || t.totalChildrenCount > 0 ) ).map( ( t ) => ( <Term key={ t.slug } showEmpty={ showEmpty } taxonomy={ t } state={ state } navigation={ navigation } indent={ indent + 1 } /> ) ) }
		</>
	);
}

const Sidebar = ( props: DrawerContentComponentProps ) => {
	const { state, navigation } = props;
	const { data, logOut, wpURL, todos } = useDataManagerContext();
	const currentRoute = state.routeNames[ state.index ];

	const [ showEmpty, setShowEmpty ] = useState( false );

	const handlePressBackButton = useCallback( () => {
		navigation.closeDrawer();
	}, [ navigation ] );
	const handlePressMenuMain = useCallback( () => {
		navigation.navigate( 'Main', { term: null } );
	}, [ navigation ] );
	const handlePressMenuAbout = useCallback( () => {
		navigation.navigate( 'About' );
	}, [ navigation ] );
	const starred = Object.keys( data.taxonomy_terms ).length ? data.taxonomy_terms.filter( ( t ) => ( t.meta && t.meta.flag === 'star' ) ) : [];
	const terms = Object.keys( data.taxonomy_terms ).length ? compactTerms( data.taxonomy_terms, todos ) : [];

	return (
		<AnimatedColorBox
			safeArea
			flex={ 1 }
			bg={ useColorModeValue( 'blue.50', 'darkBlue.800' ) }
			p={ 7 }
		>
			<ScrollView>
				<VStack flex={ 1 } space={ 2 }>
					<HStack justifyContent="flex-end">
						<IconButton
							onPress={ handlePressBackButton }
							borderRadius={ 100 }
							variant="outline"
							borderColor={ useColorModeValue(
								'blue.300',
								'darkBlue.700'
							) }
							_icon={ {
								as: Feather,
								name: 'chevron-left',
								size: 6,
								color: useColorModeValue(
									'blue.800',
									'darkBlue.700'
								),
							} }
						/>
					</HStack>
					<Avatar
						source={ {
							uri: data.gravatar,
						} }
						size="xl"
						borderRadius={ 100 }
						mb={ 6 }
						borderColor="secondary.500"
						borderWidth={ 3 }
					/>
					<Heading mb={ 4 } size="xl">
						{ '@' + data.username }
					</Heading>
					<Heading mb={ 4 } size="l">
						{ data.site_title }
					</Heading>
					{
						starred.map( ( t ) => ( <Term key={ 'starred-' + t.slug } showEmpty={ true } taxonomy={ t } icon="star" state={ state } navigation={ navigation } /> ) )
					}
					<MenuButton
						active={
							currentRoute === 'Main' &&
							! state.routes[ state.index ].params
						}
						onPress={ handlePressMenuMain }
						icon="inbox"
						endIcon={
							<Badge
								colorScheme="default"
								rounded="full"
								variant="solid"
								alignSelf="flex-end"
							>
								{ todos.length }
							</Badge>
						}
					>
						All Tasks
					</MenuButton>
					{ <Divider/>}
					{ Object.keys( data.taxonomy_terms ).length &&
						terms
							.filter( ( t ) => ( showEmpty || t.totalChildrenCount > 0 ) )
							.map( ( t ) => ( <Term key={ t.slug } showEmpty={ showEmpty } taxonomy={ t } state={ state } navigation={ navigation } /> ) )
					}
					<MenuButton
						active={ false }
						icon="external-link"
						onPress={ () => {
							Linking.openURL(
								getWPAdminUrlForCPT( wpURL, data.post_type )
							);
						} }
					>
						Manage on WP
					</MenuButton>
					<MenuButton
						active={ currentRoute === 'About' }
						onPress={ handlePressMenuAbout }
						icon="info"
					>
						About
					</MenuButton>
					<MenuButton
						active={ false }
						onPress={ () => logOut() }
						icon="log-out"
					>
						Log Out
					</MenuButton>
					<Center>
						<HStack
							space={ 2 }
							alignItems="center"
							style={ { marginBottom: 16 } }
						>
							<Text>Hide Empty</Text>
							<Switch
								isChecked={ showEmpty }
								onToggle={ () => setShowEmpty( ! showEmpty ) }
							></Switch>
							<Text>Show Empty</Text>
						</HStack>
						<ThemeToggle />
					</Center>
				</VStack>
			</ScrollView>
		</AnimatedColorBox>
	);
};

export default Sidebar;
