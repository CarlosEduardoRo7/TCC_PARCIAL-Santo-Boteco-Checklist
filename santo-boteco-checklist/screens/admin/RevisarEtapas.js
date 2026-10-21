import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Text, Icon, Button, TextInput, Portal, Modal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFotoDaEtapa, atualizarStatusExecucao } from '../../services/execucoes';
import { useTema } from '../../theme/Themecontext';

export default function RevisarEtapas({ route, navigation }) {
    const validacao = route?.params?.validacao;
    const somenteLeitura = route?.params?.somenteLeitura || false;
    const etapas = validacao?.etapas || [];

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
            textoMedio: escuro ? '#D0D0D0' : '#4A4A4A',
            sub: escuro ? '#A0A0A0' : '#8A8A8A',
            apagado: escuro ? '#6A6A70' : '#B3B3B8',
            amarelo: '#F4B740',
            seloFundo: escuro ? '#3A2E14' : '#2B1B12',
            azul: escuro ? '#3567A0' : '#3B6EA8',
            azulBarra: escuro ? '#7FAEE3' : '#3B6EA8',
            verde: escuro ? '#7BC47F' : '#3F6B3A',
            vermelho: escuro ? '#FF6B6B' : '#C62828',
            vermelhoBotao: '#C62828',
            laranja: escuro ? '#E0A23A' : '#C97A0E',
            laranjaFundo: escuro ? 'rgba(224, 162, 58, 0.14)' : 'rgba(201, 122, 14, 0.10)',
            laranjaTexto: escuro ? '#E8C27A' : '#8A5A10',
            escuro,
        }),
        [cores, escuro]
    );

    const styles = useMemo(() => criarEstilos(c), [c]);

    const [etapaIndice, setEtapaIndice] = useState(0);
    const [fotosCache, setFotosCache] = useState({});
    const [carregandoFoto, setCarregandoFoto] = useState(false);
    const [processando, setProcessando] = useState(false);
    const [erro, setErro] = useState('');
    const [motivoVisivel, setMotivoVisivel] = useState(false);
    const [motivo, setMotivo] = useState('');

    const etapaAtual = etapas[etapaIndice];
    const ultimaEtapa = etapaIndice === etapas.length - 1;
    const progresso = etapas.length > 0 ? (etapaIndice + 1) / etapas.length : 0;
    const fotoAtual = etapaAtual ? fotosCache[etapaAtual.id] : null;

    useEffect(() => {
        const carregarFoto = async () => {
            if (!etapaAtual?.temFoto || fotosCache[etapaAtual.id]) return;
            setCarregandoFoto(true);
            try {
                const foto = await getFotoDaEtapa(validacao.id, etapaAtual.id);
                setFotosCache((prev) => ({ ...prev, [etapaAtual.id]: foto }));
            } catch (error) {
            }
            setCarregandoFoto(false);
        };
        carregarFoto();
    }, [etapaIndice]);

    const irParaAnterior = () => {
        setErro('');
        setEtapaIndice((indice) => Math.max(0, indice - 1));
    };

    const irParaProximaLeitura = () => {
        setEtapaIndice((indice) => Math.min(etapas.length - 1, indice + 1));
    };

    const definirStatus = async (status, dadosExtras = {}) => {
        setErro('');
        setProcessando(true);
        try {
            await atualizarStatusExecucao(validacao.id, status, dadosExtras);
            navigation.goBack();
        } catch (error) {
            setErro('Não foi possível registrar. Tente novamente.');
        }
        setProcessando(false);
    };

    const confirmarEtapa = () => {
        if (!ultimaEtapa) {
            setErro('');
            setEtapaIndice((indice) => indice + 1);
        } else {
            definirStatus('aprovada');
        }
    };

    const abrirMotivoProblema = () => {
        setMotivo('');
        setMotivoVisivel(true);
    };

    const confirmarSinalizarProblema = () => {
        setMotivoVisivel(false);
        definirStatus('rejeitada', { motivoRejeicao: motivo.trim() });
    };

    const cabecalho = (comContador) => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
                <Icon source="arrow-left" size={22} color={c.texto} />
            </TouchableOpacity>
            <Text style={styles.headerTitulo} numberOfLines={1}>{validacao?.tarefaTitulo || 'Tarefa'}</Text>
            {comContador ? (
                <Text style={styles.headerContador}>{etapaIndice + 1}/{etapas.length}</Text>
            ) : (
                <View style={styles.headerEspaco} />
            )}
        </View>
    );

    if (!etapaAtual) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {cabecalho(false)}
                <View style={styles.vazioBox}>
                    <Icon source="clipboard-text-off-outline" size={28} color={c.sub} />
                    <Text style={styles.vazioTexto}>Essa tarefa não tem etapas registradas.</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {cabecalho(true)}

            {somenteLeitura && (
                <View style={styles.aviso}>
                    <Icon source="check-circle-outline" size={13} color={c.verde} />
                    <Text style={[styles.avisoTexto, { color: c.verde }]}>Tarefa aprovada</Text>
                </View>
            )}

            {!!validacao?.concluidaAtrasada && (
                <View style={styles.aviso}>
                    <Icon source="clock-alert-outline" size={13} color={c.vermelho} />
                    <Text style={[styles.avisoTexto, { color: c.vermelho }]}>Concluída em atraso</Text>
                </View>
            )}

            <View style={styles.progressoTrilha}>
                <View style={[styles.progressoPreenchido, { width: `${progresso * 100}%` }]} />
            </View>

            <View style={styles.corpo}>
                <View style={styles.infoTopo}>
                    <View style={styles.tituloRow}>
                        <View style={styles.numeroSelo}>
                            <Text style={styles.numeroSeloTexto}>{etapaIndice + 1}</Text>
                        </View>
                        <Text style={styles.etapaTitulo}>{etapaAtual.titulo}</Text>
                    </View>
                </View>

                <View style={styles.fotoArea}>
                    {etapaAtual.pulada ? (
                        <View style={styles.fotoEstado}>
                            <Icon source="debug-step-over" size={26} color={c.laranja} />
                            <Text style={styles.puladaEstadoTexto}>Etapa pulada pelo funcionário</Text>
                        </View>
                    ) : carregandoFoto ? (
                        <View style={styles.fotoEstado}>
                            <ActivityIndicator color={c.sub} />
                        </View>
                    ) : fotoAtual ? (
                        <>
                            <Image source={{ uri: fotoAtual }} style={styles.fotoImagem} resizeMode="contain" />
                            <View style={styles.fotoSelo}>
                                <Text style={styles.fotoSeloTexto}>Foto enviada pelo funcionário</Text>
                            </View>
                        </>
                    ) : (
                        <View style={styles.fotoEstado}>
                            <Icon source="image-off-outline" size={26} color={c.sub} />
                            <Text style={styles.fotoVaziaTexto}>Sem foto anexada</Text>
                        </View>
                    )}
                </View>

                {etapaAtual.pulada && (
                    <View style={styles.bloco}>
                        <Text style={styles.blocoLabel}>JUSTIFICATIVA DO PULO</Text>
                        <View style={styles.justificativaCard}>
                            <Icon source="comment-alert-outline" size={15} color={c.laranja} />
                            <Text style={styles.justificativaTexto}>
                                {etapaAtual.justificativaPulo?.trim()
                                    ? etapaAtual.justificativaPulo
                                    : 'Nenhuma justificativa informada pelo funcionário.'}
                            </Text>
                        </View>
                    </View>
                )}

                {!!etapaAtual.observacao && (
                    <View style={styles.bloco}>
                        <Text style={styles.blocoLabel}>OBSERVAÇÃO DO FUNCIONÁRIO</Text>
                        <View style={styles.observacaoCard}>
                            <Icon source="message-text-outline" size={15} color={c.sub} />
                            <Text style={styles.observacaoTexto}>{etapaAtual.observacao}</Text>
                        </View>
                    </View>
                )}

                <View style={styles.rodape}>
                    {!!erro && <Text style={styles.avisoErro}>{erro}</Text>}

                    {somenteLeitura ? (
                        <View style={styles.acoesRow}>
                            {etapaIndice > 0 ? (
                                <Button
                                    mode="outlined"
                                    textColor={c.sub}
                                    style={[styles.botaoAcao, styles.botaoOutline]}
                                    contentStyle={styles.buttonContent}
                                    onPress={irParaAnterior}
                                >
                                    Anterior
                                </Button>
                            ) : (
                                <View style={styles.botaoAcao} />
                            )}
                            {!ultimaEtapa && (
                                <Button
                                    mode="contained"
                                    buttonColor={c.campo}
                                    textColor={c.textoMedio}
                                    style={styles.botaoAcao}
                                    contentStyle={styles.buttonContent}
                                    onPress={irParaProximaLeitura}
                                >
                                    Próxima etapa
                                </Button>
                            )}
                        </View>
                    ) : (
                        <>
                            <View style={styles.acoesRow}>
                                <Button
                                    mode="outlined"
                                    textColor={c.vermelho}
                                    style={[styles.botaoAcao, { borderColor: c.vermelho }]}
                                    contentStyle={styles.buttonContent}
                                    loading={processando}
                                    disabled={processando}
                                    onPress={abrirMotivoProblema}
                                >
                                    Sinalizar problema
                                </Button>
                                <Button
                                    mode="contained"
                                    buttonColor={c.azul}
                                    textColor="#FFFFFF"
                                    style={styles.botaoAcao}
                                    contentStyle={styles.buttonContent}
                                    loading={processando}
                                    disabled={processando}
                                    onPress={confirmarEtapa}
                                >
                                    {ultimaEtapa ? 'Aprovar tarefa' : 'Confirmar etapa'}
                                </Button>
                            </View>

                            {etapaIndice > 0 && (
                                <TouchableOpacity onPress={irParaAnterior} disabled={processando} style={styles.linkAnterior}>
                                    <Icon source="chevron-left" size={16} color={c.sub} />
                                    <Text style={styles.linkAnteriorTexto}>Etapa anterior</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </View>

            <Portal>
                <Modal
                    visible={motivoVisivel}
                    onDismiss={() => setMotivoVisivel(false)}
                    contentContainerStyle={styles.motivoContainer}
                    theme={{ colors: { backdrop: 'rgba(0, 0, 0, 0.6)' } }}
                >
                    <Text style={styles.motivoTitulo}>Qual foi o problema?</Text>
                    <Text style={styles.motivoSubtitulo}>
                        Esse comentário vai aparecer pro funcionário na tarefa rejeitada.
                    </Text>

                    <TextInput
                        mode="outlined"
                        value={motivo}
                        onChangeText={setMotivo}
                        placeholder="Descreva o que precisa ser refeito..."
                        placeholderTextColor={c.apagado}
                        textColor={c.texto}
                        multiline
                        numberOfLines={3}
                        outlineColor={c.borda}
                        activeOutlineColor={c.vermelho}
                        outlineStyle={styles.motivoInputOutline}
                        theme={{ colors: { onSurfaceVariant: c.sub } }}
                        style={styles.motivoInput}
                    />

                    <View style={styles.motivoAcoes}>
                        <Button
                            mode="outlined"
                            textColor={c.sub}
                            style={[styles.motivoBotao, styles.botaoOutline]}
                            contentStyle={styles.buttonContent}
                            onPress={() => setMotivoVisivel(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            mode="contained"
                            buttonColor={c.vermelhoBotao}
                            textColor="#FFFFFF"
                            style={styles.motivoBotao}
                            contentStyle={styles.buttonContent}
                            onPress={confirmarSinalizarProblema}
                        >
                            Rejeitar tarefa
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
        headerEspaco: {
            width: 22,
        },
        aviso: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            marginHorizontal: 16,
            marginBottom: 10,
        },
        avisoTexto: {
            fontSize: 12,
            fontWeight: 'bold',
        },
        progressoTrilha: {
            height: 5,
            backgroundColor: c.borda,
            borderRadius: 3,
            marginHorizontal: 16,
            marginBottom: 16,
            overflow: 'hidden',
        },
        progressoPreenchido: {
            height: '100%',
            backgroundColor: c.azulBarra,
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
            marginBottom: 14,
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
        fotoArea: {
            width: '100%',
            aspectRatio: 4 / 3,
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 18,
            borderWidth: c.escuro ? 1 : 0,
            borderColor: c.borda,
        },
        fotoEstado: {
            flex: 1,
            backgroundColor: c.campo,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
        },
        fotoVaziaTexto: {
            color: c.sub,
            fontSize: 13,
            fontWeight: '500',
        },
        puladaEstadoTexto: {
            color: c.laranja,
            fontSize: 13,
            fontWeight: '600',
        },
        fotoImagem: {
            width: '100%',
            height: '100%',
            backgroundColor: c.escuro ? '#000000' : '#F5F5F5',
        },
        fotoSelo: {
            position: 'absolute',
            top: 10,
            left: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            borderRadius: 20,
            paddingHorizontal: 10,
            paddingVertical: 4,
        },
        fotoSeloTexto: {
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '600',
        },
        bloco: {
            marginBottom: 16,
        },
        blocoLabel: {
            color: c.sub,
            fontSize: 11,
            letterSpacing: 1,
            marginBottom: 6,
        },
        justificativaCard: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            backgroundColor: c.laranjaFundo,
            borderRadius: 12,
            padding: 12,
        },
        justificativaTexto: {
            flex: 1,
            color: c.laranjaTexto,
            fontSize: 13,
            lineHeight: 18,
        },
        observacaoCard: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            backgroundColor: c.campo,
            borderRadius: 12,
            padding: 12,
        },
        observacaoTexto: {
            flex: 1,
            color: c.textoMedio,
            fontSize: 13,
            lineHeight: 18,
        },
        rodape: {
            marginTop: 'auto',
            paddingBottom: 20,
            gap: 8,
        },
        avisoErro: {
            color: c.vermelho,
            fontSize: 12,
            textAlign: 'center',
        },
        acoesRow: {
            flexDirection: 'row',
            gap: 10,
        },
        botaoAcao: {
            flex: 1,
            borderRadius: 12,
        },
        botaoOutline: {
            borderColor: c.borda,
        },
        buttonContent: {
            paddingVertical: 6,
        },
        linkAnterior: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            paddingVertical: 4,
        },
        linkAnteriorTexto: {
            color: c.sub,
            fontSize: 12,
        },
        motivoContainer: {
            backgroundColor: c.superficie,
            borderRadius: 20,
            padding: 20,
            marginHorizontal: 24,
        },
        motivoTitulo: {
            color: c.texto,
            fontSize: 17,
            fontWeight: 'bold',
            marginBottom: 6,
        },
        motivoSubtitulo: {
            color: c.sub,
            fontSize: 13,
            lineHeight: 18,
            marginBottom: 16,
        },
        motivoInput: {
            backgroundColor: c.campo,
            marginBottom: 16,
            minHeight: 80,
        },
        motivoInputOutline: {
            borderRadius: 12,
        },
        motivoAcoes: {
            flexDirection: 'row',
            gap: 10,
        },
        motivoBotao: {
            flex: 1,
            borderRadius: 12,
        },
    });