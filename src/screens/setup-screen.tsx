import React, { useCallback, useState } from 'react'
import { Platform, KeyboardAvoidingView } from 'react-native'
import { useColorModeValue, Input, Button, Heading, Text, HStack, VStack, Link } from 'native-base'
import AnimatedColorBox from '../components/animated-color-box'
import Masthead from '../components/masthead'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeSyntheticEvent, TextInputChangeEventData, ActivityIndicator, View } from 'react-native'
import {Picker} from '@react-native-picker/picker';
import { authenticadedFetch, normalizeUrl } from '../utils/wpapi';
import { FontAwesome5, Feather } from '@expo/vector-icons'
import LinkButton from '../components/link-button'

export default function SetupScreen( { wpURL, login, pass, setWPURL, setLogin, setPass, data, setData }) {

  const [connecting, setConnecting] = useState(false);
  const [ posPlugin, setPosPlugin ] = useState( 0 );// 0 - not detected, 1 - detected, 2 - continuing without it.
  const [err, setErr] = useState('');

  const pickerStyle = {
    marginLeft: '6%',
    marginRight: '6%',
  };

  if( Platform.OS === 'ios' ) {
    pickerStyle['marginTop'] = -48;
    pickerStyle['marginBottom'] = -48;
  }

  function loadTaxonomyTerms( taxonomy ) {
    const url = data.taxonomies[taxonomy]._links['wp:items'][0].href;
    console.log( 'LOADING TAXONOMY TERMS', url );
    return authenticadedFetch( url, {}, login, pass );
  }

  function connectWP( url: string, username: string, password: string ) {
    //normalize url, add https if not present
    setConnecting( true );
    const siteData = fetch( normalizeUrl(url ) + `?rest_route=/`)
    .then((response) => response.json())
    .then( response => {
        data['site_home'] = response.home;
        data['site_icon_url'] = response.site_icon_url;
        data['site_title'] = response.name;
        setWPURL( response.url );
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
        title=""
        image={require('../assets/masthead-start.png')}
      >
      </Masthead>
      
      <VStack
        flex={1}
        space={1}
        bg={useColorModeValue('warmGray.50', 'primary.900')}
        mt="-20px"
        borderTopLeftRadius="20px"
        borderTopRightRadius="20px"
        pt="20px"
      >

      { connecting && (
          <View style={ { margin: '12px' } }>
            <ActivityIndicator size="large"  />
          </View>
      ) }
      <KeyboardAvoidingView
        behavior={'position'}
      >
      { ! connecting && ! data.username && (
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
        { ! wpURL && ( 
        <>
        <Text margin={ '6' }>WP TODO requires a WordPress installation. You don't have a WordPress yet?</Text>
        <LinkButton
          backgroundColor={'#3399cd'}
            size="md"
            borderRadius="full"
            marginLeft={ '6'}
            marginRight={ '6'}
            href="https://automattic.pxf.io/wptodo"
            leftIcon={
              <FontAwesome5 name="wordpress-simple" size={24} color={'white'} opacity={0.5} />
            }
          >
            Get one on WordPress.com
          </LinkButton>
          </>) }
        { wpURL && ( <>
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
              type='password'
              value={ pass }
              variant="outline"
              size="xl"
              onChange={ handleChangePass }

            />
          { wpURL && (
            <Link marginLeft={ '6' } alignContent={ 'center' } href={ normalizeUrl(wpURL) + `/wp-admin/authorize-application.php?app_name=wp-todo` }>Do not use your regular password. Create a new "application" password here</Link>
          ) }
            { err && ( <Text
              alignContent={ 'center' }
              margin={ '3' }
              color={ 'red.500'}
            >{ err }</Text> ) }

            <Button
              colorScheme="secondary"
              margin={ '10%' }
              size="md"
              borderRadius="full"
              marginLeft={ '6'}
              marginRight={ '6'}
              leftIcon={
                <FontAwesome5 name="check-circle" size={24} color={'white'} opacity={0.5} />
              }
              onPress={ () => {
                  connectWP( wpURL, login, pass );
              }}
            >
              { "Connect" }
            </Button>
          </> ) }
        </>
      ) }
      </KeyboardAvoidingView>
      { ! connecting && data.post_types.length > 0 && ( <>
        { data.connected && data.site_title && <Heading p={6} size="md">
          { "Connected to " + data.site_title }
        </Heading> }
        { ( posPlugin === 1 ) && (
          <Heading p={6} size="m">
            WP TODO detected the "Personal OS" plugin. Your TODOs will be saved as 'TODO' post type and 'TODO Category' taxonomy. You are good to go.
          </Heading>
        ) }
        { ( posPlugin === 0 ) && (
          <>
            <Heading p={6} size="md">
                Personal OS Plugin recommended
              </Heading>
              <Text p={6}>
                WP TODO can work with any post type and taxonomy. However, I recommend using the "Personal OS" plugin to manage your TODOs.
              </Text>
              <Text p={6}>
                You can also use existing Custom Post Types and taxonomies without any additional plugins.
              </Text>
              <HStack
                justifyContent="space-between"
              >
              <LinkButton
                colorScheme="secondary"
                size="md"
                width={ '40%' }
                marginLeft={ '6'}
                borderRadius="full"
                href="https://piszek.com/personal-os"
                leftIcon={
                  <FontAwesome5 name="check-circle" size={24} color={'white'} opacity={0.5} />
                }>Try Personal OS</LinkButton>
              <Button
                colorScheme="primary"
                size="md"
                width={ '40%' }
                marginRight={ '6' }
                borderRadius="full"
                rightIcon={
                  <Feather name="arrow-right-circle" size={24} color={'white'} opacity={0.5} />
                }
                onPress={ () => {
                  setPosPlugin( 2 );
                } }
              >No Plugins</Button>
              </HStack>
          </>
        ) }
        { ( posPlugin === 2 ) && (
          <>
              <Heading p={4} size="s" style={{marginBottom: 0}}>Which post type holds your TODOs?</Heading>
              <Picker
                style={ pickerStyle }
                itemStyle={{ padding:0, margin:0}}
                selectedValue={data.post_type}
                onValueChange={(itemValue, itemIndex) => {
                  setData( { ...data, post_type: itemValue } );
                } }
              >

              { data.post_types.map( ( post_type: any ) => (
                  <Picker.Item key={ post_type.slug } label={ post_type.name + ' (' + post_type.slug + ')' } value={ post_type.slug } />
              ) ) }
              </Picker>
              { (
                data.post_type.length > 0 &&
                data.taxonomies &&
                data.post_types.find( type => type.slug === data.post_type ) &&
                data.post_types.find( type => type.slug === data.post_type ).taxonomies.length > 0
                ) && (
                <>
                    <Heading p={4} size="s">How do you group your TODOs?</Heading>
                    <Picker
                      style={ pickerStyle }
                      itemStyle={{ padding:0, margin:0}}
                      selectedValue={data.taxonomy}
                      onValueChange={(itemValue, itemIndex) => {
                        setData( oldData => ( { ...oldData, taxonomy: itemValue } ) );
                      } }
                    >
                    <Picker.Item key='' label="Keep only one list" value='' />
                    { data.post_types.find( type => type.slug === data.post_type ).taxonomies.map( ( taxonomy_slug: any ) => {
                        const taxonomy = data.taxonomies[taxonomy_slug];
                        return ( <Picker.Item key={ taxonomy.slug } label={ taxonomy.name + ' (' + taxonomy.slug + ')' } value={ taxonomy.slug } /> );
                    } ) }
                    </Picker>
                </>
              ) }
          </>
        ) }
        { ( posPlugin !== 0 ) && ( <Button
          colorScheme="secondary"
          margin={ '10%' }
          size="md"
          borderRadius="full"
          marginLeft={ '6'}
          marginRight={ '6'}
          disabled={ (
            ! data.post_types ||
            ! data.post_type || (
              data.taxonomy.length > 0 && ! data.taxonomy_terms
            ) ) }
          leftIcon={
            <FontAwesome5 name="check-circle" size={24} color={'white'} opacity={0.5} />
          }
          onPress={ () => {
              setConnecting( true );
              if( data.taxonomy ) {
                loadTaxonomyTerms( data.taxonomy ).then( response => {
                  const newData = { ...data, connected: true,  taxonomy_terms: response };
                  setConnecting( false );
                  setData( newData );
                  AsyncStorage.setItem( 'config', JSON.stringify( newData ) );
                });
              } else {
                const newData = { ...data, connected: true };
                setConnecting( false );
                setData( newData );
                AsyncStorage.setItem( 'config', JSON.stringify( newData ) );
              }

          }}
          >{ "Continue" }</Button> ) }
      </> ) }
      </VStack>
    </AnimatedColorBox>
  )
}
