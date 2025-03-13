# TCC - Truth Chrome Checker

## Descrição
O **TCC - Truth Chrome Checker** é uma extensão de navegador que permite aos usuários inserir uma notícia e obter uma estimativa da probabilidade de ela ser falsa. O sistema utiliza a API do Gemini para analisar o conteúdo e fornecer um retorno baseado em padrões de desinformação.

## Funcionalidades
- Permite que o usuário insira uma notícia para análise.
- Usa a API do **Google Gemini** para processar e avaliar a veracidade da notícia.
- Retorna uma estimativa em porcentagem da probabilidade de a notícia ser falsa.
- Fornece uma justificativa concisa para a avaliação.

## Tecnologias Utilizadas
- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js com Express
- **API:** Google Gemini

## Como Usar
1. Clone este repositório:
   ```bash
   git clone https://github.com/seuusuario/truth-chrome-checker.git
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
7. Abra a extensão, insira uma notícia e clique em **Enviar** para obter a análise.

## Estrutura do Projeto
```
├── manifest.json          # Configuração da extensão do Chrome
├── index.html             # Interface do usuário
├── style.css              # Estilização da interface
├── popup.js               # Lógica de frontend para interação
├── server.js              # Servidor Node.js para processar a análise
├── package.json           # Dependências do projeto
├── .env                   # Configuração da chave da API
└── README.md              # Documentação do projeto
```

## Configuração da API
Antes de iniciar o projeto, é necessário configurar a chave da API do **Google Gemini**.
1. Obtenha uma chave de API no Google Cloud.
2. Crie um arquivo `.env` e adicione sua chave de API:
   ```env
   API_KEY=SUA_CHAVE_AQUI
   ```

## Melhorias Futuras
- Implementar análise baseada em busca na internet.
- Scraping para pegar a notícia automaticamente.
- Melhorar a interface com gráficos de confiabilidade.

## Licença
Este projeto é de código aberto e está disponível sob a licença MIT.

