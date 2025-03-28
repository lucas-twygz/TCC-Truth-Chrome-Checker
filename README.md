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
   - Crie um arquivo `.env` na raiz do projeto e adicione:
     ```env
     API_KEY=SUA_CHAVE_AQUI
     ```
5. Inicie o servidor backend:
   ```bash
   node server.js
   ```
6. Carregue a extensão no Chrome:
   - Acesse `chrome://extensions/`
   - Ative o `Modo de desenvolvedor`
   - Clique em `Carregar sem compactação`
   - Selecione a pasta do projeto
7. Para análise automática, clique no botão de captura para que a extensão extraia o conteúdo da página e o analise automaticamente.

## Estrutura do Projeto

```
├── manifest.json          # Configuração da extensão do Chrome
├── index.html             # Interface do usuário
├── style.css              # Estilização da interface
├── popup.js               # Lógica de frontend para interação
├── server.js              # Servidor Node.js para processar a análise
├── package.json           # Dependências do projeto
├── .env                   # Configuração da chave da API
├── captured_pages/        # Pasta onde os arquivos de scraping são armazenados
├── README.md              # Documentação do projeto
```

## Configuração da API

Antes de iniciar o projeto, é necessário configurar a chave da API do **Google Gemini**.

## Melhorias Futuras

- Implementar análise baseada em busca na internet.
- Melhorar a interface com gráficos de confiabilidade.
- Criar um banco de dados para armazenar notícias analisadas para otimização.
- Mudança de foco com base na analíse da vericidade de posts no **X**.
