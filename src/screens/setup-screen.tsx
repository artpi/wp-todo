import React, { useCallback, useState, useEffect } from 'react'
import { useColorModeValue, Input, Button, Heading } from 'native-base'
import AnimatedColorBox from '../components/animated-color-box'
import shortid from 'shortid'
import Masthead from '../components/masthead'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeSyntheticEvent, TextInputChangeEventData } from 'react-native'
import { set } from 'react-native-reanimated'



const initialData = {
    site_title: '',
    site_home: '',
    site_icon_url: '',
    taxonomies: [],
}


function connectWP( url: string, username: string, password: string, setData: any ) {
    //normalize url, add https if not present
    const normalizedURL = 'http://' + url;
    console.log('NORMALIZED URL', normalizedURL);
    // Fetch WP API schema
    fetch(`${normalizedURL}/wp-json/`)
    .then((response) => response.json())
    .then( response => {
        const data = {
            site_title: response.name,
            site_home: response.home,
            site_icon_url: response.site_icon_url,
        }
        console.log( 'setting', data );
        setData( data );
        const taxonomies = response.routes['/wp/v2/taxonomies']._links.self[0].href;
        console.log( 'TAXONOMIES URL', taxonomies );
        return fetch( taxonomies );
    })
    .then((response) => response.json())
    .then( response => {
        console.log( JSON.stringify( Object.values( response ) ));
        setData( { taxonomies: Object.values( response ) } );
    } );
}

export default function SetupScreen() {

  const [data, setData] = useState(initialData)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [wpURL, setWPURL] = useState('')

  useEffect(() => {
    AsyncStorage.getItem('wpurl').then( url => {
        if (url) {
            setWPURL(url)
        }
    } );
  }, []);

  const handleChangeWPURL = useCallback(
    (e: NativeSyntheticEvent<TextInputChangeEventData>) => {
        setWPURL && setWPURL(e.nativeEvent.text)
    },
    [setWPURL]
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
      <Input
            placeholder="Your WordPress URL"
            value={ wpURL }
            variant="unstyled"
            fontSize={19}
            px={1}
            py={0}
            autoFocus
            blurOnSubmit
            onChange={ handleChangeWPURL }
          />
    
    <Button
        colorScheme="primary"
        margin={ '10%' }
        onPress={ () => {
            AsyncStorage.setItem('wpurl', wpURL);
            connectWP( wpURL, '', '', setData );
        }}
    >
        { "Connect" }
    </Button>
    { data.site_title && <Heading p={6} size="xl">
        { data.site_title }
      </Heading> }
    { data.taxonomies && (
        <>
            <Heading p={6} size="m">Which taxonomy holds your TODOs?</Heading>
            { data.taxonomies.map( taxonomy => (
                <Heading p={6} size="m" key={ taxonomy.id }>
                    { taxonomy.name }
                </Heading>
            ) ) }
        </>
    ) }
    </AnimatedColorBox>
  )
}
