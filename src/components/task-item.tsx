import React, { useCallback } from 'react';
import { PanGestureHandlerProps } from 'react-native-gesture-handler';
import { NativeSyntheticEvent, TextInputChangeEventData } from 'react-native';
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
} from 'native-base';
import AnimatedTaskLabel from './animated-task-label';
import SwipableView from './swipable-view';
import { Feather } from '@expo/vector-icons';

interface Props extends Pick< PanGestureHandlerProps, 'simultaneousHandlers' > {
	isEditing: boolean;
	isDone: boolean;
	onToggleCheckbox?: () => void;
	onPressLabel?: () => void;
	onRemove?: () => void;
	onChangeSubject?: ( subject: string ) => void;
	onFinishEditing?: () => void;
	subject: string;
	terms: string[];
}

const TaskItem = ( props: Props ) => {
	const {
		isEditing,
		isDone,
		onToggleCheckbox,
		subject,
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
							value={ subject }
							isChecked={ isDone }
							isDisabled={ true }
							aria-label={ 'Complete ' + subject }
						/>
					</Box>
				</Pressable>
				{ isEditing ? (
					<Input
						placeholder="Task"
						value={ subject }
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
					<Pressable onPress={ onPressLabel }>
						<VStack>
							<Text
								strikeThrough={ isDone }
								numberOfLines={ 3 }
								fontSize={ 19 }
								isTruncated={ false }
								ellipsizeMode="tail"
								maxW={ 320 }
								color={ isDone ? doneTextColor : activeTextColor }
							>
								{ subject }
							</Text>
							<HStack space={ 1 }>
								{ terms }								
							</HStack>
						</VStack>
					</Pressable>
				) }
			</HStack>
		</SwipableView>
	);
};

export default TaskItem;
