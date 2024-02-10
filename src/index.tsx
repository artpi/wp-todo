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
  post_type: '',
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
  }, []);

  useEffect(() => {
    if ( data.connected ) {
      // Gotta load those todos.
      loadTodos( data );
    }
  }, [data, wpURL, login, pass]);

  function loadTodos( data ) {
    setRefreshing( true );
    const cpt = data.post_types.find( type => type.slug === data.post_type );
    if( !cpt ) {
      return;
    }
    const url = cpt._links['wp:items'][0].href;
    console.log('URL', url);
    authenticadedFetch( url, {}, login, pass ).then( response => {
      console.log( 'TODOS', response );
      setTodos( response );
      setRefreshing( false );
    }).catch ( err => {
      console.log( 'ERROR', err );
      setRefreshing( false );
    });
  }

  function sync( cachedData: any ) {
    const dataToSync = cachedData.filter( todo => todo.dirty );
    console.log( 'Trigggering sync', JSON.stringify(dataToSync) );
    const url = getURLForCPT( data.post_types, data.post_type );
    if( ! url ) {
      console.warn( 'Bailing on sync, no URL to update CPT found.');
      return;
    }
    const updatePromises = dataToSync.map( todo => {
      if( typeof todo.id === 'string' &&  todo.id.substring(0,3) === 'new' ) {
        return authenticadedFetch( url, {
          method: 'POST',
          body: JSON.stringify( {
            title: todo.subject,
            status: 'publish'
          } )
        }, login, pass );
      } else {
        return authenticadedFetch( url + '/' + todo.id, {
          method: 'POST',
          body: JSON.stringify( {
            title: todo.subject,
          } )
        }, login, pass );
      }
    } );
    Promise.all( updatePromises ).then( responses => {
      console.log( 'Synced', responses );
      loadTodos( data );
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
      drawerContent={props => <Sidebar logOut={ logOut } data={data} wpURL = {wpURL} {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'back',
        overlayColor: '#00000000'
      }}
    >
      <Drawer.Screen name="Main">
        {(props) => (
          <MainScreen
              todos={ todos }
              refresh={ () => loadTodos( data ) }
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
