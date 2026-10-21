import {
    collection,
    addDoc,
    setDoc,
    getDoc,
    updateDoc,
    doc,
    query,
    where,
    getDocs,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export const formatarDataHoje = () => {
    const agora = new Date();
    if (agora.getHours() < 6) {
        agora.setDate(agora.getDate() - 1);
    }
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    return `${dia}/${mes}/${ano}`;
};

const salvarFotosDaExecucao = async (execucaoId, fotosPorEtapa = {}) => {
    const entradas = Object.entries(fotosPorEtapa);
    await Promise.all(
        entradas.map(([etapaId, fotoDataUrl]) =>
            setDoc(doc(db, 'Execucoes', execucaoId, 'Fotos', etapaId), { foto: fotoDataUrl })
        )
    );
};

export const criarExecucao = async (dados, fotosPorEtapa = {}) => {
    const referenciaExecucao = await addDoc(collection(db, 'Execucoes'), {
        ...dados,
        data: formatarDataHoje(),
        status: 'aguardando',
        criadoEm: serverTimestamp(),
    });

    await salvarFotosDaExecucao(referenciaExecucao.id, fotosPorEtapa);

    return referenciaExecucao.id;
};

// Usado quando o funcionário refaz uma tarefa que já tinha uma execução
// (ex: rejeitada). Atualiza o mesmo documento em vez de criar outro,
// evitando duas execuções concorrentes pra mesma tarefa/dia.
export const refazerExecucao = async (execucaoId, dados, fotosPorEtapa = {}) => {
    await updateDoc(doc(db, 'Execucoes', execucaoId), {
        ...dados,
        status: 'aguardando',
        atualizadoEm: serverTimestamp(),
    });

    await salvarFotosDaExecucao(execucaoId, fotosPorEtapa);

    return execucaoId;
};

export const getFotoDaEtapa = async (execucaoId, etapaId) => {
    const referencia = doc(db, 'Execucoes', execucaoId, 'Fotos', etapaId);
    const snapshot = await getDoc(referencia);
    return snapshot.exists() ? snapshot.data().foto : null;
};

export const getExecucoesDoDia = async (funcionarioId) => {
    if (!funcionarioId) return [];

    const execucoesRef = collection(db, 'Execucoes');
    const q = query(
        execucoesRef,
        where('funcionarioId', '==', funcionarioId),
        where('data', '==', formatarDataHoje())
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const atualizarStatusExecucao = async (id, status, dadosExtras = {}) => {
    await updateDoc(doc(db, 'Execucoes', id), { status, ...dadosExtras });
};

export const getEstatisticasFuncionario = async (funcionarioId) => {
    if (!funcionarioId) return { concluidas: 0, atrasadas: 0 };

    const execucoesRef = collection(db, 'Execucoes');
    const q = query(execucoesRef, where('funcionarioId', '==', funcionarioId));
    const snapshot = await getDocs(q);
    const execucoes = snapshot.docs.map((d) => d.data());

    return {
        concluidas: execucoes.filter((e) => e.status === 'aprovada').length,
        atrasadas: execucoes.filter((e) => !!e.concluidaAtrasada).length,
    };
};