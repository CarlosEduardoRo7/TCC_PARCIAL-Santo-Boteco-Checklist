import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Icon, Avatar, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRanking } from '../../services/ranking';
import { useTema } from '../../theme/Themecontext';

function pegarIniciais(nome = '') {
    const partes = nome.trim().split(' ').filter(Boolean);
    const primeira = partes[0]?.[0] || '';
    const segunda = partes[1]?.[0] || '';
    return (primeira + segunda).toUpperCase();
}

function pegarPrimeiroNome(nome = '') {
    return nome.trim().split(' ')[0];
}

const periodos = [
    { valor: 'semanal', texto: 'Semanal' },
    { valor: 'mensal', texto: 'Mensal' },
];

const alturaDoPodio = { 1: 112, 2: 78, 3: 58 };
const tamanhoDoAvatar = { 1: 64, 2: 52, 3: 52 };

export default function RankingFuncionarios({ route }) {
    const funcionario = route?.params?.funcionario;
    const insets = useSafeAreaInsets();
    const { cores, modo } = useTema();
    const escuro = modo === 'escuro';

    const c = useMemo(() => ({
        fundo: cores.fundo,
        campo: escuro ? '#2A2A2C' : '#F5F5F5',
        borda: cores.borda,
        texto: cores.texto,
        sub: escuro ? '#A0A0A0' : '#8A8A8A',
        amarelo: '#F4B740',
        marrom: '#2B1B12',
        avatarFundo: escuro ? '#3A2A1E' : '#2B1B12',
        destaque: escuro ? 'rgba(244, 183, 64, 0.14)' : 'rgba(244, 183, 64, 0.16)',
        ouro: { borda: '#F4B740', base: '#F4B740', texto: '#2B1B12' },
        prata: escuro
            ? { borda: '#B5B5BA', base: '#8E8E95', texto: '#1E1E22' }
            : { borda: '#C9C9D0', base: '#DDDDE3', texto: '#55555E' },
        bronze: escuro
            ? { borda: '#C08A5E', base: '#9A6B45', texto: '#2A170A' }
            : { borda: '#D9A77D', base: '#E8C3A0', texto: '#6B4423' },
        escuro,
    }), [cores, escuro]);

    const styles = useMemo(() => criarEstilos(c), [c]);

    const [periodo, setPeriodo] = useState('semanal');
    const [ranking, setRanking] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [atualizando, setAtualizando] = useState(false);
    const [deuErro, setDeuErro] = useState(false);

    const buscarRanking = useCallback(async () => {
        setDeuErro(false);
        try {
            const dados = await getRanking(periodo);
            setRanking(Array.isArray(dados) ? dados : []);
        } catch {
            setDeuErro(true);
            setRanking([]);
        }
    }, [periodo]);

    useEffect(() => {
        setCarregando(true);
        buscarRanking().finally(() => setCarregando(false));
    }, [buscarRanking]);

    async function atualizar() {
        setAtualizando(true);
        await buscarRanking();
        setAtualizando(false);
    }

    function corDaMedalha(posicao) {
        if (posicao === 1) return c.ouro;
        if (posicao === 2) return c.prata;
        return c.bronze;
    }

    function ehVoce(pessoa) {
        return pessoa?.id === funcionario?.id;
    }

    function mostrarAvatar(pessoa, tamanho) {
        if (pessoa.icone) {
            return <Avatar.Image size={tamanho} source={{ uri: pessoa.icone }} />;
        }
        return (
            <Avatar.Text
                size={tamanho}
                label={pegarIniciais(pessoa.nome)}
                color={c.amarelo}
                style={styles.avatarSemFoto}
            />
        );
    }

    const primeiro = ranking[0];
    const segundo = ranking[1];
    const terceiro = ranking[2];
    const podio = [segundo, primeiro, terceiro].filter(Boolean);
    const demais = ranking.slice(3);

    function mostrarConteudo() {
        if (carregando) {
            return (
                <View style={styles.aviso}>
                    <ActivityIndicator animating color={c.amarelo} />
                    <Text style={styles.avisoTexto}>Calculando ranking...</Text>
                </View>
            );
        }

        if (deuErro) {
            return (
                <View style={styles.aviso}>
                    <Icon source="wifi-off" size={28} color={c.sub} />
                    <Text style={styles.avisoTexto}>Não foi possível carregar o ranking</Text>
                    <TouchableOpacity style={styles.botaoTentar} onPress={atualizar}>
                        <Text style={styles.botaoTentarTexto}>Tentar novamente</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (ranking.length === 0) {
            return (
                <View style={styles.aviso}>
                    <Icon source="trophy-outline" size={28} color={c.sub} />
                    <Text style={styles.avisoTexto}>Ainda não há dados suficientes</Text>
                </View>
            );
        }

        return (
            <>
                <View style={styles.podio}>
                    {podio.map((pessoa) => {
                        const posicao = ranking.indexOf(pessoa) + 1;
                        const medalha = corDaMedalha(posicao);
                        const tamanho = tamanhoDoAvatar[posicao];
                        const anel = tamanho + 6;

                        return (
                            <View key={pessoa.id} style={styles.colunaPodio}>
                                <View
                                    style={[
                                        styles.anelAvatar,
                                        {
                                            borderColor: medalha.borda,
                                            width: anel,
                                            height: anel,
                                            borderRadius: anel / 2,
                                        },
                                    ]}
                                >
                                    {mostrarAvatar(pessoa, tamanho)}
                                </View>

                                <Text
                                    style={[styles.nomePodio, posicao === 1 && styles.nomePrimeiro]}
                                    numberOfLines={1}
                                >
                                    {ehVoce(pessoa) ? 'Você' : pegarPrimeiroNome(pessoa.nome)}
                                </Text>

                                <Text style={styles.percentualPodio}>{pessoa.percentual}%</Text>

                                <View
                                    style={[
                                        styles.basePodio,
                                        { height: alturaDoPodio[posicao], backgroundColor: medalha.base },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.numeroPodio,
                                            { color: medalha.texto, fontSize: posicao === 1 ? 28 : 22 },
                                        ]}
                                    >
                                        {posicao}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {demais.length > 0 && (
                    <>
                        <Text style={styles.tituloSecao}>COLOCAÇÃO GERAL</Text>
                        <View style={styles.lista}>
                            {demais.map((pessoa, i) => {
                                const posicao = i + 4;
                                const voce = ehVoce(pessoa);

                                return (
                                    <View key={pessoa.id} style={[styles.linha, voce && styles.linhaVoce]}>
                                        <View style={styles.circuloPosicao}>
                                            <Text style={styles.textoPosicao}>{posicao}º</Text>
                                        </View>
                                        {mostrarAvatar(pessoa, 34)}
                                        <Text style={styles.nome} numberOfLines={1}>
                                            {voce ? 'Você' : pessoa.nome}
                                        </Text>
                                        <Text style={[styles.percentual, voce && styles.percentualVoce]}>
                                            {pessoa.percentual}%
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </>
                )}
            </>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView
                contentContainerStyle={styles.conteudo}
                refreshControl={
                    <RefreshControl
                        refreshing={atualizando}
                        onRefresh={atualizar}
                        tintColor={c.amarelo}
                        colors={[c.amarelo]}
                    />
                }
            >
                <Text style={styles.titulo}>Ranking</Text>

                <View style={styles.divisor} />

                <View style={styles.abas}>
                    {periodos.map((opcao) => {
                        const ativa = periodo === opcao.valor;
                        return (
                            <TouchableOpacity
                                key={opcao.valor}
                                style={[styles.aba, ativa && styles.abaAtiva]}
                                onPress={() => setPeriodo(opcao.valor)}
                            >
                                <Text style={[styles.textoAba, ativa && styles.textoAbaAtiva]}>
                                    {opcao.texto}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {mostrarConteudo()}
            </ScrollView>
        </View>
    );
}

function criarEstilos(c) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: c.fundo,
        },
        conteudo: {
            paddingHorizontal: 20,
            paddingTop: 22,
            paddingBottom: 40,
        },
        titulo: {
            color: c.texto,
            fontSize: 26,
            fontWeight: '800',
            marginBottom: 14,
        },
        divisor: {
            height: 1,
            backgroundColor: c.borda,
            marginBottom: 18,
        },

        abas: {
            flexDirection: 'row',
            backgroundColor: c.campo,
            borderRadius: 14,
            padding: 4,
            marginBottom: 26,
        },
        aba: {
            flex: 1,
            alignItems: 'center',
            paddingVertical: 10,
            borderRadius: 10,
        },
        abaAtiva: {
            backgroundColor: c.amarelo,
        },
        textoAba: {
            color: c.sub,
            fontSize: 13,
            fontWeight: '600',
        },
        textoAbaAtiva: {
            color: c.marrom,
            fontWeight: 'bold',
        },

        aviso: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 48,
            gap: 8,
        },
        avisoTexto: {
            color: c.sub,
            fontSize: 15,
        },
        botaoTentar: {
            marginTop: 8,
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 12,
            backgroundColor: c.amarelo,
        },
        botaoTentarTexto: {
            color: c.marrom,
            fontWeight: 'bold',
        },

        podio: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 28,
        },
        colunaPodio: {
            flex: 1,
            alignItems: 'center',
            gap: 6,
        },
        anelAvatar: {
            borderWidth: 3,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        },
        nomePodio: {
            color: c.texto,
            fontSize: 13,
            fontWeight: 'bold',
            maxWidth: '100%',
        },
        nomePrimeiro: {
            fontSize: 14,
            fontWeight: '800',
        },
        percentualPodio: {
            color: c.sub,
            fontSize: 12,
        },
        basePodio: {
            width: '100%',
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        numeroPodio: {
            fontWeight: '800',
        },

        tituloSecao: {
            color: c.sub,
            fontSize: 11,
            letterSpacing: 1,
            marginBottom: 10,
        },
        lista: {
            gap: 4,
        },
        linha: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 10,
            paddingHorizontal: 8,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: 'transparent',
        },
        linhaVoce: {
            backgroundColor: c.destaque,
            borderColor: c.amarelo,
        },
        circuloPosicao: {
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: c.campo,
            alignItems: 'center',
            justifyContent: 'center',
        },
        textoPosicao: {
            color: c.sub,
            fontSize: 12,
            fontWeight: 'bold',
        },
        avatarSemFoto: {
            backgroundColor: c.avatarFundo,
        },
        nome: {
            flex: 1,
            color: c.texto,
            fontSize: 14,
            fontWeight: 'bold',
        },
        percentual: {
            color: c.sub,
            fontSize: 13,
            fontWeight: 'bold',
        },
        percentualVoce: {
            color: c.escuro ? c.amarelo : c.marrom,
        },
    });
}