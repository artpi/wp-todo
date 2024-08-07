import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import { authenticadedFetch, getURLForCPT, getWPAdminUrlForPost, normalizeUrl } from './wpapi';
import shortid from 'shortid'

export interface DataState {
    connected: boolean;
    loggedin: boolean;
    site_title: string;
    site_home: string;
    site_icon_url: string;
    post_types: any[];
    taxonomies: Record<string, any>;
    post_type: string;
    taxonomy: string;
    taxonomy_terms: Record<string, any>;
    username: string;
    gravatar: string;
    reminders_calendars: any[];
  }
  
  export interface Todo {
    id: string | number;
    subject: string;
    done: boolean;
    deleted?: boolean;
    dirty: boolean;
    terms?: number[];
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
}
  

interface DataManager {
  data: DataState;
  setData: React.Dispatch<React.SetStateAction<DataState>>;
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  refreshing: boolean;
  wpURL: string;
  setWPURL: React.Dispatch<React.SetStateAction<string>>;
  setLogin: React.Dispatch<React.SetStateAction<string>>;
  setPass: React.Dispatch<React.SetStateAction<string>>;
  sync: () => void;
  logOut: () => void;
  connecting: boolean;
  connectingError: string;
  setConnectingError: React.Dispatch<React.SetStateAction<string>>;
  login: string;
  pass: string;
  posPlugin: number;
  setPosPlugin: React.Dispatch<React.SetStateAction<number>>;
  connectWP: () => void;
  handleToggleTaskItem: (item: Todo) => void;
  handleChangeTaskItemSubject: (item: Todo, newSubject: string) => void;
  createEmptyTodo: (filter: number) => string;
  saveMappedIosRemindersList: (term: any, value: any) => void;
}

