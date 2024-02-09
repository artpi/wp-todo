import React, { useEffect, useState } from 'react'
import { createDrawerNavigator } from '@react-navigation/drawer'
import AsyncStorage from '@react-native-async-storage/async-storage';

import MainScreen from './screens/main-screen'
import AboutScreen from './screens/about-screen'
import Sidebar from './components/sidebar'
import SetupScreen from './screens/setup-screen'

const Drawer = createDrawerNavigator()

const initialData = {
  connected: false,
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
  const [wpURL, setWPURL] = useState('')
  const [login, setLogin] = useState('')
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
      drawerContent={props => <Sidebar logOut={ logOut } data={data} {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'back',
        overlayColor: '#00000000'
      }}
    >
      <Drawer.Screen name="Main" component={MainScreen} />
      <Drawer.Screen name="About" component={AboutScreen} />
    </Drawer.Navigator>
  )
}

export default App
