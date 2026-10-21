import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, Alert } from 'react-native';
import { TextInput, Text, Icon, IconButton, Button, Portal, Modal, Switch, ActivityIndicator, Avatar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getCargos } from '../../services/cargos';
import { useTema } from '../../theme/Themecontext';

const CARGO_ADMINISTRADOR = { id: 'administrador', nome: 'Administrador', cor: '#C62828', fixo: true };

const DIAS_SEMANA_ABREVIADOS = [
    { nome: 'Domingo', letra: 'dom' },
    { nome: 'Segunda', letra: 'seg' },
    { nome: 'Terça', letra: 'ter' },
    { nome: 'Quarta', letra: 'qua' },
    { nome: 'Quinta', letra: 'qui' },
    { nome: 'Sexta', letra: 'sex' },
    { nome: 'Sábado', letra: 'sáb' },
];

const criarEtapaVazia = () => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    titulo: '',
    descricao: '',
    requerFoto: false,
});

const textoDeData = (data) => {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
};

const formatarDataHoje = () => textoDeData(new Date());

const dataDeTexto = (texto) => {
    const [dia, mes, ano] = (texto || '').split('/').map(Number);
    if (!dia || !mes || !ano) return new Date();
    return new Date(ano, mes - 1, dia);
};

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const descreverData = (texto) => `${DIAS_CURTOS[dataDeTexto(texto).getDay()]}, ${texto}`;

const descreverFrequencia = (tarefa) => {
    if (!tarefa) return '';
    if (tarefa.frequenciaTipo === 'diaria') return 'Diária';
    if (tarefa.frequenciaTipo === 'unica') return tarefa.dataUnica ? `Prazo: ${descreverData(tarefa.dataUnica)}` : 'Tarefa única';
    if (tarefa.frequenciaTipo === 'dias') {
        if (tarefa.dias.length === 7) return 'Todos os dias';
        if (tarefa.dias.length === 0) return 'Nenhum dia selecionado';
        return tarefa.dias.map((dia) => dia.slice(0, 3)).join(', ');
    }
    return '';
};

const abreviarNome = (nomeCompleto) => {
    if (!nomeCompleto) return '';
    const preposicoes = ['da', 'de', 'do', 'das', 'dos'];
    const partes = nomeCompleto.trim().split(/\s+/);
    if (partes.length <= 2) return nomeCompleto;
    const primeiroNome = partes[0];
    const resto = partes.slice(1).filter((parte) => !preposicoes.includes(parte.toLowerCase()));
    const sobrenome = resto[0] || partes[1];
    return `${primeiroNome} ${sobrenome}`;
};

const descreverAtribuido = (form) => {
    if (form.atribuidoTipo === 'ambos') return `${form.cargo} · ${abreviarNome(form.membro)}`;
    return form.cargo;
};

const iniciais = (nome) =>
    (nome || '').trim().split(/\s+/).map((parte) => parte[0]).slice(0, 2).join('').toUpperCase();

const formularioVazio = () => ({
    titulo: '',
    descricao: '',
    atribuidoTipo: 'cargo',
    cargo: '',
    membro: '',
    horario: '',
    frequenciaTipo: 'dias',
    dias: [],
    dataUnica: '',
    numeroEtapas: 1,
    etapas: [criarEtapaVazia()],
});

const TITULOS_PASSO = {
    basico: 'Informações básicas',
    frequencia: 'Frequência e horário',
    atribuir: 'Atribuir para',
    numeroEtapas: 'Número de etapas',
};

const TITULOS_SECAO = {
    basico: 'Título e descrição',
    frequencia: 'Frequência e horário',
    atribuir: 'Atribuir para',
    etapas: 'Etapas',
};

