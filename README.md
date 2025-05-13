9# TCC - Truth Chrome Checker

## Descrição

O **TCC - Truth Chrome Checker** é uma extensão de navegador que permite aos usuários analisar a veracidade de uma notícia com um clique. A extensão pode capturar automaticamente o conteúdo da página que o usuário está visitando com um clique de botão, utilizando **web scraping** com Puppeteer.

O sistema utiliza a API do **Google Gemini** para processar o conteúdo e fornecer um retorno baseado em padrões de desinformação.

## Funcionalidades

- Permite que o usuário insira uma notícia para análise.
- **Nova função:** Captura automaticamente o conteúdo da página atual.
- Usa a API do **Google Gemini** para processar e avaliar a veracidade da notícia.
- Retorna uma estimativa em porcentagem da probabilidade de a notícia ser falsa.
- Fornece uma justificativa concisa para a avaliação.
- **Nova função:** Salva o conteúdo das páginas analisadas em arquivos `.txt` para referência posterior.

## Tecnologias Utilizadas

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js com Express
- **Scraping:** Puppeteer
- **API de Inteligência Artificial:** Google Gemini

## Como Usar

1. Clone este repositório:
   ```bash
   git clone https://github.com/lucas-twygz/TCC-Truth-Chrome-Checker.git
   ```
2. Navegue até o diretório do projeto:
   ```bash
   cd truth-chrome-checker
   ```
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Configure a variável de ambiente para a API Key:
   - Crie um arquivo `.env` na pasta raiz do projeto e adicione:
     ```env
     API_KEY=SUA_CHAVE_AQUI
     ```
5. Inicie o servidor backend:
   ```bash
   npm start
   ou
   node extension/server/server.js
   ```
6. Carregue a extensão no Chrome:
   - Acesse `chrome://extensions/`
   - Ative o `Modo de desenvolvedor`
   - Clique em `Carregar sem compactação`
   - Selecione a pasta do projeto
7. Para análise automática, clique no botão de captura para que a extensão extraia o conteúdo da página e o analise automaticamente.

## Estrutura do Projeto

```
TCC-TRUTH-CHROME-CHECKER/
├── extension/                   # Tudo relacionado à extensão do Chrome
│   ├── assets/                  # Imagens e ícones
│   │   └── icon.png
│   ├── content/                 # Scripts injetados para scraping
│   │   └── content.js
│   ├── lib/                     # Bibliotecas auxiliares
│   │   └── readability.js
│   ├── popup/                   # Frontend do popup
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── style.css
│   └── manifest.json            # Configuração da extensão do Chrome
│
├── server/                      # Backend do projeto (API, scraping, análise)
│   ├── captured_pages/          # Páginas capturadas pelo Puppeteer
│   ├── server.js                # Servidor Express (Node.js)
│   └── teste_api.js             # Teste de conexão com GoogleGenerativeAI
│
├── teste_noticia/               # Testes de páginas HTML para scraping
│   ├── noticia_falsa.html
│   └── noticia_verdadeira.html
│
├── node_modules/                # Dependências do Node.js
│
├── package.json                 # Configurações do Node.js e scripts
├── package-lock.json            # Lock das versões das dependências
├── .gitignore                   # Arquivos ignorados pelo Git
├── .env                         # Variáveis de ambiente (API keys)
└── README.md                    # Documentação do projeto
```

## Configuração da API

Antes de iniciar o projeto, é necessário configurar a chave da API do **Google Gemini**.

## Melhorias Futuras

- Implementar análise baseada em busca na internet.
- Melhorar a interface com gráficos de confiabilidade.
- Criar um banco de dados para armazenar notícias analisadas para otimização.
- Mudança de foco com base na analíse da vericidade de posts no **X**.
