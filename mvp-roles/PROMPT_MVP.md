# PROMPT — MVP do app de rolês

> Como usar: crie uma pasta vazia para o projeto, coloque este arquivo nela, abra o Claude Code nessa pasta e diga:
> **"Leia o PROMPT_MVP.md inteiro e comece pela Fase 0."**
> Antes, troque os campos entre `[COLCHETES]`.

---

## 0. Seu papel

Você é um engenheiro full-stack sênior e product engineer, especialista em apps de consumo para a Geração Z, pagamentos via Pix e produtos com crescimento viral (o "loop do convite"). Vai construir comigo, do zero, o MVP de um app para organizar rolês, resenhas e festas pequenas em São Paulo.

Você trabalha em **fases curtas e verificáveis**. Em cada fase você planeja, implementa, testa, mostra o resultado e **só passa para a próxima depois da minha aprovação**. Nada de funcionalidade de mentira: se algo não ficou pronto, diga isso claramente.

---

## 1. Contexto do produto

**Nome provisório:** [NOME_DO_APP]
**Mascote / cara do app:** [NOME_DO_MASCOTE], um amigo nosso que viralizou no TikTok: engraçado, carismático, gente boa. Ele aparece nos textos, estados vazios, mensagens de erro e telas de sucesso. Use apenas placeholders de imagem (`/public/mascote/*.png`); as fotos reais eu coloco depois.

**Problema:** quem organiza rolê (resenha em casa, aniversário, churrasco, festinha num espaço alugado) usa grupo de WhatsApp, Pix direto e lista no chat. Resultado: calote ("depois te mando o Pix"), gente que confirma e não aparece, penetra, superlotação, conta de bebida e comida feita errado e horas cobrando gente e conferindo print de comprovante.

**Solução:** um lugar só para criar o rolê, convidar, aprovar a lista, cobrar por Pix, controlar quem pagou, dividir tarefas ("quem leva o gelo"), calcular custos e fazer o check-in na porta.

**Público:** jovens de 18 a 29 anos da cidade de São Paulo (começando pela zona sul). O app é mobile-first; a maioria vai abrir o primeiro convite por um link no WhatsApp ou no Instagram.

**Tom de voz:** português do Brasil, informal, bem-humorado e direto, com gírias leves de SP ("rolê", "resenha", "bora", "tá pago"). Nunca infantil, nunca cringe e nunca incentivando beber em excesso.

**Princípio de crescimento:** cada convite é uma propaganda. A página pública do convite precisa ser linda, rápida, compartilhável (com preview bonito no WhatsApp) e terminar com um CTA de **"Organize seu rolê também"**.

---

## 2. Decisões de stack (siga estas, salvo se tiver um motivo técnico forte; nesse caso me pergunte antes)

- **Web app mobile-first / PWA**, sem app nativo no MVP. O motivo: convite tem que abrir direto do WhatsApp sem precisar baixar nada.
- **Next.js (App Router) + TypeScript (strict)**
- **Tailwind CSS + shadcn/ui** para os componentes; **lucide-react** para ícones
- **Supabase**: Postgres, Auth (login por **magic link no e-mail** e **OTP por telefone** quando possível), Storage (capas dos rolês) e **Row Level Security em TODAS as tabelas**
- **Zod** para validar tudo (formulários e APIs)
- **React Hook Form** nos formulários
- **Vitest** para testes unitários e **Playwright** para os fluxos ponta a ponta principais
- **ESLint + Prettier**
- Deploy pensado para **Vercel** (com `.env.example` documentado)
- Pacotes: use só bibliotecas populares e mantidas. Antes de adicionar uma dependência nova, diga por que ela é necessária.

---

## 3. Escopo do MVP (o que ENTRA)

### 3.1 Contas
- Login sem senha (magic link / OTP).
- Perfil: nome, @ do Instagram (opcional), foto (opcional) e **data de nascimento obrigatória** (usada para regras de idade; mostre ao usuário só "18+" ou "menor de 18", nunca a data).

### 3.2 Criar rolê (anfitrião)
Campos: título, descrição, capa (upload ou um dos templates prontos), data/hora de início e fim, **bairro** (público) e **endereço completo** (privado), lotação máxima, valor por pessoa (ou grátis), chave Pix do anfitrião, tipo de lista (aberta ou com aprovação), **"vai ter bebida alcoólica?" (sim/não)** e faixa etária mínima.

- **Regra obrigatória:** se `tem_alcool = true`, a idade mínima é **18** e não pode ser reduzida. Bloqueie no front, no back e no banco (CHECK constraint + RLS). Venda ou fornecimento de bebida alcoólica a menores é crime no Brasil (art. 243 do ECA), então isso não é opcional.
- Gera um link curto e compartilhável: `/r/[codigo]`.

### 3.3 Página pública do convite `/r/[codigo]`
- Capa, título, data, bairro, valor, quantas vagas restam e avatares de quem confirmou (só primeiro nome).
- **Endereço completo só aparece para convidados aprovados E (se for pago) com pagamento confirmado.**
- Botão "Quero ir" → login rápido → pedido de entrada.
- Metatags Open Graph dinâmicas (título, data, capa), para o link ficar bonito no WhatsApp.
- Rodapé: "Feito com [NOME_DO_APP] — organize o seu" (o loop viral).

