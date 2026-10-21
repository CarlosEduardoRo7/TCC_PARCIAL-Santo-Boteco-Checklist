import React, { useState } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTema } from '../theme/Themecontext';

const AMARELO = '#F4B740';
const MARROM = '#2B1B12';

export default function Tutorial({ passos, onFechar }) {
    const { cores } = useTema();
    const [indice, setIndice] = useState(0);

    const passo = passos[indice];
    const primeiro = indice === 0;
    const ultimo = indice === passos.length - 1;

    function avancar() {
        if (ultimo) {
            onFechar();
            return;
        }
        setIndice(indice + 1);
    }

    function voltar() {
        setIndice(indice - 1);
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: cores.fundo }]}>
            <View style={styles.topo}>
                <Text style={[styles.contador, { color: cores.textoSecundario }]}>
                    {indice + 1} de {passos.length}
                </Text>
                <Pressable onPress={onFechar} hitSlop={10}>
                    <Text style={[styles.pular, { color: cores.textoSecundario }]}>Pular</Text>
                </Pressable>
            </View>

            <View style={styles.areaImagem}>
                <Image
                    source={passo.imagem}
                    style={[styles.imagem, { borderColor: cores.borda }]}
                    resizeMode="contain"
                />
            </View>

            <View style={styles.textos}>
                <Text style={[styles.titulo, { color: cores.texto }]}>{passo.titulo}</Text>
                <Text style={[styles.texto, { color: cores.textoSecundario }]}>{passo.texto}</Text>
            </View>

            <View style={styles.pontos}>
                {passos.map((item, posicao) => (
                    <View
                        key={item.titulo}
                        style={[
                            styles.ponto,
                            { backgroundColor: cores.borda },
                            posicao === indice && styles.pontoAtual,
                        ]}
                    />
                ))}
            </View>

            <View style={styles.botoes}>
                {!primeiro && (
                    <Pressable
                        onPress={voltar}
                        style={({ pressed }) => [
                            styles.botao,
                            styles.botaoVoltar,
                            { backgroundColor: cores.card },
                            pressed && styles.pressionado,
                        ]}
                    >
                        <Text style={[styles.botaoVoltarTexto, { color: cores.textoSecundario }]}>Voltar</Text>
                    </Pressable>
                )}

                <Pressable
                    onPress={avancar}
                    style={({ pressed }) => [styles.botao, styles.botaoProximo, pressed && styles.pressionado]}
                >
                    <Text style={styles.botaoProximoTexto}>{ultimo ? 'Entendi' : 'Próximo'}</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    topo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 14,
        paddingBottom: 14,
    },
    contador: {
        fontSize: 13,
    },
    pular: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    areaImagem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    imagem: {
        height: '100%',
        maxWidth: '100%',
        aspectRatio: 360 / 560,
        borderRadius: 18,
        borderWidth: 1,
    },
    textos: {
        paddingTop: 18,
        gap: 6,
    },
    titulo: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    texto: {
        fontSize: 14,
        lineHeight: 21,
    },
    pontos: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginTop: 18,
    },
    ponto: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    pontoAtual: {
        width: 22,
        backgroundColor: AMARELO,
    },
    botoes: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
        marginBottom: 16,
    },
    botao: {
        height: 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    botaoVoltar: {
        flex: 1,
    },
    botaoVoltarTexto: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    botaoProximo: {
        flex: 2,
        backgroundColor: AMARELO,
    },
    botaoProximoTexto: {
        color: MARROM,
        fontSize: 15,
        fontWeight: 'bold',
    },
    pressionado: {
        opacity: 0.7,
    },
});