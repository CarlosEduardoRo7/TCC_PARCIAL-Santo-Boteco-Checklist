import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const formatarData = (data) => {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
};

const obterDiasDoPeriodo = (periodo) => {
    const hoje = new Date();
    const quantidade = periodo === 'mensal' ? hoje.getDate() : 7;
    const dias = [];
    for (let i = 0; i < quantidade; i++) {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() - i);
        dias.push(data);
    }
    return dias;
};

const tarefaOcorreNoDia = (tarefa, data) => {
    if (tarefa.frequenciaTipo === 'diaria') return true;
    if (tarefa.frequenciaTipo === 'unica') return tarefa.dataUnica === formatarData(data);
    if (tarefa.frequenciaTipo === 'dias') return (tarefa.dias || []).includes(DIAS_SEMANA[data.getDay()]);
    return false;
};

const tarefaPertenceAoFuncionario = (tarefa, funcionario) =>
    tarefa.cargo === funcionario.cargo && (tarefa.atribuidoTipo !== 'ambos' || tarefa.membro === funcionario.nome);

export const getRanking = async (periodo) => {
    const funcionariosSnap = await getDocs(query(collection(db, 'Usuarios'), where('admin', '==', false)));
    const funcionarios = funcionariosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const tarefasSnap = await getDocs(collection(db, 'Tarefas'));
    const tarefas = tarefasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const dias = obterDiasDoPeriodo(periodo);
    const datasPeriodo = new Set(dias.map(formatarData));

    const execucoesSnap = await getDocs(collection(db, 'Execucoes'));
    const todasExecucoes = execucoesSnap.docs.map((d) => d.data());

    const diasComAtividade = new Set(
        todasExecucoes.map((e) => e.data).filter((data) => datasPeriodo.has(data))
    );
    const diasParaContar = dias.filter((dia) => diasComAtividade.has(formatarData(dia)));

    const execucoesAprovadasDoPeriodo = todasExecucoes.filter(
        (e) => e.status === 'aprovada' && datasPeriodo.has(e.data)
    );

    const resultado = funcionarios
        .filter((funcionario) => funcionario.ativo !== false)
        .map((funcionario) => {
            let esperado = 0;
            diasParaContar.forEach((dia) => {
                tarefas.forEach((tarefa) => {
                    if (tarefaPertenceAoFuncionario(tarefa, funcionario) && tarefaOcorreNoDia(tarefa, dia)) {
                        esperado += 1;
                    }
                });
            });

            const concluido = execucoesAprovadasDoPeriodo.filter((e) => e.funcionarioId === funcionario.id).length;
            const percentual = esperado > 0 ? Math.round((concluido / esperado) * 100) : 0;

            return {
                id: funcionario.id,
                nome: funcionario.nome,
                icone: funcionario.icone || null,
                esperado,
                concluido,
                percentual,
            };
        });

    resultado.sort((a, b) => b.percentual - a.percentual);
    return resultado;
};