import React, { useCallback, useState } from 'react'
import { useColorModeValue, Input, Button, Heading, Text } from 'native-base'
import AnimatedColorBox from '../components/animated-color-box'
import Masthead from '../components/masthead'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeSyntheticEvent, TextInputChangeEventData, ActivityIndicator, View } from 'react-native'
import {Picker} from '@react-native-picker/picker';


export default function SetupScreen( { wpURL, login, pass, setWPURL, setLogin, setPass, data, setData }) {

  const [connecting, setConnecting] = useState(false);
  const [err, setErr] = useState('')

  function authenticadedFetch( url: string, params = {}, username: string, password: string ) {
    const args = {
      ...params,
      headers: {
        'Authorization': 'Basic ' + btoa( username + ':' + password ),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
    return fetch( url, args ).then((response) => response.json()).then( response => {
      if ( response.code ) {
        return Promise.reject( response );
      }
      return Promise.resolve( response );
    } );
  }

  function connectWP( url: string, username: string, password: string ) {
    //normalize url, add https if not present
    setConnecting( true );
    const normalizedURL = 'http://' + url;

    const siteData = fetch(`${normalizedURL}?rest_route=/`)
    .then((response) => response.json())
    .then( response => {
        data['site_home'] = response.home;
        data['site_icon_url'] = response.site_icon_url;
        data['site_title'] = response.name;
        setData( data );
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

        setData( data );
        AsyncStorage.setItem( 'wpurl', url );
        AsyncStorage.setItem( 'wplogin', username );
        AsyncStorage.setItem( 'wppass', password );
        setErr( '' );

        return Promise.resolve( siteData );
    } )
    .then( (site) => authenticadedFetch(
      site.routes['/wp/v2/types']._links.self[0].href,
      {},
      username,
      password
    ) )
    .then( response => {
        console.log( 'POST TYPES', JSON.stringify( Object.values( response ) ));
        setData( { ...data, post_types: Object.values( response ) } );
        setConnecting( false );
    } )
    .catch( error => {
      setErr( error.message );
      setConnecting( false );
    }  );
    
}

  const handleChangeWPURL = useCallback(
    (e: NativeSyntheticEvent<TextInputChangeEventData>) => {
        setWPURL && setWPURL(e.nativeEvent.text)
    },
    [setWPURL]
  )
  const handleChangeLogin = useCallback(
    (e: NativeSyntheticEvent<TextInputChangeEventData>) => {
        setLogin && setLogin(e.nativeEvent.text)
    },
    [setLogin]
  )
  const handleChangePass = useCallback(
    (e: NativeSyntheticEvent<TextInputChangeEventData>) => {
        setPass && setPass(e.nativeEvent.text)
    },
    [setPass]
  )
  return (
    <AnimatedColorBox
      flex={1}
      bg={useColorModeValue('warmGray.50', 'primary.900')}
      w="full"
    >
      <Masthead
        title="Tell me more about your WordPress"
        image={require('../assets/masthead.png')}
      >
        <></>
      </Masthead>
      { connecting && (
          <View style={ { margin: '12px' } }>
            <ActivityIndicator size="large"  />
          </View>
      ) }

      { ! connecting && (
        <>
        <Input
              margin={ '3'}
              placeholder="Your WordPress URL"
              value={ wpURL }
              variant="outline"
              size="xl"
              autoFocus
              blurOnSubmit
              onChange={ handleChangeWPURL }
            />
        <Input
              margin={ '3'}
              placeholder="Your login"
              value={ login }
              variant="outline"
              size="xl"
              blurOnSubmit
              onChange={ handleChangeLogin }

            />
        <Input
              margin={ '3'}
              placeholder="Your application password"
              value={ pass }
              variant="outline"
              size="xl"
              onChange={ handleChangePass }

            />
        <Text
          alignContent={ 'center' }
          margin={ '3' }
        >{ err }</Text>

        <Button
          colorScheme="primary"
          margin={ '10%' }
          onPress={ () => {
              connectWP( wpURL, login, pass );
          }}
        >
          { "Connect" }
        </Button>
        </>
      ) }

      <>
        { data.site_title && <Heading p={6} size="m">
          { "Connected to " + data.site_title }
        </Heading> }
        { data.post_types.length > 0 && (
          <>
              <Heading p={6} size="m">Which post type holds your TODOs?</Heading>
              <Picker
                selectedValue={data.post_type}
                onValueChange={(itemValue, itemIndex) => {
                  setData( { ...data, post_type: itemValue } );
                } }
              >

              { data.post_types.map( ( post_type: any ) => (
                  <Picker.Item key={ post_type.slug } label={ post_type.name + ' (' + post_type.slug + ')' } value={ post_type.slug } />
              ) ) }
              </Picker>
              <Button
                colorScheme="primary"
                margin={ '10%' }
                onPress={ () => {
                    AsyncStorage.setItem( 'config', JSON.stringify( data ) );
                }}
                >{ "Continue" }</Button>
          </>
        ) }
      </>

    </AnimatedColorBox>
  )
}
