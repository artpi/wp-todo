import {
	useState,
	useEffect,
	useCallback,
	useContext,
	createContext,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
	authenticadedFetch,
	getURLForCPT,
	normalizeUrl,
    getPagePromise,
	getLinkToEndpoint
} from './wpapi';
import { Platform } from 'react-native';
import shortid from 'shortid';
import { getRemindersCalendars, pushRemindersToWP, useRemindersPermissions } from './ios-reminders';

export interface StoredTodo{
    title: {
        raw: string;
    };
    excerpt: {
        raw: string;
    };
    status: 'publish' | 'private' | 'trash';
    id: number;
    meta: Record< string, any >;
}

export interface DataState {
	connected: boolean;
	loggedin: boolean;
	site_title: string;
	site_home: string;
	site_icon_url: string;
	post_types: any[];
	taxonomies: Record< string, any >;
	post_type: string;
	taxonomy: string;
	taxonomy_terms: Record< string, any >;
	username: string;
	gravatar: string;
	reminders_calendars: any[];
    default_term: string | null;
}

export interface Todo {
	id: string | number;
	subject: string;
	done: boolean;
	deleted?: boolean;
	note?: string;
	dirty: boolean;
	terms?: number[];
    meta?: Record< string, any >;
}

function getPayload( todo: Partial<Todo>, taxonomy: string ) {
    const newData: Record< string, any > = {};
    if ( todo.hasOwnProperty( 'subject' ) ) {
        newData.title = todo.subject;
    }
    if ( todo.hasOwnProperty( 'done' ) ) {
        newData.status = todo.done ? 'trash' : 'private';
    }
    if ( todo.hasOwnProperty( 'meta' ) ) {
        newData.meta = todo.meta;
    }
    if ( todo.hasOwnProperty( 'terms' ) ) {
        newData[ taxonomy ] = todo.terms;
    }
    return newData;
}

const initialData: DataState = {
	connected: false,
	loggedin: false,
	site_title: '',
	site_home: '',
	site_icon_url: '',
	post_types: [],
	taxonomies: {},
	post_type: '',
	taxonomy: '',
	taxonomy_terms: {},
	username: '',
	gravatar: '',
	reminders_calendars: [],
    default_term: null,
};

interface DataManager {
    loading: boolean;
	data: DataState;
	setData: React.Dispatch< React.SetStateAction< DataState > >;
	todos: Todo[];
	setTodos: React.Dispatch< React.SetStateAction< Todo[] > >;
	refreshing: boolean;
	wpURL: string;
	setWPURL: React.Dispatch< React.SetStateAction< string > >;
	setLogin: React.Dispatch< React.SetStateAction< string > >;
	setPass: React.Dispatch< React.SetStateAction< string > >;
	sync: () => void;
	logOut: () => void;
	connecting: boolean;
	connectingError: string;
	setConnectingError: React.Dispatch< React.SetStateAction< string > >;
	login: string;
	pass: string;
	posPlugin: number;
	setPosPlugin: React.Dispatch< React.SetStateAction< number > >;
	connectWP: () => void;
	handleToggleTaskItem: ( item: Todo ) => void;
	handleChangeTaskItemSubject: ( item: Todo, newSubject: string ) => void;
	createEmptyTodo: ( filter: number ) => string;
	saveMappedIosRemindersList: ( term: any, value: any ) => void;
    iOSSyncedRemindersLists: { [ key: string ]: string };
    setDefaultView: ( view: string | null ) => void;
	setWpcomToken: ( token: string ) => void;
}

/**
 * This is the main sync function.
 * @param cachedData 
 * @param data 
 * @param login 
 * @param pass 
 * @param wpcomToken 
 * @param setData 
 * @param setTodos 
 * @param setRefreshing 
 * @param pushTodoToWP 
 * @returns 
 */
