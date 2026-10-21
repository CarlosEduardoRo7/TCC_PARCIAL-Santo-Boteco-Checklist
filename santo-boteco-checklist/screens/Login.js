import React, { useMemo, useState } from 'react';
import { View, Image, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Icon, Portal, Modal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { loginWithFirestore } from '../services/auth';
import { useTema } from '../theme/Themecontext';

const LOGO_CLARO = require('../images/logo_escuro.png');
const LOGO_ESCURO = require('../images/logo.png');

export default function Login({ navigation }) {
    const { cores, modo } = useTema();
    const escuro = modo === 'escuro';

    const c = useMemo(
        () => ({
            fundo: cores.fundo,
            superficie: escuro ? cores.card : '#FFFFFF',
            campo: escuro ? '#2A2A2C' : '#F5F5F5',
            borda: escuro ? cores.borda : '#EAEAEA',
            texto: cores.texto,
            sub: escuro ? '#A0A0A0' : '#8A8A8A',
            vermelho: '#D6293E',
            vermelhoTexto: escuro ? '#FF6B7D' : '#D6293E',
            perigo: escuro ? '#FF6B6B' : '#C62828',
            perigoFundo: escuro ? 'rgba(255, 107, 107, 0.15)' : 'rgba(214, 41, 62, 0.15)',
            escuro,
        }),
        [cores, escuro]
    );

    const styles = useMemo(() => criarEstilos(c), [c]);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [contaBloqueadaVisivel, setContaBloqueadaVisivel] = useState(false);

    const appVersion = Constants.expoConfig?.version;

    const handleLogin = async () => {
        setErrorMessage('');
        setLoading(true);
        try {
            const user = await loginWithFirestore(username, password);

            if (user.ativo === false) {
                setContaBloqueadaVisivel(true);
                return;
            }

            if (user.admin) {
                navigation.replace('AdminTabs', { admin: user });
            } else {
                navigation.replace('FuncionariosTabs', { funcionario: user });
            }
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    const inputProps = {
        mode: 'outlined',
        textColor: c.texto,
        outlineColor: c.borda,
        activeOutlineColor: c.vermelho,
        outlineStyle: styles.inputOutline,
        style: styles.input,
        theme: { colors: { onSurfaceVariant: c.sub } },
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.spacer} />

                <View style={styles.logoContainer}>
                    <Image source={escuro ? LOGO_ESCURO : LOGO_CLARO} style={styles.logo} resizeMode="contain" />
                </View>

                <View style={styles.spacer} />

                <Text style={styles.subtitle}>Entre com sua conta:</Text>

                <View style={styles.formCard}>
                    <Text style={styles.label}>USUÁRIO</Text>
                    <TextInput
                        {...inputProps}
                        value={username}
                        onChangeText={setUsername}
                        left={<TextInput.Icon icon="account-outline" color={c.vermelho} />}
                        autoCapitalize="none"
                        autoCorrect={false}
                        spellCheck={false}
                    />

                    <Text style={styles.label}>SENHA</Text>
                    <TextInput
                        {...inputProps}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        left={<TextInput.Icon icon="lock-outline" color={c.sub} />}
                        right={
                            <TextInput.Icon
                                icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                color={c.sub}
                                onPress={() => setShowPassword(!showPassword)}
                            />
                        }
                    />

                    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                    <Button
                        mode="contained"
                        onPress={handleLogin}
                        loading={loading}
                        disabled={loading}
                        buttonColor={c.vermelho}
                        textColor="#FFFFFF"
                        style={styles.button}
                        contentStyle={styles.buttonContent}
                        labelStyle={styles.buttonLabel}
                    >
                        ENTRAR
                    </Button>
                </View>

                <View style={styles.spacer} />

                <View style={styles.footer}>
                    <View style={styles.restrictedRow}>
                        <Icon source="shield-outline" size={16} color={c.sub} />
                        <Text style={styles.restrictedText}>Acesso restrito a funcionários autorizados</Text>
                    </View>
                    <Text style={styles.versionText}>Santo Boteco Check V{appVersion}</Text>
                </View>
            </KeyboardAvoidingView>

            <Portal>
                <Modal
                    visible={contaBloqueadaVisivel}
                    onDismiss={() => setContaBloqueadaVisivel(false)}
                    contentContainerStyle={styles.bloqueioModalContainer}
                    theme={{ colors: { backdrop: 'rgba(0, 0, 0, 0.85)' } }}
                >
                    <View style={styles.bloqueioIconeCirculo}>
                        <Icon source="lock-alert-outline" size={26} color={c.perigo} />
                    </View>

                    <Text style={styles.bloqueioTitulo}>Conta bloqueada</Text>
                    <Text style={styles.bloqueioMensagem}>
                        Fale com o administrador ou responsável para reativar seu acesso.
                    </Text>

                    <Button
                        mode="contained"
                        onPress={() => setContaBloqueadaVisivel(false)}
                        buttonColor={c.vermelho}
                        textColor="#FFFFFF"
                        style={styles.bloqueioBotao}
                        contentStyle={styles.buttonContent}
                        labelStyle={styles.buttonLabel}
                    >
                        ENTENDI
                    </Button>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

const criarEstilos = (c) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: c.fundo,
        },
        keyboardContainer: {
            flex: 1,
            paddingHorizontal: 24,
        },
        spacer: {
            flex: 1,
            minHeight: 8,
        },
        logoContainer: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        logo: {
            width: 310,
            height: 250,
        },
        formCard: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            padding: 20,
            borderWidth: c.escuro ? 1 : 0,
            borderColor: c.borda,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: c.escuro ? 0 : 0.08,
            shadowRadius: 6,
            elevation: c.escuro ? 0 : 3,
        },
        subtitle: {
            color: c.sub,
            fontSize: 16,
            marginBottom: 14,
        },
        label: {
            color: c.sub,
            fontSize: 12,
            letterSpacing: 1,
            marginBottom: 6,
        },
        input: {
            backgroundColor: c.campo,
            marginBottom: 20,
        },
        inputOutline: {
            borderRadius: 16,
        },
        errorText: {
            color: c.vermelhoTexto,
            fontSize: 13,
            marginBottom: 12,
        },
        button: {
            borderRadius: 12,
            marginTop: 8,
        },
        buttonContent: {
            paddingVertical: 8,
        },
        buttonLabel: {
            fontSize: 16,
            fontWeight: 'bold',
            letterSpacing: 1,
        },
        footer: {
            alignItems: 'center',
            paddingBottom: 16,
        },
        restrictedRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
        },
        restrictedText: {
            color: c.sub,
            fontSize: 13,
        },
        versionText: {
            color: c.sub,
            fontSize: 13,
        },
        bloqueioModalContainer: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            padding: 24,
            marginHorizontal: 32,
            alignItems: 'center',
        },
        bloqueioIconeCirculo: {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: c.perigoFundo,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
        },
        bloqueioTitulo: {
            color: c.texto,
            fontSize: 17,
            fontWeight: 'bold',
            marginBottom: 8,
            textAlign: 'center',
        },
        bloqueioMensagem: {
            color: c.sub,
            fontSize: 13,
            lineHeight: 20,
            textAlign: 'center',
            marginBottom: 22,
        },
        bloqueioBotao: {
            borderRadius: 12,
            width: '100%',
        },
    });