import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, AppState, useWindowDimensions, Alert } from 'react-native';
import { Text, Icon, IconButton, Portal, Modal, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getTarefasDoDiaPorFuncionario } from '../../services/tarefas';
import { getExecucoesDoDia } from '../../services/execucoes';
import { useTema } from '../../theme/Themecontext';

const diasSemanaCurto = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const formatarDataCurta = (data) => {
    const diaSemana = diasSemanaCurto[data.getDay()];
    const dia = data.getDate();
    const mes = meses[data.getMonth()];
    return `${diaSemana}, ${dia} de ${mes}`;
};

const FILTROS = [
    { valor: 'todas', texto: 'Gerais' },
    { valor: 'minhas', texto: 'Minhas' },
    { valor: 'setor', texto: 'Do cargo' },
];

const ABAS_STATUS = [
    { valor: 'pendentes', texto: 'Pendentes' },
    { valor: 'analise', texto: 'Em análise' },
    { valor: 'concluidas', texto: 'Concluídas' },
];

const horarioParaMinutos = (horario) => {
    const [hora, minuto] = (horario || '00:00').split(':').map(Number);
    return (hora || 0) * 60 + (minuto || 0);
};

const dataDeTexto = (texto) => {
    const [dia, mes, ano] = (texto || '').split('/').map(Number);
    if (!dia || !mes || !ano) return null;
    return new Date(ano, mes - 1, dia);
};

const ehPrazoFuturo = (tarefa) => tarefa.frequenciaTipo === 'unica' && !!dataDeTexto(tarefa.dataUnica);

const prazoDaTarefa = (tarefa) => {
    const minutos = horarioParaMinutos(tarefa.horario);
    const base = ehPrazoFuturo(tarefa) ? dataDeTexto(tarefa.dataUnica) : new Date();
    const prazo = new Date(base);
    prazo.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
    return prazo;
};

const statusDaTarefa = (tarefa) => (prazoDaTarefa(tarefa) < new Date() ? 'atrasada' : 'pendente');

const diaDoPrazo = (tarefa) => {
    if (!ehPrazoFuturo(tarefa)) return null;
    const data = dataDeTexto(tarefa.dataUnica);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diferenca = Math.round((data - hoje) / 86400000);
    if (diferenca === 0) return 'Hoje';
    if (diferenca === 1) return 'Amanhã';
    return tarefa.dataUnica.slice(0, 5);
};

const descreverPrazo = (tarefa) => {
    const data = dataDeTexto(tarefa.dataUnica);
    return `Prazo: ${diasSemanaCurto[data.getDay()]}, ${data.getDate()} de ${meses[data.getMonth()]}`;
};

const textoDoStatus = {
    pendente: 'Pendente',
    concluida: 'Concluída',
    atrasada: 'Atrasada',
    aguardando: 'Aguardando validação',
    rejeitada: 'Rejeitada, refazer',
};

const descreverFrequencia = (tarefa) => {
    if (!tarefa) return '';
    if (tarefa.frequenciaTipo === 'diaria') return 'Diária';
    if (tarefa.frequenciaTipo === 'unica') return ehPrazoFuturo(tarefa) ? descreverPrazo(tarefa) : 'Tarefa única';
    if (tarefa.frequenciaTipo === 'dias') {
        if (!tarefa.dias || tarefa.dias.length === 0) return 'Nenhum dia selecionado';
        return tarefa.dias.map((dia) => dia.slice(0, 3)).join(', ');
    }
    return '';
};

