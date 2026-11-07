# Fase 0 — Plano técnico

> Status: **aguardando aprovação**. Nenhum código de produto foi escrito.
> Referência do produto: [`PROMPT_MVP.md`](../PROMPT_MVP.md). Convenções: [`CLAUDE.md`](../CLAUDE.md).

---

## 1. O que eu entendi (resumo)

App web mobile-first (PWA) para quem organiza rolê pequeno em SP. O anfitrião cria o rolê em menos de 60 s e manda um
link `/r/[codigo]` no WhatsApp. O convidado abre esse link no navegador interno do WhatsApp ou do Instagram, pede entrada e
é aprovado. Depois paga por Pix estático direto na chave do anfitrião e recebe um QR de entrada. Na porta, o anfitrião escaneia e vê
verde, amarelo ou vermelho. O app **nunca segura dinheiro** na Fase A. As regras de idade e álcool valem no front, no back e
no banco. Cada convite termina com "Organize seu rolê também".

---

## 2. Dúvidas que mudam a arquitetura (5)

Para cada uma eu já escolhi um **padrão**. Se você não responder, sigo com ele.

| # | Dúvida | Padrão que vou seguir |
|---|---|---|
| 1 | **Onde fica o código?** Este repositório já tem 3 projetos sem relação (conciliação, radar, cr7). O app pode ficar na subpasta `mvp-roles/` deste repo ou ganhar um **repo próprio**. | Subpasta `mvp-roles/` por enquanto (a Vercel aceita *Root Directory*). **Recomendo** um repo próprio antes da Fase 1, porque o CI e o deploy ficam mais simples. |
| 2 | **Login.** O magic link tem um problema sério no nosso caso: o convidado abre o convite no navegador **interno** do WhatsApp/Instagram, mas o link do e-mail abre no navegador **padrão**, e aí a sessão "some" do lugar onde ele estava. O OTP por **SMS** exige um provedor pago (Twilio etc., ~R$0,40 por SMS). | **Código de 6 dígitos por e-mail** (OTP de e-mail do Supabase) como fluxo principal, porque funciona dentro de qualquer navegador. O magic link fica no mesmo e-mail como alternativa. SMS fica pronto na arquitetura, mas **desligado** até você topar o custo. Isso está certo? |
| 3 | **Idade mínima para ter conta.** Menores podem ir a rolês sem álcool, mas a LGPD (art. 14) exige cuidado extra com dados de menores, e abaixo de 12 anos exige consentimento dos pais. | Conta a partir de **16 anos**. Abaixo disso o cadastro é bloqueado com uma mensagem gentil. Rolê com álcool continua travado em 18+. |
| 4 | **Quando a vaga é "ocupada"?** Se um aprovado que não paga segurar a vaga para sempre, o anfitrião fica no prejuízo. | A vaga é reservada na **aprovação**. Cada rolê pago tem um **prazo para pagar** (padrão de 24 h). Quando o prazo vence, o anfitrião vê "prazo estourado" e libera a vaga com um toque, e o primeiro da lista de espera é promovido. Nada é cancelado automaticamente no MVP (fica no ROADMAP). |
| 5 | **Retenção de comprovantes.** Pela LGPD, é melhor não guardar comprovante para sempre. | Os comprovantes são **apagados 30 dias depois do fim do rolê** (job no banco). Os dados de participação continuam guardados até a exclusão da conta. |

Pequenas decisões que tomei sozinho estão na seção 8.

---

## 3. Estrutura de pastas proposta

```
mvp-roles/
├─ CLAUDE.md                 convenções do projeto (leia primeiro)
├─ ROADMAP.md                fora do escopo + Fase B
├─ PROMPT_MVP.md             especificação original
├─ .env.example
├─ docs/                     planos de fase, guia de deploy, decisões
├─ public/
│  ├─ mascote/*.png          placeholders (fotos reais depois)
│  ├─ capas/*.webp           templates de capa
│  └─ manifest.webmanifest   PWA
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/            SQL versionado (tabelas, RLS, funções, storage)
│  ├─ tests/                 pgTAP: RLS e funções de transição (supabase test db)
│  └─ seed.sql               dados demo (Fase 8)
├─ e2e/                      Playwright (3 fluxos críticos)
└─ src/
   ├─ app/                   rotas (App Router), ver seção 5
   ├─ components/
   │  ├─ ui/                 shadcn/ui (gerado)
   │  ├─ mascote/            <Mascote estado="vazio|erro|sucesso" />
   │  ├─ convite/ painel/ portaria/ formulario-role/
   ├─ copy/pt-BR.ts          TODOS os textos da interface
   ├─ lib/
   │  ├─ supabase/           client.ts, server.ts, middleware.ts, admin.ts (server-only)
   │  ├─ pagamentos/         PaymentProvider + pix-estatico/ (brcode.ts, crc16.ts)
   │  ├─ calculadora/        funções puras de preço, equilíbrio e quantidades
   │  ├─ participacao/       máquina de estados (espelho da regra do banco)
   │  ├─ idade/              cálculo de idade em America/Sao_Paulo
   │  ├─ checkin/            geração/validação de token HMAC
   │  ├─ whatsapp/           links wa.me + mensagens prontas
   │  ├─ datas/              formatação em America/Sao_Paulo (Intl, sem lib)
   │  └─ validacao/          schemas Zod compartilhados front/back
   ├─ server/actions/        Server Actions (chamam RPCs com o JWT do usuário)
   └─ styles/globals.css     tokens de design (Tailwind v4 @theme)
```

