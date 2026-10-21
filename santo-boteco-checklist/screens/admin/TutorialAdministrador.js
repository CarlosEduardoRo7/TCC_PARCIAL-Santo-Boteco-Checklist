import React from 'react';
import Tutorial from '../Tutorial';

const passos = [
    {
        imagem: require('../../assets/tutorial/administrador-1.png'),
        titulo: 'Acompanhe o dia',
        texto: 'O Dashboard mostra quanto do dia já foi feito, o que está pendente ou atrasado e o progresso de cada cargo. Toque no progresso por cargo para ver todos os cargos.',
    },
    {
        imagem: require('../../assets/tutorial/administrador-2.png'),
        titulo: 'Veja o ranking da equipe',
        texto: 'Mais abaixo no Dashboard fica o ranking de quem mais concluiu tarefas. Escolha Semanal ou Mensal e toque no ranking para ver a lista completa da equipe.',
    },
    {
        imagem: require('../../assets/tutorial/administrador-3.png'),
        titulo: 'Crie as tarefas',
        texto: 'Em Tarefas, toque no + para criar uma rotina. Você define o título, a frequência, o horário limite e para qual cargo ou funcionário ela vai.',
    },
    {
        imagem: require('../../assets/tutorial/administrador-4.png'),
        titulo: 'Monte as etapas',
        texto: 'Cada tarefa é dividida em etapas. Em cada uma, ligue Requer foto quando o funcionário precisar comprovar com uma foto.',
    },
    {
        imagem: require('../../assets/tutorial/administrador-5.png'),
        titulo: 'Cadastre a equipe',
        texto: 'Em Funcionários, toque no + para cadastrar alguém com nome, usuário, cargo e senha. No lápis você edita, e em Bloqueados ficam as contas sem acesso.',
    },
    {
        imagem: require('../../assets/tutorial/administrador-6.png'),
        titulo: 'Valide o que foi feito',
        texto: 'Quando um funcionário conclui uma tarefa, ela aparece em Validações. Toque em Revisar para conferir.',
    },
    {
        imagem: require('../../assets/tutorial/administrador-7.png'),
        titulo: 'Revise cada etapa',
        texto: 'Veja a foto e a observação que o funcionário enviou. Toque em Confirmar etapa para seguir, ou em Sinalizar problema para devolver a tarefa com o motivo.',
    },
];

export default function TutorialAdministrador({ navigation }) {
    return <Tutorial passos={passos} onFechar={() => navigation.goBack()} />;
}