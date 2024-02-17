import React, { useCallback, useState } from 'react'
import { Platform } from 'react-native'
import { useColorModeValue, Input, Button, Heading, Text, VStack, Link } from 'native-base'
import AnimatedColorBox from '../components/animated-color-box'
import Masthead from '../components/masthead'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeSyntheticEvent, TextInputChangeEventData, ActivityIndicator, View } from 'react-native'
import {Picker} from '@react-native-picker/picker';
import { authenticadedFetch, normalizeUrl } from '../utils/wpapi';
import { FontAwesome5, } from '@expo/vector-icons'
import LinkButton from '../components/link-button'

export default function SetupScreen( { wpURL, login, pass, setWPURL, setLogin, setPass, data, setData }) {

  const [connecting, setConnecting] = useState(false);
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
          console.log( 'Gonna load taxonomy terms', newData );
        }
        return Promise.resolve( newData );
        
    } )
    .then( ( newData ) => {
      console.log( 'NEW DATA 2', newData );
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

      { ! connecting && ( <>
        { data.connected && data.site_title && <Heading p={6} size="m">
          { "Connected to " + data.site_title }
        </Heading> }
        { data.post_types.length > 0 && (
          <>
              <Heading p={4} size="md" style={{marginBottom: 0}}>Which post type holds your TODOs?</Heading>
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
                    <Heading p={4} size="md">How do you seperate your TODOs?</Heading>
                    <Picker
                      style={ pickerStyle }
                      itemStyle={{ padding:0, margin:0}}
                      selectedValue={data.taxonomy}
                      onValueChange={(itemValue, itemIndex) => {
                        setData( oldData => ( { ...oldData, taxonomy: itemValue } ) );
                      } }
                    >
                    <Picker.Item key='' label="Do not separate my todos" value='' />
                    { data.post_types.find( type => type.slug === data.post_type ).taxonomies.map( ( taxonomy_slug: any ) => {
                        const taxonomy = data.taxonomies[taxonomy_slug];
                        return ( <Picker.Item key={ taxonomy.slug } label={ taxonomy.name + ' (' + taxonomy.slug + ')' } value={ taxonomy.slug } /> );
                    } ) }
                    </Picker>
                </>
              ) }
              <Button
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
                    loadTaxonomyTerms( data.taxonomy ).then( response => {
                      const newData = { ...data, connected: true,  taxonomy_terms: response };
                      setConnecting( false );
                      setData( newData );
                      AsyncStorage.setItem( 'config', JSON.stringify( newData ) );
                    });
                }}
                >{ "Continue" }</Button>
          </>
        ) }
      </> ) }
      </VStack>
    </AnimatedColorBox>
  )
}
