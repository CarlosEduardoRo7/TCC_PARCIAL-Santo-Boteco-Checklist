import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FuncionariosTarefas from './FuncionariosTarefas';
import RankingFuncionarios from './RankingFuncionarios';
import Config from '../Config';
import { useTema } from '../../theme/Themecontext';

const Tab = createBottomTabNavigator();

export default function FuncionariosTabs({ route }) {
    const funcionario = route?.params?.funcionario;
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
                    fontSize: 11,
                    fontWeight: 'bold',
                },
            })}
        >
            <Tab.Screen
                name="Tarefas"
                component={FuncionariosTarefas}
                initialParams={{ funcionario }}
                options={{
                    title: 'Tarefas',
                    tabBarIcon: ({ color, size }) => <Icon source="clipboard-check-outline" color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="Ranking"
                component={RankingFuncionarios}
                initialParams={{ funcionario }}
                options={{
                    title: 'Ranking',
                    tabBarIcon: ({ color, size }) => <Icon source="trophy-outline" color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="Configurações"
                component={Config}
                initialParams={{ funcionario }}
                options={{
                    title: 'Configurações',
                    tabBarIcon: ({ color, size }) => <Icon source="cog-outline" color={color} size={size} />,
                }}
            />
        </Tab.Navigator>
    );
}