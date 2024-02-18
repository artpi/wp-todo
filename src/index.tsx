import React, { useEffect, useState } from 'react'
import { createDrawerNavigator } from '@react-navigation/drawer'
import AsyncStorage from '@react-native-async-storage/async-storage';

import MainScreen from './screens/main-screen'
import AboutScreen from './screens/about-screen'
import Sidebar from './components/sidebar'
import SetupScreen from './screens/setup-screen'
import { authenticadedFetch, getURLForCPT } from './utils/wpapi';
import { err } from 'react-native-svg';


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
}

const App = () => {
  const [data, setData] = useState(initialData)
  const [todos, setTodos] = useState([])
  const [wpURL, setWPURL] = useState('')
  const [login, setLogin] = useState('')
  const [ refreshing, setRefreshing ] = useState( false )
  const [pass, setPass] = useState('')

  useEffect( () => {
    Promise.all( [
      AsyncStorage.getItem('wpurl'),
      AsyncStorage.getItem('wplogin'),
      AsyncStorage.getItem('wppass'),
      AsyncStorage.getItem('config'),
      AsyncStorage.getItem('todos')
    ] ).then( ([url, login, pass, savedconfig, savedtodos]) => {
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


  function sync( cachedData: any, data: any, login, pass ) {
    const url = getURLForCPT( data.post_types, data.post_type );

    if( ! url ) {
      console.warn( 'Bailing on sync, no URL to update CPT found.');
      return;
    }
    let updatePromises = [];
    if( cachedData) {
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
            const inbox = data.taxonomy_terms.find( term => term.slug === 'inbox' );
            if ( inbox ) {
              payload[ data.taxonomy ] = [ inbox.id ];
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
      modifiedURL.searchParams.set( 'status', 'private' );
      modifiedURL.searchParams.set( 'per_page', '100' );
      modifiedURL.searchParams.set( 'context', 'edit' );
      return authenticadedFetch( modifiedURL.toString() , {}, login, pass ).then( response => {
        setTodos( response.map( post => ( {
          id:post.id,
          subject: post.title.raw,
          done: false,
          dirty: false,
          terms: data.taxonomy ? post[ data.taxonomies[ data.taxonomy ].rest_base ] : []
        } ) ) );
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
              data={ data }
              todos={ todos }
              setTodos={ setTodos }
              refreshing={ refreshing }
              sync={ () => sync( todos, data, login, pass ) }
              {...props }
          />
      )}
      </Drawer.Screen>
      <Drawer.Screen name="About" component={AboutScreen} />
    </Drawer.Navigator>
  )
}

export default App
