import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Avatar, ActivityIndicator, IconButton, Portal, Modal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { formatarDataHoje } from '../../services/execucoes';
import { getRanking } from '../../services/ranking';
import { getCargos } from '../../services/cargos';
import { useTema } from '../../theme/Themecontext';


const DIAS_SEMANA_TAREFA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const STATUS_CONCLUIDA = ['aguardando', 'aprovada'];

const paraMinutos = (horario) => {
    if (typeof horario !== 'string' || !horario.includes(':')) return null;
    const [h, m] = horario.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
};

const tarefaEhDeHoje = (tarefa, agora, dataHoje) => {
    if (tarefa.frequenciaTipo === 'diaria') return true;
    if (tarefa.frequenciaTipo === 'unica') return tarefa.dataUnica === dataHoje;
    if (tarefa.frequenciaTipo === 'dias') {
        const nomeHoje = DIAS_SEMANA_TAREFA[agora.getDay()];
        return (tarefa.dias || []).includes(nomeHoje);
    }
    return false;
};

const calcularResumo = (tarefas, execucoes, agora) => {
    const dataHoje = formatarDataHoje();
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

    const concluidasIds = new Set();
    const concluidasTitulos = new Set();
    execucoes
        .filter((e) => STATUS_CONCLUIDA.includes(e.status))
        .forEach((e) => {
            if (e.tarefaId) concluidasIds.add(e.tarefaId);
            if (e.tarefaTitulo) concluidasTitulos.add(e.tarefaTitulo);
        });

    const tarefasHoje = tarefas.filter((t) => tarefaEhDeHoje(t, agora, dataHoje));

    let concluidas = 0;
    let pendentes = 0;
    let atrasadas = 0;
    const porCargo = {};

    tarefasHoje.forEach((tarefa) => {
        const feita = concluidasIds.has(tarefa.id) || concluidasTitulos.has(tarefa.titulo);
        const prazo = paraMinutos(tarefa.horario);
        const cargo = tarefa.cargo || 'Sem cargo';

        if (!porCargo[cargo]) porCargo[cargo] = { nome: cargo, total: 0, feitas: 0 };
        porCargo[cargo].total += 1;

        if (feita) {
            concluidas += 1;
            porCargo[cargo].feitas += 1;
        } else if (prazo !== null && prazo < minutosAgora) {
            atrasadas += 1;
        } else {
            pendentes += 1;
        }
    });

    const progressoPorCargo = Object.values(porCargo)
        .map((item) => ({
            nome: item.nome,
            total: item.total,
            feitas: item.feitas,
            porcentagem: Math.round((item.feitas / item.total) * 100),
        }))
        .sort((a, b) => b.porcentagem - a.porcentagem || a.nome.localeCompare(b.nome));

    return { total: tarefasHoje.length, concluidas, pendentes, atrasadas, progressoPorCargo };
};

const PERIODOS = [
    { valor: 'semanal', texto: 'Semanal' },
    { valor: 'mensal', texto: 'Mensal' },
];

const LIMITE_NA_PREVIA = 3;

const TAMANHO_ANEL = 84;
const ESPESSURA_ANEL = 9;

const iniciais = (nome) =>
    (nome || '?').trim().split(/\s+/).map((parte) => parte[0]).slice(0, 2).join('').toUpperCase();

const normalizarPessoa = (pessoa) => ({
    id: pessoa.id ?? pessoa.funcionarioId ?? pessoa.nome,
    nome: pessoa.nome ?? pessoa.funcionarioNome ?? 'Sem nome',
    icone: pessoa.icone ?? pessoa.funcionarioIcone ?? '',
    porcentagem: pessoa.porcentagem ?? pessoa.percentual ?? null,
    pontos: pessoa.pontos ?? pessoa.pontuacao ?? null,
});

