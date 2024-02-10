import React from 'react'
import { ImageSourcePropType } from 'react-native'
import { Box, VStack, Heading, Image } from 'native-base'

interface Props {
  title: string
  image: ImageSourcePropType
  children: React.ReactNode
}

const Masthead = ({ title, children, image }: Props) => {
  return (
    <VStack h="200px" pb={5} backgroundColor={'blue.500'}>
      <Image
        position="absolute"
        left={0}
        right={0}
        bottom={0}
        w="full"
        h="200px"
        resizeMode="cover"
        source={image}
        alt="masthead image"
      />
      {children}
      <Heading color="white" p={2} size="xl" style={{justifyContent: 'center'}}>
        {title}
      </Heading>
    </VStack>
  )
}

export default Masthead