Os testes unitários ficam ao lado do código (`*.test.ts`).

---

## 4. Modelo de dados final

### 4.1 Mudanças em relação ao rascunho do prompt (e por quê)

1. **`roles_eventos` → `eventos`.** "role" colide com *roles* do Postgres (`anon`, `authenticated`) e confunde nas políticas.
2. **Os dados privados saíram para tabelas separadas.** A RLS do Postgres filtra **linhas**, não colunas. A página pública precisa
   ler a linha do evento, mas não o endereço. Então:
   - `eventos_privados` (endereço completo e chave Pix) é legível só pela equipe do rolê, e o convidado recebe esses dados por funções que checam o status dele;
   - `perfis_privados` (data de nascimento) é legível só pelo próprio usuário, e as outras partes do sistema recebem só um booleano (`atende_idade`).
3. **Check-in por HMAC em vez de `checkin_token_hash`.** O convidado precisa rever o QR várias vezes, e com hash não dá para
   mostrar o token de novo. O QR passa a ser `v1.<participacao_id>.<versao>.<hmac>`, onde o HMAC é calculado com `CHECKIN_TOKEN_SECRET`.
   Ele não dá para adivinhar e dá para revogar (basta incrementar a `checkin_versao`).
4. **Escritas sensíveis só por funções do banco (RPC).** O cliente **não** faz `insert` nem `update` direto em `participacoes`.
   Tudo passa por funções `security definer` que travam a linha do evento (`FOR UPDATE`). Assim dois pedidos simultâneos não
   furam a lotação, e a máquina de estados fica garantida no banco.
5. **A declaração de álcool fica gravada.** O campo `declaracao_alcool_em` passa a ter um CHECK: com álcool, ele é obrigatório.

### 4.2 Tabelas

Convenções: `id uuid default gen_random_uuid()`, `criado_em timestamptz default now()`, dinheiro em `*_centavos integer`,
RLS **habilitada em todas**.

**`perfis`**: `id` (PK, FK `auth.users`, *on delete cascade*), `nome` (1–60), `instagram` (nullable, `^[a-z0-9._]{1,30}$`),
`avatar_path`, `termos_versao`, `termos_aceitos_em`, `criado_em`.

**`perfis_privados`**: `user_id` (PK/FK), `data_nascimento date not null`, com CHECK de idade entre 16 e 100 anos. Depois de gravada,
**não pode ser alterada pelo usuário** (trigger), o que evita "virar 18" para entrar num rolê. A correção é feita pelo suporte.

**`eventos`**
| coluna | tipo / regra |
|---|---|
| `codigo_curto` | `text unique`, 7 caracteres do alfabeto sem ambíguos (sem 0/O/1/l/I), gerado no banco |
| `anfitriao_id` | FK `perfis` |
| `titulo` (3–80), `descricao` (≤ 1000), `capa_path` | |
| `inicio`, `fim` | `timestamptz`, CHECK `fim > inicio` |
| `bairro` | público |
| `lotacao_max` | `int` entre 1 e 500 |
| `preco_centavos` | `int >= 0` (0 = grátis) |
| `tipo_lista` | enum `aberta` \| `aprovacao` |
| `tem_alcool` | `bool` |
| `idade_minima` | `int` entre 16 e 99 |
| `declaracao_alcool_em` | `timestamptz` |
| `prazo_pagamento_horas` | `int default 24` |
| `publico_esperado`, `margem_no_show_bps` | para a calculadora (`1500` = 15%) |
| `status` | enum `rascunho` \| `publicado` \| `cancelado` \| `encerrado` |
| `duplicado_de` | FK `eventos`, nullable |

