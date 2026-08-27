# Política de Privacidade — SEI Notion

**Última atualização:** 27 de agosto de 2026 (v0.2.0)  
**Desenvolvedor:** Matheus Costa Frade  
**Extensão:** SEI Notion (Chrome)

## 1. Visão geral

O **SEI Notion** liga processos do Sistema Eletrônico de Informações (SEI) a páginas de um banco no Notion **da própria pessoa**.

Não é um produto oficial do SEI, do governo nem da Notion.

## 2. Dados processados

### 2.1 Na página do SEI (localmente)

Com você logado no SEI, a extensão pode ler no navegador:

- número do processo (NUP);
- especificação e anotação visíveis nos tooltips da lista;
- URL da tela.

### 2.2 O que você configura

- URL(s) raiz do SEI;
- token da integração Notion (ou PAT);
- ID do database e mapeamento de colunas.

Ficam em `chrome.storage.local`. O token **não** é sincronizado com a conta Google.

### 2.3 O que vai para o Notion

Só a API oficial `https://api.notion.com`, autenticada com **o seu** token:

- consulta de páginas pelo Número SEI;
- criação/atualização das páginas que você pede no SEI.

Não há servidor do desenvolvedor no caminho.

## 3. O que a extensão não faz

- Não cria conta em servidor próprio
- Não envia NUP, documentos ou token para o desenvolvedor
- Não vende dados, não exibe anúncios, não usa rastreadores
- Não executa código remoto
- Não acessa o SEI de instituições além das URLs que você autorizou

## 4. Permissões

- **`storage`**: preferências e token no navegador
- **`scripting`**: injetar a UI só nos sites SEI autorizados
- **`https://api.notion.com/*`**: chamadas à API Notion no service worker
- **Host opcional**: pedido em tempo de execução só para as URLs raiz do SEI

## 5. Retenção

Remova a extensão ou limpe os dados dela no Chrome. **Remover token** nas opções apaga só a credencial do Notion.
