import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Icon, TextInput, ActivityIndicator, Portal, Modal, Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { criarExecucao, refazerExecucao } from '../../services/execucoes';
import { useTema } from '../../theme/Themecontext';

const horarioAtual = () => {
    const agora = new Date();
    return `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
};

const horarioParaMinutos = (horario) => {
    const [hora, minuto] = (horario || '00:00').split(':').map(Number);
    return (hora || 0) * 60 + (minuto || 0);
};

const tarefaEstaAtrasada = (tarefa) => {
    const agora = new Date();
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    return horarioParaMinutos(tarefa?.horario) < minutosAgora;
};

export default function EtapasTarefa({ route, navigation }) {
    const tarefa = route?.params?.tarefa;
    const onConcluir = route?.params?.onConcluir;
    const funcionario = route?.params?.funcionario;
    const execucaoExistente = route?.params?.execucaoExistente;
    const etapas = tarefa?.etapas || [];

    const insets = useSafeAreaInsets();
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
            apagado: escuro ? '#6A6A70' : '#B3B3B8',
            amarelo: '#F4B740',
            sobreAmarelo: '#2B1B12',
            seloFundo: escuro ? '#3A2E14' : '#2B1B12',
            gradiente: escuro ? ['#1E1E1E', '#252527'] : ['#FAFAFA', '#F0F0F3'],
            laranja: escuro ? '#B8700D' : '#C97A0E',
            perigo: escuro ? '#FF6B6B' : '#C62828',
            obrigatoriaFundo: escuro ? '#3A2E14' : 'rgba(244, 183, 64, 0.18)',
            obrigatoriaTexto: escuro ? '#F4B740' : '#8A5A00',
            escuro,
        }),
        [cores, escuro]
    );

    const styles = useMemo(() => criarEstilos(c), [c]);

    const inputProps = {
        mode: 'outlined',
        textColor: c.texto,
        placeholderTextColor: c.apagado,
        outlineColor: c.borda,
        activeOutlineColor: c.amarelo,
        outlineStyle: styles.observacaoOutline,
        theme: { colors: { onSurfaceVariant: c.sub } },
    };

    const [etapaIndice, setEtapaIndice] = useState(0);
    const [fotos, setFotos] = useState({});
    const [observacoes, setObservacoes] = useState({});
    const [etapasPuladas, setEtapasPuladas] = useState({});
    const [justificativasPulo, setJustificativasPulo] = useState({});
    const [justificativaPularAtual, setJustificativaPularAtual] = useState('');
    const [permissaoNegada, setPermissaoNegada] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [erroSalvar, setErroSalvar] = useState('');
    const [confirmarPularVisivel, setConfirmarPularVisivel] = useState(false);

    const etapaAtual = etapas[etapaIndice];
    const fotoAtual = etapaAtual ? fotos[etapaAtual.id] : null;
    const observacaoAtual = etapaAtual ? (observacoes[etapaAtual.id] || '') : '';
    const etapaFoiPulada = etapaAtual ? !!etapasPuladas[etapaAtual.id] : false;
    const etapaExigeFoto = !!etapaAtual?.requerFoto;
    const etapaTemFotoAnexada = !!fotoAtual?.base64;
    const podeConfirmar = !etapaAtual || etapaFoiPulada || !etapaExigeFoto || etapaTemFotoAnexada;
    const outrasEtapasNaoPuladas = etapaAtual
        ? etapas.filter((etapa) => etapa.id !== etapaAtual.id && !etapasPuladas[etapa.id]).length
        : 0;
    const podePular = !!etapaAtual && !etapaFoiPulada && outrasEtapasNaoPuladas > 0;
    const ultimaEtapa = etapaIndice === etapas.length - 1;
    const progresso = etapas.length > 0 ? (etapaIndice + 1) / etapas.length : 0;

    const tirarFoto = async () => {
        const permissao = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissao.granted) {
            setPermissaoNegada(true);
            return;
        }
        setPermissaoNegada(false);

        const resultado = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
            base64: true,
        });

        if (!resultado.canceled) {
            setFotos((prev) => ({
                ...prev,
                [etapaAtual.id]: { uri: resultado.assets[0].uri, base64: resultado.assets[0].base64 },
            }));
            setEtapasPuladas((prev) => {
                if (!prev[etapaAtual.id]) return prev;
                const proximo = { ...prev };
                delete proximo[etapaAtual.id];
                return proximo;
            });
        }
    };

    const finalizarTarefa = async (etapasPuladasOverride, justificativasOverride) => {
        const etapasPuladasAtuais = etapasPuladasOverride || etapasPuladas;
        const justificativasAtuais = justificativasOverride || justificativasPulo;
        if (etapas.length > 0 && etapas.every((etapa) => etapasPuladasAtuais[etapa.id])) {
            setErroSalvar('Não é possível pular todas as etapas. Conclua pelo menos uma.');
            return;
        }

        const etapaSemFotoObrigatoria = etapas.find(
            (etapa) => etapa.requerFoto && !etapasPuladasAtuais[etapa.id] && !fotos[etapa.id]?.base64
        );
        if (etapaSemFotoObrigatoria) {
            setErroSalvar(`A etapa "${etapaSemFotoObrigatoria.titulo}" exige uma foto pra ser concluída (ou marque como pulada).`);
            return;
        }

        setErroSalvar('');
        setSalvando(true);
        try {
            const fotosPorEtapa = {};
            etapas.forEach((etapa) => {
                const foto = fotos[etapa.id];
                if (foto?.base64) {
                    fotosPorEtapa[etapa.id] = `data:image/jpeg;base64,${foto.base64}`;
                }
            });

            const dados = {
                tarefaId: tarefa?.id || null,
                tarefaTitulo: tarefa?.titulo || '',
                funcionarioId: funcionario?.id || null,
                funcionarioNome: funcionario?.nome || '',
                funcionarioIcone: funcionario?.icone || null,
                cargo: funcionario?.cargo || '',
                horarioConclusao: horarioAtual(),
                concluidaAtrasada: tarefaEstaAtrasada(tarefa),
                etapas: etapas.map((etapa) => ({
                    id: etapa.id,
                    titulo: etapa.titulo,
                    requerFoto: !!etapa.requerFoto,
                    temFoto: !!fotos[etapa.id],
                    pulada: !!etapasPuladasAtuais[etapa.id],
                    justificativaPulo: etapasPuladasAtuais[etapa.id]
                        ? (justificativasAtuais[etapa.id] || '').trim()
                        : '',
                    observacao: observacoes[etapa.id] || '',
                })),
            };

            if (execucaoExistente?.id) {
                await refazerExecucao(
                    execucaoExistente.id,
                    { ...dados, motivoRejeicao: null },
                    fotosPorEtapa
                );
            } else {
                await criarExecucao(dados, fotosPorEtapa);
            }

            onConcluir?.();
            navigation.goBack();
        } catch (error) {
            console.log('Erro ao criar execução:', error);
            setErroSalvar(`Não foi possível enviar pra validação: ${error.message || error.code || 'erro desconhecido'}`);
        }
        setSalvando(false);
    };

    const avancarOuFinalizar = (etapasPuladasOverride, justificativasOverride) => {
        if (!ultimaEtapa) {
            setEtapaIndice((indice) => indice + 1);
        } else {
            finalizarTarefa(etapasPuladasOverride, justificativasOverride);
        }
    };

    const confirmarEtapa = () => {
        if (!podeConfirmar || salvando) return;
        avancarOuFinalizar();
    };

    const abrirConfirmarPular = () => {
        setJustificativaPularAtual(justificativasPulo[etapaAtual?.id] || '');
        setConfirmarPularVisivel(true);
    };

    const confirmarPularEtapa = () => {
        if (!podePular) {
            setConfirmarPularVisivel(false);
            return;
        }
        const etapasPuladasAtualizadas = { ...etapasPuladas, [etapaAtual.id]: true };
        const justificativasAtualizadas = {
            ...justificativasPulo,
            [etapaAtual.id]: justificativaPularAtual.trim(),
        };

        setEtapasPuladas(etapasPuladasAtualizadas);
        setJustificativasPulo(justificativasAtualizadas);
        setJustificativaPularAtual('');
        setConfirmarPularVisivel(false);
        avancarOuFinalizar(etapasPuladasAtualizadas, justificativasAtualizadas);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
                    <Icon source="arrow-left" size={22} color={c.texto} />
                </TouchableOpacity>
                <Text style={styles.headerTitulo} numberOfLines={1}>{tarefa?.titulo || 'Tarefa'}</Text>
                {etapas.length > 0 && (
                    <Text style={styles.headerContador}>{etapaIndice + 1}/{etapas.length}</Text>
                )}
            </View>

            {etapas.length > 0 && (
                <View style={styles.progressoTrilha}>
                    <View style={[styles.progressoPreenchido, { width: `${progresso * 100}%` }]} />
                </View>
            )}

            {!etapaAtual ? (
                <View style={styles.vazioBox}>
                    <Icon source="clipboard-text-off-outline" size={28} color={c.sub} />
                    <Text style={styles.vazioTexto}>Essa tarefa não tem etapas cadastradas.</Text>
                </View>
            ) : (
                <KeyboardAvoidingView
                    style={styles.corpo}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    <View style={styles.infoTopo}>
                        <View style={styles.tituloRow}>
                            <View style={styles.numeroSelo}>
                                <Text style={styles.numeroSeloTexto}>{etapaIndice + 1}</Text>
                            </View>
                            <Text style={styles.etapaTitulo}>{etapaAtual.titulo}</Text>
                        </View>
                        {!!etapaAtual.descricao && (
                            <Text style={styles.etapaDescricao}>{etapaAtual.descricao}</Text>
                        )}
                        <View style={[styles.fotoTag, etapaExigeFoto ? styles.fotoTagObrigatoria : styles.fotoTagOpcional]}>
                            <Icon
                                source={etapaExigeFoto ? 'camera' : 'camera-outline'}
                                size={13}
                                color={etapaExigeFoto ? c.obrigatoriaTexto : c.sub}
                            />
                            <Text
                                style={[
                                    styles.fotoTagTexto,
                                    { color: etapaExigeFoto ? c.obrigatoriaTexto : c.sub },
                                ]}
                            >
                                {etapaExigeFoto ? 'Foto obrigatória' : 'Foto opcional'}
                            </Text>
                        </View>
                    </View>

                    {etapaFoiPulada ? (
                        <View style={styles.puladaBox}>
                            <Icon source="debug-step-over" size={26} color={c.sub} />
                            <Text style={styles.puladaTexto}>Essa etapa foi marcada como pulada</Text>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.fotoArea} onPress={tirarFoto} activeOpacity={0.85}>
                            {fotoAtual ? (
                                <>
                                    <Image source={{ uri: fotoAtual.uri }} style={styles.fotoImagem} resizeMode="contain" />
                                    <View style={styles.fotoSelo}>
                                        <Icon source="check" size={14} color="#FFFFFF" />
                                        <Text style={styles.fotoSeloTexto}>Foto anexada</Text>
                                    </View>
                                    <View style={styles.fotoRefazer}>
                                        <Icon source="camera-flip-outline" size={18} color="#FFFFFF" />
                                    </View>
                                </>
                            ) : (
                                <LinearGradient colors={c.gradiente} style={styles.fotoVazia}>
                                    <View style={styles.fotoIconeCirculo}>
                                        <Icon source="camera-outline" size={26} color={c.amarelo} />
                                    </View>
                                    <Text style={styles.fotoVaziaTexto}>Toque para tirar a foto</Text>
                                    <Text style={styles.fotoVaziaSubtexto}>
                                        {etapaExigeFoto ? 'Essa etapa exige comprovação' : 'Se quiser, anexe uma foto'}
                                    </Text>
                                </LinearGradient>
                            )}
                        </TouchableOpacity>
                    )}

                    <View style={styles.observacaoBloco}>
                        <Text style={styles.observacaoLabel}>OBSERVAÇÕES (OPCIONAL)</Text>
                        <TextInput
                            {...inputProps}
                            value={observacaoAtual}
                            onChangeText={(texto) =>
                                setObservacoes((prev) => ({ ...prev, [etapaAtual.id]: texto }))
                            }
                            placeholder="Escreva uma possível observação..."
                            multiline
                            numberOfLines={3}
                            style={styles.observacaoInput}
                        />
                        {permissaoNegada && (
                            <Text style={styles.avisoPermissao}>Permissão de acesso à câmera negada.</Text>
                        )}
                    </View>

                    <View style={styles.rodape}>
                        {!!erroSalvar && <Text style={styles.avisoPermissao}>{erroSalvar}</Text>}

                        <View style={styles.botoesRow}>
                            {podePular && (
                                <TouchableOpacity
                                    style={styles.botaoPular}
                                    onPress={abrirConfirmarPular}
                                    disabled={salvando}
                                >
                                    <Icon source="skip-forward-outline" size={16} color={c.sub} />
                                    <Text style={styles.botaoPularTexto}>Pular</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[styles.botaoConfirmar, (!podeConfirmar || salvando) && styles.botaoConfirmarDesabilitado]}
                                onPress={confirmarEtapa}
                                disabled={!podeConfirmar || salvando}
                            >
                                {salvando ? (
                                    <ActivityIndicator size={16} color={c.sobreAmarelo} />
                                ) : (
                                    <>
                                        <Text
                                            style={[styles.botaoConfirmarTexto, !podeConfirmar && styles.botaoConfirmarTextoDesabilitado]}
                                            numberOfLines={1}
                                        >
                                            {ultimaEtapa ? 'Confirmar e concluir' : 'Confirmar e continuar'}
                                        </Text>
                                        <Icon
                                            source={ultimaEtapa ? 'check' : 'arrow-right'}
                                            size={16}
                                            color={podeConfirmar ? c.sobreAmarelo : c.apagado}
                                        />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            )}

            <Portal>
                <Modal
                    visible={confirmarPularVisivel}
                    onDismiss={() => setConfirmarPularVisivel(false)}
                    contentContainerStyle={styles.confirmarPularContainer}
                    theme={{ colors: { backdrop: 'rgba(0, 0, 0, 0.85)' } }}
                >
                    <Text style={styles.confirmarPularTitulo}>Pular esta etapa?</Text>
                    <Text style={styles.confirmarPularMensagem}>
                        Essa ação será visível para o administrador.
                    </Text>

                    <TextInput
                        {...inputProps}
                        value={justificativaPularAtual}
                        onChangeText={setJustificativaPularAtual}
                        placeholder="Justificativa (opcional)"
                        multiline
                        numberOfLines={3}
                        style={styles.justificativaPularInput}
                    />

                    <View style={styles.confirmarPularAcoes}>
                        <Button
                            mode="outlined"
                            textColor={c.sub}
                            style={[styles.confirmarPularBotao, styles.botaoOutline]}
                            contentStyle={styles.buttonContent}
                            onPress={() => setConfirmarPularVisivel(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            mode="contained"
                            buttonColor={c.laranja}
                            textColor="#FFFFFF"
                            style={styles.confirmarPularBotao}
                            contentStyle={styles.buttonContent}
                            onPress={confirmarPularEtapa}
                        >
                            Pular etapa
                        </Button>
                    </View>
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
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 12,
        },
        headerTitulo: {
            flex: 1,
            color: c.texto,
            fontSize: 15,
            fontWeight: 'bold',
        },
        headerContador: {
            color: c.sub,
            fontSize: 12,
            fontWeight: 'bold',
        },
        progressoTrilha: {
            height: 5,
            backgroundColor: c.borda,
            borderRadius: 3,
            marginHorizontal: 16,
            marginBottom: 20,
            overflow: 'hidden',
        },
        progressoPreenchido: {
            height: '100%',
            backgroundColor: c.amarelo,
            borderRadius: 3,
        },
        vazioBox: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: 24,
        },
        vazioTexto: {
            color: c.sub,
            fontSize: 14,
            textAlign: 'center',
        },
        corpo: {
            flex: 1,
            paddingHorizontal: 20,
        },
        infoTopo: {
            gap: 8,
            marginBottom: 18,
        },
        tituloRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        numeroSelo: {
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: c.seloFundo,
            alignItems: 'center',
            justifyContent: 'center',
        },
        numeroSeloTexto: {
            color: c.amarelo,
            fontSize: 12,
            fontWeight: 'bold',
        },
        etapaTitulo: {
            flex: 1,
            color: c.texto,
            fontSize: 19,
            fontWeight: 'bold',
        },
        fotoTag: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: 5,
            marginLeft: 34,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 20,
        },
        fotoTagObrigatoria: {
            backgroundColor: c.obrigatoriaFundo,
        },
        fotoTagOpcional: {
            backgroundColor: c.campo,
        },
        fotoTagTexto: {
            fontSize: 11,
            fontWeight: 'bold',
        },
        etapaDescricao: {
            color: c.sub,
            fontSize: 13,
            lineHeight: 19,
            paddingLeft: 34,
        },
        fotoArea: {
            flex: 1,
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 18,
            borderWidth: c.escuro ? 1 : 0,
            borderColor: c.borda,
        },
        puladaBox: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: c.campo,
            borderRadius: 16,
            marginBottom: 18,
        },
        puladaTexto: {
            color: c.sub,
            fontSize: 13,
            fontWeight: '600',
        },
        fotoVazia: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
        },
        fotoIconeCirculo: {
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: c.escuro ? c.campo : '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: c.escuro ? 0 : 0.1,
            shadowRadius: 8,
            elevation: c.escuro ? 0 : 3,
        },
        fotoVaziaTexto: {
            color: c.sub,
            fontSize: 13,
            fontWeight: '600',
        },
        fotoVaziaSubtexto: {
            color: c.apagado,
            fontSize: 11,
        },
        fotoImagem: {
            width: '100%',
            height: '100%',
            backgroundColor: c.escuro ? '#000000' : 'transparent',
        },
        fotoSelo: {
            position: 'absolute',
            top: 10,
            left: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(63, 107, 58, 0.9)',
            borderRadius: 20,
            paddingHorizontal: 10,
            paddingVertical: 4,
        },
        fotoSeloTexto: {
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 'bold',
        },
        fotoRefazer: {
            position: 'absolute',
            bottom: 10,
            right: 10,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        observacaoBloco: {
            marginBottom: 18,
        },
        observacaoLabel: {
            color: c.sub,
            fontSize: 11,
            letterSpacing: 1,
            marginBottom: 6,
        },
        observacaoInput: {
            backgroundColor: c.campo,
            minHeight: 90,
        },
        observacaoOutline: {
            borderRadius: 12,
        },
        avisoPermissao: {
            color: c.perigo,
            fontSize: 12,
            marginTop: 6,
        },
        rodape: {
            gap: 8,
            paddingBottom: 20,
        },
        botoesRow: {
            flexDirection: 'row',
            gap: 8,
        },
        botaoPular: {
            flex: 1,
            height: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.borda,
            backgroundColor: c.fundo,
        },
        botaoPularTexto: {
            color: c.sub,
            fontSize: 14,
            fontWeight: 'bold',
        },
        botaoConfirmar: {
            flex: 2,
            height: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: 12,
            backgroundColor: c.amarelo,
            borderRadius: 14,
            shadowColor: c.amarelo,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: c.escuro ? 0 : 0.35,
            shadowRadius: 8,
            elevation: c.escuro ? 0 : 4,
        },
        botaoConfirmarDesabilitado: {
            backgroundColor: c.escuro ? c.campo : '#EAEAEA',
            shadowOpacity: 0,
            elevation: 0,
        },
        botaoConfirmarTexto: {
            color: c.sobreAmarelo,
            fontSize: 14,
            fontWeight: 'bold',
            flexShrink: 1,
        },
        botaoConfirmarTextoDesabilitado: {
            color: c.apagado,
        },
        confirmarPularContainer: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            padding: 24,
            marginHorizontal: 32,
        },
        confirmarPularTitulo: {
            color: c.texto,
            fontSize: 17,
            fontWeight: 'bold',
            marginBottom: 8,
        },
        confirmarPularMensagem: {
            color: c.sub,
            fontSize: 13,
            lineHeight: 20,
            marginBottom: 20,
        },
        justificativaPularInput: {
            backgroundColor: c.campo,
            minHeight: 70,
            marginBottom: 16,
        },
        confirmarPularAcoes: {
            flexDirection: 'row',
            gap: 10,
        },
        confirmarPularBotao: {
            flex: 1,
            borderRadius: 12,
        },
        botaoOutline: {
            borderColor: c.borda,
        },
        buttonContent: {
            paddingVertical: 6,
        },
    });