function createDataManager(): DataManager {
  const [data, setData] = useState<DataState>(initialData);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [wpURL, setWPURL] = useState<string>('');
  const [login, setLogin] = useState<string>('');
  const [pass, setPass] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [ posPlugin, setPosPlugin ] = useState( 0 );// 0 - not detected, 1 - detected, 2 - continuing without it.
  const [ connectingError, setConnectingError ] = useState('');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    loadStoredData();
  }, []);

  useEffect(() => {
    if (todos.length > 0) {
      AsyncStorage.setItem('todos', JSON.stringify(todos));
    }
  }, [todos]);

  const loadStoredData = async () => {
    const [url, storedLogin, storedPass, savedConfig, savedTodos] = await Promise.all([
      AsyncStorage.getItem('wpurl'),
      AsyncStorage.getItem('wplogin'),
      AsyncStorage.getItem('wppass'),
      AsyncStorage.getItem('config'),
      AsyncStorage.getItem('todos'),
    ]);

    if (url) setWPURL(url);
    if (storedLogin) setLogin(storedLogin);
    if (storedPass) setPass(storedPass);

    let savedConfigObject: DataState = initialData;
    let savedTodosObject: Todo[] = [];

    if (savedConfig) {
      savedConfigObject = JSON.parse(savedConfig);
      setData( savedConfigObject );
    }

    if (savedTodos) {
      savedTodosObject = JSON.parse(savedTodos);
      setTodos(savedTodosObject);
    }

    if (url && storedLogin && storedPass && savedConfigObject.connected) {
      sync();
    }
  };

  const loadTaxonomyTerms = useCallback((data: DataState, taxonomy: string): Promise<any> => {
    const url = data.taxonomies[taxonomy]._links['wp:items'][0].href + '?per_page=100';
    return authenticadedFetch(url, {}, login, pass);
  }, [login, pass]);

  const handleToggleTaskItem = useCallback(item => {
    setTodos(prevData => {
      const newData = [...prevData]
      const index = prevData.indexOf(item)
      newData[index] = {
        ...item,
        done: !item.done,
        dirty: true
      }
      return newData
    })
  }, [])

  const handleChangeTaskItemSubject = useCallback((item, newSubject) => {
    setTodos( prevData => {
      const newData = [...prevData]
      const index = prevData.indexOf(item)
      newData[index] = {
        ...item,
        subject: newSubject,
        dirty: true
      }
      return newData
    })
  }, [])

  const createEmptyTodo = useCallback(( filter: number ) => {
    const id = 'new_' + shortid.generate();
    const newTodo = {
      id,
      subject: '',
      done: false,
      dirty: true,
      deleted: false,
      terms: [],
    };
    if( filter && filter > 0) {
      newTodo.terms.push( filter );
    }
    setTodos( todos => [
      newTodo,
      ...todos
    ])
    return id;
  }, [])

  const saveMappedIosRemindersList = useCallback(async ( term, value) => {
    console.log( 'Selected', value, JSON.stringify( term ) );
    authenticadedFetch( term._links.self[0].href, {
      method: 'POST',
      body: JSON.stringify( {
        meta: { reminders_calendar: value }
      } )
    }, login, pass ).then( res => {
      setData( prevData => {
        const newTerms = prevData.taxonomy_terms.map( t => ( t.id === term.id ? res : t ) );
        const newData = { ...prevData, taxonomy_terms: newTerms };
        return newData;
      } );
    } );
  }, [])
  const sync = useCallback(async () => {
    const url = getURLForCPT( data.post_types, data.post_type );
    const cachedData = todos;

    if( ! url ) {
      console.warn( 'Bailing on sync, no URL to update CPT found.');
      return;
    }
    let updatePromises: Promise<any>[] = [];
    if( cachedData ) {
      console.log( 'Cached Data', JSON.stringify(cachedData) );
      const dataToSync = cachedData.filter( todo => todo.dirty ).filter( todo => todo.subject.length > 0 );
      console.log( 'Trigggering sync', JSON.stringify(dataToSync) );
  
      updatePromises = dataToSync.map( todo => {
        if( todo.deleted || todo.done ) {
          return authenticadedFetch( url + '/' + todo.id, {
            method: 'DELETE'
          }, login, pass );
          // .then( deleteResponse => {
          //   // When completing tasks, we wanna mark the reminder as completed. This wont work if completed from the network.
          //   console.log( 'Completed TODO', JSON.stringify( deleteResponse ) );
          //   if ( deleteResponse.meta && deleteResponse.meta.reminders_id ) {
          //     return Calendar.updateReminderAsync( deleteResponse.meta.reminders_id, { completed:true } ).then( () => Promise.resolve( deleteResponse ) );           
          //   }
          //   return Promise.resolve( deleteResponse )
          // } );
        } else if( typeof todo.id === 'string' &&  todo.id.substring(0,3) === 'new' ) {
          let payload = {
            title: todo.subject,
            status: 'private'
          };
          // If there is inbox
          console.log( 'TAXONOMY', data.taxonomy_terms );
          if( data.taxonomy && data.taxonomy_terms ) {
            payload[ data.taxonomy ] = [];
            if ( todo.terms && todo.terms.length > 0 ) {
              payload[ data.taxonomy ] = payload[ data.taxonomy ].concat( todo.terms );
            } else {
              const inbox = data.taxonomy_terms.find( term => term.slug === 'inbox' );
              if ( inbox ) {
                payload[ data.taxonomy ].push( inbox.id );
              }
            }
          }
          return authenticadedFetch( url, {
            method: 'POST',
            body: JSON.stringify( payload )
          }, login, pass );
        } else {
          let newData = {
            title: todo.subject,
          };
          return authenticadedFetch( url + '/' + todo.id, {
            method: 'POST',
            body: JSON.stringify( newData )
          }, login, pass );
        }
      } );
    }
    
    Promise.all( updatePromises ).then( responses => {
      console.log( 'Synced Data', JSON.stringify(responses) );
      setRefreshing( true );
      // Pull taxonomies.
      loadTaxonomyTerms( data, data.taxonomy ).then( response => {
        setData( prevData => {
          const newData = { ...prevData, taxonomy_terms: response };
          AsyncStorage.setItem( 'config', JSON.stringify( newData ) );
          return newData;
        } );
      });

      // Get Calendars for selecting to sync.
      Calendar.getCalendarsAsync( Calendar.EntityTypes.REMINDER ).then( response => {
        setData( prevData => {
          const newData = { ...prevData, reminders_calendars: response };
          AsyncStorage.setItem( 'config', JSON.stringify( newData ) );
          return newData;
        } );
      } );

      // Pull latest todos.
      function getPagePromise( page: number, status: string, previousData: Todo[] ): Promise<Todo[]> {
        const modifiedURL = new URL( url );
        modifiedURL.searchParams.set( 'per_page', '100' );
        modifiedURL.searchParams.set( 'context', 'edit' );
        modifiedURL.searchParams.set( 'page', page.toString() );
        modifiedURL.searchParams.set( 'status', status );
        return authenticadedFetch( modifiedURL.toString() , {}, login, pass )
        .then( response => {
          const data = previousData.concat( response );
          if( response.length < 100 ) {
            // All results
            console.log( 'All results', data );
            return Promise.resolve( data );
          } else {
            return getPagePromise(page + 1, status, data );
          }
        } )
      }
      Promise.all( [
        getPagePromise(1, 'publish', []),
        getPagePromise(1, 'private', []),
        getPagePromise(1, 'trash', [] )
      ] ).then( ( responses ) => {
        const response = responses.flat();
        setTodos( response.filter( post => {  return ( post.status !== 'trash' ) } ).map( post => ( {
          id:post.id,
          subject: post.title.raw,
          done: false,
          dirty: false,
          terms: data.taxonomy ? post[ data.taxonomies[ data.taxonomy ].rest_base ] : []
        } ) ) );
        // Save new Reminders to todos.

        //Calendar.getRemindersAsync([]);

        // push ios reminders to WP
        if ( data.taxonomy && data.taxonomies[ data.taxonomy ] && data.reminders_calendars && data.reminders_calendars.length > 0 ) {
          const syncedCalendars = data.taxonomy_terms.map( term => term.meta.reminders_calendar ).filter( Boolean);
          const reminders_pushed = Calendar.getRemindersAsync( syncedCalendars ).then( reminders => {
            const updates = [];
            reminders.forEach(reminder => {
              const synced_notebook = data.taxonomy_terms.find( term => term.meta.reminders_calendar === reminder.calendarId );
              if( ! synced_notebook ) {
                // This reminder is not synced.
                return;
              }
              if( reminder.completed ) {
                console.log( 'Skipping completed reminder', reminder );
                return;
              }
              const existing = response.find( post => post.meta && post.meta.reminders_id === reminder.id );
              if ( ! existing ) {
                // Add the reminder.
                const payload = {
                  title: reminder.title,
                  post_name: 'ios_' + reminder.id,
                  status: 'private',
                  meta: {
                    reminders_id: reminder.id
                  }
                };
                payload[ data.taxonomy ] = [ synced_notebook.id ];
                console.log( 'NEW TODO', JSON.stringify( payload ) );
                updates.push( authenticadedFetch( url, {
                  method: 'POST',
                  body: JSON.stringify( payload )
                }, login, pass ) );
              }
            });
            return Promise.all( updates );
          });
          // Push wp to ios reminders
          reminders_pushed.then( () => {
            const rest_base = data.taxonomies[ data.taxonomy ].rest_base;
            response.forEach( todo => {
                const terms = todo[ rest_base ]
                .map( id => data.taxonomy_terms.find( term => term.id === id ) )
                .filter( term => term && term.meta.reminders_calendar && term.meta.reminders_calendar !== '' )
                .slice( 0, 1 ); // Only one calendar for now.
              if ( terms.length === 0  || ! terms[0].meta.reminders_calendar || terms[0].meta.reminders_calendar === 'no' ) {
                return;
              }

              if ( todo.meta && todo.meta.reminders_id ) {
                // Already exists.
                //console.log( 'UPDATING REMINDER', todo.title.raw, terms[0].meta.reminders_calendar );
                Calendar.getReminderAsync( todo.meta.reminders_id )
                .catch( err => {})
                .then( reminder => {
                  if( ! reminder || ! reminder.id ) {
                    return;
                  }
                  if ( reminder.calendarId !== terms[0].meta.reminders_calendar ) {
                    // We have to delete and recreate in another list.
                    console.log( 'Moving reminder', todo.title.raw, reminder.id, terms[0].meta.reminders_calendar );
                    Calendar.deleteReminderAsync( reminder.id );
                    Calendar.createReminderAsync( terms[0].meta.reminders_calendar, {
                      title: todo.title.raw,
                      completed: ( todo.status === 'trash' ),
                      url: getWPAdminUrlForPost( data, todo.id ),
                      notes: todo.excerpt.raw
                    } ).then( newReminderId => {
                      authenticadedFetch( url + '/' + todo.id, {
                        method: 'POST',
                        body: JSON.stringify( {
                          meta: {
                            reminders_id: newReminderId
                          }
                        } )
                      }, login, pass ).then( response => {
                        //TODO: push that to state.
                      } );
                    });
                    return;
                  }
                  const changes = {};
                  if ( reminder.title !== todo.title.raw ) {
                    changes.title = todo.title.raw;
                  }
                  if ( reminder.notes !== todo.excerpt.raw ) {
                    changes.notes = todo.excerpt.raw;
                  }
                  if( reminder.completed !== ( todo.status === 'trash' ) ) {
                    changes.completed = ( todo.status === 'trash' );
                  }
                  if ( Object.keys( changes ).length > 0 ) {
                    console.log( 'Reminder changes detected', todo.title.raw, changes );
                    return Calendar.updateReminderAsync( todo.meta.reminders_id, changes );
                  }
                });
                // Calendar.updateReminderAsync( todo.meta.reminders_id, {
                //   // title: todo.title.raw,
                //   // completed: ( todo.status === 'trash' ),
                //   calendarId: 'F738DB44-3997-4A9C-80D6-113EB4A172FD',//terms[0].meta.reminders_calendar
                // } ).catch( err => {
                //   //console.log( 'Error updating reminder', err );
                // } )
                // .then( reminder => console.log( 'UPDATED', todo.title.raw, reminder ) );
                return;
              } else {
                
              }

              const reminders_list_id = terms[0].meta.reminders_calendar;
              console.log( 'ADDING TO REMINDERS', reminders_list_id );
              // Adding reminders to the list.
              Calendar.createReminderAsync( reminders_list_id, {
                title: todo.title.raw,
                completed: ( todo.status === 'trash' ),
                url: getWPAdminUrlForPost( data, todo.id ),
                notes: todo.excerpt.raw
              } ).catch( err => {
                console.log( 'Error creating reminder', err );
              } ).then( reminder_id => {
                console.log( 'Created Reminder', reminder_id );
                authenticadedFetch( url + '/' + todo.id, {
                  method: 'POST',
                  body: JSON.stringify( {
                    meta: {
                      reminders_id: reminder_id
                    }
                  } )
                }, login, pass ).then( response => {
                  //TODO: push that to state.
                  console.log( 'Created a new todo from reminder', JSON.stringify( response ) );
                } );
              } );
            } );
          });
        
        }

        setRefreshing( false );
      }).catch ( err => {
        console.log( 'ERROR', err );
        setRefreshing( false );
      });
    } );
  }, [data, todos, login, pass]);

  const connectWP = useCallback( () => {
    const username = login;
    const password = pass;
    const url = wpURL;
        //normalize url, add https if not present
        setConnecting( true );
        const siteData = fetch( normalizeUrl(url, 'https' ) + `?rest_route=/`)
        .catch( err => fetch( normalizeUrl(url, 'http' ) + `?rest_route=/`) )
        .catch( err => {
          // We are going to deal with special snowflake of WPCOM later.
          // const host = (new URL( normalizeUrl( url, 'https' ) ) ).hostname;
          // const wpcomURL = 'https://public-api.wordpress.com/wpcom/v2/sites/' + host + '/';
          // return fetch( wpcomURL );
    
          // Could not find proper WP REST API.
          if ( url.indexOf( '.wordpress.com' ) > -1 ) {
            return Promise.reject( { message: 'This site is WordPress.com site without plugins. Unfortunately, these sites do not support application passwords.'} );
          }
          return Promise.reject( { message: 'I had trouble connecting to REST API on this site.'} );
        } )
        .then((response) => response.json())
        .then( response => {
            data['site_home'] = response.home;
            data['site_icon_url'] = response.site_icon_url;
            data['site_title'] = response.name;
            setWPURL( response.url );
            setData( oldData => ( { ...oldData, ...data } ) );
            return Promise.resolve( response );
        });
    
        siteData.then( (site) => authenticadedFetch(
          site.routes['/wp/v2/users/me']._links.self[0].href,
          {},
          username,
          password
        ) )
        .then( response => {
            console.log( 'USER LOGIN', response.name );
            data['username'] = response.name;
            data['gravatar'] = response.avatar_urls['96'];
    
            setData( oldData => ( { ...oldData, ...data } ) );
            AsyncStorage.setItem( 'wpurl', url );
            AsyncStorage.setItem( 'wplogin', username );
            AsyncStorage.setItem( 'wppass', password );
            setConnectingError( '' );
    
            return Promise.resolve( siteData );
        } )
        .then( (site) => Promise.all( [
          authenticadedFetch(
            site.routes['/wp/v2/types']._links.self[0].href,
            {},
            username,
            password
          ),
          authenticadedFetch(
            site.routes['/wp/v2/taxonomies']._links.self[0].href,
            {},
            username,
            password
          ),
        ] ) )
        .then( response => {
            console.log( 'POST TYPES', JSON.stringify( Object.values( response[0] ) ));
            console.log( 'POST TAXONMIES', JSON.stringify( Object.values( response[1] ) ) );
            let newData ={ post_types: Object.values( response[0] ), taxonomies: response[1] };
            // Personal OS plugin detected
            if ( response[0]['todo'] && response[1]['todo_category'] ) {
              newData['post_type'] = 'todo';
              newData['taxonomy'] = 'todo_category';
              setPosPlugin( 1 );
            } else {
              newData['post_type'] = 'post';
            }
    
            return Promise.resolve( newData );
            
        } )
        .then( ( newData ) => {
          setData( oldData => ( { ...oldData, ...newData } ) );
          setConnecting( false );
        } )
        .catch( error => {
          setConnectingError( error.message );
          setConnecting( false );
        }  );
  }, [login, pass, wpURL]);

  const logOut = useCallback(() => {
    setData(initialData);
    setTodos([]);
    setWPURL('');
    setLogin('');
    setPass('');
    AsyncStorage.removeItem('wpurl');
    AsyncStorage.removeItem('wplogin');
    AsyncStorage.removeItem('wppass');
    AsyncStorage.removeItem('config');
    AsyncStorage.removeItem('todos');
  }, []);

  return {
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
    saveMappedIosRemindersList
  };
}


const DataManagerContext = createContext<DataManager | null>(null);

export const DataManagerProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const dataManager = createDataManager();

  return (
    <DataManagerContext.Provider value={dataManager}>
      {children}
    </DataManagerContext.Provider>
  );
};

export const useDataManagerContext = () => {
  const context = useContext(DataManagerContext);
  if (!context) {
    throw new Error('useDataManagerContext must be used within a DataManagerProvider');
  }
  return context;
};
