import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const obterDataOperacional = () => {
    const agora = new Date();
    if (agora.getHours() < 6) {
        agora.setDate(agora.getDate() - 1);
    }
    return agora;
};

const formatarDataUnica = (data) => {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
};

const tarefaOcorreHoje = (tarefa, diaHoje, dataHoje) => {
    if (tarefa.frequenciaTipo === 'diaria') return true;
    if (tarefa.frequenciaTipo === 'unica') return tarefa.dataUnica === dataHoje;
    if (tarefa.frequenciaTipo === 'dias') return (tarefa.dias || []).includes(diaHoje);
    return false;
};

export const getTarefasDoDiaPorFuncionario = async (funcionario) => {
    if (!funcionario?.cargo) return [];

    const tarefasRef = collection(db, 'Tarefas');
    const q = query(tarefasRef, where('cargo', '==', funcionario.cargo));
    const snapshot = await getDocs(q);

    const hoje = obterDataOperacional();
    const diaHoje = DIAS_SEMANA[hoje.getDay()];
    const dataHoje = formatarDataUnica(hoje);

    return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((tarefa) => tarefa.atribuidoTipo !== 'ambos' || tarefa.membro === funcionario.nome)
        .filter((tarefa) => tarefaOcorreHoje(tarefa, diaHoje, dataHoje))
        .sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));
};