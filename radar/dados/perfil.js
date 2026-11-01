// ============================================================
// SEU PERFIL DE INVESTIDOR — edite aqui. O radar inteiro se
// adapta a este arquivo (relevância, impacto e oportunidades).
// ============================================================
window.PERFIL = {
  nome: "Eduardo",
  risco: "Arrojado",
  horizonte: "Longo prazo",
  objetivo: "Construir patrimônio e renda passiva (dividendos e juros)",

  // Classes em que você investe. peso = importância relativa no radar (1–5).
  classes: {
    acoes_br:  { nome: "Ações Brasil",        peso: 5, investe: true },
    fiis:      { nome: "Fundos Imobiliários", peso: 5, investe: true },
    ipca:      { nome: "Tesouro IPCA+ 2029",  peso: 4, investe: true },
    caixinha:  { nome: "Caixinha Nubank (RDB/CDI)", peso: 3, investe: true },
    exterior:  { nome: "Exterior (ações/ETFs EUA + dólar)", peso: 4, investe: true },
    cripto:    { nome: "Cripto (BTC/ETH direto)", peso: 4, investe: true }
  },

  // O que você NÃO usa — o radar não sugere esses veículos.
  exclui: ["CDB", "LCI", "LCA", "Debêntures", "BDRs", "ETFs de cripto"],

  // Seus ativos. Preencha quando quiser (ex: "PETR4", "ITUB4", "MXRF11",
  // "VOO", "BTC"). Notícias que citam esses tickers ganham prioridade máxima.
  tickers: []
};
