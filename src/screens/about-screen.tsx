import React from 'react';
import {
	ScrollView,
	Box,
	Text,
	VStack,
	Icon,
	Avatar,
	useColorModeValue,
} from 'native-base';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import AnimatedColorBox from '../components/animated-color-box';
import Navbar from '../components/navbar';
import Masthead from '../components/masthead';
import LinkButton from '../components/link-button';

const AboutScreen = () => {
	return (
		<AnimatedColorBox
			flex={ 1 }
			bg={ useColorModeValue( 'warmGray.50', 'warmGray.900' ) }
			w="full"
		>
			<Masthead
				title="WP TODO"
				image={ require( '../assets/masthead-about.png' ) }
			>
				<Navbar />
			</Masthead>
			<ScrollView
				borderTopLeftRadius="20px"
				borderTopRightRadius="20px"
				bg={ useColorModeValue( 'warmGray.50', 'primary.900' ) }
				mt="-20px"
				pt="30px"
				p={ 4 }
			>
				<VStack flex={ 1 } space={ 4 }>
					<Text fontSize="md" w="full">
						This is a TODO app that saves your tasks to WordPress -
						the most portable and extensible online software.
					</Text>
					<Text fontSize="md" w="full">
						You will be able to manage your TODOs in WP-Admin or
						export to another app.
					</Text>
					<Text fontSize="md" w="full">
						Don't have a WordPress yet?
					</Text>

					<LinkButton
						backgroundColor={ '#3399cd' }
						size="lg"
						borderRadius="full"
						href="https://automattic.pxf.io/wptodo"
						leftIcon={
							<FontAwesome5
								name="wordpress-simple"
								size={ 24 }
								color={ 'white' }
								opacity={ 0.5 }
							/>
						}
					>
						Get one on WordPress.com
					</LinkButton>

					<Text fontSize="md" w="full">
						Written by Artpi.
					</Text>
					<LinkButton
						colorScheme={ useColorModeValue( 'blue', 'darkBlue' ) }
						size="lg"
						borderRadius="full"
						href="https://piszek.com"
						leftIcon={
							<Avatar
								source={ {
									uri: 'https://gravatar.com/avatar/01f3a3eaa8bb103655920fd3eb9aa0c3ba5f093fb189994a1d1cf71e2c436bad?s=48',
								} }
								size="xs"
								borderColor="primary.500"
								borderWidth={ 1 }
							/>
						}
					>
						Check out my blog and other projects
					</LinkButton>
				</VStack>
			</ScrollView>
		</AnimatedColorBox>
	);
};

export default AboutScreen;