async function syncData( cachedData: Todo[], data: DataState, login: string, pass: string, wpcomToken: string, setData: React.Dispatch< React.SetStateAction< DataState > >, setTodos: React.Dispatch< React.SetStateAction< Todo[] > >, setRefreshing: React.Dispatch< React.SetStateAction< boolean > >, pushTodoToWP: ( todo: Partial<Todo> ) => Promise< any >, iOSSyncedRemindersLists: { [ key: string ]: string } ) {
    const url = getURLForCPT( data.post_types, data.post_type );

    if ( ! data.connected || ! url ) {
        console.warn( 'Bailing on sync, not connected' );
        return;
    }
    // Sync step 1: Get all the "dirty" todos and sync them to the server.
    let updatePromises: Promise< any >[] = [];
    if ( cachedData ) {
        const dataToSync = cachedData
            .filter( ( todo ) => todo.dirty )
            .filter( ( todo ) => todo.subject.length > 0 );
        console.log( 'Trigggering sync', data );
        updatePromises = dataToSync.map( pushTodoToWP );
    }

    // Step 2: Once all the todos are synced, we can pull the data from the server.
    Promise.all( updatePromises ).then( ( responses ) => {
        console.log( 'Synced Data', JSON.stringify( responses ) );
        setRefreshing( true );
        // Pull taxonomies.
		if ( data.taxonomy ) {
			const taxonomyUrl = new URL( data.taxonomies[data.taxonomy]._links['wp:items'][0].href );
			taxonomyUrl.searchParams.set( 'per_page', '100' ); // TODO change this to pull all
			authenticadedFetch( taxonomyUrl.toString(), {}, login, pass, wpcomToken )
			.then( ( response ) => {
				setData( ( prevData ) => {
					const newData = { ...prevData, taxonomy_terms: response };
					AsyncStorage.setItem( 'config', JSON.stringify( newData ) );
					return newData;
				} );
			} );
		}


        // Update iOS reminders calendars if needed.
        if ( Platform.OS === 'ios' ) {
            getRemindersCalendars( setData, AsyncStorage );
        }
        // Pull latest todos.
        Promise.all( [
            getPagePromise( url, 1, 'publish', [], login, pass, wpcomToken ),
            getPagePromise( url, 1, 'private', [], login, pass, wpcomToken ),
            getPagePromise( url, 1, 'trash', [], login, pass, wpcomToken ),
        ] )
            .then( ( responses ) => {
                const response = responses.flat();
                setTodos(
                    response
                        .filter( ( post: StoredTodo ) => {
                            return post.status !== 'trash';
                        } )
                        .map( ( post: StoredTodo ) => ( {
                            id: post.id,
                            subject: post.title.raw,
                            done: false,
                            dirty: false,
							note: post.excerpt.raw,
							meta: post.meta,
                            terms: data.taxonomy
                                ? post[
                                        data.taxonomies[ data.taxonomy ]
                                            .rest_base
                                  ]
                                : [],
                        } ) )
                );
                // Save new Reminders to todos.
                // push ios reminders to WP
                if (
                    Platform.OS === 'ios' &&
                    data.taxonomy &&
                    data.taxonomies[ data.taxonomy ] &&
                    data.reminders_calendars &&
                    data.reminders_calendars.length > 0
                ) {
                    console.log( 'Pushing reminders to WP' );
                    pushRemindersToWP( data, response, pushTodoToWP, iOSSyncedRemindersLists );
                }

                setRefreshing( false );
            } )
            .catch( ( err ) => {
                console.log( 'ERROR', err );
                setRefreshing( false );
            } );
    } );
}

