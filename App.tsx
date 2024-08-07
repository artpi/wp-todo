import React from 'react'
import AppContainer from './src/components/app-container'
import Navigator from './src/'
import { DataManagerProvider } from './src/utils/data-manager'

export default function App() {
  return (
    <AppContainer>
      <DataManagerProvider>
        <Navigator />
      </DataManagerProvider>
    </AppContainer>
  )
}
