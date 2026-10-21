import React from 'react';
import { PaperProvider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Login from './screens/Login';
import FuncionariosTabs from './screens/funcionarios/FuncionariosTabs';
import EtapasTarefa from './screens/funcionarios/EtapasTarefa';
import TutorialFuncionario from './screens/funcionarios/TutorialFuncionario';
import AdminTabs from './screens/admin/AdminTabs';
import RevisarEtapas from './screens/admin/RevisarEtapas';
import TutorialAdministrador from './screens/admin/TutorialAdministrador';
import { ThemeProvider, useTema } from './theme/Themecontext';

const Stack = createNativeStackNavigator();

function AppConteudo() {
  const { paperTheme, navTheme, modo } = useTema();

  return (
    <PaperProvider
      theme={paperTheme}
      settings={{
        icon: (props) => <MaterialCommunityIcons {...props} />,
      }}
    >
      <StatusBar style={modo === 'escuro' ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="FuncionariosTabs" component={FuncionariosTabs} />
          <Stack.Screen name="EtapasTarefa" component={EtapasTarefa} />
          <Stack.Screen name="TutorialFuncionario" component={TutorialFuncionario} />
          <Stack.Screen name="AdminTabs" component={AdminTabs} />
          <Stack.Screen name="RevisarEtapas" component={RevisarEtapas} />
          <Stack.Screen name="TutorialAdministrador" component={TutorialAdministrador} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppConteudo />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}