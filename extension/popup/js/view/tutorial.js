import { elements } from './domElements.js';

const tutorials = {
    gemini: {
        title: "Como Obter a Chave API do Gemini",
        content: `<p>Siga estes passos para obter sua Chave API do Gemini:</p><ol><li>Acesse o <a href="https://aistudio.google.com/app/apikey?hl=pt-br" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.</li><li>Faça login com sua conta Google, se necessário.</li><li>Clique em <strong>"+ Criar chave de API"</strong>.</li></ol><div class="tutorial-step"><img src="../assets/tutorial/gemini_criar_chave.jpeg" alt="Criar chave API Gemini"></div><ol start="4"><li>Copie a chave API gerada e cole na extensão.</li></ol>`
    },
    customSearch: {
        title: "Como Obter a Chave API Custom Search",
        content: `<p>Para obter sua Chave API do Custom Search:</p><ol><li>Acesse o <a href="https://developers.google.com/custom-search/v1/overview?hl=pt-br#api_key" target="_blank" rel="noopener noreferrer">Google Developers (Custom Search API)</a>.</li><li>Clique em <strong>"Acessar uma chave"</strong>.</li></ol><div class="tutorial-step"><img src="../assets/tutorial/custom_search_acessar_chave.jpeg" alt="Acessar chave Custom Search API"></div><ol start="3"><li>Selecione o projeto, clique em <strong>"NEXT"</strong>.</li><li>Clique em <strong>"Show Key"</strong> e copie a chave.</li></ol><div class="tutorial-step"><img src="../assets/tutorial/custom_search_mostrar_chave.jpeg" alt="Mostrar chave da API"></div>`
    },
    cxId: {
        title: "Como Obter o ID do Mecanismo de Pesquisa (CX ID)",
        content: `<p>Para criar um Mecanismo de Pesquisa Programável e obter seu ID:</p><ol><li>Acesse o <a href="https://programmablesearchengine.google.com/controlpanel/all?hl=pt-br" target="_blank" rel="noopener noreferrer">Painel do Mecanismo de Pesquisa</a>.</li><li>Clique em <strong>"Adicionar"</strong>.</li><li>Em <strong>"Nome"</strong>, coloque um nome (ex: "TCC").</li><li>Selecione <strong>"Pesquisar em toda a web"</strong> e clique em <strong>"Criar"</strong>.</li></ol><div class="tutorial-step"><img src="../assets/tutorial/programmable_search_criar.jpeg" alt="Criar mecanismo de pesquisa"></div><ol start="5"><li>Na seção <strong>"Informações básicas"</strong>, copie o <strong>"ID do mecanismo de pesquisa"</strong>.</li></ol><div class="tutorial-step"><img src="../assets/tutorial/programmable_search_id.jpeg" alt="ID do Mecanismo de Pesquisa" class="img-small"></div>`
    }
};

export function openTutorialModal(tutorialKey) {
    const tutorial = tutorials[tutorialKey];
    if (!tutorial) return;

    if (elements.modals.tutorialTitle) elements.modals.tutorialTitle.textContent = tutorial.title;
    if (elements.modals.tutorialBody) elements.modals.tutorialBody.innerHTML = tutorial.content;
    if (elements.modals.tutorial) elements.modals.tutorial.classList.remove('hidden');
}

export function closeTutorialModal() {
    if (elements.modals.tutorial) elements.modals.tutorial.classList.add('hidden');
}