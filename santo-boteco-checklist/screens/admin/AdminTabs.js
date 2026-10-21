import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Dashboard from './Dashboard';
import GerenciarFuncionarios from './GerenciarFuncionarios';
import GerenciarTarefas from './GerenciarTarefas';
import ValidarTarefas from './ValidarTarefas';
import Config from '../Config';
import { useTema } from '../../theme/Themecontext';

const Tab = createBottomTabNavigator();

export default function AdminTabs({ route }) {
    const admin = route?.params?.admin;
    const insets = useSafeAreaInsets();
    const { cores, modo } = useTema();

    return (
        <Tab.Navigator
            screenOptions={() => ({
                headerShown: false,
                tabBarActiveTintColor: cores.destaque,
                tabBarInactiveTintColor: cores.icone,
                tabBarBackground: () => (
                    <View key={modo} style={{ flex: 1, backgroundColor: cores.fundo }} />
                ),
                tabBarStyle: {
                    backgroundColor: cores.fundo,
                    borderTopWidth: 1,
                    borderTopColor: cores.borda,
                    height: 56 + insets.bottom + 10,
                    paddingTop: 8,
                    paddingBottom: insets.bottom + 10,
                },
                tabBarLabelStyle: {
                    fontSize: 9,
                    fontWeight: 'bold',
                },
            })}
        >
            <Tab.Screen
                name="Dashboard"
                component={Dashboard}
                initialParams={{ admin }}
                options={{
                    tabBarIcon: ({ color, size }) => <Icon source="view-dashboard-outline" color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="Validações"
                component={ValidarTarefas}
                options={{
                    title: 'Validações',
                    tabBarIcon: ({ color, size }) => <Icon source="format-list-checks" color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="Tarefas"
                component={GerenciarTarefas}
                options={{
                    title: 'Tarefas',
                    tabBarIcon: ({ color, size }) => <Icon source="clipboard-plus-outline" color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="Funcionarios"
                component={GerenciarFuncionarios}
                options={{
                    title: 'Funcionários',
                    tabBarIcon: ({ color, size }) => <Icon source="account-group-outline" color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="Configurações"
                component={Config}
                initialParams={{ admin }}
                options={{
                    title: 'Configurações',
                    tabBarIcon: ({ color, size }) => <Icon source="cog-outline" color={color} size={size} />,
                }}
            />
        </Tab.Navigator>
    );
}