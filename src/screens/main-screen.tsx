import React, { useCallback, useEffect, useState } from 'react'
import { Icon, VStack, useColorModeValue, Fab } from 'native-base'
import { AntDesign } from '@expo/vector-icons'
import AnimatedColorBox from '../components/animated-color-box'
import TaskList from '../components/task-list'
import shortid from 'shortid'
import Masthead from '../components/masthead'
import NavBar from '../components/navbar'

export default function MainScreen( { todos, refreshing, sync } ) {
  const [data, setData] = useState( [] )
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  useEffect(() => {
    setData( todos.map( post => ( { id:post.id, subject: post.title.rendered, done: false, dirty: false } ) ) )
  }, [todos])

  const handleToggleTaskItem = useCallback(item => {
    setData(prevData => {
      const newData = [...prevData]
      const index = prevData.indexOf(item)
      newData[index] = {
        ...item,
        done: !item.done,
        dirty: true
      }
      return newData
    })
  }, [])
  const handleChangeTaskItemSubject = useCallback((item, newSubject) => {
    setData(prevData => {
      const newData = [...prevData]
      const index = prevData.indexOf(item)
      newData[index] = {
        ...item,
        subject: newSubject,
        dirty: true
      }
      return newData
    })
  }, [])
  const handleFinishEditingTaskItem = useCallback(_item => {
    sync( data );

    setEditingItemId(null)
  }, [ data, sync])
  const handlePressTaskItemLabel = useCallback(item => {
    setEditingItemId(item.id)
  }, [])
  const handleRemoveItem = useCallback(item => {
    setData(prevData => {
      const newData = [...prevData]
      const index = prevData.indexOf(item)
      newData[index] = {
        ...item,
        dirty: true,
        deleted: true
      }
      sync( newData );
      return newData
    })
  }, [ data, sync ])

  return (
    <AnimatedColorBox
      flex={1}
      bg={useColorModeValue('warmGray.50', 'primary.900')}
      w="full"
    >
      <Masthead
        title="Lets get doin!"
        image={require('../assets/masthead-main.png')}
      >
        <NavBar />
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
        <TaskList
          refresh={ () => sync( data ) }
          refreshing={ refreshing }
          data={data}
          onToggleItem={handleToggleTaskItem}
          onChangeSubject={handleChangeTaskItemSubject}
          onFinishEditing={handleFinishEditingTaskItem}
          onPressLabel={handlePressTaskItemLabel}
          onRemoveItem={handleRemoveItem}
          editingItemId={editingItemId}
        />
      </VStack>
      <Fab
        position="absolute"
        renderInPortal={false}
        size="sm"
        icon={<Icon color="white" as={<AntDesign name="plus" />} size="sm" />}
        colorScheme={useColorModeValue('blue', 'darkBlue')}
        bg={useColorModeValue('blue.500', 'blue.400')}
        onPress={() => {
          const id = 'new_' + shortid.generate()
          setData([
            {
              id,
              subject: '',
              done: false,
              dirty: true,
              deleted: false
            },
            ...data
          ])
          setEditingItemId(id)
        }}
      />
    </AnimatedColorBox>
  )
}
