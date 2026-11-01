#!/usr/bin/env python3
"""
Radar de Notícias do Investidor: coletor automático.

Busca manchetes em feeds RSS de finanças, filtra o que importa para o seu
perfil (dados/perfil.js), estima o impacto em cada classe de ativo, sinaliza
oportunidades e grava dados/noticias-auto.js, que o index.html exibe.

Uso:
    python3 radar/radar.py                  # busca os feeds online
    python3 radar/radar.py --arquivo x.xml  # testa com um RSS local
    python3 radar/radar.py --min 4          # nota mínima de relevância

Só usa a biblioteca padrão do Python 3.8+.
"""
import argparse
import email.utils
import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
PERFIL_JS = BASE / "dados" / "perfil.js"
SAIDA_JS = BASE / "dados" / "noticias-auto.js"

FEEDS = {
    "InfoMoney": "https://www.infomoney.com.br/feed/",
    "Money Times": "https://www.moneytimes.com.br/feed/",
    "Seu Dinheiro": "https://www.seudinheiro.com/feed/",
    "Brazil Journal": "https://braziljournal.com/feed/",
    "CoinDesk": "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "CNBC Markets": "https://www.cnbc.com/id/10000664/device/rss/rss.html",
}

# ----------------------------------------------------------------------
# Regras: padrão (regex, sem acento-sensível) -> impacto por classe,
# leitura para o seu perfil e oportunidade (se houver).
# impacto: -2..+2 | classes: acoes_br fiis ipca caixinha exterior cripto
# ----------------------------------------------------------------------
REGRAS = [
    # Juros Brasil
    (r"selic.*(corte|reduz|cai)|corta.*selic|copom.*(corte|reduz)",
     {"acoes_br": 1, "fiis": 2, "ipca": 1, "caixinha": -1},
     "Juros caindo valorizam FIIs, ações e títulos IPCA+ (marcação positiva); a Caixinha passa a render menos.",
     "Ciclo de corte favorece FIIs de tijolo e ações de dividendos"),
    (r"selic.*(alta|elev|sobe|aument)|copom.*(alta|eleva)|eleva.*selic",
     {"acoes_br": -1, "fiis": -2, "ipca": -1, "caixinha": 1},
     "Selic subindo pressiona bolsa e FIIs; a Caixinha (CDI) rende mais.",
     None),
    (r"selic.*(mant|estável|pausa)|copom.*(mant|pausa)",
     {"caixinha": 1, "fiis": -1},
     "Selic alta por mais tempo: bom para a Caixinha, adia a recuperação dos FIIs de tijolo.",
     None),
    (r"focus|expectativa.*infla|ipca.*(acima|sobe|alta|acelera)|infla[çc][ãa]o.*(sobe|alta|acelera)",
     {"ipca": 1, "fiis": -1, "acoes_br": -1},
     "Inflação mais alta corrige seus títulos IPCA+ e FIIs de papel, mas afasta cortes de juros.",
     None),
    (r"tesouro (ipca|direto)|juros reais|ntn-b|taxa.*tesouro",
     {"ipca": -1},
     "Taxas do Tesouro mexem com a marcação do seu IPCA+ 2029. Levando até o vencimento, você recebe a taxa contratada.",
     "Juros reais altos: avalie travar taxa em IPCA+ com juros semestrais"),
    (r"juros futuros|curva de juros|\bdi\b.*(sobe|dispara|avan)",
     {"ipca": -1, "fiis": -1, "acoes_br": -1},
     "Juros futuros em alta derrubam ativos de duration longa (IPCA+, FIIs de tijolo).",
     None),
    # Fiscal / política
    (r"arcabou[çc]o|fiscal|d[ée]ficit|gastos|ministro da fazenda|or[çc]amento|meta fiscal",
     {"acoes_br": 0, "fiis": 0, "ipca": 0, "exterior": 0},
     "O fiscal é o principal driver de juros e câmbio agora. Sinais críveis de ajuste aliviam tudo; sinais de gasto pioram.",
     "Catalisador fiscal: ativos brasileiros descontados"),
    (r"interfer[êe]ncia|estatal|petrobras.*(governo|pol[íi]tica|pre[çc]o)",
     {"acoes_br": -1},
     "Risco político em estatais: atenção à governança e à política de dividendos.",
     None),
    # Câmbio
    (r"d[óo]lar.*(sobe|dispara|alta|avan|recorde|m[áa]xima)",
     {"exterior": 2, "acoes_br": -1},
     "Dólar em alta valoriza em reais seus ativos no exterior e pesa sobre a bolsa local.",
     None),
    (r"d[óo]lar.*(cai|recua|queda|baixa|m[íi]nima)",
     {"exterior": -1, "acoes_br": 1},
     "Dólar em queda: bom para a bolsa local e uma janela melhor para remeter recursos ao exterior.",
     "Câmbio mais barato para aportar no exterior"),
    # Bolsa Brasil
    (r"ibovespa.*(cai|despenca|queda|recua|tomba|derrete)|circuit breaker",
     {"acoes_br": -2},
     "Queda ampla da bolsa: ações boas caem junto com as ruins.",
     "Queda ampla: ações de qualidade pagadoras de dividendos mais baratas"),
    (r"ibovespa.*(sobe|dispara|alta|avan|recorde)",
     {"acoes_br": 1},
     "Bolsa em alta melhora o patrimônio. Evite comprar no impulso após fortes altas.",
     None),
    (r"dividendo|proventos|jcp|juros sobre capital|dividend yield",
     {"acoes_br": 1},
     "Notícia de proventos: alinhada ao seu objetivo de renda passiva.",
     "Renda: confira o yield e a data com"),
    (r"balan[çc]o|lucro.*trimestre|resultado.*(3t|4t|trimestre)",
     {"acoes_br": 1},
     "Temporada de balanços: confira se as empresas que você tem entregaram lucro e caixa.",
     None),
    # FIIs
    (r"\bfii|fundos? imobili[áa]rio|ifix",
     {"fiis": 1},
     "Notícia de FIIs: avalie P/VP, vacância e dividend yield antes de agir.",
     "FIIs com desconto sobre o valor patrimonial"),
    # EUA
    (r"\bfed\b|fomc|powell|warsh|federal reserve",
     {"exterior": -1, "cripto": -1},
     "A política do Fed define o dólar global e o apetite por risco (tech e cripto).",
     None),
    (r"rate (hike|increase)|raises rates|hawkish",
     {"exterior": -1, "cripto": -2, "acoes_br": -1},
     "Juros americanos subindo: pressão em ações de crescimento, cripto e emergentes.",
     None),
    (r"rate cut|cuts rates|dovish",
     {"exterior": 1, "cripto": 2, "acoes_br": 1},
     "Juros americanos caindo: favorece risco global, inclusive cripto e emergentes.",
     None),
    (r"s&p 500|nasdaq|dow jones|wall street|stocks? (fall|drop|slide|tumble|sink)|sell-?off",
     {"exterior": -1},
     "Movimento das bolsas americanas impacta diretamente seus ETFs e ações nos EUA.",
     "Correção nos EUA: aportes graduais em ETF amplo"),
    (r"stocks? (rise|rally|gain|jump|soar)|record high",
     {"exterior": 1},
     "Bolsas americanas em alta valorizam sua carteira internacional.",
     None),
    (r"payroll|jobs report|nonfarm|unemployment|cpi|inflation",
     {"exterior": -1, "cripto": -1},
     "Dados de emprego e inflação dos EUA movem as apostas sobre o Fed.",
     None),
    # Cripto
    (r"bitcoin|\bbtc\b|ethereum|\beth\b|cripto|crypto",
     {"cripto": 1},
     "Notícia de cripto relevante para sua posição direta em BTC/ETH.",
     None),
    (r"hack|exploit|stolen|roubo|ataque hacker|exchange.*(halt|suspend|paus)",
     {"cripto": -2},
     "Risco de custódia: priorize autocustódia (hardware wallet) para o longo prazo.",
     "Quedas por evento de custódia: oportunidade de DCA em BTC"),
    (r"(bitcoin|btc|crypto).*(fall|drop|plunge|slide|low|cai|despenca)",
     {"cripto": -1},
     "Cripto em queda: avalie compras programadas dentro do seu limite de alocação.",
     "Cripto com desconto: DCA disciplinado"),
    (r"(bitcoin|btc|crypto).*(rise|surge|rally|record|sobe|dispara)",
     {"cripto": 1},
     "Cripto em alta: rebalanceie se passar do seu percentual-alvo.",
     None),
    (r"\betf\b.*(bitcoin|crypto)|halving|sec.*crypto|regula[çc][ãa]o.*cripto",
     {"cripto": 1},
     "Fluxo institucional e regulação definem a tendência de longo prazo do BTC/ETH.",
     None),
    # Commodities (afetam ações BR exportadoras)
    (r"petr[óo]leo|brent|oil price|opep|opec|min[ée]rio|iron ore|commodit",
     {"acoes_br": 1},
     "Commodities mexem com Petrobras, Vale e exportadoras, e com o câmbio.",
     None),
]