CHECKs: `NOT tem_alcool OR idade_minima >= 18` e `NOT tem_alcool OR declaracao_alcool_em IS NOT NULL`.
Quando `fim < now()`, a interface trata o rolê como encerrado. Um job marca `encerrado` no banco.

**`eventos_privados`**: `evento_id` (PK/FK), `endereco_completo`, `chave_pix`, `tipo_chave_pix`
(`cpf|cnpj|email|telefone|aleatoria`), `nome_recebedor` (≤ 25, ASCII, vai no BR Code), `cidade_recebedor` (padrão `SAO PAULO`).
Para publicar um rolê pago, a chave Pix é obrigatória (validado em `publicar_evento`).

**`co_anfitrioes`**: PK (`evento_id`, `user_id`), `papel` enum `co_anfitriao` | `portaria`.
- O `co_anfitriao` aprova, confirma pagamento, vê os comprovantes e faz check-in.
- A `portaria` só faz check-in e vê a lista de nomes e status.

**`participacoes`**
| coluna | |
|---|---|
| `evento_id`, `user_id` | UNIQUE (`evento_id`, `user_id`) |
| `status` | enum (ver 4.3) |
| `txid_pix` | `text unique`, 25 caracteres alfanuméricos, gerado na aprovação |
| `aprovado_em`, `pago_marcado_em`, `pago_confirmado_em`, `pago_confirmado_por` | |
| `comprovante_path` | nullable |
| `checkin_versao` | `int default 1` |
| `checkin_em`, `checkin_por` | |
| `posicao_espera` | `int`, só em `lista_espera` |
| `cancelado_motivo` | enum `desistiu` \| `prazo_pagamento` \| `anfitriao` \| `evento_cancelado` |

**`custos`**: `evento_id`, `categoria` enum (`local|bebida_alcoolica|bebida_sem_alcool|comida|gelo|som|decoracao|outros`),
`descricao`, `valor_centavos >= 0`.

**`itens_levar`**: `evento_id`, `nome`, `quantidade` (texto livre, ex.: "2 sacos"), `responsavel_id` (nullable),
`status` enum `livre|pego|levado`, com CHECK `(status = 'livre') = (responsavel_id IS NULL)`.

**`notificacoes`**: `user_id`, `evento_id`, `tipo` enum (`pedido_recebido`, `aprovado`, `recusado`, `promovido_da_espera`,
`pagamento_informado`, `pagamento_confirmado`, `prazo_estourando`, `evento_alterado`, `evento_cancelado`), `dados jsonb`,
`lida bool`, `criado_em`. Só são criadas por funções e triggers.

**`limites_taxa`**: (`chave`, `janela_inicio`, `contagem`) para o rate limit dentro das RPCs de pedido de entrada e check-in
(sem serviço externo).

### 4.3 Máquina de estados da participação

```
                ┌──────────── (lotado) ───────────┐
pedir_entrada ──┤                                  ▼
                ├─ lista aberta ─► aprovado   lista_espera ──(vaga abriu)──► aprovado / solicitado*
                └─ com aprovação ─► solicitado ──► aprovado | recusado
aprovado ──(grátis)──────────────────────────────► checkin_feito
aprovado ──marcar "já paguei" (pago_marcado_em)──► [anfitrião confirma] ──► pago ──► checkin_feito
solicitado | lista_espera | aprovado | pago ──► cancelado   (pago→cancelado: só o anfitrião; reembolso é fora do app)
```
\* Na lista com aprovação, quem é promovido da espera volta para `solicitado` e o anfitrião é avisado.

A **vaga** é ocupada pelos status `aprovado`, `pago` e `checkin_feito`. A regra existe em dois lugares com os mesmos testes:
- a função pura `lib/participacao/transicoes.ts` (Vitest);
- as funções do banco (pgTAP).

### 4.4 Funções do banco (RPC)

- `pedir_entrada(evento_id)`: checa idade (`atende_idade`), status do rolê, lotação e rate limit.
- `aprovar(ids[])`, `recusar(ids[])`, `cancelar_participacao(id, motivo)`: cancelar promove o primeiro da lista de espera.
- `marcar_pago(id, comprovante_path?)`, `confirmar_pago(ids[])`.
- `registrar_checkin(participacao_id, versao)`: o servidor valida o HMAC antes de chamar. Retorna `verde | amarelo | vermelho` + motivo.
- `dados_privados_do_convidado(evento_id)`: devolve a chave Pix se o convidado está aprovado, e o endereço se está aprovado **e** (grátis **ou** pago).
- `convidados_publicos(evento_id)`: primeiro nome + avatar de quem ocupa vaga. É a única coisa de perfis que o público vê.
- `vagas_restantes(evento_id)`, `publicar_evento(id)`, `duplicar_evento(id)`.

