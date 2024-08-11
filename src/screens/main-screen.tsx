import React, { useCallback, useEffect, useState } from 'react';
import {
	Icon,
	VStack,
	useColorModeValue,
	Fab,
	FormControl,
	Input,
  Switch,
	Select,
  Text,
} from 'native-base';
import { AntDesign } from '@expo/vector-icons';
import AnimatedColorBox from '../components/animated-color-box';
import TaskList from '../components/task-list';
import Masthead from '../components/masthead';
import NavBar from '../components/navbar';
import { Linking } from 'react-native';
import { getWPAdminUrlForPost, authenticadedFetch } from '../utils/wpapi';
import { useDataManagerContext } from '../utils/data-manager';

export default function MainScreen( { route, navigation } ) {
	const {
		data,
		todos,
		sync,
		saveMappedIosRemindersList,
		handleToggleTaskItem,
		handleChangeTaskItemSubject,
		createEmptyTodo,
    setDefaultView,
    iOSSyncedRemindersLists
	} = useDataManagerContext();

	const [ editingItemId, setEditingItemId ] = useState< string | null >(
		null
	);

	//console.log(data.taxonomy_terms);
	let title = 'All todos';
	let filter = 0;
	let term = null;
  if( ! route.params && data.default_term ) {
    route.params = { term: data.default_term };
  }

	if ( route.params?.term && data && data.taxonomy_terms ) {
		term = data.taxonomy_terms.find(
			( t ) => t.slug === route.params.term
		);
		title = term.name;
		filter = term.id;
	}

	const handleFinishEditingTaskItem = useCallback(
		( _item ) => {
			sync();
			setEditingItemId( null );
		},
		[ todos, sync, data ]
	);
	const handlePressTaskItemLabel = useCallback( ( item ) => {
		setEditingItemId( item.id );
	}, [] );
	const handleRemoveItem = useCallback( ( item ) => {
		Linking.openURL( getWPAdminUrlForPost( data, item.id ) );
	}, [] );

	return (
		<AnimatedColorBox
			flex={ 1 }
			bg={ useColorModeValue( 'warmGray.50', 'primary.900' ) }
			w="full"
		>
			<Masthead
				title={ title }
				image={ require( '../assets/masthead-main.png' ) }
				modal={
					filter && (
						<>
							<FormControl>
								<FormControl.Label>
									{ 'Sync with calendar' }
								</FormControl.Label>
								<Select
									selectedValue={
										iOSSyncedRemindersLists[ term.id ] || 'no'
									}
									minWidth="200"
									accessibilityLabel="Dont sync"
									_selectedItem={ {
										bg: 'gray.300',
									} }
									mt={ 1 }
									onValueChange={ ( value ) => {
										saveMappedIosRemindersList(
											term,
											value
										);
									} }
								>
									<Select.Item
										label={ "Don't Sync" }
										value={ 'no' }
									/>
									{ data.reminders_calendars &&
										data.reminders_calendars.map(
											( calendar ) => (
												<Select.Item
													label={ calendar.title }
													value={ calendar.id }
												/>
											)
										) }
								</Select>
                <FormControl.Label>
                  <Switch size="sm" isChecked={ data.default_term === route.params.term } onToggle={ ( newData ) => setDefaultView( newData ? route.params.term : null ) } colorScheme="blue" />
                  <Text>Default View</Text>
                </FormControl.Label>
                
							</FormControl>
						</>
					)
				}
			>
				<NavBar />
			</Masthead>
			<VStack
				flex={ 1 }
				space={ 1 }
				bg={ useColorModeValue( 'warmGray.50', 'primary.900' ) }
				mt="-20px"
				borderTopLeftRadius="20px"
				borderTopRightRadius="20px"
				pt="20px"
			>
				<TaskList
					navigation={ navigation }
					filter={ filter }
					onToggleItem={ handleToggleTaskItem }
					onChangeSubject={ handleChangeTaskItemSubject }
					onFinishEditing={ handleFinishEditingTaskItem }
					onPressLabel={ handlePressTaskItemLabel }
					onRemoveItem={ handleRemoveItem }
					editingItemId={ editingItemId }
				/>
			</VStack>
			<Fab
				position="absolute"
				renderInPortal={ false }
				size="sm"
				icon={
					<Icon
						color="white"
						as={ <AntDesign name="plus" /> }
						size="sm"
					/>
				}
				colorScheme={ useColorModeValue( 'blue', 'darkBlue' ) }
				bg={ useColorModeValue( 'blue.500', 'blue.400' ) }
				onPress={ () => {
					const id = createEmptyTodo( filter );
					setEditingItemId( id );
				} }
			/>
		</AnimatedColorBox>
	);
}
