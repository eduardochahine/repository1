// ============================================================
// BRIEFING CURADO — análise das notícias que importam para o seu
// perfil. impacto por classe: -2 (muito negativo) … +2 (muito positivo)
// ============================================================
window.BRIEFING = {
  data: "2026-11-01",
  titulo: "Semana pós-eleição: o mercado precificou o pior cenário fiscal",
  resumo:
    "A reeleição de Lula provocou a maior realização de risco no Brasil desde 2020: bolsa com circuit breaker, " +
    "dólar com a maior alta semanal desde 2008 e juros reais do Tesouro acima de 7,6%. Lá fora, o Fed segue " +
    "inclinado a subir juros, e o maior hack cripto da história derrubou o Bitcoin. Para quem pensa em longo prazo e renda, " +
    "esse estresse abriu preços que historicamente pagam bem a quem compra com paciência e disciplina.",

  termometro: [
    { k: "Ibovespa", v: "167.922", d: "-9,88% em out", t: "neg" },
    { k: "Dólar", v: "R$ 5,45", d: "+9% na semana", t: "neg" },
    { k: "Selic", v: "13,75%", d: "Copom 4/11", t: "neu" },
    { k: "IPCA+ 2032", v: "IPCA + 8,10%", d: "era 6,72%", t: "opp" },
    { k: "IFIX", v: "3.632", d: "-3,27% em out", t: "neg" },
    { k: "S&P 500", v: "7.580", d: "3ª semana em queda", t: "neg" },
    { k: "Bitcoin", v: "~US$ 76 mil", d: "mínima em 6 semanas", t: "neg" },
    { k: "Fed Funds", v: "3,75–4,00%", d: "82% chance de alta em dez", t: "neg" }
  ],

  noticias: [
    {
      id: "ipca-8",
      titulo: "Tesouro IPCA+ dispara: todos os títulos pagam mais de IPCA + 7,6%",
      fonte: "InfoMoney / BP Money",
      url: "https://www.infomoney.com.br/onde-investir/tesouro-ipca-tem-a-segunda-maior-alta-da-serie-historica-apos-vitoria-de-lula/",
      data: "2026-10-26",
      prioridade: 5,
      tags: ["Renda fixa", "Juros"],
      fato:
        "O IPCA+ 2032 saiu de 6,72% para 8,10% de juro real num único dia, a 2ª maior alta da série (só perde para mar/2020). " +
        "O IPCA+ 2050 caiu ~23,6% no preço de mercado. O DI jan/31 chegou a 15,94%.",
      impacto: { ipca: -1, caixinha: 0, acoes_br: -1, fiis: -1 },
      leitura:
        "Seu IPCA+ 2029 sofreu marcação a mercado negativa, mas bem menos que os títulos longos, porque vence em pouco mais de 2 anos. " +
        "Se você levar até o vencimento, recebe exatamente a taxa contratada: a perda é só no papel. Vender agora seria realizar prejuízo.",
      oportunidade: {
        nivel: "alta",
        texto:
          "Juro real de ~8% é raro, já que historicamente a média fica entre 5% e 6%. Para o seu objetivo de renda de longo prazo, " +
          "o Tesouro IPCA+ com Juros Semestrais (2035/2040) trava renda real acima da inflação e paga cupons a cada 6 meses. " +
          "Estratégia: aportes escalonados em 2–3 parcelas, porque a taxa ainda pode subir se o fiscal decepcionar."
      }
    },
    {
      id: "ibov-cb",
      titulo: "Ibovespa despenca 13,88% no dia seguinte ao 2º turno e aciona circuit breaker",
      fonte: "Trading Economics / Investir",
      url: "https://tradingeconomics.com/brazil/stock-market",
      data: "2026-10-26",
      prioridade: 5,
      tags: ["Ações BR", "Política"],
      fato:
        "Com a vitória de Lula sobre Flávio Bolsonaro (o mercado apostava no contrário), o índice caiu 13,88% em 26/10 e acionou " +
        "o primeiro circuit breaker desde março/2020. Outubro fechou em -9,88%, o pior mês desde jun/2022, aos 167.922 pontos.",
      impacto: { acoes_br: -2, fiis: -1 },
      leitura:
        "A queda foi indiscriminada: boas e más empresas caíram juntas. Estatais embutem agora mais risco de interferência " +
        "(dividendos, preços, investimentos). Já exportadoras, que faturam em dólar, foram parcialmente protegidas pelo câmbio.",
      oportunidade: {
        nivel: "alta",
        texto:
          "Para um investidor arrojado de longo prazo, quedas de pânico como essa costumam ser pontos de entrada. Foco em renda: " +
          "bancos privados, elétricas/transmissoras com receita indexada à inflação e exportadoras (papel e celulose, mineração, proteínas) " +
          "agora com dividend yield maior. Evite aumentar a concentração em estatais até haver sinais concretos de governança."
      }
    },
    {
      id: "copom",
      titulo: "Copom decide a Selic na quarta (4/11): mercado já vê 63% de chance de pausa em 13,75%",
      fonte: "Valor Investe / opções de Copom B3",
      url: "https://investirecocaresocomecar.com.br/selic-copom-novembro-pausa-cortes/",
      data: "2026-11-01",
      prioridade: 4,
      tags: ["Juros", "Agenda"],
      fato:
        "Antes da eleição, o Focus via um corte para 13,25% até dezembro. Com o dólar e a inflação projetada em 5,22% (acima do teto), " +
        "a aposta virou: 63% de manutenção e só 4% de corte de 0,50 p.p.",
      impacto: { caixinha: 1, ipca: 0, acoes_br: -1, fiis: -1 },
      leitura:
        "Selic alta por mais tempo é bom para a sua Caixinha Nubank (rende ~CDI) e ruim para bolsa e FIIs de tijolo, que dependem de juros caindo. " +
        "Um comunicado duro (hawkish) pode até ajudar a ancorar o câmbio.",
      oportunidade: {
        nivel: "media",
        texto:
          "Use a Caixinha como munição: ela rende bem enquanto você espera e tem liquidez imediata para aproveitar quedas em ações, FIIs ou IPCA+. " +
          "Se o Copom surpreender com um corte, espere mais pressão no dólar."
      }
    },
    {
      id: "dolar",
      titulo: "Dólar sobe 9% na semana, maior alta desde 2008, e fecha a R$ 5,45",
      fonte: "SpaceMoney / TMC",
      url: "https://www.spacemoney.com.br/economia/dolar-hoje/dolar-fecha-maior-nivel-2026-alta-semanal/",
      data: "2026-10-30",
      prioridade: 4,
      tags: ["Câmbio", "Exterior"],
      fato:
        "A PTAX saltou de R$ 5,04 (23/10) para R$ 5,33 (27/10), e o dólar fechou sexta a R$ 5,446, máxima de 2026. " +
        "O Goldman vê uma faixa de R$ 4,50 a R$ 5,80, dependendo do fiscal.",
      impacto: { exterior: 2, cripto: 1, acoes_br: -1 },
      leitura:
        "Seus investimentos no exterior funcionaram como seguro: em reais, compensaram parte da queda local. É o papel da diversificação internacional.",
      oportunidade: {
        nivel: "baixa",
        texto:
          "Não persiga o dólar depois de uma alta de 9%. Mantenha aportes mensais regulares no exterior (preço médio) e, se o fiscal surpreender " +
          "positivamente e o dólar recuar para R$ 5,00–5,10, acelere as remessas. Rebalanceie se o exterior passar do seu percentual-alvo."
      }
    },
    {
      id: "ifix",
      titulo: "FIIs chegam a cair 17% após o 2º turno; IFIX devolve o rali e fecha outubro em -3,27%",
      fonte: "BP Money / InfoMoney",
      url: "https://bpmoney.com.br/mercado/fundos/fiis-caem-17-ifix-perde-8-apos-segundo-turno/",
      data: "2026-10-30",
      prioridade: 4,
      tags: ["FIIs", "Renda"],
      fato:
        "O IFIX estava na máxima de 52 semanas (3.990 pts) em 23/10 e terminou o mês em 3.632 pts, com 5 pregões seguidos de queda.",
      impacto: { fiis: -2 },
      leitura:
        "Juros longos mais altos derrubam o preço dos FIIs de tijolo (lajes, shoppings, logística). FIIs de papel atrelados a IPCA/CDI " +
        "sofrem menos e tendem a distribuir mais com inflação alta, mas atenção ao risco de crédito dos CRIs.",
      oportunidade: {
        nivel: "alta",
        texto:
          "Para renda passiva, é um momento de comprar renda mais barata: FIIs de tijolo de qualidade negociando bem abaixo do valor patrimonial (P/VP < 0,85) " +
          "e com contratos atípicos/longos. Combine com papel high grade. Compre em parcelas: a pressão persiste enquanto o DI longo não ceder."
      }
    },
    {
      id: "fed",
      titulo: "Fed mantém juros em 3,75–4,00%, mas 2 diretores votam por alta; mercado vê 82% de chance de alta em dezembro",
      fonte: "CNBC / CNN",
      url: "https://www.cnbc.com/2026/10/28/fed-interest-rate-decision-october-2026.html",
      data: "2026-10-28",
      prioridade: 3,
      tags: ["EUA", "Juros"],
      fato:
        "Decisão 10–2 com Lisa Cook e Beth Hammack pedindo alta. O presidente Kevin Warsh negou influência política. " +
        "O Fed subiu juros em setembro, e a próxima reunião é em 8–9/dez.",
      impacto: { exterior: -1, cripto: -1, acoes_br: -1 },
      leitura:
        "Um ciclo de alta nos EUA fortalece o dólar globalmente, pressiona ações de crescimento (tech) e cripto, e drena fluxo de emergentes como o Brasil.",
      oportunidade: {
        nivel: "media",
        texto:
          "Treasuries de curto prazo e ETFs de dividendos americanos (estilo SCHD/VYM) ficam mais atrativos para o seu objetivo de renda em dólar. " +
          "Payroll de 6/11 é o próximo gatilho: dado fraco reduz a chance de alta."
      }
    },
    {
      id: "nasdaq",
      titulo: "Nasdaq cai 2,9% na sexta; Intel desaba 30% e S&P 500 tem 3ª semana seguida de queda",
      fonte: "TheStreet / AP / FactSet",
      url: "https://www.thestreet.com/stock-market-today/stock-market-today-dow-jones-sp-500-nasdaq-updates-oct-30-2026",
      data: "2026-10-30",
      prioridade: 3,
      tags: ["EUA", "Tech", "Balanços"],
      fato:
        "O S&P 500 fechou a 7.580 (-1,82%) e o Nasdaq a 25.437 (-2,86%). A Intel caiu 30% com PCs fracos, e cresce o temor de euforia excessiva com IA. " +
        "Mesmo assim, o lucro do S&P no 3T cresce 30,2% (FactSet), e 140 empresas reportam nesta semana.",
      impacto: { exterior: -1 },
      leitura:
        "É uma correção de valuation, não de lucros: os resultados agregados seguem fortes. Em reais, a alta do dólar neutralizou boa parte da queda.",
      oportunidade: {
        nivel: "media",
        texto:
          "Se a correção se aprofundar (S&P -10% do topo), aumente aportes em ETF amplo (VOO/VTI) em vez de apostar em ações individuais de IA. " +
          "Evite 'pegar faca caindo' em casos como a Intel antes de ver estabilização."
      }
    },
    {
      id: "binance",
      titulo: "Binance sofre hack de US$ 6,3 bilhões, o maior da história; FBI atribui à Coreia do Norte",
      fonte: "CNBC / TRM Labs / NPR",
      url: "https://www.cnbc.com/2026/10/30/billions-in-crypto-frozen-in-binance-hack-heres-what-happens-next-.html",
      data: "2026-10-31",
      prioridade: 4,
      tags: ["Cripto", "Risco de custódia"],
      fato:
        "Cerca de US$ 6,36 bi saíram das carteiras em ~20 minutos, em 10 blockchains. A Binance suspendeu saques e diz que cobrirá as perdas. " +
        "Tether e Circle congelaram parte dos fundos. O BTC caiu para ~US$ 76 mil, mínima em 6 semanas.",
      impacto: { cripto: -2 },
      leitura:
        "É um risco de custódia, não um defeito do Bitcoin ou do Ethereum. Mas o choque de confiança se soma ao Fed restritivo. " +
        "Se você mantém cripto em corretora, esse é o lembrete mais caro possível.",
      oportunidade: {
        nivel: "media",
        texto:
          "Primeiro, ação defensiva: tire o que é de longo prazo da corretora e passe para autocustódia (hardware wallet). " +
          "Depois, para um arrojado de longo prazo, quedas por evento de custódia historicamente são boas para compras programadas (DCA) de BTC. " +
          "Mantenha cripto em no máximo 5–10% da carteira."
      }
    },
    {
      id: "fiscal",
      titulo: "Fazenda prepara pacote de corte de gastos para 2027; novo ministro sai até o fim do ano",
      fonte: "Diário ESP / A Crítica",
      url: "https://diarioesp.com.br/brasil/2026/11/01/fazenda-prepara-pacote-de-corte-de-gastos-para-2027-e-mira-supersalarios-do-funcionalismo.html",
      data: "2026-11-01",
      prioridade: 5,
      tags: ["Fiscal", "Catalisador"],
      fato:
        "Durigan estuda mirar supersalários, perseguir o centro da meta e até endurecer o arcabouço (teto real de gasto de 2,5% para 1,5–2,0%). " +
        "Ao mesmo tempo, promessas de campanha (Bolsa Família +R$ 22 bi etc.) exigem ~R$ 20 bi de remanejamento. Cotados para a Fazenda: Fonteles, Durigan, Moretti e Alckmin.",
      impacto: { acoes_br: 1, fiis: 1, ipca: 1 },
      leitura:
        "É o principal catalisador dos próximos 60 dias. O mercado já precificou um cenário fiscal ruim. Um ministro e um pacote críveis " +
        "podem gerar uma reversão forte em juros, bolsa, FIIs e câmbio. Um nome visto como gastador aprofunda a queda.",
      oportunidade: {
        nivel: "alta",
        texto:
          "Assimetria: com os preços já deprimidos, a boa notícia não está no preço. Por isso faz sentido montar posição gradual " +
          "em IPCA+ longo, FIIs e ações de qualidade antes da definição, mantendo caixa na Caixinha para dobrar a aposta se vier um sinal positivo."
      }
    }
  ],

  agenda: [
    { dia: "Seg 2/11", evento: "Feriado de Finados: B3 fechada" },
    { dia: "Seg 2/11", evento: "Boletim Focus (expectativas de Selic, IPCA e câmbio)" },
    { dia: "Qua 4/11", evento: "Decisão do Copom (Selic 13,75%, 63% de chance de pausa)", destaque: true },
    { dia: "Semana", evento: "140 empresas do S&P 500 divulgam resultados do 3T" },
    { dia: "Sex 6/11", evento: "Payroll EUA (último: +29 mil vagas, desemprego 4,2%)", destaque: true },
    { dia: "Até dez", evento: "Anúncio do ministro da Fazenda do 4º mandato", destaque: true },
    { dia: "8–9/12", evento: "Próximas reuniões do Fed e do Copom" }
  ],

  plano: [
    "Não venda o Tesouro IPCA+ 2029 com prejuízo: leve até o vencimento.",
    "Mantenha a Caixinha Nubank como caixa de oportunidade, rendendo ~CDI a 13,75%.",
    "Escalone aportes (3 parcelas em ~6 semanas) em IPCA+ com juros semestrais, FIIs descontados e ações pagadoras de dividendos.",
    "Exterior: siga os aportes mensais e não persiga o dólar a R$ 5,45.",
    "Cripto: faça a autocustódia primeiro e só depois retome o DCA. Respeite o limite de 5–10% da carteira.",
    "Gatilhos para acelerar: ministro da Fazenda crível, pacote fiscal aprovado ou dólar abaixo de R$ 5,10."
  ]
};
