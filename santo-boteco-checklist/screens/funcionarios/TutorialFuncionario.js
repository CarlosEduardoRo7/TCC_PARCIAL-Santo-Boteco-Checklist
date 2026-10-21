import React from 'react';
import Tutorial from '../Tutorial';

const passos = [
    {
        imagem: require('../../assets/tutorial/funcionario-1.png'),
        titulo: 'Consulte suas tarefas',
        texto: 'A tela inicial mostra as tarefas do dia com o horário limite. No filtro logo acima da lista você escolhe ver as Gerais, as Minhas ou as Do cargo.',
    },
    {
        imagem: require('../../assets/tutorial/funcionario-2.png'),
        titulo: 'Acompanhe o andamento',
        texto: 'Pendentes são as que faltam fazer. Em análise estão esperando o administrador validar. Concluídas já foram aprovadas.',
    },
    {
        imagem: require('../../assets/tutorial/funcionario-3.png'),
        titulo: 'Veja as etapas',
        texto: 'Toque em uma tarefa para abrir os detalhes e ver todas as etapas. Quando estiver pronto, toque em Iniciar tarefa.',
    },
    {
        imagem: require('../../assets/tutorial/funcionario-4.png'),
        titulo: 'Confirme com foto',
        texto: 'Em cada etapa, toque no quadro para tirar a foto. Quando aparecer Foto obrigatória, o botão de confirmar só libera depois da foto.',
    },
    {
        imagem: require('../../assets/tutorial/funcionario-5.png'),
        titulo: 'Anote observações',
        texto: 'Se algo fugiu do normal, escreva no campo de observações. Depois toque em Confirmar e continuar para ir para a próxima etapa.',
    },
];

export default function TutorialFuncionario({ navigation }) {
    return <Tutorial passos={passos} onFechar={() => navigation.goBack()} />;
}