function AnelProgresso({ porcentagem, cor, corFundo, corTexto }) {
    const raio = (TAMANHO_ANEL - ESPESSURA_ANEL) / 2;
    const circunferencia = 2 * Math.PI * raio;
    const deslocamento = circunferencia * (1 - Math.min(Math.max(porcentagem, 0), 100) / 100);

    return (
        <View style={{ width: TAMANHO_ANEL, height: TAMANHO_ANEL, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={TAMANHO_ANEL} height={TAMANHO_ANEL} style={StyleSheet.absoluteFill}>
                <Circle
                    cx={TAMANHO_ANEL / 2}
                    cy={TAMANHO_ANEL / 2}
                    r={raio}
                    stroke={corFundo}
                    strokeWidth={ESPESSURA_ANEL}
                    fill="none"
                />
                <Circle
                    cx={TAMANHO_ANEL / 2}
                    cy={TAMANHO_ANEL / 2}
                    r={raio}
                    stroke={cor}
                    strokeWidth={ESPESSURA_ANEL}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${circunferencia} ${circunferencia}`}
                    strokeDashoffset={deslocamento}
                    rotation={-90}
                    origin={`${TAMANHO_ANEL / 2}, ${TAMANHO_ANEL / 2}`}
                />
            </Svg>
            <Text style={{ color: corTexto, fontSize: 19, fontWeight: 'bold' }}>{porcentagem}%</Text>
        </View>
    );
}

export default function Dashboard({ route }) {
    const admin = route?.params?.admin;
    const insets = useSafeAreaInsets();
    const { cores, modo } = useTema();
    const escuro = modo === 'escuro';

    const c = useMemo(
        () => ({
            fundo: cores.fundo,
            superficie: escuro ? cores.card : '#FFFFFF',
            campo: escuro ? '#2A2A2C' : '#F2F2F4',
            borda: escuro ? cores.borda : '#E8E8EC',
            texto: cores.texto,
            sub: escuro ? '#A0A0A0' : '#8A8A8A',
            amarelo: '#F4B740',
            sobreAmarelo: '#2B1B12',
            verde: escuro ? '#7BC47F' : '#2F9E5A',
            laranja: escuro ? '#E0A23A' : '#E0901A',
            vermelho: escuro ? '#FF6B6B' : '#E04848',
            ouro: escuro ? '#E0A23A' : '#E0A020',
            prata: escuro ? '#B5B5BA' : '#9A9AA0',
            bronze: escuro ? '#D08A4E' : '#C27A45',
            escuro,
        }),
        [cores, escuro]
    );

    const styles = useMemo(() => criarEstilos(c), [c]);

    const [tarefas, setTarefas] = useState([]);
    const [execucoesHoje, setExecucoesHoje] = useState([]);
    const [cargos, setCargos] = useState([]);
    const [carregandoTarefas, setCarregandoTarefas] = useState(true);
    const [carregandoExecucoes, setCarregandoExecucoes] = useState(true);
    const [agora, setAgora] = useState(new Date());

    useEffect(() => {
        const cancelarTarefas = onSnapshot(
            collection(db, 'Tarefas'),
            (snapshot) => {
                setTarefas(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
                setCarregandoTarefas(false);
            },
            (erro) => {
                console.log('Erro ao carregar tarefas:', erro?.message);
                setCarregandoTarefas(false);
            }
        );

        const cancelarExecucoes = onSnapshot(
            query(collection(db, 'Execucoes'), where('data', '==', formatarDataHoje())),
            (snapshot) => {
                setExecucoesHoje(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
                setCarregandoExecucoes(false);
            },
            (erro) => {
                console.log('Erro ao carregar execuções:', erro?.message);
                setCarregandoExecucoes(false);
            }
        );

        const carregarCargos = async () => {
            try {
                const lista = await getCargos();
                setCargos(Array.isArray(lista) ? lista : []);
            } catch (erro) {
                setCargos([]);
            }
        };
        carregarCargos();

        const relogio = setInterval(() => setAgora(new Date()), 60000);

        return () => {
            cancelarTarefas();
            cancelarExecucoes();
            clearInterval(relogio);
        };
    }, []);

    const resumo = useMemo(() => calcularResumo(tarefas, execucoesHoje, agora), [tarefas, execucoesHoje, agora]);
    const carregandoResumo = carregandoTarefas || carregandoExecucoes;

    const corDoCargo = (nome) => cargos.find((cargo) => cargo.nome === nome)?.cor || c.sub;

    const [periodo, setPeriodo] = useState('semanal');
    const [ranking, setRanking] = useState([]);
    const [carregandoRanking, setCarregandoRanking] = useState(true);
    const [rankingAberto, setRankingAberto] = useState(false);
    const [cargosAbertos, setCargosAbertos] = useState(false);

    useEffect(() => {
        let ativo = true;

        const carregar = async () => {
            setCarregandoRanking(true);
            try {
                const lista = await getRanking(periodo);
                if (ativo) setRanking(Array.isArray(lista) ? lista.map(normalizarPessoa) : []);
            } catch (erro) {
                console.log('Erro ao carregar ranking:', erro?.message);
                if (ativo) setRanking([]);
            }
            if (ativo) setCarregandoRanking(false);
        };

        carregar();

        return () => {
            ativo = false;
        };
    }, [periodo]);

    const corDaPorcentagem = (porcentagem) => {
        if (porcentagem >= 70) return c.verde;
        if (porcentagem >= 40) return c.laranja;
        return c.vermelho;
    };

    const corDaPosicao = (indice) => {
        if (indice === 0) return c.ouro;
        if (indice === 1) return c.prata;
        if (indice === 2) return c.bronze;
        return c.sub;
    };

    const porcentagemConclusao = resumo.total > 0 ? Math.round((resumo.concluidas / resumo.total) * 100) : 0;
    const corConclusao = resumo.total > 0 ? corDaPorcentagem(porcentagemConclusao) : c.sub;

    const cargosSemTarefaHoje = cargos
        .filter((cargo) => !resumo.progressoPorCargo.some((item) => item.nome === cargo.nome))
        .map((cargo) => ({ nome: cargo.nome, total: 0, feitas: 0, porcentagem: 0 }));

    const todosOsCargos = [...resumo.progressoPorCargo, ...cargosSemTarefaHoje];
    const previaDosCargos = resumo.progressoPorCargo.slice(0, LIMITE_NA_PREVIA);
    const previaDoRanking = ranking.slice(0, LIMITE_NA_PREVIA);
    const nomeDoPeriodo = periodo === 'mensal' ? 'mensal' : 'semanal';

    function mostrarCargo(cargo) {
        const semTarefas = cargo.total === 0;

        return (
            <View key={cargo.nome}>
                <View style={styles.cargoLinhaTopo}>
                    <View style={styles.cargoNomeRow}>
                        <View style={[styles.cargoDot, { backgroundColor: corDoCargo(cargo.nome) }]} />
                        <Text style={styles.cargoNome}>{cargo.nome}</Text>
                    </View>
                    <Text style={styles.cargoPorcentagem}>
                        {semTarefas ? 'Sem tarefas hoje' : `${cargo.feitas}/${cargo.total} · ${cargo.porcentagem}%`}
                    </Text>
                </View>
                <View style={styles.barraFundo}>
                    <View
                        style={[
                            styles.barraPreenchida,
                            { width: `${cargo.porcentagem}%`, backgroundColor: corDaPorcentagem(cargo.porcentagem) },
                        ]}
                    />
                </View>
            </View>
        );
    }

    function mostrarPessoaDoRanking(pessoa, indice, lista) {
        const corPosicao = corDaPosicao(indice);
        const temPorcentagem = pessoa.porcentagem !== null;
        const ultima = indice === lista.length - 1;

        return (
            <View key={pessoa.id} style={[styles.rankLinha, ultima && styles.rankLinhaUltima]}>
                <Text style={[styles.rankPosicao, { color: corPosicao }]}>{indice + 1}</Text>
                {pessoa.icone ? (
                    <Avatar.Image
                        size={32}
                        source={{ uri: pessoa.icone }}
                        style={[styles.rankFoto, { borderColor: corPosicao }]}
                    />
                ) : (
                    <View style={[styles.rankAvatar, { borderColor: corPosicao }]}>
                        <Text style={[styles.rankAvatarTexto, { color: corPosicao }]}>{iniciais(pessoa.nome)}</Text>
                    </View>
                )}
                <Text style={styles.rankNome} numberOfLines={1}>{pessoa.nome}</Text>
                <Text
                    style={[
                        styles.rankValor,
                        { color: temPorcentagem ? corDaPorcentagem(pessoa.porcentagem) : c.texto },
                    ]}
                >
                    {temPorcentagem ? `${pessoa.porcentagem}%` : `${pessoa.pontos ?? 0} pts`}
                </Text>
            </View>
        );
    }

    const indicadores = [
        { texto: 'Concluídas', valor: resumo.concluidas, cor: c.verde },
        { texto: 'Pendentes', valor: resumo.pendentes, cor: c.laranja },
        { texto: 'Atrasadas', valor: resumo.atrasadas, cor: c.vermelho },
    ];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView contentContainerStyle={styles.conteudo}>
                <Text style={styles.saudacao}>Olá, {admin?.nome?.split(' ')[0] || 'admin'}</Text>

                <View style={styles.divisor} />

                <View style={[styles.cartao, styles.resumoCard]}>
                    {carregandoResumo ? (
                        <View style={styles.anelCarregando}>
                            <ActivityIndicator color={c.amarelo} />
                        </View>
                    ) : (
                        <AnelProgresso
                            porcentagem={porcentagemConclusao}
                            cor={corConclusao}
                            corFundo={c.campo}
                            corTexto={c.texto}
                        />
                    )}
                    <View style={styles.resumoTextos}>
                        <Text style={styles.resumoTitulo}>
                            {resumo.total === 0 && !carregandoResumo ? 'Nenhuma tarefa hoje' : 'do dia concluído'}
                        </Text>
                        <Text style={styles.resumoSub}>
                            {carregandoResumo
                                ? 'Carregando...'
                                : `${resumo.concluidas} de ${resumo.total} ${resumo.total === 1 ? 'tarefa' : 'tarefas'}`}
                        </Text>
                    </View>
                </View>

                <View style={styles.indicadoresRow}>
                    {indicadores.map((item) => (
                        <View key={item.texto} style={[styles.cartao, styles.indicadorCard]}>
                            <Text style={styles.indicadorLabel}>{item.texto}</Text>
                            <Text style={[styles.indicadorValor, { color: item.cor }]}>
                                {carregandoResumo ? '—' : item.valor}
                            </Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.secaoTitulo}>PROGRESSO POR CARGO</Text>
                <TouchableOpacity
                    style={[styles.cartao, styles.cargoCard]}
                    activeOpacity={0.75}
                    disabled={carregandoResumo}
                    onPress={() => setCargosAbertos(true)}
                >
                    {carregandoResumo ? (
                        <ActivityIndicator color={c.amarelo} />
                    ) : previaDosCargos.length === 0 ? (
                        <Text style={styles.rankVazioTexto}>Nenhuma tarefa programada para hoje</Text>
                    ) : (
                        previaDosCargos.map(mostrarCargo)
                    )}
                </TouchableOpacity>

                <View style={styles.rankingHeader}>
                    <Text style={[styles.secaoTitulo, styles.secaoTituloSemMargem]}>RANKING</Text>
                    <View style={styles.seletor}>
                        {PERIODOS.map((opcao) => {
                            const ativo = periodo === opcao.valor;
                            return (
                                <TouchableOpacity
                                    key={opcao.valor}
                                    style={[styles.seletorItem, ativo && styles.seletorItemAtivo]}
                                    onPress={() => setPeriodo(opcao.valor)}
                                >
                                    <Text style={[styles.seletorTexto, ativo && styles.seletorTextoAtivo]}>{opcao.texto}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.cartao, styles.rankCard]}
                    activeOpacity={0.75}
                    disabled={carregandoRanking || ranking.length === 0}
                    onPress={() => setRankingAberto(true)}
                >
                    {carregandoRanking ? (
                        <View style={styles.rankVazio}>
                            <ActivityIndicator color={c.amarelo} />
                        </View>
                    ) : ranking.length === 0 ? (
                        <View style={styles.rankVazio}>
                            <Text style={styles.rankVazioTexto}>Sem dados para esse período</Text>
                        </View>
                    ) : (
                        previaDoRanking.map(mostrarPessoaDoRanking)
                    )}
                </TouchableOpacity>
            </ScrollView>

            <Portal>
                <Modal
                    visible={cargosAbertos}
                    onDismiss={() => setCargosAbertos(false)}
                    contentContainerStyle={styles.popup}
                    theme={{ colors: { backdrop: 'rgba(0, 0, 0, 0.8)' } }}
                >
                    <View style={styles.popupCabecalho}>
                        <Text style={styles.popupTitulo}>Progresso por cargo</Text>
                        <IconButton icon="close" iconColor={c.sub} onPress={() => setCargosAbertos(false)} />
                    </View>

                    <ScrollView contentContainerStyle={styles.popupListaCargos}>
                        {todosOsCargos.length === 0 ? (
                            <Text style={styles.rankVazioTexto}>Nenhum cargo cadastrado</Text>
                        ) : (
                            todosOsCargos.map(mostrarCargo)
                        )}
                    </ScrollView>
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={rankingAberto}
                    onDismiss={() => setRankingAberto(false)}
                    contentContainerStyle={styles.popup}
                    theme={{ colors: { backdrop: 'rgba(0, 0, 0, 0.8)' } }}
                >
                    <View style={styles.popupCabecalho}>
                        <Text style={styles.popupTitulo}>Ranking {nomeDoPeriodo}</Text>
                        <IconButton icon="close" iconColor={c.sub} onPress={() => setRankingAberto(false)} />
                    </View>

                    <ScrollView>{ranking.map(mostrarPessoaDoRanking)}</ScrollView>
                </Modal>
            </Portal>
        </View>
    );
}

const criarEstilos = (c) =>
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
        saudacao: {
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
        cartao: {
            backgroundColor: c.superficie,
            borderWidth: 1,
            borderColor: c.borda,
            borderRadius: 16,
        },
        resumoCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 18,
            padding: 16,
        },
        resumoTextos: {
            flex: 1,
        },
        anelCarregando: {
            width: 84,
            height: 84,
            alignItems: 'center',
            justifyContent: 'center',
        },
        cargoNomeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
        },
        cargoDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        resumoTitulo: {
            color: c.texto,
            fontSize: 15,
            fontWeight: 'bold',
        },
        resumoSub: {
            color: c.sub,
            fontSize: 12,
            marginTop: 4,
        },
        indicadoresRow: {
            flexDirection: 'row',
            gap: 8,
            marginTop: 10,
        },
        indicadorCard: {
            flex: 1,
            padding: 12,
            minHeight: 78,
            justifyContent: 'space-between',
        },
        indicadorLabel: {
            color: c.sub,
            fontSize: 12,
        },
        indicadorValor: {
            fontSize: 24,
            fontWeight: 'bold',
        },
        secaoTitulo: {
            color: c.sub,
            fontSize: 11,
            letterSpacing: 1,
            marginTop: 20,
            marginBottom: 8,
            marginLeft: 2,
        },
        secaoTituloSemMargem: {
            marginTop: 0,
            marginBottom: 0,
        },
        cargoCard: {
            padding: 14,
            gap: 14,
        },
        cargoLinhaTopo: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 6,
        },
        cargoNome: {
            color: c.texto,
            fontSize: 13,
        },
        cargoPorcentagem: {
            color: c.sub,
            fontSize: 12,
        },
        barraFundo: {
            height: 6,
            backgroundColor: c.campo,
            borderRadius: 3,
            overflow: 'hidden',
        },
        barraPreenchida: {
            height: '100%',
            borderRadius: 3,
        },
        rankingHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 20,
            marginBottom: 8,
        },
        seletor: {
            flexDirection: 'row',
            backgroundColor: c.campo,
            borderRadius: 10,
            padding: 3,
        },
        seletorItem: {
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: 8,
        },
        seletorItemAtivo: {
            backgroundColor: c.amarelo,
        },
        seletorTexto: {
            color: c.sub,
            fontSize: 12,
        },
        seletorTextoAtivo: {
            color: c.sobreAmarelo,
            fontWeight: 'bold',
        },
        rankCard: {
            overflow: 'hidden',
        },
        rankVazio: {
            paddingVertical: 28,
            alignItems: 'center',
        },
        rankVazioTexto: {
            color: c.sub,
            fontSize: 13,
        },
        rankLinha: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderBottomWidth: 1,
            borderBottomColor: c.borda,
        },
        rankLinhaUltima: {
            borderBottomWidth: 0,
        },
        rankPosicao: {
            fontSize: 14,
            fontWeight: 'bold',
            width: 22,
        },
        rankAvatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: c.campo,
            borderWidth: 2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        rankFoto: {
            borderWidth: 2,
        },
        rankAvatarTexto: {
            fontSize: 11,
            fontWeight: 'bold',
        },
        rankNome: {
            flex: 1,
            color: c.texto,
            fontSize: 13,
        },
        rankValor: {
            fontSize: 13,
            fontWeight: 'bold',
        },
        popup: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            marginHorizontal: 20,
            paddingBottom: 8,
            maxHeight: '80%',
            overflow: 'hidden',
        },
        popupCabecalho: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 18,
            paddingRight: 4,
            paddingTop: 4,
            borderBottomWidth: 1,
            borderBottomColor: c.borda,
        },
        popupTitulo: {
            color: c.texto,
            fontSize: 17,
            fontWeight: 'bold',
        },
        popupListaCargos: {
            padding: 18,
            gap: 14,
        },
    });