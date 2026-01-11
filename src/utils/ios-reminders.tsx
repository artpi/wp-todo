import * as Calendar from 'expo-calendar';
import { Todo, DataState, StoredTodo } from './data-manager';

export function getRemindersCalendars( setData, AsyncStorage ) {
	if ( ! Calendar || ! Calendar.getCalendarsAsync ) {
		return;
	}
	Calendar.getCalendarsAsync( Calendar.EntityTypes.REMINDER ).then(
		( response ) => {
			setData( ( prevData ) => {
				const newData = {
					...prevData,
					reminders_calendars: response,
				};
				AsyncStorage.setItem( 'config', JSON.stringify( newData ) );
				return newData;
			} );
		}
	);
}
export const useRemindersPermissions = Calendar.useRemindersPermissions;

export function pushRemindersToWP(
	data: DataState,
	response: StoredTodo[],
	pushTodoToWP: ( todo: Partial< Todo > ) => Promise< any >,
	iOSSyncedRemindersLists: { [ key: string ]: string }
): Promise< void > {
	const syncedCalendars = Object.values( iOSSyncedRemindersLists ).filter(
		( id ) => id !== 'no'
	);
	if ( syncedCalendars.length === 0 ) {
		return Promise.resolve();
	}
	// First, push iOS reminders to WP (create new todos for new reminders)
	const reminders_pushed = Calendar.getRemindersAsync(
		syncedCalendars,
		null,
		new Date( 0 ),
		new Date( '2100-01-01' )
	).then( ( reminders ) => {
		const updates: Promise< any >[] = [];
		reminders.forEach( ( reminder ) => {
			const synced_notebook = data.taxonomy_terms.find(
				( term ) =>
					iOSSyncedRemindersLists[ term.id ] &&
					iOSSyncedRemindersLists[ term.id ] === reminder.calendarId
			);
			if ( ! synced_notebook ) {
				// This reminder is not synced.
				return;
			}
			if ( reminder.completed ) {
				// Skip completed reminders
				return;
			}
			const existing = response.find(
				( post ) => post.meta && post.meta.reminders_id === reminder.id
			);

			if ( ! existing ) {
				// Check if we're already creating this reminder in this sync cycle
				const alreadyCreating = response.find(
					( post ) => post.id === 'new_ios_' + reminder.id
				);
				if ( alreadyCreating ) {
					// Already being created in this sync cycle
					return;
				}

				// Add the reminder.
				console.log(
					'Adding reminder from iOS to WP:',
					reminder.title
				);
				const createPromise = pushTodoToWP( {
					id: 'new_ios_' + reminder.id,
					subject: reminder?.title,
					done: reminder.completed,
					terms: [ synced_notebook.id ],
					meta: {
						reminders_id: reminder.id,
					},
					dirty: true,
				} ).then( ( createdTodo ) => {
					// Add the newly created todo to the response array
					// so we don't create duplicates on the next sync
					if ( createdTodo && createdTodo.id ) {
						console.log(
							'New todo created from iOS reminder:',
							createdTodo.id
						);
						response.push( createdTodo );
					}
					return createdTodo;
				} );
				updates.push( createPromise );
			}
		} );
		return Promise.all( updates );
	} );

	// Then, push WP todos to iOS reminders (sync existing todos with iOS)
	return reminders_pushed.then( () => {
		const taxonomy_id = data.taxonomies[ data.taxonomy ].rest_base;
		const wpToIosPromises: Promise< any >[] = [];

		response.forEach( ( todo ) => {
			// Get the first calendar that is synced.
			const terms = todo[ taxonomy_id ]
				.map( ( id ) =>
					data.taxonomy_terms.find( ( term ) => term.id === id )
				)
				.filter(
					( term ) =>
						term &&
						iOSSyncedRemindersLists[ term.id ] &&
						iOSSyncedRemindersLists[ term.id ] !== '' &&
						iOSSyncedRemindersLists[ term.id ] !== 'no'
				)
				.slice( 0, 1 ); // Only one calendar for now.

			// Already exists on the reminders list. Are there any updates?
			if ( todo.meta && todo.meta.reminders_id ) {
				// Already exists - check for updates.
				const updatePromise = Calendar.getReminderAsync(
					todo.meta.reminders_id
				)
					.catch( ( err ) => {
						// Reminder doesn't exist in iOS anymore, clear the meta
						console.log(
							'Reminder not found in iOS, clearing meta:',
							todo.meta.reminders_id
						);
						return null;
					} )
					.then( ( reminder ) => {
						if ( ! reminder || ! reminder.id ) {
							// Clear reminders_id if reminder doesn't exist
							if ( todo.meta.reminders_id ) {
								return pushTodoToWP( {
									id: todo.id,
									meta: {
										reminders_id: null,
									},
								} ).then( ( updated ) => {
									// Update the response array
									if ( updated ) {
										todo.meta = updated.meta || {};
									}
									return;
								} );
							}
							return Promise.resolve();
						}
						if (
							! terms[ 0 ]?.id ||
							reminder.calendarId !==
								iOSSyncedRemindersLists[ terms[ 0 ].id ]
						) {
							// We have to delete and recreate in another list.
							console.log(
								'Moving reminder between lists:',
								todo.title.raw
							);
							return Calendar.deleteReminderAsync(
								reminder.id
							).then( () => {
								if (
									! terms[ 0 ]?.id ||
									! iOSSyncedRemindersLists[
										terms[ 0 ].id
									] ||
									iOSSyncedRemindersLists[ terms[ 0 ].id ] ===
										'no'
								) {
									// The new reminder list is not synced.
									return pushTodoToWP( {
										id: todo.id,
										meta: {
											reminders_id: null,
										},
									} ).then( ( updated ) => {
										if ( updated ) {
											todo.meta = updated.meta || {};
										}
										return;
									} );
								}
								return Calendar.createReminderAsync(
									iOSSyncedRemindersLists[ terms[ 0 ].id ],
									{
										title: todo.title.raw,
										completed: todo.status === 'trash',
										notes: todo.excerpt.raw,
									}
								).then( ( newReminderId ) =>
									pushTodoToWP( {
										id: todo.id,
										meta: {
											reminders_id: newReminderId,
										},
									} ).then( ( updated ) => {
										if ( updated ) {
											todo.meta = updated.meta || {};
										}
										return;
									} )
								);
							} );
						}
						const changes: Partial< Calendar.Reminder > = {};
						if ( reminder.title !== todo.title.raw ) {
							changes.title = todo.title.raw;
						}
						if ( reminder.notes !== todo.excerpt.raw ) {
							changes.notes = todo.excerpt.raw;
						}
						if (
							reminder.completed !==
							( todo.status === 'trash' )
						) {
							changes.completed = todo.status === 'trash';
						}
						if ( Object.keys( changes ).length > 0 ) {
							console.log(
								'Updating reminder in iOS:',
								todo.title.raw,
								changes
							);
							return Calendar.updateReminderAsync(
								todo.meta.reminders_id,
								changes
							).then( () => {} );
						}
						return Promise.resolve();
					} );
				wpToIosPromises.push( updatePromise );
			} else if (
				terms[ 0 ]?.id &&
				iOSSyncedRemindersLists[ terms[ 0 ].id ] &&
				iOSSyncedRemindersLists[ terms[ 0 ].id ] !== 'no'
			) {
				// Reminder was created on the WP side. Create it on iOS.
				const reminders_list_id =
					iOSSyncedRemindersLists[ terms[ 0 ].id ];
				console.log( 'Creating new reminder in iOS:', todo.title.raw );
				const createPromise = Calendar.createReminderAsync(
					reminders_list_id,
					{
						title: todo.title.raw,
						completed: todo.status === 'trash',
						notes: todo.excerpt.raw,
					}
				)
					.catch( ( err ) => {
						console.log( 'Error creating reminder:', err );
						return null;
					} )
					.then( ( reminder_id ) => {
						if ( reminder_id ) {
							return pushTodoToWP( {
								id: todo.id,
								meta: {
									reminders_id: reminder_id,
								},
							} ).then( ( updated ) => {
								// Update the response array
								if ( updated ) {
									todo.meta = updated.meta || {};
								}
							} );
						}
					} );
				wpToIosPromises.push( createPromise );
			}
		} );

		return Promise.all( wpToIosPromises ).then( () => {} );
	} );
}
