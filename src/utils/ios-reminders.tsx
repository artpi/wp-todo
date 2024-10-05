import * as Calendar from 'expo-calendar';
import { Todo, DataState, StoredTodo } from './data-manager';

export function getRemindersCalendars( setData, AsyncStorage ) {
    if( ! Calendar || ! Calendar.getCalendarsAsync ) {
        return;
    }
    Calendar.getCalendarsAsync( Calendar.EntityTypes.REMINDER ).then(
        ( response ) => {
            setData( ( prevData ) => {
                const newData = {
                    ...prevData,
                    reminders_calendars: response,
                };
                AsyncStorage.setItem(
                    'config',
                    JSON.stringify( newData )
                );
                return newData;
            } );
        }
    );
}
export const useRemindersPermissions = Calendar.useRemindersPermissions;

export function pushRemindersToWP( data: DataState, response: StoredTodo[], pushTodoToWP: ( todo: Partial<Todo> ) => Promise<any>, iOSSyncedRemindersLists: { [ key: string ]: string } ) {
    const syncedCalendars = Object.values( iOSSyncedRemindersLists ).filter( ( id ) => id !== 'no' );
    if ( syncedCalendars.length === 0 ) {
        return;
    }
    const reminders_pushed = Calendar.getRemindersAsync(
        syncedCalendars
    ).then( ( reminders ) => {
        const updates: Promise<any>[] = [];
        reminders.forEach( ( reminder ) => {
            const synced_notebook =
                data.taxonomy_terms.find(
                    ( term ) => (
                        iOSSyncedRemindersLists[ term.id ] && iOSSyncedRemindersLists[ term.id ] === reminder.calendarId
                    )
                );
            if ( ! synced_notebook ) {
                // This reminder is not synced.
                return;
            }
            if ( reminder.completed ) {
                // console.log(
                //     'Skipping completed reminder',
                //     reminder
                // );
                return;
            }
            const existing = response.find(
                ( post ) => (
                    post.meta &&
                    post.meta.reminders_id === reminder.id
                )
            );

            if ( ! existing ) {
                // Add the reminder.
                console.log( 'Adding reminder', reminder );
                updates.push(
                    pushTodoToWP( {
                        id: 'new',
                        subject: reminder?.title,
                        done: reminder.completed,
                        terms: [ synced_notebook.id ],
                        meta: {
                            reminders_id: reminder.id,
                        },
                    } )
                );
            }
        } );
        return Promise.all( updates );
    } );
    // Push wp to ios reminders
    reminders_pushed.then( () => {
        const taxonomy_id = data.taxonomies[ data.taxonomy ].rest_base;
        response.forEach( ( todo ) => {
            // Get the first calendar that is synced.
            const terms = todo[ taxonomy_id ]
                .map( ( id ) =>
                    data.taxonomy_terms.find(
                        ( term ) => term.id === id
                    )
                )
                .filter(
                    ( term ) =>
                        term &&
                        iOSSyncedRemindersLists[ term.id ] &&
                        iOSSyncedRemindersLists[ term.id ] !== ''
                )
                .slice( 0, 1 ); // Only one calendar for now.

            // Already exists on the reminders list. Are there any updates?
            if ( todo.meta && todo.meta.reminders_id ) {
                // Already exists.
                Calendar.getReminderAsync(
                    todo.meta.reminders_id
                )
                    .catch( ( err ) => {} )
                    .then( ( reminder ) => {
                        if ( ! reminder || ! reminder.id ) {
                            return;
                        }
                        if (
                            ! terms[0]?.id || ( reminder.calendarId !== iOSSyncedRemindersLists[ terms[0].id ] )
                        ) {
                            // We have to delete and recreate in another list.
                            console.log(
                                'Moving reminder',
                                todo.title.raw,
                                reminder.id,
                                iOSSyncedRemindersLists[ terms[0]?.id ]
                            );
                            const deleted =Calendar.deleteReminderAsync(
                                reminder.id
                            );
                            if ( ! terms[0]?.id ||! iOSSyncedRemindersLists[ terms[0].id ] || iOSSyncedRemindersLists[ terms[0].id ] === 'no' ) {
                                // The new reminder list is not synced.
                                deleted.then( () => pushTodoToWP( {
                                    id: todo.id,
                                    meta: {
                                        reminders_id: null,
                                    },
                                } ) );
                                return;
                            }
                            Calendar.createReminderAsync(
                                iOSSyncedRemindersLists[ terms[0].id ],
                                {
                                    title: todo.title.raw,
                                    completed:
                                        todo.status ===
                                        'trash',
                                    notes: todo.excerpt.raw,
                                }
                            ).then( ( newReminderId ) => pushTodoToWP( {
                                id: todo.id,
                                meta: {
                                    reminders_id: newReminderId,
                                },
                            } ) );
                            return;
                        }
                        const changes: Partial<Calendar.Reminder> = {};
                        if (
                            reminder.title !==
                            todo.title.raw
                        ) {
                            changes.title = todo.title.raw;
                        }
                        if (
                            reminder.notes !==
                            todo.excerpt.raw
                        ) {
                            changes.notes =
                                todo.excerpt.raw;
                        }
                        if (
                            reminder.completed !==
                            ( todo.status === 'trash' )
                        ) {
                            changes.completed =
                                todo.status === 'trash';
                        }
                        if (
                            Object.keys( changes ).length >
                            0
                        ) {
                            console.log(
                                'Reminder changes detected',
                                todo.title.raw,
                                changes
                            );
                            return Calendar.updateReminderAsync(
                                todo.meta.reminders_id,
                                changes
                            );
                        }
                    } );
                return;
            } else if ( terms[0]?.id &&iOSSyncedRemindersLists[ terms[0].id ] && iOSSyncedRemindersLists[ terms[0].id ] !== 'no') {
                // Reminder was created on the WP side elsewhere. Now we need to create it on the iOS side.
                const reminders_list_id = iOSSyncedRemindersLists[ terms[0].id ];
                console.log(
                    'ADDING TO REMINDERS',
                    reminders_list_id
                );
                // Adding reminders to the list.
                Calendar.createReminderAsync(
                    reminders_list_id,
                    {
                        title: todo.title.raw,
                        completed: todo.status === 'trash',
                        notes: todo.excerpt.raw,
                    }
                )
                .catch( ( err ) => {
                    console.log(
                        'Error creating reminder',
                        err
                    );
                } )
                .then( ( reminder_id ) => pushTodoToWP(
                    {
                        id: todo.id,
                        meta: {
                            reminders_id: reminder_id,
                        },
                    }
                ) );
            }
        } );
    } );
}
