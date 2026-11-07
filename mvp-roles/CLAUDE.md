# CLAUDE.md — convenções do projeto

App web mobile-first (PWA) para organizar rolês, resenhas e festas pequenas em São Paulo.
Especificação completa: `PROMPT_MVP.md`. Plano técnico e modelo de dados: `docs/fase-0-plano.md`.
O que está fora do escopo: `ROADMAP.md`.

## Como trabalhamos

- Trabalhamos **em fases** (ver `PROMPT_MVP.md` §7). Cada fase segue o ciclo planejar → implementar → testar → resumo → **parar e
  esperar o OK**. Não começar a fase seguinte sem aprovação.
- **Leia antes de escrever.** Entenda o que já existe antes de mexer.
- Pergunte só o que bloqueia. Decisões pequenas vão no resumo da fase.
- Se algo ficou pela metade, diga claramente. Nada de funcionalidade de mentira nem mock escondido em produção.
- Se ficar travado em algo por mais de 2 tentativas, pare e explique o problema com opções.

## Stack

Next.js (App Router) + TypeScript strict · Tailwind CSS v4 + shadcn/ui · lucide-react · Supabase (Postgres, Auth, Storage,
Realtime) · Zod · React Hook Form · Vitest · Playwright · ESLint + Prettier · deploy na Vercel · pnpm.

**Dependência nova só com justificativa** (por que é necessária e por que não dá com o que já temos). Somente libs populares e
mantidas.

## Comandos (a partir da Fase 1)

```bash
pnpm dev            # servidor local
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest (unitários)
pnpm test:db        # supabase test db (pgTAP: RLS e funções)
pnpm test:e2e       # Playwright (--trace off por padrão)
pnpm check          # lint + typecheck + test (rodar antes de dizer "pronto")
supabase start      # banco local (Docker)
supabase db reset   # recria o banco local com migrations + seed
```

## Regras inegociáveis

1. **Álcool ⇒ 18+.** Se `tem_alcool = true`, a `idade_minima` tem que ser `>= 18`. Isso é garantido em **três camadas**: no front
   (o campo trava), no back (Zod) e no banco (CHECK + RPC). O anfitrião assina a declaração obrigatória (`declaracao_alcool_em`).
   Art. 243 do ECA.
2. **RLS em TODAS as tabelas**, e toda política nova vem com teste pgTAP em `supabase/tests/`.
3. **`service_role` / secret key nunca vai para o cliente.** Ela só aparece em `src/lib/supabase/admin.ts`
   (`import 'server-only'`) e é usada apenas para excluir conta e para o seed.
4. **O cliente não escreve direto em `participacoes`.** As transições de status passam por RPCs `security definer` que travam o
   evento (`FOR UPDATE`). A regra da máquina de estados existe em `src/lib/participacao/` **e** no banco, com testes nos dois.
5. **Valide tudo no servidor com Zod.** Os schemas ficam em `src/lib/validacao/` e são compartilhados com o React Hook Form.
6. **Privacidade:**
   - o endereço completo e a chave Pix ficam em `eventos_privados`;
   - a data de nascimento fica em `perfis_privados`, e a interface mostra só "18+" ou "menor de 18";
   - comprovantes ficam no bucket **privado** e são servidos por URL assinada de curta duração;
   - colete o mínimo de dados.
7. **Rate limit** nas RPCs de pedido de entrada e de check-in.
8. **O app não segura dinheiro** (Fase A). Pagamento só passa pela interface `PaymentProvider`.

## Código

- TypeScript strict. **Proibido `any`.** `// @ts-ignore` / `@ts-expect-error` só com comentário justificando.
- **Domínio em português sem acento:** tabelas e colunas em `snake_case` (`eventos`, `preco_centavos`), TS em `camelCase`
  (`pedirEntrada`). Termos de framework ficam como são.
- **Dinheiro:** sempre `integer` em centavos (`*_centavos`). Formate só na borda com `formatarReais()`. Nada de `float` para
  dinheiro.
- **Datas:** `timestamptz` no banco, exibidas em `America/Sao_Paulo` com `Intl` (`src/lib/datas/`). A idade é calculada na data
  de início do rolê.
- **Lógica de negócio em funções puras e testadas:** Pix/BR Code, calculadora, idade, transições e tokens de check-in.
- **Server Components por padrão.** Use `"use client"` só onde há interação. A página `/r/[codigo]` deve carregar o mínimo de JS
  possível (meta: Lighthouse mobile ≥ 90).
- **Textos da interface só em `src/copy/pt-BR.ts`.** Nada de string de UI solta em componente. `[NOME_DO_APP]` e
  `[NOME_DO_MASCOTE]` vêm de `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_MASCOTE_NOME`.
- **Imagens do mascote** em `public/mascote/*.png` (placeholders), sempre via o componente `<Mascote />`.

## Voz e UX

- pt-BR informal, bem-humorado e direto, com gírias leves de SP ("rolê", "resenha", "bora", "tá pago"). **Nunca** infantil, nunca
  cringe e nunca incentivando beber em excesso. Sempre listar opções sem álcool junto.
- Mobile-first (390 px), tema escuro como padrão, tokens de design só em `src/styles/globals.css`.
- Acessibilidade: contraste AA, alvos de toque ≥ 44 px, `label` em todo campo, foco visível.
- Estados vazio, de carregamento e de erro sempre com a voz do mascote.
- Criar um rolê em **< 60 s**: passos curtos e valores padrão inteligentes.

## Testes (o que importa)

Regras de idade/álcool · payload Pix (CRC16 e exemplos conhecidos) · calculadora · RLS (um usuário não lê endereço,
comprovante nem lista de outro rolê) · transições de status da participação · fluxos E2E críticos (criar rolê → convidado
entra e paga → check-in).

## Git

- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`), commits pequenos.
- Antes de dizer que uma fase está pronta, `pnpm check` e `pnpm test:db` precisam passar.
- Nunca commitar `.env*` (exceto `.env.example`).
