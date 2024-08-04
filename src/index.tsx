import React, { useEffect, useState } from 'react'
import { createDrawerNavigator } from '@react-navigation/drawer'
import AsyncStorage from '@react-native-async-storage/async-storage';

import MainScreen from './screens/main-screen'
import AboutScreen from './screens/about-screen'
import Sidebar from './components/sidebar'
import SetupScreen from './screens/setup-screen'
import { authenticadedFetch, getURLForCPT } from './utils/wpapi';
import { err } from 'react-native-svg';
import * as Calendar from 'expo-calendar';


const Drawer = createDrawerNavigator()

const initialData = {
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

const App = () => {
  const [data, setData] = useState(initialData)
  const [todos, setTodos] = useState([])
  const [wpURL, setWPURL] = useState('')
  const [login, setLogin] = useState('')
  const [ refreshing, setRefreshing ] = useState( false )
  const [pass, setPass] = useState('')
  const [remindersPermission, requestRemindersPermission] = Calendar.useRemindersPermissions();

  useEffect(() => {
    (async () => {
      if ( ! remindersPermission || (  remindersPermission.status !== 'granted' && remindersPermission.canAskAgain ) ) {
        console.log('Requesting reminders permission');
        const permissionResponse = await requestRemindersPermission();
        console.log( 'Reminders permission Response', permissionResponse );
      }
    })();
  }, []);

  useEffect( () => {
  
    const promises = [
      AsyncStorage.getItem('wpurl'),
      AsyncStorage.getItem('wplogin'),
      AsyncStorage.getItem('wppass'),
      AsyncStorage.getItem('config'),
      AsyncStorage.getItem('todos'),
    ];

    Promise.all( promises ).then( ([url, login, pass, savedconfig, savedtodos ]) => {
      let savedConfigObject = {};
      let savedTodosObject = [];
      if (url) {
        setWPURL(url);
      }
      if (login) {
        setLogin(login);
      }
      if (pass) {
        setPass(pass);
      }
      if (savedconfig) {
        savedConfigObject = JSON.parse(savedconfig);
        setData( savedConfigObject );
      }
      if (savedtodos) {
        savedTodosObject = JSON.parse(savedtodos);
        setTodos( savedTodosObject );
      }
      console.log( 'Loaded Data', url, login, savedConfigObject );
      if (url && login && pass && savedConfigObject.connected ) {
        console.log( 'Syncing todos' );
        sync( savedTodosObject, savedConfigObject, login, pass );
      }
    });
  }, [] );

  useEffect(() => {
    if( todos.length > 0 ) {
      console.log( 'Saving todos to local storage', todos );

      AsyncStorage.setItem('todos', JSON.stringify( todos ) );
    }
  }, [todos]);

  function loadTaxonomyTerms( data, taxonomy ) {
    const url = data.taxonomies[taxonomy]._links['wp:items'][0].href + '?per_page=100';
    console.log( 'LOADING TAXONOMY TERMS', url );
    return authenticadedFetch( url, {}, login, pass );
  }

  function sync( cachedData: any, data: any, login, pass ) {
    const url = getURLForCPT( data.post_types, data.post_type );

    if( ! url ) {
      console.warn( 'Bailing on sync, no URL to update CPT found.');
      return;
    }
    let updatePromises = [];
    if( cachedData ) {
      console.log( 'Cached Data', JSON.stringify(cachedData) );
      const dataToSync = cachedData.filter( todo => todo.dirty ).filter( todo => todo.subject.length > 0 );
      console.log( 'Trigggering sync', JSON.stringify(dataToSync) );
  
      updatePromises = dataToSync.map( todo => {
        if( todo.deleted || todo.done ) {
          return authenticadedFetch( url + '/' + todo.id, {
            method: 'DELETE'
          }, login, pass );
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
      const modifiedURL = new URL( url );
      modifiedURL.searchParams.set( 'status[]', 'public' );
      modifiedURL.searchParams.set( 'status[]', 'private' );
      modifiedURL.searchParams.set( 'per_page', '100' );
      modifiedURL.searchParams.set( 'context', 'edit' );
      // Pull taxonomies.
      loadTaxonomyTerms( data, data.taxonomy ).then( response => {
        setData( prevData => {
          //console.log( 'TERMS', JSON.stringify(response, null, 2) );
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
      authenticadedFetch( modifiedURL.toString() , {}, login, pass ).then( response => {
        setTodos( response.map( post => ( {
          id:post.id,
          subject: post.title.raw,
          done: false,
          dirty: false,
          terms: data.taxonomy ? post[ data.taxonomies[ data.taxonomy ].rest_base ] : []
        } ) ) );
        // Save new Reminders to todos.

        //Calendar.getRemindersAsync([]);

        // push ios reminders to WP
        if ( data.taxonomy && data.taxonomies[ data.taxonomy ] && data.reminders_calendars.length > 0 ) {
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
              if ( todo.meta && todo.meta.reminders_id ) {
                // Already exists.
                Calendar.updateReminderAsync( todo.meta.reminders_id, {
                  title: todo.title.raw,
                  completed: ( todo.status === 'trash' )
                } );
                return;
              }
              const terms = todo[ rest_base ]
                .map( id => data.taxonomy_terms.find( term => term.id === id ) )
                .filter( term => term && term.meta.reminders_calendar && term.meta.reminders_calendar !== '' )
                .slice( 0, 1 ); // Only one calendar for now.
              if ( terms.length === 0 ) {
                return;
              }
              const reminders_list_id = terms[0].meta.reminders_calendar;
              console.log( 'ADDING TO REMINDERS', reminders_list_id );
              // Adding reminders to the list.
              Calendar.createReminderAsync( reminders_list_id, {
                title: todo.title.raw,
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
  }

  function logOut() {
    setData( initialData );
    setTodos( [] );
    setWPURL('');
    setLogin('');
    setPass('');
    AsyncStorage.removeItem('wpurl');
    AsyncStorage.removeItem('wplogin');
    AsyncStorage.removeItem('wppass');
    AsyncStorage.removeItem('config');
    AsyncStorage.removeItem('todos');
  }

  if ( !data.connected ) {
    return ( <SetupScreen
      wpURL={wpURL}
      login={login}
      pass={pass}
      setWPURL={setWPURL}
      setLogin={setLogin}
      setPass={setPass}
      data={data}
      setData={setData}
    /> );
  }

  return (
    <Drawer.Navigator
      initialRouteName="Main"
      drawerContent={props => <Sidebar logOut={ logOut } data={data} todos={ todos } wpURL = {wpURL} {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'back',
        overlayColor: '#00000000'
      }}
    >
      <Drawer.Screen name="Main">
        {(props) => (
          <MainScreen
              key={"main"}
              data={ data }
              todos={ todos }
              setTodos={ setTodos }
              refreshing={ refreshing }
              login={login}
              pass={pass}
              sync={ () => sync( todos, data, login, pass ) }
              setData={ setData }
              {...props }
          />
      )}
      </Drawer.Screen>
      <Drawer.Screen name="About" component={AboutScreen} />
    </Drawer.Navigator>
  )
}

export default App
