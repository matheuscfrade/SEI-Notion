# Política de Privacidade — SEI Notion

**Última atualização:** 28 de agosto de 2026 (v0.3.0)  
**Desenvolvedor:** Matheus Costa Frade  
**Extensão:** SEI Notion (Chrome)  
**Contato:** [issues no GitHub](https://github.com/matheuscfrade/SEI-Notion/issues)  
**Código:** [github.com/matheuscfrade/SEI-Notion](https://github.com/matheuscfrade/SEI-Notion)

Não é um produto oficial do SEI, de nenhum órgão público nem da Notion.

## 1. Finalidade única

O **SEI Notion** liga processos do Sistema Eletrônico de Informações (SEI) a páginas de um banco no **Notion da própria pessoa**, no navegador dela. Não há outro uso dos dados.

## 2. Dados processados

### 2.1 Na página do SEI (localmente)

Com você logado no SEI, a extensão pode ler no navegador:

- número do processo (NUP);
- tipo de processo, quando visível;
- especificação e anotação visíveis nos tooltips da lista;
- URL da tela do SEI.

Isso só acontece nos endereços que **você** autorizou (por exemplo `https://sei.sua-instituicao.gov.br`).

### 2.2 O que você configura

- URL(s) raiz do SEI;
- token da integração Notion (ou PAT);
- seu nome nesta equipe (para o bloqueio de edição);
- ID dos bancos de processos e atividades e o mapeamento de colunas.

Ficam em `chrome.storage.local` **neste navegador**. O token **não** é sincronizado com a conta Google (`chrome.storage.sync` não é usado).

### 2.3 O que vai para o Notion

Só a API oficial `https://api.notion.com`, autenticada com **o seu** token:

- consulta de páginas pelo Número SEI;
- criação e atualização das páginas e atividades que você pede no SEI;
- leitura do esquema dos bancos que você compartilhou com a integração.

Não há servidor do desenvolvedor no caminho. O desenvolvedor **não recebe** NUP, documentos, token nem conteúdo do Notion.

## 3. O que a extensão não faz

- Não cria conta em servidor próprio
- Não envia dados a analytics, anúncios ou rastreadores
- Não vende dados
- Não executa código remoto
- Não acessa o SEI de instituições além das URLs que você autorizou
- Não lê o conteúdo dos documentos do processo além do que já está visível na tela em que o botão N aparece

## 4. Permissões

- **`storage`**: guardar preferências e o token neste navegador
- **`scripting`**: injetar o botão N e o popup só nos sites SEI autorizados
- **`https://api.notion.com/*`**: chamar a API Notion no service worker (a API não tem CORS)
- **Host opcional (`http://*/*` e `https://*/*`)**: o SEI tem URL diferente em cada instituição. A extensão **não** recebe acesso a todos os sites. No clique em “Salvar e autorizar”, o Chrome pede permissão **somente** para a URL raiz que você informou.

## 5. Uso limitado (Chrome Web Store)

O desenvolvedor certifica que:

- os dados do usuário são usados só para a finalidade única descrita nesta política;
- não são vendidos a terceiros;
- não são usados para crédito, anúncios ou determinação de emprego, crédito ou seguro;
- não são transferidos a terceiros para fins não relacionados à funcionalidade da extensão.

## 6. Retenção e exclusão

- Os dados ficam só no Chrome desta máquina, até você removê-los.
- **Remover token** nas opções apaga a credencial do Notion neste navegador.
- Desinstalar a extensão ou usar “Limpar dados da extensão” no Chrome apaga o restante.
- Páginas já criadas no Notion continuam na sua conta Notion; a extensão não as apaga ao desinstalar.

## 7. Crianças

A extensão destina-se a servidores públicos e equipes que usam o SEI. Não é dirigida a crianças com menos de 13 anos e não coleta dados de crianças de forma intencional.

## 8. Alterações nesta política

Se as práticas de dados mudarem, esta página será atualizada com nova data e a versão da extensão. Mudanças relevantes serão descritas no histórico do repositório e nas notas da versão na Chrome Web Store.

## 9. Contato

Dúvidas sobre privacidade: abra uma issue em [github.com/matheuscfrade/SEI-Notion/issues](https://github.com/matheuscfrade/SEI-Notion/issues).
