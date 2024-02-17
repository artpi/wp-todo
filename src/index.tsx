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

  useEffect(() => {
    AsyncStorage.getItem('wpurl').then( url => {
        if (url) {
            setWPURL(url)
        }
    } );
    AsyncStorage.getItem('wplogin').then( l => {
      if (l) {
          setLogin( l );
      }
    } );
    AsyncStorage.getItem('wppass').then( l => {
      if (l) {
          setPass( l );
      }
    } );
    AsyncStorage.getItem('config').then( read => {
      if (read) {
          setData( JSON.parse( read ) );
          console.log('READING CONFIG: ', read);
      }
    } );
    AsyncStorage.getItem('todos').then( read => {
      if (read) {
          setTodos( JSON.parse( read ) );
          console.log('READING TODOS: ', read);
      }
    } );
  }, []);

  useEffect(() => {
    if ( data.connected ) {
      // Gotta load those todos.
      sync( todos );
    }
  }, [data, wpURL, login, pass ]);

  useEffect(() => {
    console.log( 'Saving todos to local storage', todos );
    AsyncStorage.setItem('todos', JSON.stringify( todos) );
  }, [todos]);


  function sync( cachedData: any ) {
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
        if( todo.deleted ) {
          console.log( 'Deleting', todo );
          return authenticadedFetch( url + '/' + todo.id, {
            method: 'DELETE'
          }, login, pass );
        } else if( typeof todo.id === 'string' &&  todo.id.substring(0,3) === 'new' ) {
          return authenticadedFetch( url, {
            method: 'POST',
            body: JSON.stringify( {
              title: todo.subject,
              status: 'publish'
            } )
          }, login, pass );
        } else {
          let newData = {
            title: todo.subject,
          };
          if ( todo.done ) {
            newData['status'] = 'pending';
          } 
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
      return authenticadedFetch( url, {}, login, pass ).then( response => {
        console.log('DEB', data.taxonomy, data.taxonomies , response);
        setTodos( response.map( post => ( {
          id:post.id,
          subject: post.title.rendered,
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
    setWPURL('');
    setLogin('');
    setPass('');
    AsyncStorage.removeItem('wpurl');
    AsyncStorage.removeItem('wplogin');
    AsyncStorage.removeItem('wppass');
    AsyncStorage.removeItem('config');
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
              sync={ sync }
              {...props }
          />
      )}
      </Drawer.Screen>
      <Drawer.Screen name="About" component={AboutScreen} />
    </Drawer.Navigator>
  )
}

export default App