export default function GerenciarTarefas() {
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
            ambarFundo: escuro ? '#3A2E14' : 'rgba(244, 183, 64, 0.16)',
            ambarTexto: escuro ? '#F4B740' : '#8A5A00',
            perigo: escuro ? '#FF6B6B' : '#C62828',
            sucesso: escuro ? '#7BC47F' : '#3F6B3A',
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

    const backdrop = (opacidade) => ({ colors: { backdrop: `rgba(0, 0, 0, ${opacidade})` } });

    const [horarioPickerVisivel, setHorarioPickerVisivel] = useState(false);
    const [dataPickerVisivel, setDataPickerVisivel] = useState(false);

    const alterarData = (event, data) => {
        setDataPickerVisivel(false);
        if (!data) return;
        setForm((prev) => ({ ...prev, dataUnica: textoDeData(data) }));
    };

    const obterDateDoHorario = (horario) => {
        const [hora, minuto] = (horario || '08:00').split(':').map(Number);
        const data = new Date();
        data.setHours(hora || 0);
        data.setMinutes(minuto || 0);
        data.setSeconds(0);
        data.setMilliseconds(0);
        return data;
    };

    const alterarHorario = (event, data) => {
        setHorarioPickerVisivel(false);
        if (!data) return;
        const hora = String(data.getHours()).padStart(2, '0');
        const minuto = String(data.getMinutes()).padStart(2, '0');
        setForm((prev) => ({ ...prev, horario: `${hora}:${minuto}` }));
    };

    const [tarefas, setTarefas] = useState([]);
    const [carregandoTarefas, setCarregandoTarefas] = useState(true);
    const [funcionarios, setFuncionarios] = useState([]);
    const [cargos, setCargos] = useState([CARGO_ADMINISTRADOR]);
    const [busca, setBusca] = useState('');
    const [filtroCargo, setFiltroCargo] = useState('Todos');
    const [filtroDia, setFiltroDia] = useState('Todos');

    const [cargoMenuVisivel, setCargoMenuVisivel] = useState(false);
    const [buscaCargoFiltro, setBuscaCargoFiltro] = useState('');
    const [membroMenuVisivel, setMembroMenuVisivel] = useState(false);
    const [buscaMembroFiltro, setBuscaMembroFiltro] = useState('');
    const [filtroMembro, setFiltroMembro] = useState('Todos');
    const [diaMenuVisivel, setDiaMenuVisivel] = useState(false);
    const [cargoFormVisivel, setCargoFormVisivel] = useState(false);
    const [membroFormVisivel, setMembroFormVisivel] = useState(false);
    const [buscaCargoForm, setBuscaCargoForm] = useState('');
    const [buscaMembroForm, setBuscaMembroForm] = useState('');

    const [modalVisivel, setModalVisivel] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [wizardPasso, setWizardPasso] = useState('basico');
    const [etapaIndiceAtual, setEtapaIndiceAtual] = useState(0);
    const [form, setForm] = useState(formularioVazio());
    const [errorMessage, setErrorMessage] = useState('');

    const [detalheVisivel, setDetalheVisivel] = useState(false);
    const [tarefaDetalhe, setTarefaDetalhe] = useState(null);

    const [secaoAberta, setSecaoAberta] = useState(null);
    const [etapaPopupIndice, setEtapaPopupIndice] = useState(0);

    const corDoCargo = (nomeCargo) => cargos.find((cargo) => cargo.nome === nomeCargo)?.cor || '#8A8A8A';

    const cargosDisponiveis = [...new Set(funcionarios.map((f) => f.cargo).filter(Boolean))];

    const membrosDoCargo = (nomeCargo) => funcionarios.filter((f) => f.cargo === nomeCargo);
    const membrosParaFiltro = filtroCargo === 'Todos' ? funcionarios : membrosDoCargo(filtroCargo);

    useEffect(() => {
        const qFuncionarios = query(collection(db, 'Usuarios'), where('admin', '==', false));
        const cancelarFuncionarios = onSnapshot(
            qFuncionarios,
            (snapshot) => {
                setFuncionarios(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
            },
            () => {
                setErrorMessage('Não foi possível carregar os funcionários.');
            }
        );

        const cancelarTarefas = onSnapshot(
            collection(db, 'Tarefas'),
            (snapshot) => {
                const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                lista.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));
                setTarefas(lista);
                setCarregandoTarefas(false);
            },
            () => {
                setCarregandoTarefas(false);
            }
        );

        getCargos()
            .then((cargosData) => setCargos([CARGO_ADMINISTRADOR, ...cargosData]))
            .catch(() => {});

        return () => {
            cancelarFuncionarios();
            cancelarTarefas();
        };
    }, []);

    const tarefasFiltradas = tarefas.filter((tarefa) => {
        const termo = busca.trim().toLowerCase();
        const buscaOk = !termo || tarefa.titulo.toLowerCase().includes(termo);
        const cargoOk = filtroCargo === 'Todos' || tarefa.cargo === filtroCargo;
        const membroOk = filtroMembro === 'Todos' || tarefa.membro === filtroMembro;
        const diaOk =
            filtroDia === 'Todos' ||
            (filtroDia === 'Diárias'
                ? tarefa.frequenciaTipo === 'diaria'
                : tarefa.frequenciaTipo === 'dias' && tarefa.dias.includes(filtroDia));
        return buscaOk && cargoOk && membroOk && diaOk;
    });

    const abrirNovo = () => {
        const cargoPadrao = cargosDisponiveis[0] || '';
        const membroPadrao = membrosDoCargo(cargoPadrao)[0]?.nome || '';
        setForm({ ...formularioVazio(), cargo: cargoPadrao, membro: membroPadrao });
        setEditandoId(null);
        setErrorMessage('');
        setWizardPasso('basico');
        setModalVisivel(true);
    };

    const abrirDetalhe = (tarefa) => {
        setTarefaDetalhe(tarefa);
        setDetalheVisivel(true);
    };

    const abrirEdicao = (tarefa) => {
        setForm({
            titulo: tarefa.titulo,
            descricao: tarefa.descricao,
            atribuidoTipo: tarefa.atribuidoTipo || 'cargo',
            cargo: tarefa.cargo,
            membro: tarefa.membro || membrosDoCargo(tarefa.cargo)[0]?.nome || '',
            horario: tarefa.horario,
            frequenciaTipo: tarefa.frequenciaTipo,
            dias: tarefa.dias,
            dataUnica: tarefa.dataUnica || '',
            numeroEtapas: tarefa.etapas.length,
            etapas: tarefa.etapas,
        });
        setEditandoId(tarefa.id);
        setErrorMessage('');
        setSecaoAberta(null);
        setModalVisivel(true);
    };

    const editarDoDetalhe = () => {
        if (!tarefaDetalhe) return;
        setDetalheVisivel(false);
        abrirEdicao(tarefaDetalhe);
    };

    const excluirDoDetalhe = () => {
        if (!tarefaDetalhe) return;
        const id = tarefaDetalhe.id;
        setEditandoId(id);
        Alert.alert('Excluir tarefa?', 'Essa ação não pode ser desfeita.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Excluir', style: 'destructive', onPress: () => excluirTarefa(id) },
        ]);
    };

    const abrirSecaoPopup = (chave) => {
        if (chave === 'etapas') {
            setEtapaPopupIndice(0);
        }
        setSecaoAberta(chave);
    };

    const fecharSecaoPopup = () => {
        setSecaoAberta(null);
    };

    const abrirCargoForm = () => {
        setBuscaCargoForm('');
        setCargoFormVisivel(true);
    };

    const abrirMembroForm = () => {
        setBuscaMembroForm('');
        setMembroFormVisivel(true);
    };

    const alternarDiaForm = (dia) => {
        setForm((prev) => ({
            ...prev,
            dias: prev.dias.includes(dia) ? prev.dias.filter((d) => d !== dia) : [...prev.dias, dia],
        }));
    };

    const atualizarEtapa = (indice, dados) => {
        setForm((prev) => ({
            ...prev,
            etapas: prev.etapas.map((etapa, i) => (i === indice ? { ...etapa, ...dados } : etapa)),
        }));
    };

    const adicionarEtapaEIrParaNoPopup = () => {
        const novoIndice = form.etapas.length;
        setForm((prev) => ({
            ...prev,
            etapas: [...prev.etapas, criarEtapaVazia()],
            numeroEtapas: prev.etapas.length + 1,
        }));
        setEtapaPopupIndice(novoIndice);
    };

    const removerEtapaAtualNoPopup = () => {
        if (form.etapas.length <= 1) return;
        setForm((prev) => {
            const etapas = prev.etapas.filter((_, i) => i !== etapaPopupIndice);
            return { ...prev, etapas, numeroEtapas: etapas.length };
        });
        setEtapaPopupIndice((i) => Math.max(0, Math.min(i, form.etapas.length - 2)));
    };

    const irParaFrequencia = () => {
        if (!form.titulo.trim()) {
            setErrorMessage('Dê um título para a tarefa');
            return;
        }
        setErrorMessage('');
        setWizardPasso('frequencia');
    };

    const irParaAtribuir = () => {
        if (!form.horario.trim()) {
            setErrorMessage('Defina um horário');
            return;
        }
        if (form.frequenciaTipo === 'dias' && form.dias.length === 0) {
            setErrorMessage('Escolha ao menos um dia da semana');
            return;
        }
        setErrorMessage('');
        setWizardPasso('atribuir');
    };

    const irParaNumeroEtapas = () => {
        setErrorMessage('');
        setWizardPasso('numeroEtapas');
    };

    const avancarParaEtapas = () => {
        setForm((prev) => {
            const diferenca = prev.numeroEtapas - prev.etapas.length;
            let etapas = prev.etapas;
            if (diferenca > 0) {
                etapas = [...etapas, ...Array.from({ length: diferenca }, criarEtapaVazia)];
            } else if (diferenca < 0) {
                etapas = etapas.slice(0, prev.numeroEtapas);
            }
            return { ...prev, etapas };
        });
        setErrorMessage('');
        setEtapaIndiceAtual(0);
        setWizardPasso('etapa');
    };

    const salvarTarefaFinal = async () => {
        const dadosFinais = {
            titulo: form.titulo.trim(),
            descricao: form.descricao.trim(),
            atribuidoTipo: form.atribuidoTipo,
            cargo: form.cargo,
            membro: form.atribuidoTipo === 'ambos' ? form.membro : '',
            horario: form.horario,
            frequenciaTipo: form.frequenciaTipo,
            dias: form.frequenciaTipo === 'dias' ? form.dias : [],
            dataUnica: form.frequenciaTipo === 'unica' ? form.dataUnica || formatarDataHoje() : '',
            etapas: form.etapas.map((etapa) => ({
                id: etapa.id,
                titulo: etapa.titulo.trim(),
                descricao: etapa.descricao.trim(),
                requerFoto: etapa.requerFoto,
            })),
        };

        try {
            if (editandoId) {
                await updateDoc(doc(db, 'Tarefas', editandoId), dadosFinais);
            } else {
                await addDoc(collection(db, 'Tarefas'), dadosFinais);
            }
            setModalVisivel(false);
        } catch (erro) {
            setErrorMessage('Não foi possível salvar a tarefa. Tente novamente.');
        }
    };

    const avancarEtapa = () => {
        if (!form.etapas[etapaIndiceAtual].titulo.trim()) {
            setErrorMessage('Dê um título para essa etapa');
            return;
        }
        setErrorMessage('');
        if (etapaIndiceAtual < form.etapas.length - 1) {
            setEtapaIndiceAtual((i) => i + 1);
        } else {
            salvarTarefaFinal();
        }
    };

    const voltarPasso = () => {
        setErrorMessage('');
        if (wizardPasso === 'frequencia') {
            setWizardPasso('basico');
        } else if (wizardPasso === 'atribuir') {
            setWizardPasso('frequencia');
        } else if (wizardPasso === 'numeroEtapas') {
            setWizardPasso('atribuir');
        } else if (wizardPasso === 'etapa') {
            if (etapaIndiceAtual === 0) {
                setWizardPasso('numeroEtapas');
            } else {
                setEtapaIndiceAtual((i) => i - 1);
            }
        }
    };

    const confirmarEdicao = () => {
        if (!form.titulo.trim()) {
            setErrorMessage('Dê um título para a tarefa');
            return;
        }
        if (!form.horario.trim()) {
            setErrorMessage('Defina um horário');
            return;
        }
        if (form.frequenciaTipo === 'dias' && form.dias.length === 0) {
            setErrorMessage('Escolha ao menos um dia da semana');
            return;
        }
        if (form.etapas.some((etapa) => !etapa.titulo.trim())) {
            setErrorMessage('Dê um título para todas as etapas');
            return;
        }
        setErrorMessage('');
        salvarTarefaFinal();
    };

    const excluirTarefa = async (id) => {
        try {
            await deleteDoc(doc(db, 'Tarefas', id));
        } catch (erro) {
        }
        setModalVisivel(false);
        setDetalheVisivel(false);
    };

    const tituloDoModal = editandoId
        ? 'Editar tarefa'
        : wizardPasso === 'etapa'
            ? `Etapa ${etapaIndiceAtual + 1} de ${form.etapas.length}`
            : TITULOS_PASSO[wizardPasso];

    const renderCampoHorario = () => (
        <>
            <Text style={styles.label}>{form.frequenciaTipo === 'unica' ? 'HORÁRIO DO PRAZO' : 'PRAZO'}</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setHorarioPickerVisivel(true)}>
                <View pointerEvents="none">
                    <TextInput
                        {...inputProps}
                        value={form.horario}
                        placeholder="18:00"
                        editable={false}
                        left={<TextInput.Icon icon="clock-outline" color={c.sub} />}
                        right={<TextInput.Icon icon="chevron-down" color={c.sub} />}
                        style={styles.input}
                        dense
                    />
                </View>
            </TouchableOpacity>

            {horarioPickerVisivel && (
                <DateTimePicker
                    value={obterDateDoHorario(form.horario)}
                    mode="time"
                    is24Hour={true}
                    display="clock"
                    onChange={alterarHorario}
                />
            )}
        </>
    );

    const renderCampoData = () => (
        <>
            <Text style={styles.label}>DATA DO PRAZO</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setDataPickerVisivel(true)}>
                <View pointerEvents="none">
                    <TextInput
                        {...inputProps}
                        value={form.dataUnica ? descreverData(form.dataUnica) : ''}
                        placeholder={formatarDataHoje()}
                        editable={false}
                        left={<TextInput.Icon icon="calendar-outline" color={c.sub} />}
                        right={<TextInput.Icon icon="chevron-down" color={c.sub} />}
                        style={styles.input}
                        dense
                    />
                </View>
            </TouchableOpacity>

            {dataPickerVisivel && (
                <DateTimePicker
                    value={dataDeTexto(form.dataUnica)}
                    mode="date"
                    display="calendar"
                    minimumDate={new Date()}
                    onChange={alterarData}
                />
            )}

            <Text style={styles.avisoDiaria}>
                A tarefa já aparece para o funcionário e fica disponível até{' '}
                {descreverData(form.dataUnica || formatarDataHoje())}
                {form.horario ? ` às ${form.horario}` : ''}.
            </Text>
        </>
    );

    const renderSegmentadoFrequencia = () => (
        <View style={styles.segmentado}>
            {[
                { valor: 'dias', texto: 'Dias da semana' },
                { valor: 'unica', texto: 'Tarefa única' },
                { valor: 'diaria', texto: 'Diária' },
            ].map((opcao) => (
                <TouchableOpacity
                    key={opcao.valor}
                    style={[styles.segmentadoItem, form.frequenciaTipo === opcao.valor && styles.segmentadoItemAtivo]}
                    onPress={() =>
                        setForm((prev) => ({
                            ...prev,
                            frequenciaTipo: opcao.valor,
                            dataUnica: opcao.valor === 'unica' && !prev.dataUnica ? formatarDataHoje() : prev.dataUnica,
                        }))
                    }
                >
                    <Text style={[styles.segmentadoTexto, form.frequenciaTipo === opcao.valor && styles.segmentadoTextoAtivo]}>
                        {opcao.texto}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderDiasForm = () => (
        <View style={styles.diasRow}>
            {DIAS_SEMANA_ABREVIADOS.map((dia) => {
                const ativo = form.dias.includes(dia.nome);
                return (
                    <TouchableOpacity key={dia.nome} style={styles.diaCirculo} onPress={() => alternarDiaForm(dia.nome)}>
                        <View style={[styles.diaCirculoFundo, ativo && styles.diaCirculoFundoAtivo]}>
                            <Text style={[styles.diaCirculoLetra, ativo && styles.diaCirculoLetraAtiva]}>{dia.letra}</Text>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    const renderSegmentadoAtribuir = () => (
        <View style={styles.segmentado}>
            {[
                { valor: 'cargo', texto: 'Cargo' },
                { valor: 'ambos', texto: 'Cargo e membro' },
            ].map((opcao) => (
                <TouchableOpacity
                    key={opcao.valor}
                    style={[styles.segmentadoItem, form.atribuidoTipo === opcao.valor && styles.segmentadoItemAtivo]}
                    onPress={() =>
                        setForm((prev) => {
                            if (opcao.valor === 'ambos') {
                                const compativel = membrosDoCargo(prev.cargo)[0];
                                return { ...prev, atribuidoTipo: opcao.valor, membro: compativel ? compativel.nome : prev.membro };
                            }
                            return { ...prev, atribuidoTipo: opcao.valor };
                        })
                    }
                >
                    <Text style={[styles.segmentadoTexto, form.atribuidoTipo === opcao.valor && styles.segmentadoTextoAtivo]}>
                        {opcao.texto}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderCamposAtribuir = (semMargem) =>
        form.atribuidoTipo === 'ambos' ? (
            <View style={[styles.duploCampoRow, semMargem && { marginBottom: 0 }]}>
                <TouchableOpacity style={[styles.filtroBotao, styles.campoMetade]} onPress={abrirCargoForm}>
                    <View style={[styles.dot, { backgroundColor: corDoCargo(form.cargo) }]} />
                    <Text style={styles.filtroTexto} numberOfLines={1}>{form.cargo}</Text>
                    <Icon source="chevron-down" size={14} color={c.sub} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filtroBotao, styles.campoMetade]} onPress={abrirMembroForm}>
                    <Icon source="account-outline" size={14} color={c.sub} />
                    <Text style={styles.filtroTexto} numberOfLines={1}>{form.membro}</Text>
                    <Icon source="chevron-down" size={14} color={c.sub} />
                </TouchableOpacity>
            </View>
        ) : (
            <TouchableOpacity style={[styles.filtroBotao, semMargem ? { marginBottom: 0 } : styles.campoLargura]} onPress={abrirCargoForm}>
                <View style={[styles.dot, { backgroundColor: corDoCargo(form.cargo) }]} />
                <Text style={styles.filtroTexto}>{form.cargo}</Text>
                <Icon source="chevron-down" size={16} color={c.sub} />
            </TouchableOpacity>
        );

    const renderCamposEtapa = (indice) => (
        <>
            <Text style={styles.label}>TÍTULO DA ETAPA</Text>
            <TextInput
                {...inputProps}
                value={form.etapas[indice].titulo}
                onChangeText={(texto) => atualizarEtapa(indice, { titulo: texto })}
                style={styles.input}
                dense
            />

            <Text style={styles.label}>DESCRIÇÃO (OPCIONAL)</Text>
            <TextInput
                {...inputProps}
                value={form.etapas[indice].descricao}
                onChangeText={(texto) => atualizarEtapa(indice, { descricao: texto })}
                multiline
                numberOfLines={2}
                style={[styles.input, styles.inputMultiline]}
            />

            <View style={styles.etapaFotoRow}>
                <View style={styles.etapaFotoInfo}>
                    <Icon
                        source="camera-outline"
                        size={18}
                        color={form.etapas[indice].requerFoto ? c.sucesso : c.sub}
                    />
                    <Text style={styles.etapaFotoTexto}>Requer foto</Text>
                </View>
                <Switch
                    value={form.etapas[indice].requerFoto}
                    onValueChange={(valor) => atualizarEtapa(indice, { requerFoto: valor })}
                    color={c.sucesso}
                />
            </View>
        </>
    );

    const renderAvatarMembro = (membro) =>
        membro.icone ? (
            <Avatar.Image size={28} source={{ uri: membro.icone }} />
        ) : (
            <Avatar.Text
                size={28}
                label={iniciais(membro.nome)}
                color={corDoCargo(membro.cargo)}
                style={[styles.avatarFallback, { borderColor: corDoCargo(membro.cargo) }]}
            />
        );

    const botaoAmarelo = (texto, onPress) => (
        <Button
            mode="contained"
            buttonColor={c.amarelo}
            textColor={c.sobreAmarelo}
            style={styles.wizardBotao}
            contentStyle={styles.buttonContent}
            onPress={onPress}
        >
            {texto}
        </Button>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.cabecalho}>
                <Text style={styles.titulo}>Tarefas</Text>
                <View style={styles.divisor} />
            </View>

            <View style={styles.searchRow}>
                <TextInput
                    {...inputProps}
                    value={busca}
                    onChangeText={setBusca}
                    placeholder="Buscar por título"
                    left={<TextInput.Icon icon="magnify" color={c.sub} />}
                    style={styles.searchInput}
                    dense
                />
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.pilulasScroll}
                contentContainerStyle={styles.pilulasRow}
            >
                <TouchableOpacity
                    style={[styles.pilula, filtroCargo !== 'Todos' && styles.pilulaAtiva]}
                    onPress={() => {
                        setBuscaCargoFiltro('');
                        setCargoMenuVisivel(true);
                    }}
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

                <TouchableOpacity
                    style={[styles.pilula, filtroDia !== 'Todos' && styles.pilulaAtiva]}
                    onPress={() => setDiaMenuVisivel(true)}
                >
                    <Icon source="calendar-outline" size={14} color={filtroDia !== 'Todos' ? c.ambarTexto : c.sub} />
                    <Text style={[styles.pilulaTexto, filtroDia !== 'Todos' && styles.pilulaTextoAtivo]} numberOfLines={1}>
                        {filtroDia !== 'Todos' ? filtroDia : 'Dia'}
                    </Text>
                    <Icon source="chevron-down" size={14} color={filtroDia !== 'Todos' ? c.ambarTexto : c.sub} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.pilula, filtroMembro !== 'Todos' && styles.pilulaAtiva]}
                    onPress={() => {
                        setBuscaMembroFiltro('');
                        setMembroMenuVisivel(true);
                    }}
                >
                    <Icon source="account-outline" size={14} color={filtroMembro !== 'Todos' ? c.ambarTexto : c.sub} />
                    <Text style={[styles.pilulaTexto, filtroMembro !== 'Todos' && styles.pilulaTextoAtivo]} numberOfLines={1}>
                        {filtroMembro !== 'Todos' ? abreviarNome(filtroMembro) : 'Funcionário'}
                    </Text>
                    <Icon source="chevron-down" size={14} color={filtroMembro !== 'Todos' ? c.ambarTexto : c.sub} />
                </TouchableOpacity>
            </ScrollView>

            {!carregandoTarefas && (
                <Text style={styles.countText}>
                    {tarefasFiltradas.length === tarefas.length
                        ? `Total de tarefas: ${tarefas.length}`
                        : `Mostrando ${tarefasFiltradas.length} de ${tarefas.length} tarefas`}
                </Text>
            )}

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {carregandoTarefas && (
                    <View style={styles.emptyState}>
                        <ActivityIndicator animating color={c.perigo} />
                        <Text style={styles.emptyStateText}>Carregando tarefas...</Text>
                    </View>
                )}
                {!carregandoTarefas && tarefasFiltradas.length === 0 && (
                    <View style={styles.emptyState}>
                        <Icon source="clipboard-text-off-outline" size={28} color={c.sub} />
                        <Text style={styles.emptyStateText}>Nenhuma tarefa encontrada</Text>
                    </View>
                )}
                {!carregandoTarefas && tarefasFiltradas.map((tarefa) => (
                    <TouchableOpacity key={tarefa.id} style={styles.card} onPress={() => abrirDetalhe(tarefa)}>
                        <View style={styles.cardInner}>
                            <View style={styles.horarioBox}>
                                <Text style={styles.horarioTexto}>{tarefa.horario}</Text>
                                {tarefa.frequenciaTipo === 'unica' && !!tarefa.dataUnica && (
                                    <Text style={styles.horarioData}>{tarefa.dataUnica.slice(0, 5)}</Text>
                                )}
                            </View>
                            <View style={styles.cardConteudo}>
                                <Text style={styles.cardTitulo} numberOfLines={2}>{tarefa.titulo}</Text>
                                <View style={styles.cardRodape}>
                                    <View style={styles.cardRodapeLinha}>
                                        <View style={[styles.cargoBadge, { backgroundColor: `${corDoCargo(tarefa.cargo)}26` }]}>
                                            <View style={[styles.dot, { backgroundColor: corDoCargo(tarefa.cargo) }]} />
                                            <Text style={[styles.cargoBadgeTexto, { color: corDoCargo(tarefa.cargo) }]}>{tarefa.cargo}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.cardRodapeLinha}>
                                        {tarefa.atribuidoTipo === 'ambos' && (
                                            <View style={styles.membroBadge}>
                                                <Icon source="account-outline" size={12} color={c.sub} />
                                                <Text style={styles.membroBadgeTexto} numberOfLines={1}>{abreviarNome(tarefa.membro)}</Text>
                                            </View>
                                        )}
                                        <View style={styles.etapasInfo}>
                                            <Icon source="format-list-checks" size={14} color={c.sub} />
                                            <Text style={styles.etapasTexto}>{tarefa.etapas.length} etapas</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.cardChevron}>
                                <Icon source="chevron-right" size={20} color={c.sub} />
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <TouchableOpacity style={[styles.fab, { bottom: Math.max(insets.bottom + 16, 24) }]} onPress={abrirNovo}>
                <Icon source="plus" size={26} color={c.sobreAmarelo} />
            </TouchableOpacity>

            <Portal>
                <Modal
                    visible={cargoMenuVisivel}
                    onDismiss={() => setCargoMenuVisivel(false)}
                    contentContainerStyle={styles.menuPopupContainerBusca}
                    theme={backdrop(0.8)}
                >
                    <TextInput
                        {...inputProps}
                        value={buscaCargoFiltro}
                        onChangeText={setBuscaCargoFiltro}
                        placeholder="Buscar cargo"
                        left={<TextInput.Icon icon="magnify" color={c.sub} />}
                        style={styles.input}
                        dense
                        autoFocus
                    />
                    <ScrollView style={styles.menuPopupLista}>
                        {'todos'.includes(buscaCargoFiltro.trim().toLowerCase()) && (
                            <TouchableOpacity
                                style={styles.menuOpcao}
                                onPress={() => {
                                    setFiltroCargo('Todos');
                                    setFiltroMembro('Todos');
                                    setCargoMenuVisivel(false);
                                }}
                            >
                                <View style={[styles.dot, { backgroundColor: c.sub }]} />
                                <Text style={styles.menuOpcaoTexto}>Todos</Text>
                            </TouchableOpacity>
                        )}
                        {cargosDisponiveis
                            .filter((cargo) => cargo.toLowerCase().includes(buscaCargoFiltro.trim().toLowerCase()))
                            .map((cargo) => (
                                <TouchableOpacity
                                    key={cargo}
                                    style={styles.menuOpcao}
                                    onPress={() => {
                                        setFiltroCargo(cargo);
                                        setFiltroMembro('Todos');
                                        setCargoMenuVisivel(false);
                                    }}
                                >
                                    <View style={[styles.dot, { backgroundColor: corDoCargo(cargo) }]} />
                                    <Text style={styles.menuOpcaoTexto}>{cargo}</Text>
                                </TouchableOpacity>
                            ))}
                    </ScrollView>
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={membroMenuVisivel}
                    onDismiss={() => setMembroMenuVisivel(false)}
                    contentContainerStyle={styles.menuPopupContainerBusca}
                    theme={backdrop(0.8)}
                >
                    <TextInput
                        {...inputProps}
                        value={buscaMembroFiltro}
                        onChangeText={setBuscaMembroFiltro}
                        placeholder="Buscar funcionário"
                        left={<TextInput.Icon icon="magnify" color={c.sub} />}
                        style={styles.input}
                        dense
                        autoFocus
                    />
                    <ScrollView style={styles.menuPopupLista}>
                        {'todos'.includes(buscaMembroFiltro.trim().toLowerCase()) && (
                            <TouchableOpacity
                                style={styles.menuOpcao}
                                onPress={() => {
                                    setFiltroMembro('Todos');
                                    setMembroMenuVisivel(false);
                                }}
                            >
                                <Text style={styles.menuOpcaoTexto}>Todos</Text>
                            </TouchableOpacity>
                        )}
                        {membrosParaFiltro
                            .filter((membro) => membro.nome.toLowerCase().includes(buscaMembroFiltro.trim().toLowerCase()))
                            .map((membro) => (
                                <TouchableOpacity
                                    key={membro.id}
                                    style={styles.menuOpcao}
                                    onPress={() => {
                                        setFiltroMembro(membro.nome);
                                        setMembroMenuVisivel(false);
                                    }}
                                >
                                    {renderAvatarMembro(membro)}
                                    <Text style={styles.menuOpcaoTexto}>{membro.nome}</Text>
                                </TouchableOpacity>
                            ))}
                    </ScrollView>
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={diaMenuVisivel}
                    onDismiss={() => setDiaMenuVisivel(false)}
                    contentContainerStyle={styles.diaMenuContainer}
                    theme={backdrop(0.8)}
                >
                    <View style={styles.diaMenuHeader}>
                        <Text style={styles.diaMenuTitulo}>Filtrar por dia</Text>
                        <IconButton icon="close" size={18} iconColor={c.sub} onPress={() => setDiaMenuVisivel(false)} />
                    </View>
                    <Text style={styles.diaMenuDescricao}>
                        Veja todas as tarefas, só as diárias, ou apenas as marcadas para um dia específico da semana.
                    </Text>

                    <View style={styles.diaMenuPillsRow}>
                        <TouchableOpacity
                            style={[styles.diaMenuPill, filtroDia === 'Todos' && styles.diaMenuPillAtiva]}
                            onPress={() => {
                                setFiltroDia('Todos');
                                setDiaMenuVisivel(false);
                            }}
                        >
                            <Text style={[styles.diaMenuPillTexto, filtroDia === 'Todos' && styles.diaMenuPillTextoAtiva]}>
                                Todos
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.diaMenuPill, filtroDia === 'Diárias' && styles.diaMenuPillAtiva]}
                            onPress={() => {
                                setFiltroDia('Diárias');
                                setDiaMenuVisivel(false);
                            }}
                        >
                            <Icon source="repeat" size={14} color={filtroDia === 'Diárias' ? c.sobreAmarelo : c.sub} />
                            <Text style={[styles.diaMenuPillTexto, filtroDia === 'Diárias' && styles.diaMenuPillTextoAtiva]}>
                                Diárias
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.diaMenuLegenda}>Ou escolha um dia específico</Text>

                    <View style={styles.diasRow}>
                        {DIAS_SEMANA_ABREVIADOS.map((dia) => {
                            const ativo = filtroDia === dia.nome;
                            return (
                                <TouchableOpacity
                                    key={dia.nome}
                                    style={styles.diaCirculo}
                                    onPress={() => {
                                        setFiltroDia(dia.nome);
                                        setDiaMenuVisivel(false);
                                    }}
                                >
                                    <View style={[styles.diaCirculoFundo, ativo && styles.diaCirculoFundoAtivo]}>
                                        <Text style={[styles.diaCirculoLetra, ativo && styles.diaCirculoLetraAtiva]}>{dia.letra}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={detalheVisivel}
                    onDismiss={() => setDetalheVisivel(false)}
                    contentContainerStyle={[styles.detalheContainer, { paddingBottom: Math.max(insets.bottom + 20, 28) }]}
                    style={styles.detalheModalWrapper}
                    theme={backdrop(0.6)}
                >
                    {tarefaDetalhe && (
                        <View>
                            <View style={styles.detalheHandle} />

                            <View style={styles.detalheHeader}>
                                <View style={[styles.cargoBadge, { backgroundColor: `${corDoCargo(tarefaDetalhe.cargo)}26` }]}>
                                    <View style={[styles.dot, { backgroundColor: corDoCargo(tarefaDetalhe.cargo) }]} />
                                    <Text style={[styles.cargoBadgeTexto, { color: corDoCargo(tarefaDetalhe.cargo) }]}>
                                        {tarefaDetalhe.cargo}
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
                                    <Text style={styles.detalheChipTexto} numberOfLines={1}>{descreverFrequencia(tarefaDetalhe)}</Text>
                                </View>
                            </View>

                            {!!tarefaDetalhe.descricao && (
                                <Text style={styles.detalheDescricao}>{tarefaDetalhe.descricao}</Text>
                            )}

                            <View style={styles.detalheResponsavelRow}>
                                <View style={[styles.dot, { backgroundColor: corDoCargo(tarefaDetalhe.cargo) }]} />
                                <Text style={styles.detalheResponsavelTexto}>{tarefaDetalhe.cargo}</Text>
                                {tarefaDetalhe.atribuidoTipo === 'ambos' && (
                                    <>
                                        <Icon source="account-outline" size={14} color={c.sub} />
                                        <Text style={styles.detalheResponsavelTexto}>{abreviarNome(tarefaDetalhe.membro)}</Text>
                                    </>
                                )}
                            </View>

                            <View style={styles.detalheEtapasBloco}>
                                <View style={styles.detalheEtapasHeader}>
                                    <Text style={styles.label}>ETAPAS</Text>
                                    <Text style={styles.detalheEtapasContador}>{tarefaDetalhe.etapas.length} etapas</Text>
                                </View>

                                <ScrollView style={styles.detalheEtapasScroll} nestedScrollEnabled>
                                    {tarefaDetalhe.etapas.map((etapa, indice) => (
                                        <View key={etapa.id} style={styles.detalheEtapaLinha}>
                                            <View style={styles.detalheEtapaNumero}>
                                                <Text style={styles.detalheEtapaNumeroTexto}>{indice + 1}</Text>
                                            </View>
                                            <Text style={styles.detalheEtapaTitulo} numberOfLines={1}>{etapa.titulo}</Text>
                                            {etapa.requerFoto && <Icon source="camera-outline" size={16} color={c.sucesso} />}
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={styles.detalheAcoes}>
                                <Button
                                    mode="outlined"
                                    icon="trash-can-outline"
                                    textColor={c.perigo}
                                    style={[styles.detalheBotao, { borderColor: c.perigo }]}
                                    contentStyle={styles.buttonContent}
                                    onPress={excluirDoDetalhe}
                                >
                                    Excluir
                                </Button>
                                <Button
                                    mode="contained"
                                    icon="pencil-outline"
                                    buttonColor={c.amarelo}
                                    textColor={c.sobreAmarelo}
                                    style={styles.detalheBotao}
                                    contentStyle={styles.buttonContent}
                                    onPress={editarDoDetalhe}
                                >
                                    Editar
                                </Button>
                            </View>
                        </View>
                    )}
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={modalVisivel}
                    onDismiss={() => setModalVisivel(false)}
                    contentContainerStyle={styles.wizardContainer}
                    theme={backdrop(0.85)}
                >
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitulo}>{tituloDoModal}</Text>
                        <IconButton icon="close" iconColor={c.sub} onPress={() => setModalVisivel(false)} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {editandoId && (
                            <View>
                                <View style={styles.secaoGrupo}>
                                    <TouchableOpacity style={styles.secaoGrupoLinha} onPress={() => abrirSecaoPopup('basico')}>
                                        <View style={styles.secaoGrupoInfo}>
                                            <Text style={styles.secaoLabel}>TÍTULO E DESCRIÇÃO</Text>
                                            <Text style={styles.secaoValor} numberOfLines={1}>{form.titulo || 'Sem título'}</Text>
                                        </View>
                                        <Icon source="chevron-right" size={18} color={c.sub} />
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.secaoGrupoLinha} onPress={() => abrirSecaoPopup('frequencia')}>
                                        <View style={styles.secaoGrupoInfo}>
                                            <Text style={styles.secaoLabel}>FREQUÊNCIA E HORÁRIO</Text>
                                            <Text style={styles.secaoValor} numberOfLines={1}>
                                                {form.horario || '--:--'} · {descreverFrequencia(form)}
                                            </Text>
                                        </View>
                                        <Icon source="chevron-right" size={18} color={c.sub} />
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.secaoGrupoLinha} onPress={() => abrirSecaoPopup('atribuir')}>
                                        <View style={styles.secaoGrupoInfo}>
                                            <Text style={styles.secaoLabel}>ATRIBUIR PARA</Text>
                                            <View style={styles.secaoValorLinha}>
                                                <View style={[styles.dot, { backgroundColor: corDoCargo(form.cargo) }]} />
                                                <Text style={styles.secaoValor} numberOfLines={1}>{descreverAtribuido(form)}</Text>
                                            </View>
                                        </View>
                                        <Icon source="chevron-right" size={18} color={c.sub} />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.secaoGrupoLinha, styles.secaoGrupoLinhaUltima]}
                                        onPress={() => abrirSecaoPopup('etapas')}
                                    >
                                        <View style={styles.secaoGrupoInfo}>
                                            <Text style={styles.secaoLabel}>ETAPAS</Text>
                                            <Text style={styles.secaoValor}>{form.etapas.length} etapas</Text>
                                        </View>
                                        <Icon source="chevron-right" size={18} color={c.sub} />
                                    </TouchableOpacity>
                                </View>

                                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                                <Button
                                    mode="contained"
                                    buttonColor={c.amarelo}
                                    textColor={c.sobreAmarelo}
                                    style={styles.botaoSalvarEdicao}
                                    contentStyle={styles.buttonContent}
                                    onPress={confirmarEdicao}
                                >
                                    Salvar alterações
                                </Button>
                            </View>
                        )}

                        {!editandoId && (
                            <View>
                                {wizardPasso === 'basico' && (
                                    <View>
                                        <Text style={styles.label}>TÍTULO</Text>
                                        <TextInput
                                            {...inputProps}
                                            value={form.titulo}
                                            onChangeText={(texto) => setForm((prev) => ({ ...prev, titulo: texto }))}
                                            style={styles.input}
                                            dense
                                        />

                                        <Text style={styles.label}>DESCRIÇÃO (OPCIONAL, MÁX. 250 CARACTERES)</Text>
                                        <TextInput
                                            {...inputProps}
                                            value={form.descricao}
                                            onChangeText={(texto) => setForm((prev) => ({ ...prev, descricao: texto.slice(0, 250) }))}
                                            multiline
                                            numberOfLines={3}
                                            maxLength={250}
                                            style={[styles.input, styles.inputMultiline]}
                                        />
                                    </View>
                                )}

                                {wizardPasso === 'frequencia' && (
                                    <View>
                                        {renderCampoHorario()}

                                        <Text style={styles.label}>FREQUÊNCIA</Text>
                                        {renderSegmentadoFrequencia()}

                                        {form.frequenciaTipo === 'dias' && renderDiasForm()}

                                        {form.frequenciaTipo === 'unica' && renderCampoData()}

                                        {form.frequenciaTipo === 'diaria' && (
                                            <Text style={styles.avisoDiaria}>Essa tarefa aparece todos os dias.</Text>
                                        )}
                                    </View>
                                )}

                                {wizardPasso === 'atribuir' && (
                                    <View>
                                        {renderSegmentadoAtribuir()}
                                        {renderCamposAtribuir(false)}
                                    </View>
                                )}

                                {wizardPasso === 'numeroEtapas' && (
                                    <View style={styles.numeroEtapasBox}>
                                        <Text style={styles.numeroEtapasLabel}>Quantas etapas essa tarefa tem?</Text>
                                        <View style={styles.contadorRow}>
                                            <IconButton
                                                icon="minus"
                                                mode="outlined"
                                                iconColor={c.texto}
                                                containerColor={c.campo}
                                                onPress={() => setForm((prev) => ({ ...prev, numeroEtapas: Math.max(1, prev.numeroEtapas - 1) }))}
                                            />
                                            <Text style={styles.contadorNumero}>{form.numeroEtapas}</Text>
                                            <IconButton
                                                icon="plus"
                                                mode="outlined"
                                                iconColor={c.texto}
                                                containerColor={c.campo}
                                                onPress={() => setForm((prev) => ({ ...prev, numeroEtapas: prev.numeroEtapas + 1 }))}
                                            />
                                        </View>
                                    </View>
                                )}

                                {wizardPasso === 'etapa' && <View>{renderCamposEtapa(etapaIndiceAtual)}</View>}

                                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                                <View style={styles.wizardAcoes}>
                                    {wizardPasso !== 'basico' && (
                                        <Button
                                            mode="outlined"
                                            textColor={c.sub}
                                            style={[styles.wizardBotao, styles.botaoOutline]}
                                            contentStyle={styles.buttonContent}
                                            onPress={voltarPasso}
                                        >
                                            Voltar
                                        </Button>
                                    )}
                                    {wizardPasso === 'basico' && botaoAmarelo('Próximo', irParaFrequencia)}
                                    {wizardPasso === 'frequencia' && botaoAmarelo('Próximo', irParaAtribuir)}
                                    {wizardPasso === 'atribuir' && botaoAmarelo('Próximo', irParaNumeroEtapas)}
                                    {wizardPasso === 'numeroEtapas' && botaoAmarelo('Continuar', avancarParaEtapas)}
                                    {wizardPasso === 'etapa' &&
                                        botaoAmarelo(
                                            etapaIndiceAtual < form.etapas.length - 1 ? 'Próxima etapa' : 'Salvar',
                                            avancarEtapa
                                        )}
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={!!secaoAberta}
                    onDismiss={fecharSecaoPopup}
                    contentContainerStyle={styles.secaoPopupContainer}
                    theme={backdrop(0.6)}
                >
                    {secaoAberta && (
                        <View>
                            <View style={styles.secaoPopupHeader}>
                                <TouchableOpacity onPress={fecharSecaoPopup} style={styles.secaoPopupVoltar} hitSlop={8}>
                                    <Icon source="chevron-left" size={20} color={c.sub} />
                                </TouchableOpacity>
                                <Text style={styles.secaoPopupTitulo}>{TITULOS_SECAO[secaoAberta]}</Text>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                {secaoAberta === 'basico' && (
                                    <View>
                                        <Text style={styles.label}>TÍTULO</Text>
                                        <TextInput
                                            {...inputProps}
                                            value={form.titulo}
                                            onChangeText={(texto) => setForm((prev) => ({ ...prev, titulo: texto }))}
                                            style={styles.input}
                                            dense
                                        />

                                        <Text style={styles.label}>DESCRIÇÃO (OPCIONAL, MÁX. 250 CARACTERES)</Text>
                                        <TextInput
                                            {...inputProps}
                                            value={form.descricao}
                                            onChangeText={(texto) => setForm((prev) => ({ ...prev, descricao: texto.slice(0, 250) }))}
                                            multiline
                                            numberOfLines={3}
                                            maxLength={250}
                                            style={[styles.input, styles.inputMultiline, { marginBottom: 0 }]}
                                        />
                                    </View>
                                )}

                                {secaoAberta === 'frequencia' && (
                                    <View>
                                        {renderCampoHorario()}

                                        <Text style={styles.label}>FREQUÊNCIA</Text>
                                        {renderSegmentadoFrequencia()}

                                        {form.frequenciaTipo === 'dias' && renderDiasForm()}

                                        {form.frequenciaTipo === 'unica' && renderCampoData()}

                                        {form.frequenciaTipo === 'diaria' && (
                                            <Text style={styles.avisoDiaria}>Essa tarefa aparece todos os dias.</Text>
                                        )}
                                    </View>
                                )}

                                {secaoAberta === 'atribuir' && (
                                    <View>
                                        {renderSegmentadoAtribuir()}
                                        {renderCamposAtribuir(true)}
                                    </View>
                                )}

                                {secaoAberta === 'etapas' && (
                                    <View>
                                        <View style={styles.etapaPopupNavHeader}>
                                            <Text style={styles.etapaPopupContagem}>
                                                Etapa {etapaPopupIndice + 1} de {form.etapas.length}
                                            </Text>
                                            {form.etapas.length > 1 && (
                                                <TouchableOpacity onPress={removerEtapaAtualNoPopup} hitSlop={8}>
                                                    <Icon source="trash-can-outline" size={18} color={c.perigo} />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {renderCamposEtapa(etapaPopupIndice)}

                                        <View style={styles.wizardAcoes}>
                                            {etapaPopupIndice > 0 && (
                                                <Button
                                                    mode="outlined"
                                                    textColor={c.sub}
                                                    style={[styles.wizardBotao, styles.botaoOutline]}
                                                    contentStyle={styles.buttonContent}
                                                    onPress={() => setEtapaPopupIndice((i) => i - 1)}
                                                >
                                                    Anterior
                                                </Button>
                                            )}
                                            {botaoAmarelo(
                                                etapaPopupIndice < form.etapas.length - 1 ? 'Próxima etapa' : 'Adicionar etapa',
                                                () => {
                                                    if (etapaPopupIndice < form.etapas.length - 1) {
                                                        setEtapaPopupIndice((i) => i + 1);
                                                    } else {
                                                        adicionarEtapaEIrParaNoPopup();
                                                    }
                                                }
                                            )}
                                        </View>
                                    </View>
                                )}

                                <Button
                                    mode="contained"
                                    buttonColor={c.amarelo}
                                    textColor={c.sobreAmarelo}
                                    style={styles.secaoPopupConcluir}
                                    contentStyle={styles.buttonContent}
                                    onPress={fecharSecaoPopup}
                                >
                                    Concluído
                                </Button>
                            </ScrollView>
                        </View>
                    )}
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={cargoFormVisivel}
                    onDismiss={() => setCargoFormVisivel(false)}
                    contentContainerStyle={styles.menuPopupContainer}
                    theme={backdrop(0.8)}
                >
                    <TextInput
                        {...inputProps}
                        value={buscaCargoForm}
                        onChangeText={setBuscaCargoForm}
                        placeholder="Buscar cargo"
                        left={<TextInput.Icon icon="magnify" color={c.sub} />}
                        style={styles.input}
                        dense
                        autoFocus
                    />
                    <ScrollView style={styles.menuPopupListaCurta}>
                        {cargosDisponiveis
                            .filter((cargo) => cargo.toLowerCase().includes(buscaCargoForm.trim().toLowerCase()))
                            .map((cargo) => (
                                <TouchableOpacity
                                    key={cargo}
                                    style={styles.menuOpcao}
                                    onPress={() => {
                                        setForm((prev) => {
                                            if (prev.atribuidoTipo === 'ambos') {
                                                const compativel = membrosDoCargo(cargo)[0];
                                                return { ...prev, cargo, membro: compativel ? compativel.nome : prev.membro };
                                            }
                                            return { ...prev, cargo };
                                        });
                                        setCargoFormVisivel(false);
                                    }}
                                >
                                    <View style={[styles.dot, { backgroundColor: corDoCargo(cargo) }]} />
                                    <Text style={styles.menuOpcaoTexto}>{cargo}</Text>
                                </TouchableOpacity>
                            ))}
                    </ScrollView>
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={membroFormVisivel}
                    onDismiss={() => setMembroFormVisivel(false)}
                    contentContainerStyle={styles.menuPopupContainer}
                    theme={backdrop(0.8)}
                >
                    <TextInput
                        {...inputProps}
                        value={buscaMembroForm}
                        onChangeText={setBuscaMembroForm}
                        placeholder="Buscar membro"
                        left={<TextInput.Icon icon="magnify" color={c.sub} />}
                        style={styles.input}
                        dense
                        autoFocus
                    />
                    <ScrollView style={styles.menuPopupListaCurta}>
                        {membrosDoCargo(form.cargo)
                            .filter((membro) => membro.nome.toLowerCase().includes(buscaMembroForm.trim().toLowerCase()))
                            .map((membro) => (
                                <TouchableOpacity
                                    key={membro.id}
                                    style={styles.menuOpcao}
                                    onPress={() => {
                                        setForm((prev) => ({ ...prev, membro: membro.nome }));
                                        setMembroFormVisivel(false);
                                    }}
                                >
                                    {renderAvatarMembro(membro)}
                                    <Text style={styles.menuOpcaoTexto}>{membro.nome}</Text>
                                </TouchableOpacity>
                            ))}
                    </ScrollView>
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
        cabecalho: {
            paddingHorizontal: 20,
            paddingTop: 22,
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
        searchRow: {
            paddingHorizontal: 20,
        },
        searchInput: {
            backgroundColor: c.campo,
            fontSize: 14,
        },
        pilulasScroll: {
            flexGrow: 0,
            marginTop: 10,
            marginBottom: 4,
        },
        countText: {
            color: c.sub,
            fontSize: 12,
            paddingHorizontal: 22,
            marginTop: 8,
            marginBottom: 8,
        },
        pilulasRow: {
            paddingHorizontal: 20,
            gap: 8,
        },
        pilula: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 36,
            maxWidth: 200,
            paddingHorizontal: 12,
            borderRadius: 18,
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
        filtroBotao: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: c.campo,
            borderWidth: 1,
            borderColor: c.borda,
            borderRadius: 14,
            paddingHorizontal: 12,
            height: 44,
        },
        filtroTexto: {
            flex: 1,
            color: c.sub,
            fontSize: 12,
        },
        campoLargura: {
            marginBottom: 16,
        },
        duploCampoRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 16,
        },
        campoMetade: {
            flex: 1,
        },
        dot: {
            width: 8,
            height: 8,
            borderRadius: 4,
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
            borderRadius: 14,
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
            borderRadius: 14,
            overflow: 'hidden',
        },
        cardChevron: {
            marginRight: 10,
        },
        horarioBox: {
            width: 58,
            alignSelf: 'stretch',
            backgroundColor: c.escuro ? '#2C2C2E' : '#2B1B12',
            alignItems: 'center',
            justifyContent: 'center',
        },
        horarioTexto: {
            color: c.escuro ? '#F2F2F2' : '#FFFFFF',
            fontSize: 15,
            fontWeight: 'bold',
        },
        horarioData: {
            color: c.amarelo,
            fontSize: 11,
            fontWeight: 'bold',
            marginTop: 2,
        },
        cardConteudo: {
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 12,
        },
        cardTitulo: {
            color: c.texto,
            fontSize: 14,
            fontWeight: 'bold',
            marginBottom: 6,
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
        membroBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        membroBadgeTexto: {
            color: c.sub,
            fontSize: 11,
        },
        cargoBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 20,
        },
        cargoBadgeTexto: {
            fontSize: 11,
            fontWeight: 'bold',
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
        menuPopupContainer: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            padding: 16,
            marginHorizontal: 32,
            maxHeight: alturaTela * 0.6,
        },
        menuPopupContainerBusca: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            padding: 16,
            marginHorizontal: 24,
            height: Math.min(420, alturaTela * 0.65),
        },
        menuPopupLista: {
            flex: 1,
        },
        menuPopupListaCurta: {
            flexGrow: 0,
        },
        menuOpcao: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 8,
            borderBottomWidth: 1,
            borderBottomColor: c.borda,
        },
        menuOpcaoTexto: {
            color: c.texto,
            fontSize: 14,
        },
        avatarFallback: {
            backgroundColor: c.campo,
            borderWidth: 2,
        },
        diaMenuContainer: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            padding: 20,
            marginHorizontal: 24,
        },
        diaMenuHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 2,
        },
        diaMenuTitulo: {
            color: c.texto,
            fontSize: 16,
            fontWeight: 'bold',
        },
        diaMenuDescricao: {
            color: c.sub,
            fontSize: 12,
            lineHeight: 18,
            marginBottom: 16,
        },
        diaMenuPillsRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 14,
        },
        diaMenuPill: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: c.campo,
            borderRadius: 12,
            paddingVertical: 10,
        },
        diaMenuPillAtiva: {
            backgroundColor: c.amarelo,
        },
        diaMenuPillTexto: {
            color: c.sub,
            fontSize: 13,
        },
        diaMenuPillTextoAtiva: {
            color: c.sobreAmarelo,
            fontWeight: 'bold',
        },
        diaMenuLegenda: {
            color: c.sub,
            fontSize: 11,
            marginBottom: 8,
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
            marginBottom: 14,
        },
        detalheHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        detalheFechar: {
            margin: 0,
        },
        detalheTitulo: {
            color: c.texto,
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 12,
        },
        detalheChipsRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 14,
        },
        detalheChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: c.campo,
            borderWidth: 1,
            borderColor: c.borda,
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 7,
        },
        detalheChipFlex: {
            flexShrink: 1,
        },
        detalheChipTexto: {
            color: c.sub,
            fontSize: 12,
        },
        detalheDescricao: {
            color: c.sub,
            fontSize: 13,
            lineHeight: 20,
            marginBottom: 14,
        },
        detalheResponsavelRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 14,
        },
        detalheResponsavelTexto: {
            color: c.sub,
            fontSize: 12,
        },
        detalheEtapasBloco: {
            borderTopWidth: 1,
            borderTopColor: c.borda,
            paddingTop: 12,
            marginBottom: 18,
        },
        detalheEtapasHeader: {
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        detalheEtapasContador: {
            color: c.sub,
            fontSize: 11,
        },
        detalheEtapasScroll: {
            maxHeight: Math.min(160, alturaTela * 0.2),
        },
        detalheEtapaLinha: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 7,
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
        detalheAcoes: {
            flexDirection: 'row',
            gap: 10,
        },
        detalheBotao: {
            flex: 1,
            borderRadius: 12,
        },
        secaoGrupo: {
            backgroundColor: c.campo,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.borda,
            marginBottom: 16,
        },
        secaoGrupoLinha: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderBottomWidth: 1,
            borderBottomColor: c.borda,
        },
        secaoGrupoLinhaUltima: {
            borderBottomWidth: 0,
        },
        secaoGrupoInfo: {
            flex: 1,
        },
        secaoLabel: {
            color: c.sub,
            fontSize: 11,
            marginBottom: 3,
        },
        secaoValor: {
            color: c.texto,
            fontSize: 13,
        },
        secaoValorLinha: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        botaoSalvarEdicao: {
            borderRadius: 12,
            marginTop: 8,
        },
        secaoPopupContainer: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            padding: 20,
            marginHorizontal: 24,
            maxHeight: alturaTela * 0.8,
        },
        secaoPopupHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 14,
        },
        secaoPopupVoltar: {
            padding: 2,
        },
        secaoPopupTitulo: {
            color: c.texto,
            fontSize: 15,
            fontWeight: 'bold',
        },
        secaoPopupConcluir: {
            borderRadius: 12,
            marginTop: 12,
        },
        etapaPopupNavHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
        },
        etapaPopupContagem: {
            color: c.sub,
            fontSize: 12,
            letterSpacing: 0.5,
        },
        wizardContainer: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            padding: 20,
            marginHorizontal: 20,
            maxHeight: alturaTela * 0.8,
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
        },
        modalTitulo: {
            color: c.texto,
            fontSize: 17,
            fontWeight: 'bold',
            flexShrink: 1,
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
        inputMultiline: {
            minHeight: 76,
        },
        inputOutline: {
            borderRadius: 12,
        },
        botaoOutline: {
            borderColor: c.borda,
        },
        segmentado: {
            flexDirection: 'row',
            backgroundColor: c.campo,
            borderRadius: 12,
            padding: 4,
            marginBottom: 14,
        },
        segmentadoItem: {
            flex: 1,
            alignItems: 'center',
            paddingVertical: 8,
            borderRadius: 9,
        },
        segmentadoItemAtivo: {
            backgroundColor: c.amarelo,
        },
        segmentadoTexto: {
            color: c.sub,
            fontSize: 11,
        },
        segmentadoTextoAtivo: {
            color: c.sobreAmarelo,
            fontWeight: 'bold',
        },
        diasRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        diaCirculo: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        diaCirculoFundo: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: c.campo,
            borderWidth: 1,
            borderColor: c.borda,
            alignItems: 'center',
            justifyContent: 'center',
        },
        diaCirculoFundoAtivo: {
            backgroundColor: c.amarelo,
            borderColor: c.amarelo,
        },
        diaCirculoLetra: {
            color: c.sub,
            fontSize: 11,
            fontWeight: 'bold',
        },
        diaCirculoLetraAtiva: {
            color: c.sobreAmarelo,
        },
        avisoDiaria: {
            color: c.sub,
            fontSize: 12,
            lineHeight: 18,
        },
        numeroEtapasBox: {
            alignItems: 'center',
            paddingVertical: 16,
        },
        numeroEtapasLabel: {
            color: c.sub,
            fontSize: 14,
            marginBottom: 14,
        },
        contadorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
        },
        contadorNumero: {
            color: c.texto,
            fontSize: 26,
            fontWeight: 'bold',
            minWidth: 40,
            textAlign: 'center',
        },
        etapaFotoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 2,
        },
        etapaFotoInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        etapaFotoTexto: {
            color: c.sub,
            fontSize: 13,
        },
        errorText: {
            color: c.perigo,
            fontSize: 13,
            marginTop: 8,
            marginBottom: 4,
        },
        wizardAcoes: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 14,
        },
        wizardBotao: {
            flex: 1,
            borderRadius: 12,
        },
        buttonContent: {
            paddingVertical: 4,
        },
    });