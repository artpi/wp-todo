import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useDataManagerContext } from './utils/data-manager';
import MainScreen from './screens/main-screen';
import AboutScreen from './screens/about-screen';
import Sidebar from './components/sidebar';
import SetupScreen from './screens/setup-screen';

const Drawer = createDrawerNavigator();

const App: React.FC = () => {
	const { data, loading } = useDataManagerContext();
	if ( loading ) {
		// TODO: add loading screen
		return;
	}
	console.log( 'DAT', data );
	if ( ! data.connected ) {
		return <SetupScreen />;
	}

	return (
		<Drawer.Navigator
			initialRouteName="Main"
			drawerContent={ ( props ) => <Sidebar { ...props } /> }
			screenOptions={ {
				headerShown: false,
				drawerType: 'back',
				overlayColor: '#00000000',
			} }
		>
			<Drawer.Screen name="Main">
				{ ( props ) => <MainScreen key="main" { ...props } /> }
			</Drawer.Screen>
			<Drawer.Screen name="About" component={ AboutScreen } />
		</Drawer.Navigator>
	);
};

export default App;