function createDataManager(): DataManager {
	const [ data, setData ] = useState< DataState >( initialData );
	const [ todos, setTodos ] = useState< Todo[] >( [] );
	const [ wpURL, setWPURL ] = useState< string >( '' );
	const [ login, setLogin ] = useState< string >( '' );
	const [ wpcomToken, setWpcomToken ] = useState< string >( '' );
	const [ pass, setPass ] = useState< string >( '' );
	const [ connecting, setConnecting ] = useState( false );
	const [ posPlugin, setPosPlugin ] = useState( 0 ); // 0 - not detected, 1 - detected, 2 - continuing without it.
	const [ connectingError, setConnectingError ] = useState( '' );
	const [ refreshing, setRefreshing ] = useState< boolean >( false );
    const [ remindersPermission, requestRemindersPermission ] = useRemindersPermissions();
    const [ loading, setLoading ] = useState( true );
    const [ iOSSyncedRemindersLists, setIosSyncedRemindersLists ] = useState( {} );

    useEffect( () => {
		loadStoredData();
	}, [] );

	useEffect( () => {
        if ( Platform.OS === 'ios' && ( ! remindersPermission || ( remindersPermission.status !== 'granted' && remindersPermission.canAskAgain ) ) ) {
            requestRemindersPermission();
        }
	}, [ remindersPermission ] );

	useEffect( () => {
		if ( todos.length > 0 ) {
			AsyncStorage.setItem( 'todos', JSON.stringify( todos ) );
		}
	}, [ todos ] );


    function pushTodoToWP( todo: Partial<Todo> ) {
        const url = getURLForCPT( data.post_types, data.post_type ) || '';
		console.log( 'Pushing todo to WP', todo.id, url );
    	if ( todo.deleted || todo.done ) {
            return authenticadedFetch(
                url + '/' + todo.id,
                {
                    method: 'DELETE',
                },
                login,
                pass,
                wpcomToken
            );
        } else if (
            typeof todo.id === 'string' &&
            todo.id.substring( 0, 3 ) === 'new'
        ) {
            const payload = getPayload( todo, data.taxonomy );
            // If there is inbox
            if ( data.taxonomy && data.taxonomy_terms ) {
                payload[ data.taxonomy ] = [];
                if ( todo.terms && todo.terms.length > 0 ) {
                    payload[ data.taxonomy ] = todo.terms;
                } else {
                    const inbox = data.taxonomy_terms.find(
                        ( term ) => term.slug === 'inbox'
                    );
                    if ( inbox ) {
                        payload[ data.taxonomy ].push( inbox.id );
                    }
                }
            }
            return authenticadedFetch(
                url,
                {
                    method: 'POST',
                    body: JSON.stringify( payload ),
                },
                login,
                pass,
                wpcomToken
            );
        } else if ( todo.id ) {
            // check for changes.
            const newData = getPayload( todo, data.taxonomy );
            console.log( 'Pushing todo to WP', todo.id, JSON.stringify( newData ) );
            return authenticadedFetch(
                url + '/' + todo.id,
                {
                    method: 'POST',
                    body: JSON.stringify( newData ),
                },
                login,
                pass,
                wpcomToken
            );
        }
        return Promise.reject();
    }

	const loadStoredData = async () => {
		const [ url, storedLogin, storedPass, storedWpcomToken, savedConfig, savedTodos, savedIosRemindersLists ] =
			await Promise.all( [
				AsyncStorage.getItem( 'wpurl' ),
				AsyncStorage.getItem( 'wplogin' ),
				AsyncStorage.getItem( 'wppass' ),
				AsyncStorage.getItem( 'wpcomtoken' ),
				AsyncStorage.getItem( 'config' ),
				AsyncStorage.getItem( 'todos' ),
                AsyncStorage.getItem( 'ios_reminders_lists' ),
			] );

			console.log( 'storedData', url, storedLogin, storedPass, storedWpcomToken);
		if ( url ) setWPURL( url );
		if ( storedLogin ) setLogin( storedLogin );
		if ( storedPass ) setPass( storedPass );
		if ( storedWpcomToken ) setWpcomToken( storedWpcomToken );

		let savedConfigObject: DataState = initialData;
		let savedTodosObject: Todo[] = [];

		if ( savedConfig ) {
			savedConfigObject = JSON.parse( savedConfig );
			setData( savedConfigObject );
		}

		if ( savedTodos ) {
			savedTodosObject = JSON.parse( savedTodos );
			setTodos( savedTodosObject );
		}

        if ( savedIosRemindersLists ) {
            setIosSyncedRemindersLists( JSON.parse( savedIosRemindersLists ) );
        }

        setLoading( false );
		if ( url && ( storedWpcomToken || ( storedLogin && storedPass ) ) && savedConfigObject.connected ) {
            syncData( savedTodosObject, savedConfigObject, storedLogin, storedPass, storedWpcomToken, setData, setTodos, setRefreshing, pushTodoToWP, iOSSyncedRemindersLists );
		}
	};

	const handleToggleTaskItem = useCallback( ( item ) => {
		setTodos( ( prevData ) => {
			const newData = [ ...prevData ];
			const index = prevData.indexOf( item );
			newData[ index ] = {
				...item,
				done: ! item.done,
				dirty: true,
			};
			return newData;
		} );
	}, [] );

	const handleChangeTaskItemSubject = useCallback( ( item, newSubject ) => {
		setTodos( ( prevData ) => {
			const newData = [ ...prevData ];
			const index = prevData.indexOf( item );
			newData[ index ] = {
				...item,
				subject: newSubject,
				dirty: true,
			};
			return newData;
		} );
	}, [] );

	const createEmptyTodo = useCallback( ( filter: number ) => {
		const id = 'new_' + shortid.generate();
		const newTodo = {
			id,
			subject: '',
			done: false,
			dirty: true,
			deleted: false,
			terms: [],
		};
		if ( filter && filter > 0 ) {
			newTodo.terms.push( filter );
		}
		setTodos( ( todos ) => [ newTodo, ...todos ] );
		return id;
	}, [] );

	const saveMappedIosRemindersList = useCallback( async ( term, value ) => {
        setIosSyncedRemindersLists( ( prevLists ) => {
            const newLists = { ...prevLists, [ term.id ]: value };
            AsyncStorage.setItem( 'ios_reminders_lists', JSON.stringify( newLists ) );
            return newLists;
        } );
		// console.log( 'Selected', value, JSON.stringify( term ) );
		// authenticadedFetch(
		// 	term._links.self[ 0 ].href,
		// 	{
		// 		method: 'POST',
		// 		body: JSON.stringify( {
		// 			meta: { reminders_calendar: value },
		// 		} ),
		// 	},
		// 	login,
		// 	pass
		// ).then( ( res ) => {
		// 	setData( ( prevData ) => {
		// 		const newTerms = prevData.taxonomy_terms.map( ( t ) =>
		// 			t.id === term.id ? res : t
		// 		);
		// 		const newData = { ...prevData, taxonomy_terms: newTerms };
		// 		return newData;
		// 	} );
		// } );
	}, [] );

    const setDefaultView = useCallback( ( view: string | null ) => setData( oldData => {
        const newData = ( { ...oldData, default_term: view } );
        AsyncStorage.setItem( 'config', JSON.stringify( newData ) );
        return newData;
    } ), [] );

    // This is the main sync function.
	const sync = useCallback( async () => {
        syncData( todos, data, login, pass, wpcomToken, setData, setTodos, setRefreshing, pushTodoToWP, iOSSyncedRemindersLists );
	}, [ data, todos, login, pass, wpcomToken ] );

	const connectWP = useCallback( ( wpcomToken: string, wpcomData ) => {
		const username = login;
		const password = pass;
		const url = wpURL;
		//normalize url, add https if not present
		setConnecting( true );
		let siteData;
		if ( wpcomToken.length > 0 && wpcomData ) {
			console.log('WPCOM Data', wpcomData);
			data[ 'site_home' ] = wpcomData.URL;
			if ( wpcomData.icon ) {
				data[ 'site_icon_url' ] = wpcomData.icon.img;
			}
			data[ 'site_title' ] = wpcomData.name;
			setWPURL( wpcomData.URL );
			setData( ( oldData ) => ( { ...oldData, ...data } ) );
			siteData = fetch( 'https://public-api.wordpress.com/wp/v2/sites/' + wpcomData.ID + '/' ).then( resp => resp.json() );
		} else {
			siteData = fetch( normalizeUrl( url, 'https' ) + `?rest_route=/` )
			.catch( ( err ) =>
				fetch( normalizeUrl( url, 'http' ) + `?rest_route=/` )
			)
			.catch( ( err ) => {
				return Promise.reject( {
					message:
						'I had trouble connecting to REST API on this site.',
				} );
			} )
			.then( ( response ) => response.json() )
			.then( ( response ) => {
				console.log('res', response);
				data[ 'site_home' ] = response.home;
				data[ 'site_icon_url' ] = response.site_icon_url;
				data[ 'site_title' ] = response.name;
				setWPURL( response.url );
				setData( ( oldData ) => ( { ...oldData, ...data } ) );
				return Promise.resolve( response );
			} );
		}
		siteData.then( data => {console.log('ROUTES', data.routes, getLinkToEndpoint( data.routes, '/users/me' ) )});

		siteData
			.then( ( site ) =>
				authenticadedFetch(
					getLinkToEndpoint( site.routes, '/users/me' ),
					{},
					username,
					password,
					wpcomToken
				)
			)
			.then( ( response ) => {
				console.log( 'USER LOGIN', response.name );
				data[ 'username' ] = response.name;
				data[ 'gravatar' ] = response.avatar_urls[ '96' ];

				setData( ( oldData ) => ( { ...oldData, ...data } ) );
				AsyncStorage.setItem( 'wpurl', url );
				AsyncStorage.setItem( 'wplogin', username );
				AsyncStorage.setItem( 'wppass', password );
				AsyncStorage.setItem( 'wpcomtoken', wpcomToken );
				setConnectingError( '' );

				return Promise.resolve( siteData );
			} )
			.then( ( site ) =>
				Promise.all( [
					authenticadedFetch(
						getLinkToEndpoint( site.routes, '/types' ),
						{},
						username,
						password,
						wpcomToken
					),
					authenticadedFetch(
						getLinkToEndpoint( site.routes, '/taxonomies'),
						{},
						username,
						password,
						wpcomToken
					),
				] )
			).then( ( response ) => {
				console.log(
					'POST TYPES',
					JSON.stringify( Object.values( response[ 0 ] ) )
				);
				console.log(
					'POST TAXONMIES',
					JSON.stringify( Object.values( response[ 1 ] ) )
				);
				let newData = {
					post_types: Object.values( response[ 0 ] ),
					taxonomies: response[ 1 ],
				};
				// Personal OS plugin detected
				if (
					response[ 0 ][ 'todo' ] &&
					response[ 1 ][ 'notebook' ]
				) {
					newData[ 'post_type' ] = 'todo';
					newData[ 'taxonomy' ] = 'notebook';
					setPosPlugin( 1 );
				} else {
					newData[ 'post_type' ] = 'post';
				}

				return Promise.resolve( newData );
			} )
			.then( ( newData ) => {
				setData( ( oldData ) => ( { ...oldData, ...newData } ) );
				setConnecting( false );
			} )
			.catch( ( error ) => {
				setConnectingError( error.message );
				setConnecting( false );
			} );
	}, [ login, pass, wpURL, wpcomToken ] );

	const logOut = useCallback( () => {
		setData( initialData );
		setTodos( [] );
		setWPURL( '' );
		setLogin( '' );
		setPass( '' );
		setWpcomToken( '' );
		AsyncStorage.removeItem( 'wpurl' );
		AsyncStorage.removeItem( 'wplogin' );
		AsyncStorage.removeItem( 'wppass' );
		AsyncStorage.removeItem( 'config' );
		AsyncStorage.removeItem( 'todos' );
		AsyncStorage.removeItem( 'ios_reminders_lists' );
		AsyncStorage.removeItem( 'wpcomtoken' );
	}, [] );

	return {
        loading,
		data,
		setData,
		todos,
		setTodos,
		refreshing,
		wpURL,
		setWPURL,
		setLogin,
		setPass,
		sync,
		logOut,
		connecting,
		connectingError,
		setConnectingError,
		login,
		pass,
		posPlugin,
		setPosPlugin,
		connectWP,
		handleToggleTaskItem,
		handleChangeTaskItemSubject,
		createEmptyTodo,
		saveMappedIosRemindersList,
        iOSSyncedRemindersLists,
        setDefaultView,
		setWpcomToken
	};
}

const DataManagerContext = createContext< DataManager | null >( null );

export const DataManagerProvider: React.FC<
	React.PropsWithChildren< {} >
> = ( { children } ) => {
	const dataManager = createDataManager();

	return (
		<DataManagerContext.Provider value={ dataManager }>
			{ children }
		</DataManagerContext.Provider>
	);
};

export const useDataManagerContext = () => {
	const context = useContext( DataManagerContext );
	if ( ! context ) {
		throw new Error(
			'useDataManagerContext must be used within a DataManagerProvider'
		);
	}
	return context;
};
