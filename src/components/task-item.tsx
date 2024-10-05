import React, { useCallback } from 'react';
import { PanGestureHandlerProps } from 'react-native-gesture-handler';
import {
	NativeSyntheticEvent,
	TextInputChangeEventData,
	Linking,
} from 'react-native';
import {
	Pressable,
	Box,
	HStack,
	Text,
	useColorModeValue,
	Icon,
	Input,
	useToken,
	Checkbox,
	Badge,
	VStack,
	Link,
} from 'native-base';
import AnimatedTaskLabel from './animated-task-label';
import SwipableView from './swipable-view';
import { Feather } from '@expo/vector-icons';
import { Todo } from '../utils/data-manager';

interface Props extends Pick< PanGestureHandlerProps, 'simultaneousHandlers' > {
	isEditing: boolean;
	onToggleCheckbox?: () => void;
	onPressLabel?: () => void;
	onRemove?: () => void;
	onChangeSubject?: ( subject: string ) => void;
	onFinishEditing?: () => void;
	terms: string[];
	data: Todo;
}

function getIconForUrl( url: string ) {
	const protocol = new URL( url )?.protocol.replace( ':', '' );
	if ( ! protocol ) {
		return 'external-link';
	}
	const mapping = {
		sms: 'message-square',
		tel: 'phone',
		mailto: 'mail',
		call: 'phone',
		https: 'external-link',
		http: 'external-link',
	};
	return mapping[ protocol ] || 'external-link';
}

const TaskItem = ( props: Props ) => {
	const {
		isEditing,
		data,
		onToggleCheckbox,
		onPressLabel,
		onRemove,
		onChangeSubject,
		onFinishEditing,
		terms,
		simultaneousHandlers,
	} = props;

	const highlightColor = useToken(
		'colors',
		useColorModeValue( 'blue.500', 'blue.400' )
	);
	const boxStroke = useToken(
		'colors',
		useColorModeValue( 'muted.300', 'muted.500' )
	);

	const checkmarkColor = useToken(
		'colors',
		useColorModeValue( 'white', 'white' )
	);

	const activeTextColor = useToken(
		'colors',
		useColorModeValue( 'darkText', 'lightText' )
	);
	const doneTextColor = useToken(
		'colors',
		useColorModeValue( 'muted.400', 'muted.600' )
	);

	const handleChangeSubject = useCallback(
		( e: NativeSyntheticEvent< TextInputChangeEventData > ) => {
			onChangeSubject && onChangeSubject( e.nativeEvent.text );
		},
		[ onChangeSubject ]
	);

	return (
		<SwipableView
			simultaneousHandlers={ simultaneousHandlers }
			onSwipeLeft={ onRemove }
			backView={
				<Box
					w="full"
					h="full"
					bg="green.500"
					alignItems="flex-end"
					justifyContent="center"
					pr={ 4 }
				>
					<Icon
						color="white"
						as={ <Feather name="external-link" /> }
						size="sm"
					/>
				</Box>
			}
		>
			<HStack
				alignItems="top"
				w="full"
				px={ 4 }
				py={ 2 }
				bg={ useColorModeValue( 'warmGray.50', 'primary.900' ) }
			>
				<Pressable onPress={ onToggleCheckbox }>
					<Box
						width={ 30 }
						height={ 30 }
						mr={ 2 }
						onPress={ onToggleCheckbox }
					>
						<Checkbox
							size="lg"
							value={ data.subject }
							isChecked={ data.done }
							isDisabled={ true }
							aria-label={ 'Complete ' + data.subject }
						/>
					</Box>
				</Pressable>
				{ isEditing ? (
					<Input
						placeholder="Task"
						value={ data.subject }
						variant="unstyled"
						fontSize={ 19 }
						px={ 1 }
						py={ 0 }
						autoFocus
						blurOnSubmit
						onChange={ handleChangeSubject }
						onBlur={ onFinishEditing }
						flexWrap={ 'wrap' }
					/>
				) : (
					<VStack>
						<Pressable onPress={ onPressLabel }>
							<Text
								strikeThrough={ data.done }
								numberOfLines={ 3 }
								fontSize={ 19 }
								isTruncated={ false }
								ellipsizeMode="tail"
								maxW={ 320 }
								color={
									data.done ? doneTextColor : activeTextColor
								}
							>
								{ data.subject }
							</Text>
						</Pressable>
						{ data.note && data.note.length > 0 && (
							<Text
								my={ 2 }
								fontStyle={ 'italic' }
								color={ 'gray.500' }
							>
								{ data.note }
							</Text>
						) }
						<HStack space={ 1 }>
							{ data.meta?.url && (
								<Pressable
									onPress={ () =>
										Linking.openURL( data.meta?.url )
									}
								>
									<Badge
										leftIcon={
											<Icon
												as={ Feather }
												name={ getIconForUrl(
													data.meta?.url
												) }
												size="sm"
											/>
										}
										colorScheme="secondary"
										variant="solid"
										rounded="full"
									>
										{ new URL(
											data.meta.url
										)?.host?.replace( 'www.', '' ) }
									</Badge>
								</Pressable>
							) }
							{ terms }
						</HStack>
					</VStack>
				) }
			</HStack>
		</SwipableView>
	);
};

export default TaskItem;
