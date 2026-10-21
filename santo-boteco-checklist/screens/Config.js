import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Alert, Image, Switch } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTema } from '../theme/Themecontext';

const AMARELO = '#F4B740';
const CAMPOS_FOTO = ['foto', 'fotoBase64', 'fotoPerfil', 'imagem', 'avatar'];

function pareceImagem(valor) {
    return (
        typeof valor === 'string' &&
        (valor.startsWith('data:image') ||
            valor.startsWith('/9j/') ||
            valor.startsWith('iVBOR') ||
            valor.startsWith('UklGR'))
    );
}

function pegarFoto(dados) {
    if (!dados) return null;

    const valor =
        CAMPOS_FOTO.map((campo) => dados[campo]).find((v) => typeof v === 'string' && v.length > 0) ??
        Object.values(dados).find(pareceImagem);

    if (!valor) return null;
    if (valor.startsWith('iVBOR')) return `data:image/png;base64,${valor}`;
    if (valor.startsWith('data:') || valor.startsWith('http') || valor.startsWith('file:')) return valor;
    return `data:image/jpeg;base64,${valor}`;
}

function pegarIniciais(nome) {
    if (!nome) return '?';
    const partes = nome.trim().split(/\s+/);
    const primeira = partes[0]?.[0] ?? '';
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primeira + ultima).toUpperCase();
}

export default function Config({ navigation, route }) {
    const { modo, cores, alterarModo } = useTema();
    const modoEscuro = modo === 'escuro';

    const usuario = route?.params?.funcionario ?? route?.params?.admin;
    const ehAdmin = !!route?.params?.admin || !!usuario?.admin;
    const nome = usuario?.nome ?? 'Usuário';
    const cargo = ehAdmin ? 'Administrador' : usuario?.cargo ?? 'Funcionário';
    const versao = Constants.expoConfig?.version;

    const [foto, setFoto] = useState(pegarFoto(usuario));

    useEffect(() => {
        const fotoLocal = pegarFoto(usuario);
        if (fotoLocal) {
            setFoto(fotoLocal);
            return;
        }

        const id = usuario?.id ?? usuario?.uid;
        if (!id) return;

        let ativo = true;
        getDoc(doc(db, 'Usuarios', id))
            .then((snap) => {
                if (ativo && snap.exists()) setFoto(pegarFoto(snap.data()));
            })
            .catch(() => {});

        return () => {
            ativo = false;
        };
    }, [usuario]);

    function trocarModo(ligado) {
        alterarModo(ligado ? 'escuro' : 'claro');
    }

    function abrirTutorial() {
        const stack = navigation.getParent() ?? navigation;
        stack.navigate(ehAdmin ? 'TutorialAdministrador' : 'TutorialFuncionario');
    }

    function sair() {
        const stack = navigation.getParent() ?? navigation;
        stack.replace('Login');
    }

    function confirmarSaida() {
        Alert.alert('Sair da conta', 'Deseja mesmo sair?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Sair', style: 'destructive', onPress: sair },
        ]);
    }

    return (
        <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: cores.fundo }]}>
            <View style={styles.conteudo}>
                <Text style={[styles.titulo, { color: cores.texto }]}>Configurações</Text>
                <View style={[styles.divisor, { backgroundColor: cores.borda }]} />

                <View style={[styles.perfil, { backgroundColor: cores.card }]}>
                    {foto ? (
                        <Image source={{ uri: foto }} style={[styles.avatar, { borderColor: cores.destaque }]} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarSemFoto, { borderColor: cores.destaque }]}>
                            <Text style={[styles.iniciais, { color: cores.destaque }]}>{pegarIniciais(nome)}</Text>
                        </View>
                    )}

                    <Text style={[styles.nome, { color: cores.texto }]} numberOfLines={1}>
                        {nome}
                    </Text>
                    <Text style={[styles.cargo, { color: cores.textoSecundario }]} numberOfLines={1}>
                        {cargo}
                    </Text>
                </View>

                <View style={[styles.opcoes, { backgroundColor: cores.card }]}>
                    <Pressable
                        onPress={abrirTutorial}
                        style={({ pressed }) => [
                            styles.opcao,
                            styles.opcaoComLinha,
                            { borderBottomColor: cores.borda },
                            pressed && styles.pressionado,
                        ]}
                    >
                        <Icon source="help-circle-outline" size={20} color={cores.icone} />
                        <Text style={[styles.opcaoTexto, { color: cores.texto }]}>Como usar o aplicativo</Text>
                        <Icon source="chevron-right" size={20} color={cores.icone} />
                    </Pressable>

                    <View style={[styles.opcao, styles.opcaoComLinha, { borderBottomColor: cores.borda }]}>
                        <Icon source="weather-night" size={20} color={cores.icone} />
                        <Text style={[styles.opcaoTexto, { color: cores.texto }]}>Modo escuro</Text>
                        <Switch
                            value={modoEscuro}
                            onValueChange={trocarModo}
                            trackColor={{ false: cores.borda, true: AMARELO }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    <Pressable
                        onPress={confirmarSaida}
                        style={({ pressed }) => [styles.opcao, pressed && styles.pressionado]}
                    >
                        <Icon source="logout" size={20} color={cores.perigo} />
                        <Text style={[styles.opcaoTexto, { color: cores.perigo }]}>Sair da conta</Text>
                    </Pressable>
                </View>

                {!!versao && (
                    <Text style={[styles.versao, { color: cores.textoSecundario }]}>
                        Santo Boteco Check v{versao}
                    </Text>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    conteudo: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 22,
    },
    titulo: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    divisor: {
        height: 1,
        marginTop: 16,
        marginBottom: 18,
    },
    perfil: {
        alignItems: 'center',
        borderRadius: 14,
        paddingVertical: 20,
        paddingHorizontal: 16,
        marginBottom: 14,
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 2,
        marginBottom: 10,
    },
    avatarSemFoto: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iniciais: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    nome: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    cargo: {
        fontSize: 13,
        marginTop: 2,
    },
    opcoes: {
        borderRadius: 14,
        paddingHorizontal: 16,
    },
    opcao: {
        height: 54,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    opcaoComLinha: {
        borderBottomWidth: 1,
    },
    opcaoTexto: {
        flex: 1,
        fontSize: 15,
    },
    versao: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 'auto',
        marginBottom: 16,
    },
    pressionado: {
        opacity: 0.65,
    },
});