### 4.5 Storage

| bucket | acesso |
|---|---|
| `capas` | leitura pública; escrita só pelo anfitrião em `{evento_id}/*` |
| `avatares` | leitura pública; escrita só pelo dono em `{user_id}/*` |
| `comprovantes` | **privado**; o convidado faz upload em `{evento_id}/{participacao_id}/*`; leitura pelo anfitrião, pelo co-anfitrião e pelo próprio convidado; servido por URL assinada de 60 s |

### 4.6 Matriz de RLS (o que os testes pgTAP vão provar)

| tabela | anônimo | convidado (outro rolê) | convidado (deste rolê) | equipe do rolê |
|---|---|---|---|---|
| `eventos` (publicado) | lê | lê | lê | lê/edita (anfitrião) |
| `eventos_privados` | ✗ | ✗ | ✗ (só via função, conforme status) | lê (anfitrião e co-anfitrião) |
| `participacoes` | ✗ | ✗ | só a própria | todas do rolê |
| `perfis_privados` | ✗ | ✗ | ✗ | ✗ (só o dono) |
| `custos` | ✗ | ✗ | ✗ | anfitrião e co-anfitrião |
| `itens_levar` | ✗ | ✗ | lê / pega item livre (se aprovado) | tudo |
| storage `comprovantes` | ✗ | ✗ | só o próprio | anfitrião e co-anfitrião |

---

## 5. Rotas

| rota | quem | o quê |
|---|---|---|
| `/` | público | landing com CTA "Criar meu rolê" |
| `/entrar` | público | e-mail → código de 6 dígitos (`?volta=` preserva o convite) |
| `/auth/callback` | público | troca de código do magic link (route handler) |
| `/cadastro` | logado sem perfil | nome, data de nascimento, termos (obrigatório antes de tudo) |
| `/perfil` | logado | editar perfil, sair, **excluir minha conta e meus dados** |
| `/criar` | logado | formulário em passos (rascunho salvo a cada passo) |
| `/r/[codigo]` | público | convite: SSR, Open Graph dinâmico, CTA viral |
| `/r/[codigo]/opengraph-image` | público | imagem OG 1200×630 gerada (`next/og`, já vem no Next) |
| `/r/[codigo]/ingresso` | convidado | status, Pix copia-e-cola + QR, "já paguei", endereço, QR de entrada, quem leva o quê |
| `/r/[codigo]/portaria` | equipe | leitor de QR + busca manual por nome |
| `/painel` | logado | abas "Organizo" e "Vou"; próximos e passados |
| `/painel/[id]` | equipe | visão geral em tempo real |
| `/painel/[id]/convidados` | equipe | filtros e aprovação em lote |
| `/painel/[id]/financeiro` | anfitrião/co | arrecadado, pendente, cobrar no WhatsApp |
| `/painel/[id]/custos` | anfitrião/co | calculadora anti-prejuízo |
| `/painel/[id]/itens` | equipe | quem leva o quê |
| `/painel/[id]/equipe` | anfitrião | co-anfitriões e portaria (escolhidos entre os aprovados) |
| `/painel/[id]/editar` | anfitrião | editar e duplicar |
| `/notificacoes` | logado | avisos dentro do app |
| `/termos`, `/privacidade` | público | rascunhos marcados "REVISAR COM ADVOGADO" |
| `POST /api/portaria/checkin` | equipe | valida o HMAC e chama a RPC (rate limit) |
| `GET /api/portaria/lista` | equipe | lista enxuta (nome + status) para busca offline |

Mutações comuns usam **Server Actions**. Route handlers ficam só onde precisa de HTTP puro (callback, portaria).

---

## 6. Pagamentos (Fase A) em uma tela

- O `PaymentProvider` é uma interface: `criarCobranca(participacao) → { copiaECola, qrSvg, txid }`, `statusCobranca()`.
  A implementação `PixEstaticoProvider` gera um BR Code (EMV/BCB): campos 00, 01, 26 (GUI `br.gov.bcb.pix` + chave), 52, 53 (986),
  54 (valor), 58, 59, 60, 62/05 (txid) e 63 (CRC16-CCITT-FALSE, polinômio 0x1021, valor inicial 0xFFFF).
  Os testes usam payloads de referência.