export default function FuncionariosTarefas({ route, navigation }) {
    const funcionario = route?.params?.funcionario;
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
            textoMedio: escuro ? '#D0D0D0' : '#4A4A4A',
            sub: escuro ? '#A0A0A0' : '#8A8A8A',
            amarelo: '#F4B740',
            sobreAmarelo: '#2B1B12',
            verde: escuro ? '#7BC47F' : '#3F6B3A',
            verdeForte: escuro ? '#3F7F42' : '#4E9350',
            vermelho: escuro ? '#FF6B6B' : '#C62828',
            vermelhoForte: escuro ? '#B83232' : '#C62828',
            vermelhoMotivo: escuro ? '#E8A0A0' : '#8A4040',
            azul: escuro ? '#7FAEE3' : '#3B6EA8',
            azulForte: escuro ? '#3567A0' : '#3B6EA8',
            laranja: escuro ? '#E0A23A' : '#C97A0E',
            escuro,
        }),
        [cores, escuro]
    );

    const styles = useMemo(() => criarEstilos(c, alturaTela), [c, alturaTela]);

    const corDoStatus = (status) => {
        if (status === 'concluida') return c.verde;
        if (status === 'atrasada' || status === 'rejeitada') return c.vermelho;
        if (status === 'aguardando') return c.azul;
        return c.laranja;
    };

    const estiloHorario = (status) => {
        if (status === 'atrasada' || status === 'rejeitada') return { bg: c.vermelhoForte, texto: '#FFFFFF' };
        if (status === 'concluida') return { bg: c.verdeForte, texto: '#FFFFFF' };
        if (status === 'aguardando') return { bg: c.azulForte, texto: '#FFFFFF' };
        return { bg: c.campo, texto: c.texto };
    };

    const [tarefas, setTarefas] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [filtro, setFiltro] = useState('todas');
    const [abaStatus, setAbaStatus] = useState('pendentes');
    const [filtroMenuVisivel, setFiltroMenuVisivel] = useState(false);

    const [detalheVisivel, setDetalheVisivel] = useState(false);
    const [tarefaDetalhe, setTarefaDetalhe] = useState(null);
    const [execucoesPorTarefa, setExecucoesPorTarefa] = useState({});

    useFocusEffect(
        useCallback(() => {
            carregarTarefas();
            carregarExecucoes();
        }, [funcionario?.id])
    );

    useEffect(() => {
        const assinatura = AppState.addEventListener('change', (proximoEstado) => {
            if (proximoEstado === 'active') {
                carregarTarefas();
                carregarExecucoes();
            }
        });
        return () => assinatura.remove();
    }, [funcionario?.id]);

    const carregarTarefas = async () => {
        setCarregando(true);
        try {
            const tarefasDoDia = await getTarefasDoDiaPorFuncionario(funcionario);
            setTarefas(tarefasDoDia);
        } catch (error) {
            setTarefas([]);
        }
        setCarregando(false);
    };

    const carregarExecucoes = async () => {
        try {
            const execucoes = await getExecucoesDoDia(funcionario?.id);
            const porTarefa = {};
            execucoes.forEach((execucao) => {
                porTarefa[execucao.tarefaId] = execucao;
            });
            setExecucoesPorTarefa(porTarefa);
        } catch (error) {
            setExecucoesPorTarefa({});
        }
    };

    const abrirDetalhe = (tarefa) => {
        setTarefaDetalhe(tarefa);
        setDetalheVisivel(true);
    };

    const abrirConfirmarIniciar = () => {
        Alert.alert(
            'Deseja realmente iniciar a tarefa?',
            'Você poderá acompanhar as etapas assim que começar.',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Iniciar', onPress: confirmarIniciarTarefa },
            ]
        );
    };

    const statusExibido = (tarefa) => {
        const execucao = execucoesPorTarefa[tarefa.id];
        if (execucao) {
            if (execucao.status === 'aprovada') return 'concluida';
            if (execucao.status === 'rejeitada') return 'rejeitada';
            return 'aguardando';
        }
        return statusDaTarefa(tarefa);
    };

    const confirmarIniciarTarefa = () => {
        setDetalheVisivel(false);
        navigation?.navigate('EtapasTarefa', {
            tarefa: tarefaDetalhe,
            funcionario,
            execucaoExistente: execucoesPorTarefa[tarefaDetalhe.id] || null,
            onConcluir: carregarExecucoes,
        });
    };

    const tarefasFiltradas = tarefas.filter((tarefa) => {
        const status = statusExibido(tarefa);

        const statusOk =
            abaStatus === 'pendentes'
                ? status === 'pendente' || status === 'atrasada' || status === 'rejeitada'
                : abaStatus === 'analise'
                    ? status === 'aguardando'
                    : status === 'concluida';

        const filtroOk =
            filtro === 'minhas'
                ? tarefa.atribuidoTipo === 'ambos'
                : filtro === 'setor'
                    ? tarefa.atribuidoTipo !== 'ambos'
                    : true;

        return statusOk && filtroOk;
    });

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView contentContainerStyle={styles.conteudo}>
                <Text style={styles.saudacao}>Olá, {funcionario?.nome?.split(' ')[0] || 'funcionário'}</Text>
                <Text style={styles.subtitulo}>Tarefas do dia · {formatarDataCurta(new Date())}</Text>

                <View style={styles.divisor} />

                <View style={styles.segmentado}>
                    {ABAS_STATUS.map((aba) => (
                        <TouchableOpacity
                            key={aba.valor}
                            style={[styles.segmentadoItem, abaStatus === aba.valor && styles.segmentadoItemAtivo]}
                            onPress={() => setAbaStatus(aba.valor)}
                        >
                            <Text style={[styles.segmentadoTexto, abaStatus === aba.valor && styles.segmentadoTextoAtivo]}>
                                {aba.texto}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={styles.filtroDropdown} onPress={() => setFiltroMenuVisivel(true)}>
                    <Icon source="filter-variant" size={14} color={c.sub} />
                    <Text style={styles.filtroDropdownTexto}>
                        {FILTROS.find((opcao) => opcao.valor === filtro)?.texto}
                    </Text>
                    <Icon source="chevron-down" size={16} color={c.sub} />
                </TouchableOpacity>

                {carregando ? (
                    <View style={styles.emptyState}>
                        <ActivityIndicator animating color={c.vermelho} />
                        <Text style={styles.emptyStateTexto}>Carregando tarefas...</Text>
                    </View>
                ) : tarefasFiltradas.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Icon source="clipboard-check-outline" size={28} color={c.sub} />
                        <Text style={styles.emptyStateTexto}>
                            {abaStatus === 'pendentes' && 'Nenhuma tarefa pendente'}
                            {abaStatus === 'analise' && 'Nenhuma tarefa em análise'}
                            {abaStatus === 'concluidas' && 'Nenhuma tarefa concluída ainda'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.lista}>
                        {tarefasFiltradas.map((tarefa) => {
                            const status = statusExibido(tarefa);
                            const cor = corDoStatus(status);
                            const horario = estiloHorario(status);
                            const dia = diaDoPrazo(tarefa);
                            return (
                                <TouchableOpacity key={tarefa.id} style={styles.card} onPress={() => abrirDetalhe(tarefa)}>
                                    <View style={styles.cardInner}>
                                        <View style={[styles.horarioBox, { backgroundColor: horario.bg }]}>
                                            <Text style={[styles.horarioTexto, { color: horario.texto }]}>
                                                {tarefa.horario}
                                            </Text>
                                            {!!dia && (
                                                <Text style={[styles.horarioData, { color: horario.texto }]}>{dia}</Text>
                                            )}
                                        </View>
                                        <View style={styles.cardConteudo}>
                                            <Text style={styles.cardTitulo}>{tarefa.titulo}</Text>
                                            {!!tarefa.descricao && (
                                                <Text style={styles.cardDescricao} numberOfLines={2}>{tarefa.descricao}</Text>
                                            )}
                                            <View style={styles.cardRodape}>
                                                <View style={styles.cardRodapeLinha}>
                                                    <View style={[styles.statusBadge, { backgroundColor: `${cor}26` }]}>
                                                        <View style={[styles.dot, { backgroundColor: cor }]} />
                                                        <Text style={[styles.statusBadgeTexto, { color: cor }]}>{textoDoStatus[status]}</Text>
                                                    </View>
                                                </View>
                                                {(tarefa.atribuidoTipo === 'ambos' || tarefa.etapas?.length > 0) && (
                                                    <View style={styles.cardRodapeLinha}>
                                                        {tarefa.atribuidoTipo === 'ambos' && (
                                                            <View style={styles.exclusivaInfo}>
                                                                <Icon source="account-outline" size={12} color={c.sub} />
                                                                <Text style={styles.exclusivaTexto}>Exclusiva</Text>
                                                            </View>
                                                        )}
                                                        {tarefa.etapas?.length > 0 && (
                                                            <View style={styles.etapasInfo}>
                                                                <Icon source="format-list-checks" size={14} color={c.sub} />
                                                                <Text style={styles.etapasTexto}>{tarefa.etapas.length} etapas</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <View style={styles.cardChevron}>
                                            <Icon source="chevron-right" size={20} color={c.sub} />
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
                    visible={filtroMenuVisivel}
                    onDismiss={() => setFiltroMenuVisivel(false)}
                    contentContainerStyle={styles.filtroMenuContainer}
                    theme={{ colors: { backdrop: 'rgba(0, 0, 0, 0.6)' } }}
                >
                    {FILTROS.map((opcao) => (
                        <TouchableOpacity
                            key={opcao.valor}
                            style={styles.filtroMenuOpcao}
                            onPress={() => {
                                setFiltro(opcao.valor);
                                setFiltroMenuVisivel(false);
                            }}
                        >
                            <Text
                                style={[
                                    styles.filtroMenuOpcaoTexto,
                                    filtro === opcao.valor && styles.filtroMenuOpcaoTextoAtiva,
                                ]}
                            >
                                {opcao.texto}
                            </Text>
                            {filtro === opcao.valor && <Icon source="check" size={16} color={c.amarelo} />}
                        </TouchableOpacity>
                    ))}
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={detalheVisivel}
                    onDismiss={() => setDetalheVisivel(false)}
                    contentContainerStyle={[styles.detalheContainer, { paddingBottom: Math.max(insets.bottom + 20, 28) }]}
                    style={styles.detalheModalWrapper}
                    theme={{ colors: { backdrop: 'rgba(0, 0, 0, 0.6)' } }}
                >
                    {tarefaDetalhe && (() => {
                        const statusDetalhe = statusExibido(tarefaDetalhe);
                        const corDetalhe = corDoStatus(statusDetalhe);
                        const execucaoDetalhe = execucoesPorTarefa[tarefaDetalhe.id];
                        return (
                            <View>
                                <View style={styles.detalheHandle} />

                                <View style={styles.detalheHeader}>
                                    <View style={[styles.statusBadge, { backgroundColor: `${corDetalhe}26` }]}>
                                        <View style={[styles.dot, { backgroundColor: corDetalhe }]} />
                                        <Text style={[styles.statusBadgeTexto, { color: corDetalhe }]}>
                                            {textoDoStatus[statusDetalhe]}
                                        </Text>
                                    </View>
                                    <IconButton
                                        icon="close"
                                        size={18}
                                        iconColor={c.sub}
                                        onPress={() => setDetalheVisivel(false)}
                                        style={styles.detalheFechar}
                                    />
                                </View>

                                <Text style={styles.detalheTitulo}>{tarefaDetalhe.titulo}</Text>

                                <View style={styles.detalheChipsRow}>
                                    <View style={styles.detalheChip}>
                                        <Icon source="clock-outline" size={15} color={c.sub} />
                                        <Text style={styles.detalheChipTexto}>{tarefaDetalhe.horario}</Text>
                                    </View>
                                    <View style={[styles.detalheChip, styles.detalheChipFlex]}>
                                        <Icon source="calendar-outline" size={15} color={c.sub} />
                                        <Text style={styles.detalheChipTexto} numberOfLines={1}>
                                            {descreverFrequencia(tarefaDetalhe)}
                                        </Text>
                                    </View>
                                </View>

                                {!!tarefaDetalhe.descricao && (
                                    <Text style={styles.detalheDescricao}>{tarefaDetalhe.descricao}</Text>
                                )}

                                {tarefaDetalhe.atribuidoTipo === 'ambos' && (
                                    <View style={styles.detalheResponsavelRow}>
                                        <Icon source="account-outline" size={14} color={c.sub} />
                                        <Text style={styles.detalheResponsavelTexto}>Tarefa exclusiva pra você</Text>
                                    </View>
                                )}

                                {tarefaDetalhe.etapas?.length > 0 && (
                                    <View style={styles.detalheEtapasBloco}>
                                        <View style={styles.detalheEtapasHeader}>
                                            <Text style={styles.detalheEtapasLabel}>ETAPAS</Text>
                                            <Text style={styles.detalheEtapasContador}>{tarefaDetalhe.etapas.length} etapas</Text>
                                        </View>

                                        <ScrollView style={styles.detalheEtapasScroll} nestedScrollEnabled>
                                            {tarefaDetalhe.etapas.map((etapa, indice) => (
                                                <View key={etapa.id} style={styles.detalheEtapaLinha}>
                                                    <View style={styles.detalheEtapaNumero}>
                                                        <Text style={styles.detalheEtapaNumeroTexto}>{indice + 1}</Text>
                                                    </View>
                                                    <Text style={styles.detalheEtapaTitulo} numberOfLines={1}>{etapa.titulo}</Text>
                                                    {etapa.requerFoto && <Icon source="camera-outline" size={16} color={c.verde} />}
                                                </View>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {statusDetalhe === 'aguardando' && (
                                    <View style={styles.avisoAguardando}>
                                        <Icon source="clock-check-outline" size={16} color={c.azul} />
                                        <Text style={styles.avisoAguardandoTexto}>Aguardando validação do responsável</Text>
                                    </View>
                                )}

                                {statusDetalhe === 'concluida' && (
                                    <View style={styles.avisoAprovada}>
                                        <Icon source="check-circle-outline" size={16} color={c.verde} />
                                        <Text style={styles.avisoAprovadaTexto}>Tarefa aprovada</Text>
                                    </View>
                                )}

                                {statusDetalhe === 'rejeitada' && (
                                    <View style={styles.avisoRejeitada}>
                                        <View style={styles.avisoRejeitadaTopo}>
                                            <Icon source="alert-circle-outline" size={16} color={c.vermelho} />
                                            <Text style={styles.avisoRejeitadaTexto}>Não aprovada, refaça a tarefa</Text>
                                        </View>
                                        {!!execucaoDetalhe?.motivoRejeicao && (
                                            <Text style={styles.avisoRejeitadaMotivo}>{execucaoDetalhe.motivoRejeicao}</Text>
                                        )}
                                    </View>
                                )}

                                {(statusDetalhe === 'pendente' || statusDetalhe === 'atrasada' || statusDetalhe === 'rejeitada') && (
                                    <TouchableOpacity style={styles.botaoIniciar} onPress={abrirConfirmarIniciar}>
                                        <Icon source="play-circle-outline" size={18} color={c.sobreAmarelo} />
                                        <Text style={styles.botaoIniciarTexto}>Iniciar tarefa</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })()}
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
            paddingHorizontal: 24,
            paddingTop: 22,
            paddingBottom: 32,
        },
        saudacao: {
            color: c.texto,
            fontSize: 22,
            fontWeight: 'bold',
            marginBottom: 4,
        },
        subtitulo: {
            color: c.sub,
            fontSize: 13,
            marginBottom: 18,
        },
        divisor: {
            height: 1,
            backgroundColor: c.borda,
            marginBottom: 18,
        },
        segmentado: {
            flexDirection: 'row',
            backgroundColor: c.campo,
            borderRadius: 14,
            padding: 4,
            marginBottom: 18,
        },
        segmentadoItem: {
            flex: 1,
            alignItems: 'center',
            paddingVertical: 9,
            borderRadius: 10,
        },
        segmentadoItemAtivo: {
            backgroundColor: c.amarelo,
        },
        segmentadoTexto: {
            color: c.sub,
            fontSize: 12,
        },
        segmentadoTextoAtivo: {
            color: c.sobreAmarelo,
            fontWeight: 'bold',
        },
        filtroDropdown: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: 6,
            backgroundColor: c.campo,
            borderWidth: 1,
            borderColor: c.borda,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 18,
        },
        filtroDropdownTexto: {
            color: c.textoMedio,
            fontSize: 12,
            fontWeight: '600',
        },
        filtroMenuContainer: {
            backgroundColor: c.superficie,
            borderRadius: 16,
            paddingVertical: 8,
            marginHorizontal: 60,
        },
        filtroMenuOpcao: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 13,
            paddingHorizontal: 18,
        },
        filtroMenuOpcaoTexto: {
            color: c.texto,
            fontSize: 14,
        },
        filtroMenuOpcaoTextoAtiva: {
            fontWeight: 'bold',
        },
        emptyState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 48,
            gap: 8,
        },
        emptyStateTexto: {
            color: c.sub,
            fontSize: 15,
        },
        lista: {
            gap: 10,
        },
        card: {
            borderRadius: 16,
            backgroundColor: c.superficie,
            borderWidth: c.escuro ? 1 : 0,
            borderColor: c.borda,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: c.escuro ? 0 : 0.08,
            shadowRadius: 6,
            elevation: c.escuro ? 0 : 3,
            marginHorizontal: 1,
        },
        cardInner: {
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 16,
            overflow: 'hidden',
        },
        cardChevron: {
            marginRight: 12,
        },
        horarioBox: {
            width: 60,
            alignSelf: 'stretch',
            alignItems: 'center',
            justifyContent: 'center',
        },
        horarioTexto: {
            fontSize: 16,
            fontWeight: 'bold',
        },
        horarioData: {
            fontSize: 11,
            fontWeight: 'bold',
            marginTop: 2,
            opacity: 0.85,
        },
        cardConteudo: {
            flex: 1,
            padding: 12,
        },
        cardTitulo: {
            color: c.texto,
            fontSize: 14,
            fontWeight: 'bold',
            marginBottom: 4,
        },
        cardDescricao: {
            color: c.sub,
            fontSize: 12,
            marginBottom: 8,
        },
        cardRodape: {
            gap: 6,
        },
        cardRodapeLinha: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
        },
        dot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 20,
        },
        statusBadgeTexto: {
            fontSize: 11,
            fontWeight: 'bold',
        },
        exclusivaInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        exclusivaTexto: {
            color: c.sub,
            fontSize: 11,
        },
        etapasInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        etapasTexto: {
            color: c.sub,
            fontSize: 12,
        },
        detalheModalWrapper: {
            justifyContent: 'flex-end',
            margin: 0,
        },
        detalheContainer: {
            backgroundColor: c.superficie,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 20,
            paddingTop: 12,
            maxHeight: alturaTela * 0.85,
        },
        detalheHandle: {
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: c.borda,
            alignSelf: 'center',
            marginBottom: 16,
        },
        detalheHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
        },
        detalheFechar: {
            margin: 0,
        },
        detalheTitulo: {
            color: c.texto,
            fontSize: 19,
            fontWeight: 'bold',
            marginBottom: 14,
        },
        detalheChipsRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 16,
        },
        detalheChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: c.campo,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
        },
        detalheChipFlex: {
            flexShrink: 1,
        },
        detalheChipTexto: {
            color: c.texto,
            fontSize: 12,
        },
        detalheDescricao: {
            color: c.sub,
            fontSize: 13,
            lineHeight: 20,
            marginBottom: 16,
        },
        detalheResponsavelRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 16,
        },
        detalheResponsavelTexto: {
            color: c.sub,
            fontSize: 12,
        },
        detalheEtapasBloco: {
            borderTopWidth: 1,
            borderTopColor: c.borda,
            paddingTop: 14,
            marginBottom: 20,
        },
        detalheEtapasHeader: {
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 10,
        },
        detalheEtapasLabel: {
            color: c.sub,
            fontSize: 11,
            letterSpacing: 1,
        },
        detalheEtapasContador: {
            color: c.sub,
            fontSize: 11,
        },
        detalheEtapasScroll: {
            maxHeight: Math.min(160, alturaTela * 0.22),
        },
        detalheEtapaLinha: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 8,
        },
        detalheEtapaNumero: {
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: c.campo,
            borderWidth: 1,
            borderColor: c.borda,
            alignItems: 'center',
            justifyContent: 'center',
        },
        detalheEtapaNumeroTexto: {
            color: c.sub,
            fontSize: 10,
            fontWeight: 'bold',
        },
        detalheEtapaTitulo: {
            flex: 1,
            color: c.texto,
            fontSize: 13,
        },
        botaoIniciar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: c.amarelo,
            borderRadius: 12,
            paddingVertical: 14,
        },
        botaoIniciarTexto: {
            color: c.sobreAmarelo,
            fontSize: 15,
            fontWeight: 'bold',
        },
        avisoAguardando: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: `${c.azul}20`,
            borderRadius: 12,
            paddingVertical: 14,
        },
        avisoAguardandoTexto: {
            color: c.azul,
            fontSize: 13,
            fontWeight: 'bold',
        },
        avisoAprovada: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: `${c.verde}20`,
            borderRadius: 12,
            paddingVertical: 14,
        },
        avisoAprovadaTexto: {
            color: c.verde,
            fontSize: 13,
            fontWeight: 'bold',
        },
        avisoRejeitada: {
            backgroundColor: `${c.vermelho}1A`,
            borderRadius: 12,
            paddingVertical: 14,
            paddingHorizontal: 14,
            marginBottom: 10,
            gap: 6,
        },
        avisoRejeitadaTopo: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
        },
        avisoRejeitadaMotivo: {
            color: c.vermelhoMotivo,
            fontSize: 13,
            textAlign: 'center',
        },
        avisoRejeitadaTexto: {
            color: c.vermelho,
            fontSize: 13,
            fontWeight: 'bold',
        },
    });