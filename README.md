# SEI Notion

Extensão Chrome que mostra, na interface do SEI, as páginas do **seu** Notion ligadas a cada processo.

Cada pessoa instala, aponta o SEI da instituição e conecta o **próprio** workspace. Não há servidor no meio: o token fica no navegador e as chamadas vão direto para `api.notion.com`.

Não é um produto oficial do SEI nem da Notion.

## O que faz

Na **Controle de Processos** e no **processo aberto**:

- um botão **N** ao lado do número (azul se já existe página)
- o botão abre um **popup** para ver e editar especificação, status, prazo, marcadores, atribuição e observações
- **Quadro de Atividades (Kanban)**: vincule um banco de dados de atividades conectado ao banco de processos por relação (`Relation`). Cada processo ganha um quadro Kanban completo com colunas de status, drag & drop direto no popup, exclusão e checklists internos expansíveis em cada atividade.
- **Modelos de processos (atividades e checklists)**: no banco de atividades, crie um modelo com a lista de atividades e, em cada uma, tarefas (`/to-do`). No popup, **Importar atividades** aplica o modelo ao Kanban. Checklists também podem ser editados no próprio card.
- **Salvar alterações** atualiza a página existente — não cria outra
- se ainda não houver página, o popup tem **Criar página no Notion**

O vínculo é a propriedade **Número SEI** (ex.: `23123.000123/2024-01`), não um texto solto na descrição.

Se duas pessoas abrirem o mesmo processo, a primeira edita; a segunda vê o nome de quem está no popup e não consegue salvar até a outra fechar (ou ~1 minuto sem atividade). Preencha **Seu nome nesta equipe** nas opções.

## Instalação (desenvolvedor)

1. `chrome://extensions` → Modo do desenvolvedor
2. **Carregar sem compactação** → pasta `SEI-Notion`

As opções abrem numa tela inicial com dois caminhos: **Opções** (todos os ajustes) ou **Guia passo a passo** (uma etapa de cada vez). No topo da página completa dá para voltar ao **Início** ou reabrir o guia.

## Configuração (cada usuário)

O guia cobre os mesmos passos abaixo. A página de opções completa continua disponível a qualquer momento.

### 1. URL do SEI

Informe a URL raiz da instituição, por exemplo `https://sei.ifmg.edu.br`, e clique em **Salvar e autorizar acesso ao SEI**. A extensão só atua nesses sites.

### 2. Token do Notion

1. Abra [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Crie uma integração **interna** (ou um token de acesso pessoal)
3. Capacidades: ler, inserir e atualizar conteúdo
4. Nos databases de processos e atividades: **••• → Add connections** → a integração
5. Cole o token nas opções, preencha **Seu nome nesta equipe** e clique em **Conectar**

Time no mesmo workspace: cada um cria o próprio token (ou PAT). Todos apontam para os **mesmos databases** compartilhados.

### 3. Banco de dados de Processos (kit inicial)

No Notion, crie um banco em tabela (ex.: *Processos SEI*), compartilhe com a integração (**••• → Conexões**) e, nas opções:

- **Listar bancos visíveis** e escolher, ou colar o link/ID
- **Preparar este banco** cria as colunas que faltarem (não apaga as existentes):
  - **Número SEI** (obrigatória) — liga o processo do SEI ao card
  - **Tipo de processo**, **Status** (recomendadas)
  - **SEI lock** (sistema) — bloqueio de edição; não aparece no popup
- O título da página no Notion usa o número do processo. A especificação do SEI ficou fora do escopo (não é extraída de forma confiável).
- Marcadores, observações, URL SEI e responsável/prazo do *processo* não fazem mais parte do kit (responsável e prazo ficam nas atividades)
- Se o banco já existir com outros nomes, associe cada campo à coluna correspondente
- **Salvar banco e mapeamento**

### 4. Banco de dados de Atividades (Kanban, opcional)

Crie um segundo banco (ex.: *Atividades SEI*), compartilhe com a mesma integração e:

- **Preparar este banco de atividades** cria:
  - **Status** (colunas do Kanban)
  - **Número SEI** (Relation para o banco de processos) — obrigatória
  - **Responsável**, **Prazo** (recomendadas)
  - **Ordem** (sistema, posição dos cards)
- O título já existe em todo banco Notion
- Sem o kit: o banco precisa de título, Status (ou Seleção) e Relação com o banco de processos
- **Salvar banco de atividades**

O título da página no Notion usa o número do processo.

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

**0.3.0** — tela inicial das opções com escolha entre ajustes e guia passo a passo.