- **Limitação honesta:** no Pix estático, muitos bancos **não mostram o txid** para quem recebe. A conferência continua sendo
  feita pelo anfitrião (comprovante + "confirmar"), e a Fase B resolve isso com webhook.
- Aviso de privacidade para o anfitrião: uma chave CPF fica visível para os convidados no "copia e cola", então sugerimos usar a **chave aleatória**.
- `QRCode` gerado com o pacote `qrcode` (justificativa na Fase 4).

## 7. Check-in com conexão ruim

- O convidado vê o QR mesmo offline: ele é guardado pelo service worker e pelo `localStorage` depois do primeiro carregamento.
- A portaria baixa a lista (nome + status) ao abrir e oferece busca manual por nome, que funciona sem rede.
  Os check-ins manuais feitos offline entram numa fila local e são sincronizados depois. Se dois aparelhos fizerem check-in da mesma pessoa
  sem rede, o servidor aceita o primeiro, e o segundo aparece como "já usado" na sincronização.
  Isso é uma limitação conhecida e vai documentada.

## 8. Pequenas decisões que tomei sozinho

- **Next.js 15+ / React 19, Tailwind v4**, com tokens em `globals.css` (`@theme`). Gerenciador **pnpm**.
- **Sem lib de datas:** uso `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'`. A idade é calculada na **data de início do rolê**.
- **Rate limit no Postgres** (tabela `limites_taxa`), sem Redis/Upstash. Se o volume crescer, migramos.
- **Testes de RLS em pgTAP** (`supabase test db`, já vem no Supabase CLI, sem dependência JS nova).
- Código curto de 7 caracteres (~2,7×10¹⁰ combinações) + rate limit = inviável de varrer.
- O avatar no convite público mostra só o primeiro nome. A opção "não mostrar minha foto" fica no ROADMAP.
- Excluir a conta cancela os rolês futuros do anfitrião e avisa os convidados. É o **único** uso da `service_role`
  (`auth.admin.deleteUser`, só no servidor, `import 'server-only'`).
- Código de domínio em português sem acento (`eventos`, `pedirEntrada`). Termos técnicos de framework ficam como são.

## 9. O que você precisa fazer do seu lado

1. **Decidir as 5 dúvidas** da seção 2 (ou só responder "segue o padrão").
2. **Trocar os placeholders**: `[NOME_DO_APP]` e `[NOME_DO_MASCOTE]`. Enquanto isso, eles ficam como variáveis em `.env` e no arquivo de copy.
3. **Supabase** (https://supabase.com):
   - Crie um projeto na região **South America (São Paulo) – `sa-east-1`** e guarde a senha do banco.
   - Em *Project Settings → API*, copie a **Project URL**, a **publishable key** (antiga `anon`) e a **secret key** (antiga `service_role`). Nunca cole a secret key no chat: ela vai só no `.env.local` e na Vercel.
   - Em *Authentication → Providers → Email*, deixe ligado.
   - Em *Authentication → Email Templates*, eu te passo na Fase 1 o template com o código `{{ .Token }}`.
   - Em *Authentication → URL Configuration*, configure a Site URL e as Redirect URLs (`http://localhost:3000/**` e o domínio da Vercel).
   - **SMTP próprio** (*Authentication → SMTP*): o e-mail embutido do Supabase manda pouquíssimos e-mails por hora e não serve para usuários reais. Sugestão: **Resend** (tem plano grátis), com um domínio seu verificado.
   - (Opcional, só se topar SMS) uma conta Twilio/Vonage para o OTP por telefone.
4. **Vercel**: conta conectada ao GitHub. Se o código ficar nesta subpasta, use *Root Directory* = `mvp-roles`.
5. **Segredo do check-in**: rode `openssl rand -base64 32` e guarde o resultado como `CHECKIN_TOKEN_SECRET`.
6. **Domínio** (opcional, mas ajuda muito no preview do WhatsApp e no SMTP).
7. Localmente: Node 20+, pnpm, Docker e Supabase CLI (para rodar banco e testes de RLS).

## 10. Próximo passo

Depois do seu OK, a **Fase 1 (Fundação)** entrega:
- setup do Next.js, Tailwind/shadcn e clientes Supabase;
- login por código de e-mail e cadastro com data de nascimento;
- layout e tema;
- as primeiras migrations (`perfis` e `perfis_privados` com RLS e testes);
- os scripts `lint`, `typecheck`, `test` e o CI no GitHub Actions.
