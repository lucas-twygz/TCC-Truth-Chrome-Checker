### Descrição

O **TCC - Truth Chrome Checker** é uma extensão para navegadores **Chromium** que permite aos usuários analisar a veracidade de uma notícia com um clique. A extensão pode capturar automaticamente o conteúdo da página que o usuário está visitando com um clique de botão, utilizando **web scraping** com Readability, Google CSE e parâmetros baseados em IA.

O sistema utiliza a API do **Google Gemini** para processar o conteúdo e fornecer um retorno baseado em padrões de desinformação.

### Funcionalidades

-   Captura automaticamente o conteúdo da página atual.
-   Busca automática em tempo real por fontes na internet para cálculo de veracidade.
-   Usa a API do **Google Gemini** para processar e avaliar a veracidade da notícia.
-   Retorna uma estimativa em porcentagem da probabilidade de a notícia ser verdadeira.
-   Fornece uma justificativa concisa para a avaliação.
-   **Sistema de Cache:**
    -   Salva os resultados finais das análises no **histórico local da extensão** (`chrome.storage.local`).
    -   Ao reanalisar uma URL dentro de 24 horas, pergunta ao usuário se deseja usar o resultado cacheado ou realizar uma nova análise.
    -   Análises cacheadas há mais de 24 horas são refeitas automaticamente.

### Tecnologias Utilizadas

-   **Frontend:** HTML5, CSS3, JavaScript (ESM)
-   **Scraping/Extração de Conteúdo:** @mozilla/readability
-   **Busca de Evidências Externas:** Google Custom Search API (CSE)
-   **API de Inteligência Artificial:** Google Gemini Flash
-   **Armazenamento:** Chrome Storage API (`chrome.storage.local`)

### Como Usar

1.  Clone este repositório:
    ```bash
    git clone [https://github.com/lucas-twygz/TCC-Truth-Chrome-Checker.git](https://github.com/lucas-twygz/TCC-Truth-Chrome-Checker.git)
    ```
2.  Navegue até o diretório do projeto:
    ```bash
    cd TCC-Truth-Chrome-Checker
    ```
3.  Carregue a extensão no Chrome (ou navegador baseado em Chromium):
    -   Acesse `chrome://extensions/`
    -   Ative o `Modo de desenvolvedor` (geralmente um interruptor no canto superior direito).
    -   Clique em `Carregar sem compactação` (ou "Load unpacked").
    -   Selecione a pasta `extension` de dentro do projeto (a pasta que contém o `manifest.json`).
4.  **Configure as chaves de API:**
    -   Clique no ícone da extensão e vá para a aba "Configurações".
    -   Insira suas chaves da API do Google Gemini e da API do Custom Search, e o ID do Mecanismo de Pesquisa.
5.  Para análise, com uma página de notícia aberta, clique no ícone da extensão e depois no botão "Analisar Página Atual". Se a análise já foi feita recentemente, você será perguntado se deseja usar o cache.

### Estrutura do Projeto

```
TCC-TRUTH-CHROME-CHECKER/
├── extension/                   # Tudo relacionado à extensão do Chrome
│   ├── assets/                  # Ícones e imagens do tutorial
│   ├── content/                 # Script injetado para extração de conteúdo (content.js)
│   ├── lib/                     # Bibliotecas (readability.js)
│   ├── popup/                   # Frontend (HTML, CSS, JS) do popup da extensão
│   │   ├── js/                    # Lógica JavaScript do popup
│   │   │   ├── application/       # Regras de negócio (analysisUseCase.js)
│   │   │   ├── infrastructure/    # Serviços (apiService.js, storageService.js)
│   │   │   ├── view/              # Manipulação de DOM (ui.js, domElements.js, tutorial.js)
│   │   │   ├── config.js          # Constantes de configuração
│   │   │   ├── main.js            # Ponto de entrada principal do popup
│   │   │   └── utils/             # Funções utilitárias (textUtils.js)
│   │   ├── curiosities.js         # Banco de curiosidades da home
│   │   ├── popup.html
│   │   └── style.css
│   └── manifest.json            # Configuração da extensão do Chrome
│
├── teste_noticia/               # Páginas HTML de exemplo para testes de extração
│
├── .gitignore
└── README.md
```

## Configuração da API

Antes de iniciar o projeto, é necessário configurar as chaves da API do **Google Gemini** e do **Google Custom Search API**, bem como o **ID do MecanMecanismo de Pesquisa Programável**, diretamente **na tela de configuração da extensão**. A extensão possui tutoriais visuais na tela de configuração para ajudar a obter essas chaves.
