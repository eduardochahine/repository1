# ROADMAP

Fica **fora** do MVP. As ideias anotadas aqui não devem ser implementadas sem uma decisão explícita.

## Fase B de pagamentos: Pix dinâmico via PSP

- Integrar um PSP (ex.: **Asaas** ou **Mercado Pago**) como nova implementação de `PaymentProvider`
  (`src/lib/pagamentos/`), sem mudar as telas.
- Pix dinâmico (cobrança com vencimento) + **webhook** que confirma o pagamento sozinho (`pago_confirmado_por = 'sistema'`).
- **Split**: o repasse para o anfitrião e a taxa do app.
- Pontos a resolver antes:
  - KYC do anfitrião (subconta no PSP);
  - reembolso e cancelamento;
  - o contrato e o enquadramento regulatório de intermediação;
  - nota fiscal da taxa;
  - idempotência e assinatura do webhook.
- Hoje existe um `TODO(fase-b)` documentado na interface.

## Produto

- App nativo (iOS/Android).
- Chat interno do rolê.
- Feed social / "onde meus amigos vão".
- Marketplace de fornecedores (adegas, DJs, espaços).
- Plano pago para produtores.
- Revenda/transferência de ingressos.
- Verificação de documento (idade real, antifraude).
- Multi-idioma.

## Evoluções técnicas adiadas

- **OTP por SMS / telefone**: precisa de um provedor pago (Twilio/Vonage). A arquitetura já comporta.
- Envio automático de WhatsApp/SMS. No MVP só existem links `wa.me` prontos.
- Notificações push (Web Push no PWA).
- **Cancelamento automático** de quem estourou o prazo de pagamento (via `pg_cron`). No MVP, o anfitrião libera manualmente.
- Check-in 100% offline com validação local do QR e sincronização com resolução de conflitos entre vários aparelhos.
- Opção "não mostrar minha foto na lista pública".
- Exportação dos dados do usuário (portabilidade LGPD). No MVP: exclusão.
- Rate limit em Redis/Upstash, se o volume justificar.
- Expansão para além da zona sul / outras cidades (o campo de cidade do recebedor Pix já existe).
- Analytics do loop viral (convite → cadastro → novo rolê criado), com consentimento.
