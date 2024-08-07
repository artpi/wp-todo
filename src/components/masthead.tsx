import React from 'react';
import { ImageSourcePropType } from 'react-native';
import {
	Box,
	VStack,
	Heading,
	Image,
	HStack,
	IconButton,
	useColorModeValue,
	Modal,
	Button,
} from 'native-base';
import { Feather } from '@expo/vector-icons';

interface Props {
	title: string;
	image: ImageSourcePropType;
	children: React.ReactNode;
}

const Masthead = ( { title, children, image, modal }: Props ) => {
	const [ showModal, setShowModal ] = React.useState( false );
	return (
		<VStack h="200px" pb={ 5 } backgroundColor={ 'blue.500' }>
			<Image
				position="absolute"
				left={ 0 }
				right={ 0 }
				bottom={ 0 }
				w="full"
				h="200px"
				resizeMode="cover"
				source={ image }
				alt="masthead image"
			/>
			{ children }
			<HStack style={ { justifyContent: 'space-between' } }>
				<Heading
					color="white"
					p={ 2 }
					size="xl"
					style={ { justifyContent: 'center' } }
				>
					{ title }
				</Heading>
				{ !! modal && (
					<IconButton
						onPress={ () => setShowModal( true ) }
						borderRadius={ 100 }
						borderColor={ 'white' }
						_icon={ {
							as: Feather,
							name: 'chevron-down',
							size: 5,
							color: 'white',
						} }
					/>
				) }
			</HStack>
			{ !! modal && (
				<Modal
					isOpen={ showModal }
					onClose={ () => setShowModal( false ) }
				>
					<Modal.Content maxWidth="400px">
						<Modal.CloseButton />
						<Modal.Header>Settings</Modal.Header>
						<Modal.Body>{ modal }</Modal.Body>
						<Modal.Footer>
							<Button.Group space={ 2 }>
								<Button
									variant="ghost"
									colorScheme="blueGray"
									onPress={ () => {
										setShowModal( false );
									} }
								>
									Cancel
								</Button>
								<Button
									onPress={ () => {
										setShowModal( false );
									} }
								>
									Save
								</Button>
							</Button.Group>
						</Modal.Footer>
					</Modal.Content>
				</Modal>
			) }
		</VStack>
	);
};

export default Masthead;
