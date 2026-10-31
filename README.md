# Conciliação Contábil

Sistema web para **conciliação bancária e contábil**: confronta o extrato bancário com o razão da conta contábil,
concilia automaticamente, trata pendências e emite o relatório de conciliação pronto para assinatura.

Roda inteiramente no navegador, sem servidor, sem instalação e sem cadastro. Os dados **não saem do seu computador**.

## Como usar

**Opção 1 — no seu computador:** baixe o repositório (botão *Code → Download ZIP*), descompacte e abra o arquivo
`index.html` no Chrome, Edge ou Firefox.

**Opção 2 — online (GitHub Pages):** no GitHub, vá em *Settings → Pages*, escolha *Deploy from a branch*,
branch `master`, pasta `/ (root)` e salve. Em ~1 minuto o sistema estará disponível em
`https://<seu-usuario>.github.io/repository1/`.

## Passo a passo

1. **Nova conciliação** — informe empresa, banco/conta, conta contábil, período e saldos iniciais
   (saldos finais são opcionais; se não forem informados, o sistema calcula).
2. **Importar** o extrato bancário e o razão contábil:
   - **OFX** (recomendado para o extrato — todos os bancos oferecem no internet banking);
   - **CSV / TXT** delimitado (`;` `,` tabulação ou `|`), em UTF-8 ou Windows-1252;
   - **XLSX** (Excel);
   - **colar direto do Excel** ou do sistema contábil.

   O sistema detecta cabeçalho, separador, colunas de data/histórico/documento/valor e formatos
   (`1.234,56`, `1,234.56`, `(1.234,56)`, `1.234,56-`, `1.234,56 D/C`). Também aceita colunas de Débito/Crédito separadas
   ou valor + coluna D/C. Linhas de saldo e totais são ignoradas, e reimportar o mesmo arquivo não duplica lançamentos.
3. **Conciliação automática** — casa lançamentos de mesmo valor dentro de uma tolerância de dias, priorizando
   número de documento, proximidade de data e semelhança do histórico. Também encontra combinações
   (1 lançamento = soma de 2 a 5 do outro lado, ex.: um depósito que corresponde a vários recebimentos).
4. **Conciliação manual** — selecione itens dos dois lados; o sistema mostra as somas, a diferença e destaca
   em amarelo os lançamentos com o mesmo valor. É possível conciliar com diferença (com observação obrigatória).
5. **Pendências** — justifique o que fica em aberto (cheque não compensado, depósito em trânsito, tarifa a
   contabilizar etc.) ou registre lançamentos manuais.
6. **Relatório** — demonstrativo da conciliação, pendências de cada lado, diferenças aceitas e campos de
   assinatura. Imprima ou salve em PDF; exporte pendências/conciliações em CSV (abre no Excel).
7. **Próximo período** — cria a conciliação do mês seguinte com os saldos finais como iniciais e transporta as
   pendências em aberto.

## Convenção de sinais

| Origem | Positivo (+) | Negativo (−) |
|---|---|---|
| Extrato bancário | Entradas (créditos no extrato) | Saídas (débitos no extrato) |
| Razão contábil (conta do banco, no ativo) | Débitos (entradas) | Créditos (saídas) |

Se o seu arquivo vier com sinais trocados (ex.: conta de passivo), marque **Inverter sinal** na importação.

## Demonstrativo

```
  Saldo final conforme extrato bancário
(−) Entradas no extrato ainda não contabilizadas
(+) Saídas no extrato ainda não contabilizadas
(+) Entradas contabilizadas que não constam no extrato
(−) Saídas contabilizadas que não constam no extrato
(±) Diferenças aceitas
= Saldo contábil esperado
  Saldo final conforme razão contábil
  Diferença não explicada   → deve ser zero para fechar a conciliação
```

A conciliação é considerada **fechada** quando a diferença não explicada é zero e todas as pendências têm justificativa.

## Seus dados e backup

- Os dados ficam salvos automaticamente no armazenamento local do navegador (`localStorage`), apenas neste computador e neste navegador.
- Limpar os dados de navegação apaga as informações. Use **Configurações → Fazer backup** regularmente
  (gera um arquivo `.json`) e **Restaurar backup** para recuperar ou levar os dados para outro computador.
- Arquivos `.xls` (Excel 97-2003) e PDF não são lidos: salve como `.xlsx`/`.csv` ou baixe o OFX do banco.

## Estrutura

```
index.html        página principal
css/styles.css    estilos (inclui layout de impressão)
js/parsers.js     leitura de OFX, CSV/TXT, XLSX, datas e valores
js/app.js         regras de conciliação e interface
```