### 3.4 Lista de convidados
- Estados: `solicitado` → `aprovado` / `recusado` → `pago` → `check-in feito`; além de `lista_de_espera` e `cancelado`.
- Quando lota, novos pedidos vão para a lista de espera; se alguém cancela, o primeiro da fila é promovido e avisado.
- O anfitrião aprova ou recusa (individualmente ou em lote) e vê filtros: pendentes, aprovados, pagos, não pagos.
- Usuário menor que a idade mínima do rolê **não consegue** pedir entrada (mostre uma mensagem gentil).

### 3.5 Pagamento — Fase A (MVP): Pix estático, sem segurar dinheiro
- O app **não recebe nem guarda dinheiro**. O convidado paga direto para a chave Pix do anfitrião.
- Gere o **Pix "copia e cola" + QR Code (BR Code / padrão EMV do Banco Central)** com valor e um identificador (txid) único por convidado. Implemente o payload EMV com CRC16-CCITT **e escreva testes unitários validando o payload** com exemplos conhecidos.
- O convidado marca "Já paguei" e pode anexar o comprovante (opcional) → o anfitrião confirma com um toque.
- O anfitrião vê um painel: arrecadado, pendente, quem falta pagar e um botão "cobrar no WhatsApp" (que abre `wa.me` com uma mensagem pronta, educada e divertida).
- Deixe a camada de pagamento atrás de uma interface (`PaymentProvider`), para a **Fase B** (PSP com Pix dinâmico + webhook + split, ex.: Asaas ou Mercado Pago) entrar depois sem reescrever nada. **Não implemente a Fase B agora**, só a interface e um `TODO` documentado.

### 3.6 Calculadora anti-prejuízo
- O anfitrião informa os custos (local, bebida, comida, gelo, som, decoração, outros) e o número esperado de pessoas.
- O app sugere um **preço mínimo por pessoa** e um **preço recomendado** (com margem configurável para no-show; padrão de 15%).
- Mostra o "ponto de equilíbrio": quantas pessoas pagantes são necessárias para empatar.
- Mostra a sugestão de quantidade de bebida e comida por pessoa como estimativa editável, sempre com opções sem álcool listadas junto.
- Toda essa lógica fica em funções puras, **com testes unitários**.

### 3.7 Quem leva o quê
- Lista de itens que os convidados aprovados podem "pegar" ("eu levo o gelo") ou que o anfitrião atribui. Status: livre / alguém pegou / levado.

### 3.8 Check-in na porta
- Cada convidado aprovado e pago tem um **QR de entrada** (token assinado, impossível de adivinhar).
- O anfitrião (ou co-anfitrião que ele indicar) abre `/r/[codigo]/portaria`, escaneia com a câmera do celular e vê **verde (pode entrar) / amarelo (não pagou) / vermelho (não está na lista ou QR já usado)**.
- Funciona com conexão ruim: fallback de busca manual por nome.

### 3.9 Painel do anfitrião `/painel`
- Meus rolês (próximos e passados) e, para cada um: vagas, arrecadação, pendências, tarefas e check-ins em tempo real (Supabase Realtime).
- Duplicar um rolê (para quem organiza toda semana).

### 3.10 Mensagens e avisos
- No MVP: notificações dentro do app + links prontos de WhatsApp (`wa.me`). Sem envio automático de SMS ou WhatsApp (isso fica para depois).

### 3.11 Legal e LGPD (obrigatório no MVP)
- Página de **Termos de Uso** e de **Política de Privacidade** (rascunhos marcados como "REVISAR COM ADVOGADO"), dizendo que o anfitrião é o responsável pelo evento, pelo local, pelo alvará quando necessário e pelo cumprimento da lei sobre álcool e menores.
- Checkbox obrigatório para o anfitrião ao criar um rolê com álcool: "Confirmo que não vou servir nem vender bebida alcoólica a menores de 18 anos."
- Colete o mínimo de dados possível. Comprovantes de Pix ficam em um bucket **privado**, e só o anfitrião daquele rolê tem acesso.
- Botão "excluir minha conta e meus dados".

---

## 4. Fora do escopo do MVP (NÃO faça agora; apenas anote em `ROADMAP.md`)
Pix dinâmico/PSP/split (Fase B), app nativo, chat interno, feed social / "onde meus amigos vão", marketplace de fornecedores (adegas, DJs, espaços), plano pago para produtores, revenda de ingressos, verificação de documento, multi-idioma.

---

## 5. Modelo de dados (ponto de partida; refine na Fase 0 e me mostre)

- `profiles` (id = auth.uid, nome, instagram, avatar_url, data_nascimento, criado_em)
- `roles_eventos` (id, codigo_curto único, anfitriao_id, titulo, descricao, capa_url, inicio, fim, bairro, endereco_privado, lotacao_max, preco_centavos, chave_pix, tipo_lista, tem_alcool, idade_minima, status [rascunho/publicado/cancelado/encerrado], criado_em)
  - CHECK: `NOT tem_alcool OR idade_minima >= 18`
