# SEI Notion

Extensão Chrome que mostra, na interface do SEI, as páginas do **seu** Notion ligadas a cada processo.

Cada pessoa instala, aponta o SEI da instituição e conecta o **próprio** workspace. Não há servidor no meio: o token fica no navegador e as chamadas vão direto para `api.notion.com`.

Não é um produto oficial do SEI nem da Notion.

## O que faz

Na **Controle de Processos** e no **processo aberto**:

- um botão **N** ao lado do número (azul se já existe página)
- o botão abre um **popup** para ver e editar especificação, status, prazo, marcadores, atribuição e observações
- **Quadro de Atividades (Kanban)**: vincule um banco de dados de atividades conectado ao banco de processos por relação (`Relation`). Cada processo ganha um quadro Kanban completo com colunas de status, drag & drop direto no popup, exclusão e checklists internos expansíveis em cada atividade.
- **Modelos de Atividades**: importe templates nativos do Notion cadastrados na database de atividades diretamente para o Kanban.
- **Salvar alterações** atualiza a página existente — não cria outra
- se ainda não houver página, o popup tem **Criar página no Notion**

O vínculo é a propriedade **Número SEI** (ex.: `23123.000123/2024-01`), não um texto solto na descrição.

Se duas pessoas abrirem o mesmo processo, a primeira edita; a segunda vê o nome de quem está no popup e não consegue salvar até a outra fechar (ou ~1 minuto sem atividade). Preencha **Seu nome nesta equipe** nas opções.

## Instalação (desenvolvedor)

1. `chrome://extensions` → Modo do desenvolvedor
2. **Carregar sem compactação** → pasta `SEI-Notion`

Na primeira instalação as opções abrem sozinhas.

## Configuração (cada usuário)

### 1. URL do SEI

Informe a URL raiz da instituição, por exemplo `https://sei.ifmg.edu.br`, e clique em **Salvar e autorizar acesso ao SEI**. A extensão só atua nesses sites.

### 2. Token do Notion

1. Abra [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Crie uma integração **interna** (ou um token de acesso pessoal)
3. Capacidades: ler, inserir e atualizar conteúdo
4. Nos databases de processos e atividades: **••• → Add connections** → a integração
5. Cole o token nas opções, preencha **Seu nome nesta equipe** e clique em **Conectar**

Time no mesmo workspace: cada um cria o próprio token (ou PAT). Todos apontam para os **mesmos databases** compartilhados.

### 3. Banco de dados de Processos

- **Listar bancos visíveis** e escolher, ou colar o link/ID
- **Preparar este banco** cria as colunas que faltarem:
  - Número SEI (texto)
  - Status
  - Etiquetas
  - Prazo
  - URL SEI
  - Observações
  - Responsável (texto; no Papel no SEI escolha **Atribuição**)
- Confira o mapeamento se o banco já existir com outros nomes. Em **Papel no SEI**, ligue a coluna de responsável a **Atribuição** para preencher com o login atribuído no processo.
- **Salvar banco e mapeamento**

### 4. Banco de dados de Atividades (Kanban)

- Escolha ou cole o ID/link da database de atividades
- **Preparar este banco** cria automaticamente as propriedades necessárias:
  - Processo (Relation apontando para o Banco de Processos)
  - Status (Status/Select com colunas de Kanban)
- **Salvar banco de atividades**: a extensão passa a gerenciar e renderizar o Kanban com drag & drop e checklists por card no popup do SEI.

O título da página usa a especificação do processo no SEI, quando houver; senão, o número.

## Privacidade

Política: [`PRIVACY.md`](PRIVACY.md)

- Token e preferências: `chrome.storage.local` neste navegador
- Metadados do processo (número, especificação, anotação, URL) só vão para a API do Notion da conta que você conectou
- Nada é enviado a servidor do desenvolvedor

## Arquitetura

```
Opções  →  token + database da pessoa
SEI     →  content script lê o DOM
Worker  →  único lugar que chama api.notion.com (a API não tem CORS)
```

Mesmo padrão do SEI Blocos / SEI Fluxo: URL do SEI configurável e content scripts só nos hosts autorizados.

## Versão

**0.1.0** — MVP autoatendido (token próprio, mapeamento de colunas, lista + processo).
