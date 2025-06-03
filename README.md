## Descrição

O **TCC - Truth Chrome Checker** é uma extensão para navegadores **Chromium** que permite aos usuários analisar a veracidade de uma notícia com um clique. A extensão pode capturar automaticamente o conteúdo da página que o usuário está visitando com um clique de botão, utilizando **web scraping** com Readability, Google CSE e parâmetros baseados em IA.

O sistema utiliza a API do **Google Gemini** para processar o conteúdo e fornecer um retorno baseado em padrões de desinformação.

## Funcionalidades

- Captura automaticamente o conteúdo da página atual.
- Busca automática em tempo real por fontes na internet para cálculo de veracidade.
- Usa a API do **Google Gemini** para processar e avaliar a veracidade da notícia.
- Retorna uma estimativa em porcentagem da probabilidade de a notícia ser verdadeira.
- Fornece uma justificativa concisa para a avaliação.
- **Sistema de Cache:**
    - Salva os resultados finais das análises em um cache local (`server/analysis_cache.json`) para otimizar o uso da API.
    - Ao reanalisar uma URL dentro de 24 horas, pergunta ao usuário se deseja usar o resultado cacheado ou realizar uma nova análise.
    - Análises cacheadas há mais de 24 horas são refeitas automaticamente.
- Salva os *detalhes das requisições de análise e prompts enviados à IA* em arquivos `.json` individuais (na pasta `server captured_pages`) para referência posterior e debugging.

## Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Node.js com Express
- **Scraping/Extração de Conteúdo:** @mozilla/readability
- **Busca de Evidências Externas:** Google Custom Search API (CSE)
- **API de Inteligência Artificial:** Google Gemini Flash

## Como Usar

1.  Clone este repositório:
    ```bash
    git clone [https://github.com/lucas-twygz/TCC-Truth-Chrome-Checker.git](https://github.com/lucas-twygz/TCC-Truth-Chrome-Checker.git)
    ```
   
2.  Navegue até o diretório do projeto:
    ```bash
    cd TCC-Truth-Chrome-Checker 
    ```

3.  Instale as dependências:
    ```bash
    npm install
    ```
   
4.  Configure as variáveis de ambiente para as chaves de API:
    - Crie um arquivo `.env` na pasta raiz do projeto (onde está o `package.json` e a pasta `server`) e adicione:
      ```env
      # Chave da API do Google Gemini (obtida no Google AI Studio)
      API_KEY=SUA_CHAVE_GEMINI_AQUI

      # Chave da API do Google Custom Search (obtida no Google Cloud Console)
      GOOGLE_API_KEY=SUA_CHAVE_CUSTOM_SEARCH_AQUI

      # ID do Mecanismo de Pesquisa Programável (obtido no Painel do Programmable Search Engine)
      GOOGLE_CSE_ID=SEU_ID_MECANISMO_PESQUISA_AQUI
      ```
   
    (Nota: O README original mencionava `API_KEY` duas vezes com nomes diferentes. Clarificado para os usos corretos.)
5.  Inicie o servidor backend:
    ```bash
    npm start
    ```
    ou
    ```bash
    node server/server.js 
    ```
    (Nota: Ajustado o caminho para `server/server.js` conforme a estrutura.)
6.  Carregue a extensão no Chrome (ou navegador baseado em Chromium):
    - Acesse `chrome://extensions/`
    - Ative o `Modo de desenvolvedor` (geralmente um interruptor no canto superior direito).
    - Clique em `Carregar sem compactação` (ou "Load unpacked").
    - Selecione a pasta `extension` de dentro do projeto (a pasta que contém o `manifest.json`).
7.  Para análise, com uma página de notícia aberta, clique no ícone da extensão e depois no botão "Analisar Página Atual". Se a análise já foi feita recentemente, você será perguntado se deseja usar o cache.

## Estrutura do Projeto

```
TCC-TRUTH-CHROME-CHECKER/
├── extension/                   # Tudo relacionado à extensão do Chrome
│   ├── assets/                  # Imagens e ícones
│   │   └── icon.png
│   ├── content/                 # Scripts injetados para extração de conteúdo
│   │   └── content.js
│   ├── lib/                     # Bibliotecas auxiliares (ex: readability.js)
│   │   └── readability.js
│   ├── popup/                   # Frontend do popup da extensão
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── style.css
│   └── manifest.json            # Configuração da extensão do Chrome
│
├── server/                      # Backend do projeto (API, lógica de análise e cache)
│   ├── captured_pages/          # Payloads detalhados das requisições de análise para debugging
│   │   ├── initial/
│   │   ├── low_truth_chance_investigation/
│   │   └── high_truth_chance_confirmation/
│   ├── googleNewsSearch.js      # Módulo de busca de notícias no Google CSE
│   ├── server.js                # Servidor Express (Node.js) com lógica de análise e cache
│   ├── analysis_cache.json      # Cache local dos resultados das análises de notícias (criado pelo servidor)
│   └── teste_api.js             # Script de teste de conexão com GoogleGenerativeAI (se ainda relevante)
│
├── teste_noticia/               # Páginas HTML de exemplo para testes de extração
│   ├── noticia_falsa.html
│   └── noticia_verdadeira.html
│
├── node_modules/                # Dependências do Node.js (instaladas via npm install)
│
├── package.json                 # Configurações do Node.js, dependências e scripts
├── package-lock.json            # Lock das versões das dependências
├── .gitignore                   # Arquivos ignorados pelo Git
├── .env                         # Arquivo para variáveis de ambiente (API keys - NÃO DEVE SER COMMITADO)
└── README.md                    # Documentação do projeto
```


## Configuração da API

Antes de iniciar o projeto, é necessário configurar as chaves da API do **Google Gemini** e do **Google Custom Search API**, bem como o **ID do Mecanismo de Pesquisa Programável**, conforme descrito na seção "Como Usar". A extensão possui tutoriais visuais na tela de configuração para ajudar a obter essas chaves.
