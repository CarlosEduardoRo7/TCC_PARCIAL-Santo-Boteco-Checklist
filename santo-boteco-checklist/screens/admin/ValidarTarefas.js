import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { TextInput, Text, Icon, IconButton, Portal, Modal, ActivityIndicator, Avatar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { formatarDataHoje } from '../../services/execucoes';
import { useTema } from '../../theme/Themecontext';

const iniciais = (nome) =>
    (nome || '').trim().split(/\s+/).map((parte) => parte[0]).slice(0, 2).join('').toUpperCase();

const primeiroNome = (nome) => (nome || '').trim().split(/\s+/)[0] || '';

const paraMinutos = (horario) => {
    if (typeof horario !== 'string' || !horario.includes(':')) return null;
    const [h, m] = horario.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
};

const textoAtraso = (v) => {
    const fim = paraMinutos(v.horarioConclusao);
    const prazo = paraMinutos(v.horarioTarefa ?? v.horario ?? v.prazo);
    if (fim === null || prazo === null || fim <= prazo) return 'em atraso';
    const minutos = fim - prazo;
    if (minutos < 60) return `${minutos} min de atraso`;
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    return resto ? `${horas}h${String(resto).padStart(2, '0')} de atraso` : `${horas}h de atraso`;
};

export default function ValidarTarefas({ navigation }) {
    const insets = useSafeAreaInsets();
    const { height: alturaTela } = useWindowDimensions();
    const { cores, modo } = useTema();
    const escuro = modo === 'escuro';

    const c = useMemo(
        () => ({
            fundo: cores.fundo,
            superficie: escuro ? cores.card : '#FFFFFF',
            campo: escuro ? '#2A2A2C' : '#F5F5F5',
            borda: cores.borda,
            texto: cores.texto,
            sub: escuro ? '#A0A0A0' : '#8A8A8A',
            amarelo: '#F4B740',
            sobreAmarelo: '#2B1B12',
            marrom: '#2B1B12',
            ambarFundo: escuro ? '#3A2E14' : 'rgba(244, 183, 64, 0.16)',
            ambarTexto: escuro ? '#F4B740' : '#8A5A00',
            ambarForte: escuro ? '#F4B740' : '#2B1B12',
            perigo: escuro ? '#FF6B6B' : '#C62828',
            sucesso: escuro ? '#7BC47F' : '#3F6B3A',
            sucessoFundo: escuro ? 'rgba(123, 196, 127, 0.15)' : 'rgba(63, 107, 58, 0.12)',
            quadradoVazio: escuro ? '#3A3A3C' : '#ECECEF',
            quadradoCheio: escuro ? '#7BC47F' : '#5AA65E',
            escuro,
        }),
        [cores, escuro]
    );

    const styles = useMemo(() => criarEstilos(c, alturaTela), [c, alturaTela]);

    const [validacoes, setValidacoes] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [busca, setBusca] = useState('');
    const [filtroCargo, setFiltroCargo] = useState('Todos');
    const [filtroPessoa, setFiltroPessoa] = useState('Todos');
    const [filtrosVisivel, setFiltrosVisivel] = useState(false);
    const [aba, setAba] = useState('aguardando');

    const [totalPendentes, setTotalPendentes] = useState(0);
    const [totalConcluidasHoje, setTotalConcluidasHoje] = useState(0);

    useEffect(() => {
        const ref = collection(db, 'Execucoes');

        const cancelarPendentes = onSnapshot(query(ref, where('status', '==', 'aguardando')), (snapshot) => {
            setTotalPendentes(snapshot.size);
        });

        const cancelarConcluidas = onSnapshot(
            query(ref, where('status', '==', 'aprovada'), where('data', '==', formatarDataHoje())),
            (snapshot) => setTotalConcluidasHoje(snapshot.size)
        );

        return () => {
            cancelarPendentes();
            cancelarConcluidas();
        };
    }, []);

    useEffect(() => {
        setCarregando(true);
        const ref = collection(db, 'Execucoes');
        const q =
            aba === 'concluidas'
                ? query(ref, where('status', '==', 'aprovada'), where('data', '==', formatarDataHoje()))
                : query(ref, where('status', '==', 'aguardando'));

        const cancelar = onSnapshot(
            q,
            (snapshot) => {
                const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                lista.sort((a, b) => {
                    const atrasoA = a.concluidaAtrasada ? 0 : 1;
                    const atrasoB = b.concluidaAtrasada ? 0 : 1;
                    if (atrasoA !== atrasoB) return atrasoA - atrasoB;
                    return (a.horarioConclusao || '').localeCompare(b.horarioConclusao || '');
                });
                setValidacoes(lista);
                setCarregando(false);
            },
            () => setCarregando(false)
        );

        return cancelar;
    }, [aba]);

    const cargosDisponiveis = [...new Set(validacoes.map((v) => v.cargo).filter(Boolean))];
    const pessoasDisponiveis = [...new Set(validacoes.map((v) => v.funcionarioNome).filter(Boolean))];

    const validacoesFiltradas = validacoes.filter((v) => {
        const termo = busca.trim().toLowerCase();
        const buscaOk = !termo || (v.tarefaTitulo || '').toLowerCase().includes(termo);
        const cargoOk = filtroCargo === 'Todos' || v.cargo === filtroCargo;
        const pessoaOk = filtroPessoa === 'Todos' || v.funcionarioNome === filtroPessoa;
        return buscaOk && cargoOk && pessoaOk;
    });

    const totalFiltrosAtivos = (filtroCargo !== 'Todos' ? 1 : 0) + (filtroPessoa !== 'Todos' ? 1 : 0);

    const abrirDetalhe = (validacao) => {
        navigation.navigate('RevisarEtapas', {
            validacao,
            somenteLeitura: aba === 'concluidas',
        });
    };

    const concluidas = aba === 'concluidas';

    const abas = [
        { valor: 'aguardando', texto: 'Aguardando', total: totalPendentes },
        { valor: 'concluidas', texto: 'Concluídas hoje', total: totalConcluidasHoje },
    ];

    const renderOpcaoFiltro = (texto, ativo, onPress, cor) => (
        <TouchableOpacity key={texto} style={[styles.opcaoFiltro, ativo && styles.opcaoFiltroAtiva]} onPress={onPress}>
            {cor ? <View style={[styles.dot, { backgroundColor: cor }]} /> : null}
            <Text style={[styles.opcaoFiltroTexto, ativo && styles.opcaoFiltroTextoAtivo]} numberOfLines={1}>
                {texto}
            </Text>
        </TouchableOpacity>
    );

    const semPendentes = totalPendentes === 0;
    const textoDoAlerta = semPendentes
        ? 'Nenhuma validação pendente'
        : `${totalPendentes} ${totalPendentes === 1 ? 'validação pendente' : 'validações pendentes'}`;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView contentContainerStyle={styles.conteudo}>
                <Text style={styles.titulo}>Validações</Text>
                <View style={styles.divisor} />

                <View style={[styles.alertaCard, semPendentes && styles.alertaCardOk]}>
                    <Icon
                        source={semPendentes ? 'check-all' : 'clock-check-outline'}
                        size={20}
                        color={semPendentes ? c.sucesso : c.ambarForte}
                    />
                    <Text style={[styles.alertaTexto, semPendentes && { color: c.sucesso }]}>{textoDoAlerta}</Text>
                </View>

                <View style={styles.abasRow}>
                    {abas.map((opcao) => {
                        const ativa = aba === opcao.valor;
                        return (
                            <TouchableOpacity
                                key={opcao.valor}
                                style={[styles.abaItem, ativa && styles.abaItemAtiva]}
                                onPress={() => setAba(opcao.valor)}
                            >
                                <Text style={[styles.abaTexto, ativa && styles.abaTextoAtiva]}>{opcao.texto}</Text>
                                <View style={[styles.abaContador, ativa && styles.abaContadorAtivo]}>
                                    <Text style={[styles.abaContadorTexto, ativa && styles.abaTextoAtiva]}>{opcao.total}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.buscaRow}>
                    <View style={styles.buscaCampo}>
                        <TextInput
                            mode="outlined"
                            value={busca}
                            onChangeText={setBusca}
                            placeholder="Buscar tarefa"
                            textColor={c.texto}
                            placeholderTextColor={c.sub}
                            outlineColor={c.borda}
                            activeOutlineColor={c.amarelo}
                            outlineStyle={styles.inputOutline}
                            theme={{ colors: { onSurfaceVariant: c.sub } }}
                            left={<TextInput.Icon icon="magnify" color={c.sub} />}
                            style={styles.searchInput}
                            dense
                        />
                    </View>
                    <TouchableOpacity
                        style={[styles.botaoFiltro, totalFiltrosAtivos > 0 && styles.botaoFiltroAtivo]}
                        onPress={() => setFiltrosVisivel(true)}
                    >
                        <Icon source="tune-variant" size={22} color={totalFiltrosAtivos > 0 ? c.ambarTexto : c.sub} />
                        {totalFiltrosAtivos > 0 && (
                            <View style={styles.botaoFiltroBadge}>
                                <Text style={styles.botaoFiltroBadgeTexto}>{totalFiltrosAtivos}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {totalFiltrosAtivos > 0 && (
                    <View style={styles.chipsRow}>
                        {filtroCargo !== 'Todos' && (
                            <TouchableOpacity style={styles.chip} onPress={() => setFiltroCargo('Todos')}>
                                <View style={[styles.dot, { backgroundColor: '#D6293E' }]} />
                                <Text style={styles.chipTexto}>{filtroCargo}</Text>
                                <Icon source="close" size={12} color={c.ambarTexto} />
                            </TouchableOpacity>
                        )}
                        {filtroPessoa !== 'Todos' && (
                            <TouchableOpacity style={styles.chip} onPress={() => setFiltroPessoa('Todos')}>
                                <Icon source="account-outline" size={12} color={c.ambarTexto} />
                                <Text style={styles.chipTexto}>{primeiroNome(filtroPessoa)}</Text>
                                <Icon source="close" size={12} color={c.ambarTexto} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {carregando ? (
                    <View style={styles.emptyState}>
                        <ActivityIndicator animating color={c.amarelo} />
                        <Text style={styles.emptyStateTexto}>Carregando validações...</Text>
                    </View>
                ) : validacoesFiltradas.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Icon source="check-all" size={28} color={c.sub} />
                        <Text style={styles.emptyStateTexto}>
                            {concluidas ? 'Nenhuma tarefa concluída hoje' : 'Nenhuma validação por aqui'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.lista}>
                        {validacoesFiltradas.map((v) => {
                            const etapas = v.etapas || [];
                            const feitas = etapas.filter((etapa) => !etapa.pulada).length;
                            const puladas = etapas.length - feitas;
                            const fotos = etapas.filter((etapa) => etapa.temFoto).length;
                            const percentual = etapas.length > 0 ? Math.round((feitas / etapas.length) * 100) : 0;
                            const completa = etapas.length > 0 && feitas === etapas.length;
                            const atrasada = !!v.concluidaAtrasada;

                            return (
                                <TouchableOpacity
                                    key={v.id}
                                    style={styles.card}
                                    activeOpacity={0.75}
                                    onPress={() => abrirDetalhe(v)}
                                >
                                    <View style={styles.cardTopo}>
                                        {v.funcionarioIcone ? (
                                            <Avatar.Image size={34} source={{ uri: v.funcionarioIcone }} />
                                        ) : (
                                            <Avatar.Text
                                                size={34}
                                                label={iniciais(v.funcionarioNome)}
                                                color={c.amarelo}
                                                style={styles.avatarFallback}
                                                labelStyle={styles.avatarTexto}
                                            />
                                        )}
                                        <View style={styles.cardTopoInfo}>
                                            <Text style={styles.cardTitulo} numberOfLines={1}>{v.tarefaTitulo}</Text>
                                            <Text style={styles.cardSub} numberOfLines={1}>
                                                {primeiroNome(v.funcionarioNome)} · {v.horarioConclusao}
                                                {atrasada ? (
                                                    <Text style={styles.cardSubAtraso}> · {textoAtraso(v)}</Text>
                                                ) : null}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.progressoRow}>
                                        <View style={styles.quadrados}>
                                            {Array.from({ length: 10 }).map((_, indice) => (
                                                <View
                                                    key={indice}
                                                    style={[
                                                        styles.quadrado,
                                                        indice < Math.round(percentual / 10) && styles.quadradoPreenchido,
                                                    ]}
                                                />
                                            ))}
                                        </View>
                                        <Text style={[styles.progressoTexto, completa && { color: c.sucesso }]}>
                                            {percentual}%
                                        </Text>
                                    </View>

                                    <View style={styles.cardRodape}>
                                        <View style={styles.metaRow}>
                                            <View style={styles.metaItem}>
                                                <Icon source="format-list-checks" size={13} color={completa ? c.sucesso : c.sub} />
                                                <Text style={[styles.metaTexto, completa && { color: c.sucesso }]}>
                                                    {feitas}/{etapas.length} etapas
                                                </Text>
                                            </View>
                                            {fotos > 0 && (
                                                <View style={styles.metaItem}>
                                                    <Icon source="camera-outline" size={13} color={c.sub} />
                                                    <Text style={styles.metaTexto}>{fotos}</Text>
                                                </View>
                                            )}
                                            {puladas > 0 && (
                                                <View style={styles.metaItem}>
                                                    <Icon source="skip-forward-outline" size={13} color={c.ambarTexto} />
                                                    <Text style={[styles.metaTexto, { color: c.ambarTexto }]}>
                                                        {puladas} {puladas === 1 ? 'pulada' : 'puladas'}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        <View style={[styles.botaoRevisar, concluidas && styles.botaoVerDetalhes]}>
                                            <Text style={[styles.botaoRevisarTexto, concluidas && styles.botaoVerDetalhesTexto]}>
                                                {concluidas ? 'Detalhes' : 'Revisar'}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            <Portal>
                <Modal
                    visible={filtrosVisivel}
                    onDismiss={() => setFiltrosVisivel(false)}
                    contentContainerStyle={[styles.filtrosContainer, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
                    style={styles.filtrosWrapper}
                    theme={{ colors: { backdrop: 'rgba(0, 0, 0, 0.6)' } }}
                >
                    <View style={styles.filtrosHandle} />
                    <View style={styles.filtrosHeader}>
                        <Text style={styles.filtrosTitulo}>Filtros</Text>
                        <View style={styles.filtrosHeaderAcoes}>
                            {totalFiltrosAtivos > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setFiltroCargo('Todos');
                                        setFiltroPessoa('Todos');
                                    }}
                                    hitSlop={8}
                                >
                                    <Text style={styles.filtrosLimpar}>Limpar</Text>
                                </TouchableOpacity>
                            )}
                            <IconButton icon="close" size={18} iconColor={c.sub} onPress={() => setFiltrosVisivel(false)} />
                        </View>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text style={styles.filtrosSecao}>CARGO</Text>
                        <View style={styles.opcoesWrap}>
                            {renderOpcaoFiltro('Todos', filtroCargo === 'Todos', () => setFiltroCargo('Todos'))}
                            {cargosDisponiveis.map((cargo) =>
                                renderOpcaoFiltro(cargo, filtroCargo === cargo, () => setFiltroCargo(cargo), '#D6293E')
                            )}
                        </View>

                        <Text style={styles.filtrosSecao}>FUNCIONÁRIO</Text>
                        <View style={styles.opcoesWrap}>
                            {renderOpcaoFiltro('Todos', filtroPessoa === 'Todos', () => setFiltroPessoa('Todos'))}
                            {pessoasDisponiveis.map((nome) =>
                                renderOpcaoFiltro(nome, filtroPessoa === nome, () => setFiltroPessoa(nome))
                            )}
                        </View>
                    </ScrollView>

                    <TouchableOpacity style={styles.filtrosAplicar} onPress={() => setFiltrosVisivel(false)}>
                        <Text style={styles.filtrosAplicarTexto}>
                            Ver {validacoesFiltradas.length} {validacoesFiltradas.length === 1 ? 'resultado' : 'resultados'}
                        </Text>
                    </TouchableOpacity>
                </Modal>
            </Portal>
        </View>
    );
}

const criarEstilos = (c, alturaTela) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: c.fundo,
        },
        conteudo: {
            paddingHorizontal: 20,
            paddingTop: 22,
            paddingBottom: 32,
        },
        titulo: {
            color: c.texto,
            fontSize: 22,
            fontWeight: 'bold',
        },
        divisor: {
            height: 1,
            backgroundColor: c.borda,
            marginTop: 16,
            marginBottom: 18,
        },
        alertaCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: c.ambarFundo,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 14,
            marginBottom: 14,
        },
        alertaCardOk: {
            backgroundColor: c.sucessoFundo,
        },
        alertaTexto: {
            color: c.ambarForte,
            fontSize: 14,
            fontWeight: 'bold',
        },
        chip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: c.ambarFundo,
            borderRadius: 20,
            paddingHorizontal: 10,
            paddingVertical: 5,
        },
        chipTexto: {
            color: c.ambarTexto,
            fontSize: 11,
            fontWeight: '600',
        },
        abasRow: {
            flexDirection: 'row',
            backgroundColor: c.campo,
            borderRadius: 12,
            padding: 4,
            marginBottom: 10,
        },
        abaItem: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 11,
            borderRadius: 10,
        },
        abaItemAtiva: {
            backgroundColor: c.amarelo,
        },
        abaTexto: {
            color: c.sub,
            fontSize: 13,
        },
        abaTextoAtiva: {
            color: c.sobreAmarelo,
            fontWeight: 'bold',
        },
        abaContador: {
            minWidth: 20,
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 10,
            backgroundColor: c.borda,
            alignItems: 'center',
        },
        abaContadorAtivo: {
            backgroundColor: 'rgba(43, 27, 18, 0.15)',
        },
        abaContadorTexto: {
            color: c.sub,
            fontSize: 11,
        },
        buscaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
        },
        buscaCampo: {
            flex: 1,
        },
        searchInput: {
            backgroundColor: c.campo,
            fontSize: 14,
            height: 48,
        },
        inputOutline: {
            borderRadius: 12,
        },
        botaoFiltro: {
            width: 48,
            height: 48,
            marginTop: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.borda,
            backgroundColor: c.campo,
            alignItems: 'center',
            justifyContent: 'center',
        },
        botaoFiltroAtivo: {
            borderColor: c.amarelo,
            backgroundColor: c.ambarFundo,
        },
        botaoFiltroBadge: {
            position: 'absolute',
            top: -5,
            right: -5,
            width: 17,
            height: 17,
            borderRadius: 9,
            backgroundColor: c.amarelo,
            alignItems: 'center',
            justifyContent: 'center',
        },
        botaoFiltroBadgeTexto: {
            color: c.sobreAmarelo,
            fontSize: 10,
            fontWeight: 'bold',
        },
        chipsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 8,
        },
        dot: {
            width: 6,
            height: 6,
            borderRadius: 3,
        },
        emptyState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 48,
            gap: 8,
        },
        emptyStateTexto: {
            color: c.sub,
            fontSize: 14,
        },
        lista: {
            gap: 8,
            marginTop: 6,
        },
        card: {
            backgroundColor: c.superficie,
            borderWidth: 1,
            borderColor: c.borda,
            borderRadius: 14,
            paddingVertical: 10,
            paddingHorizontal: 12,
        },
        cardTopo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        avatarFallback: {
            backgroundColor: c.marrom,
        },
        avatarTexto: {
            fontSize: 12,
            fontWeight: 'bold',
        },
        cardTopoInfo: {
            flex: 1,
        },
        cardTitulo: {
            color: c.texto,
            fontSize: 14,
            fontWeight: 'bold',
        },
        cardSub: {
            color: c.sub,
            fontSize: 11,
            marginTop: 1,
        },
        cardSubAtraso: {
            color: c.perigo,
            fontWeight: 'bold',
        },
        progressoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 10,
        },
        quadrados: {
            flexDirection: 'row',
            gap: 3,
        },
        quadrado: {
            width: 10,
            height: 10,
            borderRadius: 2,
            backgroundColor: c.quadradoVazio,
        },
        quadradoPreenchido: {
            backgroundColor: c.quadradoCheio,
        },
        progressoTexto: {
            color: c.sub,
            fontSize: 11,
            fontWeight: 'bold',
        },
        cardRodape: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 9,
        },
        metaRow: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            columnGap: 12,
            rowGap: 4,
        },
        metaItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
        },
        metaTexto: {
            color: c.sub,
            fontSize: 11,
        },
        botaoRevisar: {
            backgroundColor: c.amarelo,
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 20,
            minWidth: 96,
            alignItems: 'center',
        },
        botaoRevisarTexto: {
            color: c.sobreAmarelo,
            fontSize: 14,
            fontWeight: 'bold',
        },
        botaoVerDetalhes: {
            backgroundColor: c.campo,
            borderWidth: 1,
            borderColor: c.borda,
        },
        botaoVerDetalhesTexto: {
            color: c.texto,
        },
        filtrosWrapper: {
            justifyContent: 'flex-end',
            margin: 0,
        },
        filtrosContainer: {
            backgroundColor: c.superficie,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 20,
            paddingTop: 10,
            maxHeight: alturaTela * 0.75,
        },
        filtrosHandle: {
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: c.borda,
            alignSelf: 'center',
            marginBottom: 6,
        },
        filtrosHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        filtrosHeaderAcoes: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        filtrosTitulo: {
            color: c.texto,
            fontSize: 17,
            fontWeight: 'bold',
        },
        filtrosLimpar: {
            color: c.ambarTexto,
            fontSize: 13,
            fontWeight: 'bold',
        },
        filtrosSecao: {
            color: c.sub,
            fontSize: 11,
            letterSpacing: 1,
            marginTop: 8,
            marginBottom: 8,
        },
        opcoesWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 8,
        },
        opcaoFiltro: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            maxWidth: '100%',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: c.borda,
            backgroundColor: c.campo,
        },
        opcaoFiltroAtiva: {
            borderColor: c.amarelo,
            backgroundColor: c.ambarFundo,
        },
        opcaoFiltroTexto: {
            color: c.texto,
            fontSize: 13,
            flexShrink: 1,
        },
        opcaoFiltroTextoAtivo: {
            color: c.ambarTexto,
            fontWeight: 'bold',
        },
        filtrosAplicar: {
            backgroundColor: c.amarelo,
            borderRadius: 12,
            paddingVertical: 15,
            alignItems: 'center',
            marginTop: 12,
        },
        filtrosAplicarTexto: {
            color: c.sobreAmarelo,
            fontSize: 14,
            fontWeight: 'bold',
        },
    });