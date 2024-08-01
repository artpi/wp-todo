import React, { useCallback, useState } from 'react'
import { Icon, VStack, useColorModeValue, Fab } from 'native-base'
import { AntDesign } from '@expo/vector-icons'
import AnimatedColorBox from '../components/animated-color-box'
import TaskList from '../components/task-list'
import shortid from 'shortid'
import Masthead from '../components/masthead'
import NavBar from '../components/navbar'
import { Linking } from 'react-native'
import { getWPAdminUrlForPost } from '../utils/wpapi'

export default function MainScreen( { todos, data, setTodos, refreshing, sync, route } ) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  console.log(data.taxonomy_terms);
  let title = 'All todos';
  let filter = 0;
  if( route.params?.term  && data && data.taxonomy_terms ) {
    const term = data.taxonomy_terms.find( t => t.slug === route.params.term );
    title = term.name;
    filter = term.id;
  }

  const handleToggleTaskItem = useCallback(item => {
    setTodos(prevData => {
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
    setTodos(prevData => {
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
    sync();
    setEditingItemId(null)
  }, [ todos, sync, data ])
  const handlePressTaskItemLabel = useCallback(item => {
    setEditingItemId(item.id)
  }, [])
  const handleRemoveItem = useCallback(item => {
    Linking.openURL( getWPAdminUrlForPost( data, item.id ) );
  }, [])

  return (
    <AnimatedColorBox
      flex={1}
      bg={useColorModeValue('warmGray.50', 'primary.900')}
      w="full"
    >
      <Masthead
        title= { title }
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
          refresh={ () => sync() }
          filter={ filter }
          refreshing={ refreshing }
          data={todos}
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
          const id = 'new_' + shortid.generate();
          const newTodo = {
            id,
            subject: '',
            done: false,
            dirty: true,
            deleted: false,
            terms: [],
          };
          if( filter && filter > 0) {
            newTodo.terms.push( filter );
          }
          setTodos([
            newTodo,
            ...todos
          ])
          setEditingItemId(id)
        }}
      />
    </AnimatedColorBox>
  )
}
