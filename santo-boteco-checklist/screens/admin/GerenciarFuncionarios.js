import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, PanResponder, useWindowDimensions, Alert } from 'react-native';
import { TextInput, Button, Text, Icon, IconButton, Avatar, Portal, Modal, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { getFuncionarios, addFuncionario, updateFuncionario } from '../../services/funcionarios';
import { getCargos, addCargo, updateCargo, deleteCargo } from '../../services/cargos';
import { getEstatisticasFuncionario } from '../../services/execucoes';
import { getRanking } from '../../services/ranking';
import { useTema } from '../../theme/Themecontext';

const CARGO_ADMINISTRADOR = { id: 'administrador', nome: 'Administrador', cor: '#D6293E', fixo: true };
const CARGO_INDEFINIDO_NOME = 'Indefinido';

const ETAPA_DADOS = 0;
const ETAPA_CARGO = 1;
const ETAPA_SENHA = 2;

const hslParaHex = (h, s, l) => {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const paraHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
    return `#${paraHex(f(0))}${paraHex(f(8))}${paraHex(f(4))}`;
};

const capitalizarCargo = (texto) =>
    texto
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((palavra) => palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase())
        .join(' ');

export default function GerenciarFuncionarios({ navigation }) {
    const insets = useSafeAreaInsets();
    const { height: alturaTela } = useWindowDimensions();
    const { cores, modo } = useTema();
    const escuro = modo === 'escuro';

    const c = useMemo(
        () => ({
            fundo: cores.fundo,
            superficie: escuro ? cores.card : '#FFFFFF',
            lista: escuro ? '#0B0B0B' : '#F2F2F4',
            campo: escuro ? '#2A2A2C' : '#F5F5F5',
            borda: cores.borda,
            texto: cores.texto,
            sub: escuro ? '#A0A0A0' : '#8A8A8A',
            amarelo: '#F4B740',
            sobreAmarelo: '#2B1B12',
            ambarFundo: escuro ? '#3A2E14' : 'rgba(244, 183, 64, 0.16)',
            ambarTexto: escuro ? '#F4B740' : '#8A5A00',
            perigo: escuro ? '#FF6B6B' : '#C62828',
            perigoFundo: escuro ? 'rgba(255, 107, 107, 0.15)' : 'rgba(198, 40, 40, 0.15)',
            sucesso: escuro ? '#7BC47F' : '#3F6B3A',
            ouro: escuro ? '#E0A23A' : '#E0A020',
            prata: escuro ? '#B5B5BA' : '#9A9AA0',
            bronze: escuro ? '#D08A4E' : '#C27A45',
            escuro,
        }),
        [cores, escuro]
    );

    const styles = useMemo(() => criarEstilos(c, alturaTela), [c, alturaTela]);

    const inputProps = {
        mode: 'outlined',
        textColor: c.texto,
        placeholderTextColor: c.sub,
        outlineColor: c.borda,
        activeOutlineColor: c.amarelo,
        outlineStyle: styles.inputOutline,
        theme: { colors: { onSurfaceVariant: c.sub } },
    };

    const backdrop = { colors: { backdrop: 'rgba(0, 0, 0, 0.8)' } };

    const [funcionarios, setFuncionarios] = useState([]);
    const [cargos, setCargos] = useState([CARGO_ADMINISTRADOR]);
    const [carregando, setCarregando] = useState(true);

    const [salvando, setSalvando] = useState(false);
    const [busca, setBusca] = useState('');
    const [filtroCargo, setFiltroCargo] = useState('Todos');
    const [abaFuncionarios, setAbaFuncionarios] = useState('ativos');

    const [modalVisivel, setModalVisivel] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [etapaForm, setEtapaForm] = useState(ETAPA_DADOS);

    const [form, setForm] = useState({ nome: '', usuario: '', senha: '', cargo: 'Administrador', icone: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [senhaPopupVisivel, setSenhaPopupVisivel] = useState(false);
    const [senhaTemp, setSenhaTemp] = useState('');
    const [senhaAtualFuncionario, setSenhaAtualFuncionario] = useState('');
    const [mostrarSenhaPopup, setMostrarSenhaPopup] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [infoVisivel, setInfoVisivel] = useState(false);
    const [funcionarioInfo, setFuncionarioInfo] = useState(null);
    const [estatisticas, setEstatisticas] = useState(null);
    const [carregandoEstatisticas, setCarregandoEstatisticas] = useState(false);
    const [rankingInfo, setRankingInfo] = useState({ semanal: null, mensal: null });

    const [novoCargoNome, setNovoCargoNome] = useState('');
    const [novoCargoHue, setNovoCargoHue] = useState(0);
    const [novoCargoCor, setNovoCargoCor] = useState(hslParaHex(0, 70, 50));

    const [cargoConfirmarExclusao, setCargoConfirmarExclusao] = useState(null);
    const [excluindoCargo, setExcluindoCargo] = useState(false);

    const [cargoRenomeandoId, setCargoRenomeandoId] = useState(null);
    const [nomeRenomear, setNomeRenomear] = useState('');
    const [renomeandoCargo, setRenomeandoCargo] = useState(false);

    const [opcoesFotoVisivel, setOpcoesFotoVisivel] = useState(false);

    const [cargoSheetVisivel, setCargoSheetVisivel] = useState(false);
    const [cargoSheetContexto, setCargoSheetContexto] = useState('form');
    const [cargoBusca, setCargoBusca] = useState('');
    const [criandoCargoNoSheet, setCriandoCargoNoSheet] = useState(false);

    const gradienteRef = useRef(null);
    const gradienteX = useRef(0);
    const gradienteLargura = useRef(0);

    useEffect(() => { carregarDados(); }, []);

    const carregarDados = async () => {
        setCarregando(true);
        try {
            const [funcionariosData, cargosData] = await Promise.all([getFuncionarios(), getCargos()]);
            setFuncionarios(funcionariosData);
            setCargos([CARGO_ADMINISTRADOR, ...cargosData]);
        } catch (error) {
            setErrorMessage(error.message);
        }
        setCarregando(false);
    };

    const corDoCargo = (nomeCargo) => cargos.find((cargo) => cargo.nome === nomeCargo)?.cor || '#8A8A8A';

    const iniciais = (nome) =>
        nome.trim().split(/\s+/).map((parte) => parte[0]).slice(0, 2).join('').toUpperCase();

    const funcionariosFiltrados = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        return funcionarios.filter((funcionario) => {
            const ativoOk = abaFuncionarios === 'bloqueados' ? funcionario.ativo === false : funcionario.ativo !== false;
            const cargoOk = filtroCargo === 'Todos' || funcionario.cargo === filtroCargo;
            const buscaOk =
                !termo ||
                funcionario.nome?.toLowerCase().includes(termo) ||
                funcionario.user?.toLowerCase().includes(termo);
            return ativoOk && cargoOk && buscaOk;
        });
    }, [funcionarios, busca, filtroCargo, abaFuncionarios]);

    const totalBloqueados = useMemo(
        () => funcionarios.filter((funcionario) => funcionario.ativo === false).length,
        [funcionarios]
    );

    const tituloEtapas = ['Foto e dados', 'Cargo', editandoId ? 'Revisão' : 'Senha'];

    const abrirNovo = () => {
        setForm({ nome: '', usuario: '', senha: '', cargo: 'Administrador', icone: '' });
        setEditandoId(null);
        setEtapaForm(ETAPA_DADOS);
        setErrorMessage('');
        setShowPassword(false);
        setSenhaAtualFuncionario('');
        setCargoConfirmarExclusao(null);
        setModalVisivel(true);
    };

    const abrirEdicao = (funcionario) => {
        setForm({
            nome: funcionario.nome || '',
            usuario: funcionario.user || '',
            senha: '',
            cargo: funcionario.cargo || 'Administrador',
            icone: funcionario.icone || '',
        });
        setEditandoId(funcionario.id);
        setEtapaForm(ETAPA_DADOS);
        setErrorMessage('');
        setShowPassword(false);
        setSenhaAtualFuncionario(funcionario.password || '');
        setCargoConfirmarExclusao(null);
        setModalVisivel(true);
    };

    const abrirSenhaPopup = () => {
        setSenhaTemp(form.senha || senhaAtualFuncionario);
        setMostrarSenhaPopup(false);
        setSenhaPopupVisivel(true);
    };

    const confirmarSenhaPopup = () => {
        setForm((prev) => ({ ...prev, senha: senhaTemp }));
        setSenhaPopupVisivel(false);
    };

    const abrirCargoSheet = (contexto) => {
        setCargoSheetContexto(contexto);
        setCargoBusca('');
        setCriandoCargoNoSheet(false);
        setCargoRenomeandoId(null);
        setCargoConfirmarExclusao(null);
        setNovoCargoNome('');
        setNovoCargoHue(0);
        setNovoCargoCor(hslParaHex(0, 70, 50));
        setCargoSheetVisivel(true);
    };

    const selecionarCargoSheet = (nomeCargo) => {
        if (cargoSheetContexto === 'filtro') {
            setFiltroCargo(nomeCargo);
        } else {
            setForm((prev) => ({ ...prev, cargo: nomeCargo }));
        }
        setCargoSheetVisivel(false);
    };

    const tentarSelecionarCargo = (nomeCargo) => {
        if (nomeCargo === 'Administrador' && cargoSheetContexto === 'form') {
            Alert.alert(
                'Tornar administrador?',
                'Pessoas com o cargo Administrador têm acesso a todas as funções administrativas do sistema.',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Confirmar', onPress: () => selecionarCargoSheet('Administrador') },
                ]
            );
            return;
        }
        selecionarCargoSheet(nomeCargo);
    };

    const iniciarCriacaoNoSheet = () => {
        setNovoCargoNome(capitalizarCargo(cargoBusca));
        setCriandoCargoNoSheet(true);
    };

    const abrirCriacaoCargoDireta = (contexto) => {
        abrirCargoSheet(contexto);
        setCriandoCargoNoSheet(true);
    };

    const abrirInfo = (funcionario) => {
        setFuncionarioInfo(funcionario);
        setInfoVisivel(true);
        carregarEstatisticas(funcionario);
    };

    const carregarEstatisticas = async (funcionario) => {
        setCarregandoEstatisticas(true);
        setEstatisticas(null);
        setRankingInfo({ semanal: null, mensal: null });

        const posicaoNoRanking = async (periodo) => {
            try {
                const lista = await getRanking(periodo);
                if (!Array.isArray(lista)) return null;
                const indice = lista.findIndex((pessoa) => pessoa.id === funcionario.id);
                return indice >= 0 ? { posicao: indice + 1, total: lista.length } : { posicao: null, total: lista.length };
            } catch (erro) {
                return null;
            }
        };

        try {
            const [dadosEstatisticas, semanal, mensal] = await Promise.all([
                getEstatisticasFuncionario(funcionario.id).catch(() => ({ concluidas: 0, atrasadas: 0 })),
                posicaoNoRanking('semanal'),
                posicaoNoRanking('mensal'),
            ]);
            setEstatisticas(dadosEstatisticas);
            setRankingInfo({ semanal, mensal });
        } catch (error) {
            setEstatisticas({ concluidas: 0, atrasadas: 0 });
        }
        setCarregandoEstatisticas(false);
    };

    const selecionarImagem = async () => {
        const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissao.granted) {
            setErrorMessage('Permissão de acesso à galeria negada');
            return;
        }

        const resultado = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.4,
            base64: true,
        });

        if (!resultado.canceled) {
            const base64Imagem = `data:image/jpeg;base64,${resultado.assets[0].base64}`;
            setForm((prev) => ({ ...prev, icone: base64Imagem }));
        }
    };

    const tirarFoto = async () => {
        const permissao = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissao.granted) {
            setErrorMessage('Permissão de acesso à câmera negada');
            return;
        }

        const resultado = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.4,
            base64: true,
        });

        if (!resultado.canceled) {
            const base64Imagem = `data:image/jpeg;base64,${resultado.assets[0].base64}`;
            setForm((prev) => ({ ...prev, icone: base64Imagem }));
        }
    };

    const escolherDaGaleria = async () => {
        setOpcoesFotoVisivel(false);
        await selecionarImagem();
    };

    const escolherDaCamera = async () => {
        setOpcoesFotoVisivel(false);
        await tirarFoto();
    };

    const validarEtapa = (etapa) => {
        if (etapa === ETAPA_DADOS && (!form.nome.trim() || !form.usuario.trim())) {
            setErrorMessage('Preencha nome e usuário');
            return false;
        }

        if (etapa === ETAPA_CARGO && !form.cargo) {
            setErrorMessage('Selecione um cargo');
            return false;
        }

        if (etapa === ETAPA_SENHA && !editandoId && !form.senha.trim()) {
            setErrorMessage('Defina uma senha para o novo funcionário');
            return false;
        }

        setErrorMessage('');
        return true;
    };

    const avancarEtapa = () => {
        if (!validarEtapa(etapaForm)) return;

        if (etapaForm < ETAPA_SENHA) {
            setEtapaForm((prev) => prev + 1);
        } else {
            salvar();
        }
    };

    const voltarEtapa = () => {
        setErrorMessage('');
        setEtapaForm((prev) => Math.max(ETAPA_DADOS, prev - 1));
    };

    const salvar = async () => {
        if (!validarEtapa(ETAPA_DADOS) || !validarEtapa(ETAPA_CARGO) || !validarEtapa(ETAPA_SENHA)) {
            return;
        }

        setSalvando(true);
        try {
            const dados = {
                nome: form.nome.trim(),
                user: form.usuario.trim(),
                icone: form.icone,
                cargo: form.cargo,
                admin: form.cargo === 'Administrador',
            };

            if (form.senha.trim()) {
                dados.password = form.senha.trim();
            }

            if (editandoId) {
                await updateFuncionario(editandoId, dados);
            } else {
                await addFuncionario(dados);
            }

            setModalVisivel(false);
            await carregarDados();
        } catch (error) {
            setErrorMessage(error.message);
        }
        setSalvando(false);
    };

    const alternarBloqueio = async (funcionario) => {
        setSalvando(true);
        try {
            const novoStatusAtivo = funcionario.ativo === false;
            await updateFuncionario(funcionario.id, { ativo: novoStatusAtivo });
            setInfoVisivel(false);
            await carregarDados();
        } catch (error) {
            setErrorMessage(error.message);
        }
        setSalvando(false);
    };

    const medirGradiente = () => {
        gradienteRef.current?.measure((x, y, largura, altura, pageX) => {
            gradienteX.current = pageX;
            gradienteLargura.current = largura;
        });
    };

    const atualizarHue = (posicaoX) => {
        const hue = Math.round(Math.max(0, Math.min(1, posicaoX / (gradienteLargura.current || 1))) * 360);
        setNovoCargoHue(hue);
        setNovoCargoCor(hslParaHex(hue, 70, 50));
    };

    const panResponderCor = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evento) => atualizarHue(evento.nativeEvent.locationX),
            onPanResponderMove: (evento, gesto) => atualizarHue(gesto.moveX - gradienteX.current),
        })
    ).current;

    const criarCargo = async () => {
        const nome = capitalizarCargo(novoCargoNome);

        if (!nome) {
            setErrorMessage('Dê um nome ao cargo');
            return;
        }

        if (cargos.some((cargo) => cargo.nome.toLowerCase() === nome.toLowerCase())) {
            setErrorMessage('Esse cargo já existe');
            return;
        }

        try {
            await addCargo({ nome, cor: novoCargoCor });
            await carregarDados();

            if (cargoSheetContexto === 'filtro') {
                setFiltroCargo(nome);
            } else {
                setForm((prev) => ({ ...prev, cargo: nome }));
            }

            setNovoCargoNome('');
            setNovoCargoHue(0);
            setNovoCargoCor(hslParaHex(0, 70, 50));
            setCriandoCargoNoSheet(false);
            setCargoSheetVisivel(false);
        } catch (error) {
            setErrorMessage(error.message);
        }
    };

    const excluirCargo = async (cargo) => {
        setExcluindoCargo(true);
        try {
            const funcionariosAfetados = funcionarios.filter((f) => f.cargo === cargo.nome);
            await Promise.all(
                funcionariosAfetados.map((f) =>
                    updateFuncionario(f.id, { cargo: CARGO_INDEFINIDO_NOME, admin: false })
                )
            );
            await deleteCargo(cargo.id);

            if (form.cargo === cargo.nome) {
                setForm((prev) => ({ ...prev, cargo: CARGO_INDEFINIDO_NOME }));
            }
            if (filtroCargo === cargo.nome) {
                setFiltroCargo('Todos');
            }

            setCargoConfirmarExclusao(null);
            await carregarDados();
        } catch (error) {
            setErrorMessage(error.message);
        }
        setExcluindoCargo(false);
    };

    const confirmarRenomear = async (cargo) => {
        const nome = capitalizarCargo(nomeRenomear);

        if (!nome) {
            setErrorMessage('Dê um nome ao cargo');
            return;
        }

        if (cargos.some((item) => item.id !== cargo.id && item.nome.toLowerCase() === nome.toLowerCase())) {
            setErrorMessage('Esse cargo já existe');
            return;
        }

        if (nome === cargo.nome) {
            setCargoRenomeandoId(null);
            return;
        }

        setRenomeandoCargo(true);
        try {
            await updateCargo(cargo.id, { nome });

            const funcionariosAfetados = funcionarios.filter((f) => f.cargo === cargo.nome);
            await Promise.all(funcionariosAfetados.map((f) => updateFuncionario(f.id, { cargo: nome })));

            if (form.cargo === cargo.nome) {
                setForm((prev) => ({ ...prev, cargo: nome }));
            }
            if (filtroCargo === cargo.nome) {
                setFiltroCargo(nome);
            }

            setCargoRenomeandoId(null);
            await carregarDados();
        } catch (error) {
            setErrorMessage(error.message);
        }
        setRenomeandoCargo(false);
    };

    const cargosFiltradosBusca = cargos.filter((cargo) =>
        cargo.nome.toLowerCase().includes(cargoBusca.trim().toLowerCase())
    );

    return (
        <View style={styles.container}>
            <View style={[styles.topo, { paddingTop: insets.top + 22 }]}>
                <Text style={styles.titulo}>Funcionários</Text>
                <View style={styles.divisor} />

                <TextInput
                    {...inputProps}
                    value={busca}
                    onChangeText={setBusca}
                    placeholder="Buscar por nome ou usuário"
                    left={<TextInput.Icon icon="magnify" color={c.sub} />}
                    style={styles.searchInput}
                    dense
                />

                <View style={styles.controlesRow}>
                    <View style={styles.abaRow}>
                        <TouchableOpacity
                            style={[styles.abaItem, abaFuncionarios === 'ativos' && styles.abaItemAtiva]}
                            onPress={() => setAbaFuncionarios('ativos')}
                        >
                            <Text style={[styles.abaTexto, abaFuncionarios === 'ativos' && styles.abaTextoAtivo]}>Ativos</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.abaItem, abaFuncionarios === 'bloqueados' && styles.abaItemAtiva]}
                            onPress={() => setAbaFuncionarios('bloqueados')}
                        >
                            <Text
                                style={[styles.abaTexto, abaFuncionarios === 'bloqueados' && styles.abaTextoAtivo]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.85}
                            >
                                Bloqueados{totalBloqueados > 0 ? ` · ${totalBloqueados}` : ''}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.pilula, filtroCargo !== 'Todos' && styles.pilulaAtiva]}
                        onPress={() => abrirCargoSheet('filtro')}
                    >
                        {filtroCargo !== 'Todos' ? (
                            <View style={[styles.dot, { backgroundColor: corDoCargo(filtroCargo) }]} />
                        ) : (
                            <Icon source="briefcase-outline" size={14} color={c.sub} />
                        )}
                        <Text style={[styles.pilulaTexto, filtroCargo !== 'Todos' && styles.pilulaTextoAtivo]} numberOfLines={1}>
                            {filtroCargo !== 'Todos' ? filtroCargo : 'Cargo'}
                        </Text>
                        <Icon source="chevron-down" size={14} color={filtroCargo !== 'Todos' ? c.ambarTexto : c.sub} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.listaArea}>
                <Text style={styles.countText}>
                    {abaFuncionarios === 'bloqueados'
                        ? `Bloqueados: ${funcionariosFiltrados.length}`
                        : `Total de funcionários: ${funcionariosFiltrados.length}`}
                </Text>

                {carregando ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color={c.perigo} size="large" />
                    </View>
                ) : (
                    <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                        {funcionariosFiltrados.length === 0 && (
                            <View style={styles.emptyState}>
                                <Icon source="account-off-outline" size={28} color={c.sub} />
                                <Text style={styles.emptyStateText}>
                                    {abaFuncionarios === 'bloqueados' ? 'Nenhum funcionário bloqueado' : 'Nenhum funcionário encontrado'}
                                </Text>
                            </View>
                        )}
                        {funcionariosFiltrados.map((funcionario) => {
                            const cor = corDoCargo(funcionario.cargo);
                            return (
                                <TouchableOpacity
                                    key={funcionario.id}
                                    style={styles.card}
                                    onPress={() => abrirInfo(funcionario)}
                                >
                                    {funcionario.icone ? (
                                        <Avatar.Image size={44} source={{ uri: funcionario.icone }} />
                                    ) : (
                                        <Avatar.Text
                                            size={44}
                                            label={iniciais(funcionario.nome || '?')}
                                            color={cor}
                                            style={[styles.avatarFallback, { borderColor: cor }]}
                                        />
                                    )}
                                    <View style={styles.cardInfo}>
                                        <Text style={styles.cardName} numberOfLines={1}>{funcionario.nome}</Text>
                                        <View style={styles.cardMetaRow}>
                                            <View style={[styles.dot, { backgroundColor: cor }]} />
                                            <Text style={styles.cardMetaText} numberOfLines={1}>
                                                {funcionario.cargo}
                                                <Text style={styles.cardMetaText}> · @{funcionario.user}</Text>
                                            </Text>
                                        </View>
                                    </View>
                                    {abaFuncionarios === 'bloqueados' ? (
                                        <IconButton
                                            icon="lock-open-outline"
                                            size={18}
                                            iconColor={c.sucesso}
                                            onPress={() => alternarBloqueio(funcionario)}
                                        />
                                    ) : (
                                        <IconButton icon="pencil" size={18} iconColor={c.sub} onPress={() => abrirEdicao(funcionario)} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
            </View>

            <TouchableOpacity style={[styles.fab, { bottom: Math.max(insets.bottom + 16, 24) }]} onPress={abrirNovo}>
                <Icon source="plus" size={26} color={c.sobreAmarelo} />
            </TouchableOpacity>

            <Portal>
                <Modal
                    visible={infoVisivel}
                    onDismiss={() => setInfoVisivel(false)}
                    contentContainerStyle={styles.infoModalContainer}
                    style={styles.modalWrapper}
                    theme={backdrop}
                >
                    {funcionarioInfo && (
                        <View>
                            <View style={styles.infoTopoFechar}>
                                <IconButton icon="close" iconColor={c.sub} onPress={() => setInfoVisivel(false)} />
                            </View>

                            <View style={styles.infoAvatarBox}>
                                {funcionarioInfo.icone ? (
                                    <Avatar.Image size={72} source={{ uri: funcionarioInfo.icone }} />
                                ) : (
                                    <Avatar.Text
                                        size={72}
                                        label={iniciais(funcionarioInfo.nome || '?')}
                                        color={corDoCargo(funcionarioInfo.cargo)}
                                        style={[styles.avatarFallback, { borderColor: corDoCargo(funcionarioInfo.cargo) }]}
                                    />
                                )}
                                <Text style={styles.infoNome}>{funcionarioInfo.nome}</Text>
                                <View style={[styles.infoCargoBox, { backgroundColor: `${corDoCargo(funcionarioInfo.cargo)}26` }]}>
                                    <View style={[styles.dot, { backgroundColor: corDoCargo(funcionarioInfo.cargo) }]} />
                                    <Text style={[styles.infoCargoTexto, { color: corDoCargo(funcionarioInfo.cargo) }]}>
                                        {funcionarioInfo.cargo}
                                    </Text>
                                </View>
                                <Text style={styles.infoUsuario}>@{funcionarioInfo.user}</Text>
                            </View>

                            <Text style={styles.statsLabelSecao}>DESEMPENHO (TOTAL)</Text>
                            <View style={styles.statsGrid}>
                                <View style={styles.statsCard}>
                                    <Text style={styles.statsLabel}>Concluídas</Text>
                                    <Text style={[styles.statsValor, { color: c.sucesso }]}>
                                        {carregandoEstatisticas ? '—' : estatisticas?.concluidas ?? 0}
                                    </Text>
                                </View>
                                <View style={styles.statsCard}>
                                    <Text style={styles.statsLabel}>Concluídas em atraso</Text>
                                    <Text style={[styles.statsValor, { color: c.perigo }]}>
                                        {carregandoEstatisticas ? '—' : estatisticas?.atrasadas ?? 0}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.statsLabelSecao}>RANKING</Text>
                            <View style={styles.statsGrid}>
                                {[
                                    { chave: 'semanal', texto: 'Semanal', icone: 'calendar-week' },
                                    { chave: 'mensal', texto: 'Mensal', icone: 'calendar-month-outline' },
                                ].map((item) => {
                                    const dado = rankingInfo[item.chave];
                                    const posicao = dado?.posicao;
                                    const corPosicao =
                                        posicao === 1 ? c.ouro : posicao === 2 ? c.prata : posicao === 3 ? c.bronze : c.texto;
                                    return (
                                        <View key={item.chave} style={[styles.statsCard, styles.rankingCard]}>
                                            <View style={styles.rankingCardTopo}>
                                                <Icon source={item.icone} size={13} color={c.sub} />
                                                <Text style={styles.rankingCardLabel}>{item.texto}</Text>
                                            </View>
                                            <View style={styles.rankingCardValorRow}>
                                                {posicao && posicao <= 3 ? (
                                                    <Icon source="trophy" size={18} color={corPosicao} />
                                                ) : null}
                                                <Text style={[styles.statsValor, { color: corPosicao }]}>
                                                    {carregandoEstatisticas ? '—' : posicao ? `${posicao}º` : '—'}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>

                            <Button
                                mode="outlined"
                                textColor={c.texto}
                                style={[styles.button, styles.botaoOutline]}
                                contentStyle={styles.buttonContent}
                                labelStyle={styles.buttonLabelNormal}
                                icon="pencil-outline"
                                onPress={() => {
                                    setInfoVisivel(false);
                                    abrirEdicao(funcionarioInfo);
                                }}
                            >
                                Editar
                            </Button>

                            {funcionarioInfo.ativo === false ? (
                                <Button
                                    mode="outlined"
                                    textColor={c.sucesso}
                                    style={[styles.button, { borderColor: c.sucesso }]}
                                    contentStyle={styles.buttonContent}
                                    labelStyle={styles.buttonLabelNormal}
                                    icon="lock-open-outline"
                                    loading={salvando}
                                    disabled={salvando}
                                    onPress={() => alternarBloqueio(funcionarioInfo)}
                                >
                                    Reativar acesso
                                </Button>
                            ) : (
                                <Button
                                    mode="outlined"
                                    textColor={c.perigo}
                                    style={[styles.button, { borderColor: c.perigo }]}
                                    contentStyle={styles.buttonContent}
                                    labelStyle={styles.buttonLabelNormal}
                                    icon="lock-outline"
                                    loading={salvando}
                                    disabled={salvando}
                                    onPress={() => alternarBloqueio(funcionarioInfo)}
                                >
                                    Bloquear acesso
                                </Button>
                            )}
                        </View>
                    )}
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={modalVisivel}
                    onDismiss={() => setModalVisivel(false)}
                    contentContainerStyle={styles.modalContainer}
                    style={styles.modalWrapper}
                    theme={backdrop}
                >
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {editandoId ? 'Editar funcionário' : 'Novo funcionário'}
                        </Text>
                        <IconButton icon="close" iconColor={c.sub} onPress={() => setModalVisivel(false)} />
                    </View>

                    <Text style={styles.etapaSubtitulo}>{tituloEtapas[etapaForm]}</Text>

                    <View style={styles.progressRow}>
                        {tituloEtapas.map((_, indice) => (
                            <View
                                key={indice}
                                style={[styles.progressDot, indice <= etapaForm && styles.progressDotAtiva]}
                            />
                        ))}
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={styles.etapaScroll}>
                        {etapaForm === ETAPA_DADOS && (
                            <View>
                                <TouchableOpacity style={styles.photoPicker} onPress={() => setOpcoesFotoVisivel(true)}>
                                    {form.icone ? (
                                        <Avatar.Image size={76} source={{ uri: form.icone }} />
                                    ) : (
                                        <Avatar.Icon size={76} icon="camera-outline" color={c.sub} style={styles.photoPlaceholder} />
                                    )}
                                </TouchableOpacity>
                                <Text style={styles.photoHint}>Toque para adicionar foto</Text>

                                <Text style={styles.label}>NOME COMPLETO</Text>
                                <TextInput
                                    {...inputProps}
                                    value={form.nome}
                                    onChangeText={(texto) => setForm((prev) => ({ ...prev, nome: texto }))}
                                    left={<TextInput.Icon icon="account-outline" color={c.sub} />}
                                    style={styles.input}
                                    dense
                                />

                                <Text style={styles.label}>USUÁRIO</Text>
                                <TextInput
                                    {...inputProps}
                                    value={form.usuario}
                                    onChangeText={(texto) => setForm((prev) => ({ ...prev, usuario: texto }))}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    left={<TextInput.Icon icon="at" color={c.sub} />}
                                    style={styles.input}
                                    dense
                                />
                            </View>
                        )}

                        {etapaForm === ETAPA_CARGO && (
                            <View>
                                <Text style={styles.etapaDescricao}>Escolha o cargo do funcionário.</Text>
                                <TouchableOpacity
                                    style={[styles.filterButton, styles.campoCargoForm]}
                                    onPress={() => abrirCargoSheet('form')}
                                >
                                    <View style={[styles.dot, { backgroundColor: corDoCargo(form.cargo) }]} />
                                    <Text style={styles.filterButtonText}>{form.cargo}</Text>
                                    <Icon source="chevron-down" size={16} color={c.sub} />
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.criarCargoBotao} onPress={() => abrirCriacaoCargoDireta('form')}>
                                    <Icon source="plus" size={16} color={c.sobreAmarelo} />
                                    <Text style={styles.criarCargoBotaoTexto}>Criar novo cargo</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {etapaForm === ETAPA_SENHA && (
                            <View>
                                {editandoId ? (
                                    <>
                                        <Text style={styles.etapaDescricao}>Revise os dados antes de salvar.</Text>
                                        <View style={styles.resumoBox}>
                                            <View style={styles.resumoLinha}>
                                                <Text style={styles.resumoLabel}>Nome</Text>
                                                <Text style={styles.resumoValor}>{form.nome}</Text>
                                            </View>
                                            <View style={styles.resumoLinha}>
                                                <Text style={styles.resumoLabel}>Usuário</Text>
                                                <Text style={styles.resumoValor}>@{form.usuario}</Text>
                                            </View>
                                            <View style={styles.resumoLinha}>
                                                <Text style={styles.resumoLabel}>Cargo</Text>
                                                <Text style={styles.resumoValor}>{form.cargo}</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.filterButton, styles.campoCargoForm]}
                                            onPress={abrirSenhaPopup}
                                        >
                                            <Icon source="lock-outline" size={16} color={c.texto} />
                                            <Text style={styles.botaoAlterarSenhaTexto}>Alterar senha</Text>
                                            <Icon source="chevron-right" size={16} color={c.sub} />
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.etapaDescricao}>Defina uma senha de acesso.</Text>
                                        <Text style={styles.label}>SENHA</Text>
                                        <TextInput
                                            {...inputProps}
                                            value={form.senha}
                                            onChangeText={(texto) => setForm((prev) => ({ ...prev, senha: texto }))}
                                            secureTextEntry={!showPassword}
                                            left={<TextInput.Icon icon="lock-outline" color={c.sub} />}
                                            right={
                                                <TextInput.Icon
                                                    icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                                    color={c.sub}
                                                    onPress={() => setShowPassword(!showPassword)}
                                                />
                                            }
                                            style={styles.input}
                                            dense
                                        />
                                    </>
                                )}
                            </View>
                        )}

                        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                    </ScrollView>

                    <View style={styles.etapaFooter}>
                        {etapaForm > ETAPA_DADOS && (
                            <Button
                                mode="outlined"
                                textColor={c.sub}
                                style={[styles.button, styles.botaoOutline, styles.etapaBotaoVoltar]}
                                contentStyle={styles.buttonContent}
                                labelStyle={styles.buttonLabelNormal}
                                onPress={voltarEtapa}
                            >
                                Voltar
                            </Button>
                        )}
                        <Button
                            mode="contained"
                            onPress={avancarEtapa}
                            loading={salvando}
                            disabled={salvando}
                            buttonColor={c.amarelo}
                            textColor={c.sobreAmarelo}
                            style={[styles.button, styles.etapaBotaoAvancar]}
                            contentStyle={styles.buttonContent}
                            labelStyle={styles.buttonLabel}
                        >
                            {etapaForm === ETAPA_SENHA ? 'SALVAR' : 'PRÓXIMO'}
                        </Button>
                    </View>
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={opcoesFotoVisivel}
                    onDismiss={() => setOpcoesFotoVisivel(false)}
                    contentContainerStyle={styles.opcoesFotoModalContainer}
                    style={styles.modalWrapper}
                    theme={backdrop}
                >
                    <Text style={styles.modalTitle}>Foto de perfil</Text>

                    <TouchableOpacity style={styles.opcaoFotoLinha} onPress={escolherDaCamera}>
                        <Icon source="camera-outline" size={22} color={c.texto} />
                        <Text style={styles.opcaoFotoTexto}>Tirar foto</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.opcaoFotoLinha, styles.opcaoFotoUltima]} onPress={escolherDaGaleria}>
                        <Icon source="image-outline" size={22} color={c.texto} />
                        <Text style={styles.opcaoFotoTexto}>Escolher da galeria</Text>
                    </TouchableOpacity>

                    <Button
                        mode="outlined"
                        textColor={c.sub}
                        style={[styles.button, styles.botaoOutline]}
                        contentStyle={styles.buttonContent}
                        labelStyle={styles.buttonLabelNormal}
                        onPress={() => setOpcoesFotoVisivel(false)}
                    >
                        Cancelar
                    </Button>
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={cargoSheetVisivel}
                    onDismiss={() => setCargoSheetVisivel(false)}
                    contentContainerStyle={criandoCargoNoSheet ? styles.cargoSheetContainerCriar : styles.cargoSheetContainer}
                    theme={backdrop}
                >
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Selecionar cargo</Text>
                        <IconButton icon="close" iconColor={c.sub} onPress={() => setCargoSheetVisivel(false)} />
                    </View>

                    {criandoCargoNoSheet ? (
                        <View>
                            <Text style={styles.label}>NOME DO CARGO</Text>
                            <TextInput
                                {...inputProps}
                                value={novoCargoNome}
                                onChangeText={setNovoCargoNome}
                                placeholder="Ex.: Segurança"
                                style={styles.input}
                                dense
                            />
                            <Text style={styles.label}>COR DE IDENTIFICAÇÃO</Text>
                            <View
                                ref={gradienteRef}
                                onLayout={medirGradiente}
                                style={styles.gradienteBarra}
                                {...panResponderCor.panHandlers}
                            >
                                <LinearGradient
                                    colors={['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.gradienteInterno}
                                />
                                <View
                                    pointerEvents="none"
                                    style={[
                                        styles.gradienteIndicador,
                                        { left: `${(novoCargoHue / 360) * 100}%`, backgroundColor: novoCargoCor },
                                    ]}
                                />
                            </View>
                            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                            <View style={styles.novoCargoActions}>
                                <Button
                                    mode="outlined"
                                    textColor={c.sub}
                                    style={[styles.novoCargoBotao, styles.botaoOutline]}
                                    onPress={() => setCriandoCargoNoSheet(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    mode="contained"
                                    buttonColor={novoCargoCor}
                                    textColor="#FFFFFF"
                                    style={styles.novoCargoBotao}
                                    onPress={criarCargo}
                                >
                                    Criar cargo
                                </Button>
                            </View>
                        </View>
                    ) : (
                        <>
                            <TextInput
                                {...inputProps}
                                value={cargoBusca}
                                onChangeText={setCargoBusca}
                                placeholder="Buscar cargo"
                                left={<TextInput.Icon icon="magnify" color={c.sub} />}
                                style={styles.input}
                                dense
                                autoFocus
                            />

                            <ScrollView style={styles.cargoSheetLista}>
                                {cargoSheetContexto === 'filtro' && 'todos'.includes(cargoBusca.trim().toLowerCase()) && (
                                    <TouchableOpacity style={styles.cargoGerenciarLinha} onPress={() => selecionarCargoSheet('Todos')}>
                                        <View style={styles.cargoGerenciarInfo}>
                                            <View style={[styles.dot, { backgroundColor: c.sub }]} />
                                            <Text style={styles.cargoGerenciarNome}>Todos</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}

                                {cargosFiltradosBusca.map((cargo) =>
                                    cargoRenomeandoId === cargo.id ? (
                                        <View key={cargo.id} style={styles.cargoGerenciarLinha}>
                                            <View style={styles.cargoRenomearRow}>
                                                <TextInput
                                                    {...inputProps}
                                                    value={nomeRenomear}
                                                    onChangeText={setNomeRenomear}
                                                    dense
                                                    style={styles.cargoRenomearInput}
                                                />
                                                <IconButton
                                                    icon="close"
                                                    size={18}
                                                    iconColor={c.sub}
                                                    onPress={() => setCargoRenomeandoId(null)}
                                                />
                                                <IconButton
                                                    icon="check"
                                                    size={18}
                                                    iconColor={c.sucesso}
                                                    disabled={renomeandoCargo}
                                                    onPress={() => confirmarRenomear(cargo)}
                                                />
                                            </View>
                                        </View>
                                    ) : (
                                        <View key={cargo.id} style={styles.cargoGerenciarLinha}>
                                            <TouchableOpacity
                                                style={styles.cargoGerenciarInfo}
                                                onPress={() => tentarSelecionarCargo(cargo.nome)}
                                            >
                                                <View style={[styles.dot, { backgroundColor: cargo.cor }]} />
                                                <Text style={styles.cargoGerenciarNome}>{cargo.nome}</Text>
                                            </TouchableOpacity>

                                            {!cargo.fixo &&
                                                (cargoConfirmarExclusao === cargo.nome ? (
                                                    <View style={styles.cargoConfirmarRow}>
                                                        <TouchableOpacity onPress={() => setCargoConfirmarExclusao(null)}>
                                                            <Text style={styles.cargoConfirmarCancelar}>Cancelar</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => excluirCargo(cargo)} disabled={excluindoCargo}>
                                                            <Text style={styles.cargoConfirmarExcluir}>
                                                                {excluindoCargo ? 'Excluindo...' : 'Excluir'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                ) : (
                                                    <View style={styles.cargoAcoesRow}>
                                                        <IconButton
                                                            icon="pencil-outline"
                                                            size={18}
                                                            iconColor={c.sub}
                                                            onPress={() => {
                                                                setCargoRenomeandoId(cargo.id);
                                                                setNomeRenomear(cargo.nome);
                                                            }}
                                                        />
                                                        <IconButton
                                                            icon="trash-can-outline"
                                                            size={18}
                                                            iconColor={c.perigo}
                                                            onPress={() => setCargoConfirmarExclusao(cargo.nome)}
                                                        />
                                                    </View>
                                                ))}
                                        </View>
                                    )
                                )}

                                {cargoBusca.trim() &&
                                    !cargos.some((cargo) => cargo.nome.toLowerCase() === cargoBusca.trim().toLowerCase()) && (
                                        <TouchableOpacity style={styles.cargoCriarLinha} onPress={iniciarCriacaoNoSheet}>
                                            <View style={styles.cargoCriarIconeCirculo}>
                                                <Icon source="plus" size={13} color={c.sub} />
                                            </View>
                                            <Text style={styles.cargoCriarTexto}>
                                                Criar cargo "{capitalizarCargo(cargoBusca)}"
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                            </ScrollView>
                        </>
                    )}
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={senhaPopupVisivel}
                    onDismiss={() => setSenhaPopupVisivel(false)}
                    contentContainerStyle={styles.senhaPopupContainer}
                    theme={{ colors: { backdrop: 'rgba(0, 0, 0, 0.85)' } }}
                >
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Alterar senha</Text>
                        <IconButton icon="close" iconColor={c.sub} onPress={() => setSenhaPopupVisivel(false)} />
                    </View>

                    <Text style={styles.label}>SENHA</Text>
                    <TextInput
                        {...inputProps}
                        value={senhaTemp}
                        onChangeText={setSenhaTemp}
                        secureTextEntry={!mostrarSenhaPopup}
                        left={<TextInput.Icon icon="lock-outline" color={c.sub} />}
                        right={
                            <TextInput.Icon
                                icon={mostrarSenhaPopup ? 'eye-off-outline' : 'eye-outline'}
                                color={c.sub}
                                onPress={() => setMostrarSenhaPopup(!mostrarSenhaPopup)}
                            />
                        }
                        style={styles.input}
                        dense
                        autoFocus
                    />

                    <View style={styles.novoCargoActions}>
                        <Button
                            mode="outlined"
                            textColor={c.sub}
                            style={[styles.novoCargoBotao, styles.botaoOutline]}
                            onPress={() => setSenhaPopupVisivel(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            mode="contained"
                            buttonColor={c.amarelo}
                            textColor={c.sobreAmarelo}
                            style={styles.novoCargoBotao}
                            onPress={confirmarSenhaPopup}
                        >
                            Salvar
                        </Button>
                    </View>
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
        topo: {
            paddingHorizontal: 20,
            paddingBottom: 12,
            backgroundColor: c.fundo,
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
        controlesRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 10,
        },
        listaArea: {
            flex: 1,
            backgroundColor: c.lista,
        },
        searchInput: {
            backgroundColor: c.campo,
            fontSize: 14,
        },
        pilula: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 44,
            maxWidth: 150,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.borda,
            backgroundColor: c.campo,
        },
        pilulaAtiva: {
            borderColor: c.amarelo,
            backgroundColor: c.ambarFundo,
        },
        pilulaTexto: {
            color: c.texto,
            fontSize: 13,
            flexShrink: 1,
        },
        pilulaTextoAtivo: {
            color: c.ambarTexto,
            fontWeight: 'bold',
        },
        filterButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: c.campo,
            borderWidth: 1,
            borderColor: c.borda,
            borderRadius: 14,
            paddingHorizontal: 14,
            height: 46,
        },
        filterButtonText: {
            color: c.sub,
            fontSize: 13,
            flex: 1,
            marginLeft: 8,
        },
        campoCargoForm: {
            marginBottom: 16,
        },
        botaoAlterarSenhaTexto: {
            flex: 1,
            color: c.texto,
            fontSize: 14,
            fontWeight: 'bold',
            marginLeft: 10,
        },
        abaRow: {
            flex: 1,
            flexDirection: 'row',
            height: 44,
            backgroundColor: c.campo,
            borderRadius: 12,
            padding: 4,
        },
        abaItem: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
            borderRadius: 9,
        },
        abaItemAtiva: {
            backgroundColor: c.amarelo,
        },
        abaTexto: {
            color: c.sub,
            fontSize: 13,
        },
        abaTextoAtivo: {
            color: c.sobreAmarelo,
            fontWeight: 'bold',
        },
        dot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        countText: {
            color: c.sub,
            fontSize: 12,
            paddingHorizontal: 22,
            marginTop: 12,
            marginBottom: 8,
        },
        loadingContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        list: {
            flex: 1,
            paddingHorizontal: 20,
        },
        listContent: {
            paddingTop: 2,
            paddingBottom: 110,
            gap: 10,
        },
        emptyState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 48,
            gap: 8,
        },
        emptyStateText: {
            color: c.sub,
            fontSize: 14,
        },
        card: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: c.superficie,
            borderRadius: 14,
            paddingVertical: 12,
            paddingLeft: 12,
            paddingRight: 4,
            gap: 12,
            borderWidth: 1,
            borderColor: c.borda,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: c.escuro ? 0 : 0.06,
            shadowRadius: 8,
            elevation: c.escuro ? 0 : 2,
            marginHorizontal: 1,
        },
        avatarFallback: {
            backgroundColor: c.campo,
            borderWidth: 2,
        },
        cardInfo: {
            flex: 1,
        },
        cardName: {
            color: c.texto,
            fontSize: 15,
            fontWeight: 'bold',
        },
        cardMetaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 3,
            gap: 6,
        },
        cardMetaText: {
            color: c.sub,
            fontSize: 12,
            flexShrink: 1,
        },
        fab: {
            position: 'absolute',
            right: 24,
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: c.amarelo,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
        },
        modalWrapper: {
            justifyContent: 'flex-end',
            margin: 0,
        },
        modalContainer: {
            backgroundColor: c.superficie,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            maxHeight: alturaTela * 0.9,
        },
        infoModalContainer: {
            backgroundColor: c.superficie,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingBottom: 20,
        },
        opcoesFotoModalContainer: {
            backgroundColor: c.superficie,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
        },
        opcaoFotoLinha: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: c.borda,
        },
        opcaoFotoUltima: {
            marginBottom: 16,
        },
        opcaoFotoTexto: {
            color: c.texto,
            fontSize: 15,
        },
        infoTopoFechar: {
            alignItems: 'flex-end',
            marginBottom: -12,
        },
        infoAvatarBox: {
            alignItems: 'center',
            marginBottom: 16,
            gap: 6,
        },
        infoNome: {
            color: c.texto,
            fontSize: 17,
            fontWeight: 'bold',
            marginTop: 6,
        },
        infoCargoBox: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 20,
        },
        infoCargoTexto: {
            fontSize: 12,
            fontWeight: 'bold',
        },
        infoUsuario: {
            color: c.sub,
            fontSize: 12,
        },
        statsLabelSecao: {
            color: c.sub,
            fontSize: 11,
            letterSpacing: 1,
            marginBottom: 8,
        },
        statsGrid: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 16,
        },
        statsCard: {
            flex: 1,
            alignItems: 'center',
            backgroundColor: c.campo,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 6,
        },
        statsLabel: {
            color: c.sub,
            fontSize: 10,
            lineHeight: 13,
            textAlign: 'center',
            marginBottom: 4,
            minHeight: 26,
        },
        statsValor: {
            color: c.texto,
            fontSize: 24,
            fontWeight: 'bold',
            textAlign: 'center',
        },
        rankingCard: {
            paddingVertical: 12,
        },
        rankingCardTopo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginBottom: 4,
        },
        rankingCardLabel: {
            color: c.sub,
            fontSize: 11,
        },
        rankingCardValorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
        },
        botaoOutline: {
            borderColor: c.borda,
        },
        buttonLabelNormal: {
            fontSize: 14,
            fontWeight: 'bold',
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
        },
        modalTitle: {
            color: c.texto,
            fontSize: 18,
            fontWeight: 'bold',
        },
        etapaSubtitulo: {
            color: c.sub,
            fontSize: 13,
            marginBottom: 10,
        },
        progressRow: {
            flexDirection: 'row',
            gap: 6,
            marginBottom: 16,
        },
        progressDot: {
            height: 4,
            flex: 1,
            borderRadius: 2,
            backgroundColor: c.borda,
        },
        progressDotAtiva: {
            backgroundColor: c.amarelo,
        },
        etapaScroll: {
            maxHeight: alturaTela * 0.5,
        },
        etapaDescricao: {
            color: c.sub,
            fontSize: 13,
            marginBottom: 14,
        },
        criarCargoBotao: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: c.amarelo,
            borderRadius: 12,
            paddingVertical: 12,
        },
        criarCargoBotaoTexto: {
            color: c.sobreAmarelo,
            fontSize: 14,
            fontWeight: 'bold',
        },
        resumoBox: {
            backgroundColor: c.campo,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.borda,
            padding: 14,
            marginBottom: 14,
            gap: 10,
        },
        resumoLinha: {
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        resumoLabel: {
            color: c.sub,
            fontSize: 13,
        },
        resumoValor: {
            color: c.texto,
            fontSize: 13,
            fontWeight: 'bold',
        },
        etapaFooter: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 12,
        },
        etapaBotaoVoltar: {
            flex: 1,
            marginBottom: 0,
        },
        etapaBotaoAvancar: {
            flex: 2,
            marginBottom: 0,
        },
        photoPicker: {
            alignSelf: 'center',
            marginTop: 4,
        },
        photoPlaceholder: {
            backgroundColor: c.campo,
            borderWidth: 1,
            borderColor: c.borda,
            borderStyle: 'dashed',
        },
        photoHint: {
            color: c.sub,
            fontSize: 12,
            textAlign: 'center',
            marginTop: 6,
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
            marginBottom: 16,
            fontSize: 14,
        },
        inputOutline: {
            borderRadius: 14,
        },
        senhaPopupContainer: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            padding: 20,
            marginHorizontal: 24,
        },
        cargoSheetContainer: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            padding: 20,
            marginHorizontal: 24,
            height: Math.min(480, alturaTela * 0.7),
        },
        cargoSheetContainerCriar: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            padding: 20,
            marginHorizontal: 24,
        },
        cargoSheetLista: {
            flex: 1,
        },
        cargoCriarLinha: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 12,
            marginTop: 4,
        },
        cargoCriarIconeCirculo: {
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 1,
            borderColor: c.sub,
            borderStyle: 'dashed',
            alignItems: 'center',
            justifyContent: 'center',
        },
        cargoCriarTexto: {
            color: c.sub,
            fontSize: 13,
        },
        cargoGerenciarLinha: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 52,
            borderBottomWidth: 1,
            borderBottomColor: c.borda,
        },
        cargoGerenciarInfo: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'stretch',
        },
        cargoGerenciarNome: {
            color: c.texto,
            fontSize: 14,
        },
        cargoConfirmarRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        cargoAcoesRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        cargoRenomearRow: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        cargoRenomearInput: {
            flex: 1,
            height: 40,
            backgroundColor: c.campo,
            fontSize: 13,
        },
        cargoConfirmarCancelar: {
            color: c.sub,
            fontSize: 12,
        },
        cargoConfirmarExcluir: {
            color: c.perigo,
            fontSize: 12,
            fontWeight: 'bold',
        },
        gradienteBarra: {
            height: 28,
            borderRadius: 14,
            marginBottom: 16,
            justifyContent: 'center',
        },
        gradienteInterno: {
            height: 14,
            borderRadius: 7,
        },
        gradienteIndicador: {
            position: 'absolute',
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 3,
            borderColor: '#FFFFFF',
            marginLeft: -10,
            top: 4,
        },
        novoCargoActions: {
            flexDirection: 'row',
            gap: 8,
        },
        novoCargoBotao: {
            flex: 1,
            borderRadius: 12,
        },
        errorText: {
            color: c.perigo,
            fontSize: 13,
            marginBottom: 12,
        },
        button: {
            borderRadius: 12,
            marginBottom: 8,
        },
        buttonContent: {
            paddingVertical: 6,
        },
        buttonLabel: {
            fontSize: 15,
            fontWeight: 'bold',
            letterSpacing: 1,
        },
    });