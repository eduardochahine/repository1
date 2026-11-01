# 📡 Radar de Notícias do Investidor

Painel pessoal que filtra as notícias do mercado pelo **seu perfil**, mostra o impacto em cada classe
de ativo que você tem e destaca oportunidades.

## Como usar
1. Abra `radar/index.html` no navegador (funciona offline, sem servidor).
2. Edite `radar/dados/perfil.js` para ajustar perfil, pesos das classes e **seus tickers**.
   Notícias que citam seus tickers sobem para o topo.
3. (Opcional) Rode o coletor automático, que busca manchetes em InfoMoney, Money Times, Seu Dinheiro,
   Brazil Journal, CoinDesk e CNBC e as classifica pelo seu perfil:
   ```bash
   python3 radar/radar.py          # gera radar/dados/noticias-auto.js
   ```
   Depois, recarregue a página. Não precisa instalar nada (Python 3.8+, só a biblioteca padrão).

## Arquivos
| Arquivo | O que é |
|---|---|
| `dados/perfil.js` | Seu perfil: risco, objetivo, classes, exclusões e tickers |
| `dados/briefing.js` | Briefing curado com fato, impacto, leitura e oportunidade de cada notícia |
| `radar.py` | Coletor RSS com regras de impacto por classe |
| `index.html` | O painel |

> Conteúdo informativo, não é recomendação individual de investimento.
