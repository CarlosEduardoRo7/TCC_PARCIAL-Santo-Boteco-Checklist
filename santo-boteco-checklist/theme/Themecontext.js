import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MD3DarkTheme } from 'react-native-paper';
import { DefaultTheme as NavLight, DarkTheme as NavDark } from '@react-navigation/native';
import { theme as temaBase } from './theme';

const CHAVE_TEMA = '@santoboteco:tema';
const VERMELHO = temaBase?.colors?.primary ?? '#D6293E';

export const paletas = {
    claro: {
        fundo: '#FFFFFF',
        card: '#F7F7F7',
        borda: '#E5E5EA',
        texto: '#1A1A1A',
        textoSecundario: '#6F6F6F',
        icone: '#85858D',
        destaque: VERMELHO,
        perigo: VERMELHO,
    },
    escuro: {
        fundo: '#121212',
        card: '#1E1E1E',
        borda: '#2C2C2E',
        texto: '#F2F2F2',
        textoSecundario: '#A0A0A0',
        icone: '#85858D',
        destaque: VERMELHO,
        perigo: '#FF5A6E',
    },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
    const [modo, setModo] = useState('claro');

    useEffect(() => {
        AsyncStorage.getItem(CHAVE_TEMA)
            .then((salvo) => {
                if (salvo === 'claro' || salvo === 'escuro') setModo(salvo);
            })
            .catch(() => {});
    }, []);

    const alterarModo = (novoModo) => {
        setModo(novoModo);
        AsyncStorage.setItem(CHAVE_TEMA, novoModo).catch(() => {});
    };

    const value = useMemo(() => {
        const cores = paletas[modo];
        const escuro = modo === 'escuro';
        const paperTheme = escuro
            ? {
                  ...temaBase,
                  dark: true,
                  colors: {
                      ...temaBase.colors,
                      ...(temaBase.isV3 === false ? {} : MD3DarkTheme.colors),
                      primary: VERMELHO,
                      background: cores.fundo,
                      surface: cores.card,
                      onSurface: cores.texto,
                      text: cores.texto,
                  },
              }
            : temaBase;

        const navTheme = {
            ...(escuro ? NavDark : NavLight),
            colors: {
                ...(escuro ? NavDark.colors : NavLight.colors),
                primary: VERMELHO,
                background: cores.fundo,
                card: cores.fundo,
                text: cores.texto,
                border: cores.borda,
            },
        };

        return { modo, cores, alterarModo, paperTheme, navTheme };
    }, [modo]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTema = () => useContext(ThemeContext);