import React, { useCallback } from 'react'
import {
  HStack,
  VStack,
  Center,
  Avatar,
  Heading,
  IconButton,
  useColorModeValue,
  Link
} from 'native-base'
import { DrawerContentComponentProps } from '@react-navigation/drawer'
import AnimatedColorBox from './animated-color-box'
import ThemeToggle from './theme-toggle'
import { Feather } from '@expo/vector-icons'
import MenuButton from './menu-button'
import * as Linking from 'expo-linking'
import { getWPAdminUrlForCPT } from '../utils/wpapi'

const Sidebar = (props: DrawerContentComponentProps) => {
  const { state, navigation, data, logOut, wpURL } = props
  const currentRoute = state.routeNames[state.index]
console.log('DAT', data);
  const handlePressBackButton = useCallback(() => {
    navigation.closeDrawer()
  }, [navigation])
  const handlePressMenuMain = useCallback(() => {
    navigation.navigate('Main')
  }, [navigation])
  const handlePressMenuAbout = useCallback(() => {
    navigation.navigate('About')
  }, [navigation])

  return (
    <AnimatedColorBox
      safeArea
      flex={1}
      bg={useColorModeValue('blue.50', 'darkBlue.800')}
      p={7}
    >
      <VStack flex={1} space={2}>
        <HStack justifyContent="flex-end">
          <IconButton
            onPress={handlePressBackButton}
            borderRadius={100}
            variant="outline"
            borderColor={useColorModeValue('blue.300', 'darkBlue.700')}
            _icon={{
              as: Feather,
              name: 'chevron-left',
              size: 6,
              color: useColorModeValue('blue.800', 'darkBlue.700')
            }}
          />
        </HStack>
        <Avatar
          source={{
            uri: data.gravatar
          }}
          size="xl"
          borderRadius={100}
          mb={6}
          borderColor="secondary.500"
          borderWidth={3}
        />
        <Heading mb={4} size="xl">
          { '@' + data.username }
        </Heading>
        <Heading mb={4} size="l">
          { data.site_title }
        </Heading>
        <MenuButton
          active={currentRoute === 'Main'}
          onPress={handlePressMenuMain}
          icon="inbox"
        >
          Tasks
        </MenuButton>
        <MenuButton
          active={ false }
          icon="external-link"
          onPress={() => {
            Linking.openURL( getWPAdminUrlForCPT( wpURL, data.post_type ) );
          }}
        >
          Manage on WP
        </MenuButton>
        <MenuButton
          active={currentRoute === 'About'}
          onPress={handlePressMenuAbout}
          icon="info"
        >
          About
        </MenuButton>
        <MenuButton
          active={ false }
          onPress={ () => logOut()}
          icon="log-out"
        >
          Log Out
        </MenuButton>
      </VStack>
      <Center>
        <ThemeToggle />
      </Center>
    </AnimatedColorBox>
  )
}

export default Sidebar