def normaliza(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", " ", s or "")).strip()

def carregar_perfil():
    txt = PERFIL_JS.read_text(encoding="utf-8")
    pesos = {k: int(p) for k, p, inv in re.findall(r"(\w+):\s*\{[^}]*peso:\s*(\d)[^}]*investe:\s*(true)", txt)}
    m = re.search(r"tickers:\s*\[([^\]]*)\]", txt)
    tickers = [t.strip().upper() for t in re.findall(r'"([^"]+)"', m.group(1))] if m else []
    return pesos, tickers

def baixar(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 RadarInvestidor/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()

def parse_feed(xml_bytes: bytes, fonte: str):
    itens = []
    root = ET.fromstring(xml_bytes)
    ns = {"a": "http://www.w3.org/2005/Atom"}
    for it in root.iter("item"):
        itens.append({
            "fonte": fonte,
            "titulo": normaliza(it.findtext("title")),
            "resumo": normaliza(it.findtext("description"))[:400],
            "url": (it.findtext("link") or "").strip(),
            "data_raw": it.findtext("pubDate") or "",
        })
    for it in root.findall("a:entry", ns):
        link = it.find("a:link", ns)
        itens.append({
            "fonte": fonte,
            "titulo": normaliza(it.findtext("a:title", namespaces=ns)),
            "resumo": normaliza(it.findtext("a:summary", namespaces=ns))[:400],
            "url": link.get("href") if link is not None else "",
            "data_raw": it.findtext("a:updated", namespaces=ns) or "",
        })
    return itens

def fmt_data(raw: str) -> str:
    try:
        d = email.utils.parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return raw[:16]
    return d.astimezone().strftime("%d/%m %H:%M")

def classificar(n, pesos, tickers):
    texto = f"{n['titulo']} {n['resumo']}"
    baixo = texto.lower()
    impacto, leituras, opps = {}, [], []
    for padrao, imp, leitura, opp in REGRAS:
        if re.search(padrao, baixo):
            for c, v in imp.items():
                impacto[c] = max(-2, min(2, impacto.get(c, 0) + v))
            leituras.append(leitura)
            if opp:
                opps.append(opp)
    impacto = {c: v for c, v in impacto.items() if c in pesos}
    hits = [t for t in tickers if re.search(rf"\b{re.escape(t)}\b", texto.upper())]
    score = sum(max(abs(v), 1) * pesos[c] for c, v in impacto.items()) + 25 * len(hits)
    return {
        **{k: n[k] for k in ("fonte", "titulo", "url")},
        "data": fmt_data(n["data_raw"]),
        "impacto": impacto,
        "leitura": " ".join(dict.fromkeys(leituras[:2])),
        "oportunidade": opps[0] if opps else None,
        "tickers": hits,
        "score": score,
    }

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--arquivo", action="append", help="RSS local para teste (pode repetir)")
    ap.add_argument("--min", type=int, default=4, help="relevância mínima (padrão 4)")
    args = ap.parse_args()

    pesos, tickers = carregar_perfil()
    brutos = []
    fontes = {f"arquivo:{Path(a).name}": a for a in args.arquivo} if args.arquivo else FEEDS
    for nome, origem in fontes.items():
        try:
            dados = Path(origem).read_bytes() if args.arquivo else baixar(origem)
            itens = parse_feed(dados, nome)
            brutos += itens
            print(f"  ✓ {nome}: {len(itens)} itens")
        except Exception as e:  # um feed fora do ar não derruba os outros
            print(f"  ✗ {nome}: {e}", file=sys.stderr)

    vistos, saida = set(), []
    for n in brutos:
        chave = n["titulo"].lower()[:80]
        if not n["titulo"] or chave in vistos:
            continue
        vistos.add(chave)
        c = classificar(n, pesos, tickers)
        if c["score"] >= args.min or c["tickers"]:
            saida.append(c)
    saida.sort(key=lambda x: x["score"], reverse=True)

    payload = {"gerado_em": datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y %H:%M"), "itens": saida}
    SAIDA_JS.write_text("window.NOTICIAS_AUTO = " + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    print(f"\n{len(saida)} notícias relevantes de {len(brutos)} coletadas → {SAIDA_JS.relative_to(BASE.parent)}")
    for n in saida[:10]:
        print(f"  [{n['score']:>3}] {n['titulo'][:95]}")

if __name__ == "__main__":
    main()