- `co_anfitrioes` (evento_id, user_id, papel [co_anfitriao/portaria])
- `participacoes` (id, evento_id, user_id, status, txid_pix, pago_marcado_em, pago_confirmado_em, comprovante_path, checkin_token_hash, checkin_em, posicao_espera)
- `custos` (id, evento_id, categoria, descricao, valor_centavos)
- `itens_levar` (id, evento_id, nome, responsavel_id, status)
- `notificacoes` (id, user_id, evento_id, tipo, lida, criado_em)

Regras gerais: valores sempre em **centavos (integer)**; datas em `timestamptz` exibidas em `America/Sao_Paulo`; as migrations ficam em `supabase/migrations`; e **as políticas RLS vêm acompanhadas de testes** que provem que um usuário não lê dados de outro rolê (endereço, comprovantes, lista completa).

---

## 6. Design e UX
- Mobile-first (390px de largura de referência), com tema escuro como padrão e cores vibrantes de festa. Defina tokens de design em um único lugar.
- Criar um rolê em **menos de 60 segundos**: formulário em passos curtos e valores padrão inteligentes.
- Estados vazios, de carregamento e de erro com a voz do mascote. Exemplo: "[NOME_DO_MASCOTE] procurou e não achou nenhum rolê seu… bora criar o primeiro?"
- Acessibilidade: contraste AA, alvos de toque ≥ 44px e labels nos campos.
- Performance: a página do convite deve carregar rápido em 4G (imagens otimizadas, nada de JS desnecessário). Meta: Lighthouse mobile ≥ 90.

---

## 7. Plano de execução em fases

Cada fase termina com: código funcionando, testes passando, `lint` + `typecheck` limpos, um commit claro e um **resumo curto para mim** (o que foi feito, como testar e o que ficou pendente). Depois disso você **para e espera o meu OK**.

- **Fase 0 — Planejamento (sem código de produto):** confirme que entendeu, liste suas dúvidas (no máximo 5, só as que mudam a arquitetura), proponha a estrutura de pastas, o modelo de dados final e as rotas. Crie o `CLAUDE.md` com as convenções do projeto, o `ROADMAP.md` e o `.env.example`. Diga exatamente o que eu preciso criar do meu lado (projeto no Supabase, chaves etc.).
- **Fase 1 — Fundação:** setup do Next.js, Tailwind/shadcn, Supabase, auth, perfil com data de nascimento, layout base, tema e CI local (lint, typecheck, test).
- **Fase 2 — Criar rolê + página do convite:** formulário em passos, regras de idade/álcool, link curto, Open Graph e CTA viral.
- **Fase 3 — Lista de convidados:** pedidos, aprovação, lotação, lista de espera e privacidade do endereço.
- **Fase 4 — Pix (Fase A):** BR Code + QR com testes, "já paguei", confirmação, painel financeiro e cobrança via WhatsApp.
- **Fase 5 — Calculadora + quem leva o quê.**
- **Fase 6 — Check-in na portaria:** QR assinado, leitor de câmera e fallback manual.
- **Fase 7 — Painel do anfitrião + tempo real + duplicar rolê.**
- **Fase 8 — Legal, LGPD, polimento e deploy:** termos, privacidade, exclusão de conta, testes E2E dos 3 fluxos críticos (criar rolê → convidado entra e paga → check-in), seed de dados demo e guia de deploy na Vercel.

---

## 8. Regras de trabalho para você (Claude Code)
1. **Leia antes de escrever.** Antes de mexer em qualquer arquivo, entenda o que já existe.
2. **Pergunte só o que bloqueia.** Para decisões pequenas, escolha o padrão mais sensato e anote no resumo da fase.
3. **Segurança primeiro:** nunca exponha a `service_role` no cliente, valide tudo no servidor com Zod, use RLS em tudo e coloque rate limit nas rotas de pedido de entrada e de check-in.
4. **Sem gambiarra silenciosa:** nada de `any`, nada de `// @ts-ignore` sem justificativa e nada de mock escondido em produção.
5. **Teste o que importa:** regras de idade/álcool, payload Pix, calculadora, RLS e transições de status da participação.
6. **Commits pequenos** com mensagens no padrão Conventional Commits.
7. **Textos da interface centralizados** (um arquivo de copy em pt-BR), para eu poder ajustar a voz do mascote facilmente.
8. **Ao final de cada fase**, rode `lint`, `typecheck` e `test`, e só diga "pronto" se tudo passar.
9. Se ficar travado em algo por mais de 2 tentativas, pare e me explique o problema com opções.

---

## 9. Critério de sucesso do MVP
Consigo, pelo celular e em menos de 5 minutos:
1. criar um rolê pago com bebida (e o app me obriga a definir 18+);
2. mandar o link no WhatsApp e ver um preview bonito;
3. um amigo pedir entrada, ser aprovado, pagar via Pix copia e cola e eu confirmar;
4. o endereço aparecer só para ele depois disso;
5. na porta, escanear o QR dele e ver verde;
6. ver no painel quanto arrecadei e quem ainda falta pagar.

**Comece agora pela Fase 0.**
