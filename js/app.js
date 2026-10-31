/* =====================================================================
 * Conciliação Contábil — aplicação
 * Os dados ficam no navegador (localStorage). Faça backups periódicos.
 * ===================================================================== */
(function () {
  'use strict';

  const P = window.Parsers;
  const CHAVE = 'conciliacao-contabil:v1';
  const MAX_LINHAS_LISTA = 2000;

  /* ============================ Utilidades ============================ */
  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtNum = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ct = v => Math.round((+v || 0) * 100);              // reais -> centavos
  const brl = c => fmtBRL.format(((c || 0) / 100) || 0);      // centavos -> "R$ 1.234,56"
  const numBR = c => fmtNum.format(((c || 0) / 100) || 0);    // centavos -> "1.234,56"
  const pad = n => String(n).padStart(2, '0');
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function fdata(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
  function dias(a, b) { return Math.round((Date.parse(a) - Date.parse(b)) / 86400000); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function hojeISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function agoraBR() { return new Date().toLocaleString('pt-BR'); }
  function parseMoeda(s) {
    if (s == null || String(s).trim() === '') return null;
    const p = P.parseNumero(s, 'br');
    return p ? Math.round(p.v * 100) / 100 : NaN;
  }
  function moedaInput(v) { return v == null || v === '' ? '' : fmtNum.format(v); }
  function classeValor(c) { return c < 0 ? 'neg' : ''; }
  function plural(n, s, p) { return n === 1 ? s : (p || s + 's'); }

  function ultimoDiaMes(iso) {
    const [y, m] = iso.split('-').map(Number);
    return `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
  }
  function somaDias(iso, n) {
    const d = new Date(Date.parse(iso) + n * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  /* ============================ Estado ============================ */
  function estadoVazio() { return { versao: 1, conciliacoes: [], atual: null, ultimoBackup: null }; }

  function carregar() {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE));
      if (s && Array.isArray(s.conciliacoes)) return s;
    } catch (e) { /* ignora */ }
    return estadoVazio();
  }

  let state = carregar();

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(state));
      return true;
    } catch (e) {
      toast('Não foi possível salvar: o armazenamento do navegador está cheio. Faça um backup e exclua conciliações antigas.', 'erro', 8000);
      return false;
    }
  }

  function atual() { return state.conciliacoes.find(c => c.id === state.atual) || null; }

  const ui = {
    aba: 'painel',
    sel: { extrato: new Set(), razao: new Set() },
    ultimoClique: { extrato: null, razao: null },
    visiveis: { extrato: [], razao: [] },
    f: { status: 'pendente', busca: '', valor: '', de: '', ate: '' },
    fr: { busca: '', tipo: 'todos' }
  };

  function limparSelecao() { ui.sel.extrato.clear(); ui.sel.razao.clear(); }

  /* ============================ Domínio ============================ */
  const LADOS = {
    extrato: { nome: 'Extrato bancário', curto: 'Extrato', ent: 'Entrada (crédito no extrato)', sai: 'Saída (débito no extrato)' },
    razao: { nome: 'Razão contábil', curto: 'Razão', ent: 'Débito (entrada na conta)', sai: 'Crédito (saída da conta)' }
  };

  function novaConc(d) {
    return Object.assign({
      id: uid(), nome: '', empresa: '', cnpj: '', bancoNome: '', agenciaConta: '', contaContabil: '',
      periodoIni: '', periodoFim: '',
      saldoIniExtrato: 0, saldoFimExtrato: null, saldoIniRazao: 0, saldoFimRazao: null,
      tolerancia: 3, responsavel: '', revisor: '',
      criadoEm: new Date().toISOString(),
      extrato: [], razao: [], matches: [], lotes: []
    }, d || {});
  }

  function indice(k) {
    const m = new Map();
    k.extrato.forEach(i => m.set(i.id, i));
    k.razao.forEach(i => m.set(i.id, i));
    return m;
  }

  function soma(arr) { return arr.reduce((a, i) => a + ct(i.valor), 0); }

  /** Calcula saldos e o demonstrativo de conciliação (valores em centavos). */
  function resumo(k) {
    const eCalc = ct(k.saldoIniExtrato) + soma(k.extrato.filter(i => !i.transportado));
    const rCalc = ct(k.saldoIniRazao) + soma(k.razao.filter(i => !i.transportado));
    const eInf = k.saldoFimExtrato == null ? null : ct(k.saldoFimExtrato);
    const rInf = k.saldoFimRazao == null ? null : ct(k.saldoFimRazao);
    const eFim = eInf == null ? eCalc : eInf;
    const rFim = rInf == null ? rCalc : rInf;
    const pendE = k.extrato.filter(i => !i.matchId);
    const pendR = k.razao.filter(i => !i.matchId);
    const pEent = soma(pendE.filter(i => i.valor > 0));
    const pEsai = soma(pendE.filter(i => i.valor < 0));
    const pRent = soma(pendR.filter(i => i.valor > 0));
    const pRsai = soma(pendR.filter(i => i.valor < 0));
    const difs = k.matches.reduce((a, m) => a + (m.dif || 0), 0);
    const difsAnt = k.difsAnteriores || 0;
    const ajustado = eFim - pEent - pEsai + pRent + pRsai - difs - difsAnt;
    const naoExplicada = ajustado - rFim;
    const total = k.extrato.length + k.razao.length;
    const conciliados = total - pendE.length - pendR.length;
    const semJust = pendE.filter(i => !i.just).length + pendR.filter(i => !i.just).length;
    return {
      eCalc, rCalc, eInf, rInf, eFim, rFim, pendE, pendR, pEent, pEsai, pRent, pRsai, difs, difsAnt,
      ajustado, naoExplicada, total, conciliados, semJust,
      pct: total ? Math.round(conciliados / total * 1000) / 10 : 0,
      fechada: naoExplicada === 0 && semJust === 0 && total > 0
    };
  }

  function criarMatch(k, idsE, idsR, tipo, obs) {
    const idx = indice(k);
    const iE = idsE.map(id => idx.get(id)).filter(Boolean);
    const iR = idsR.map(id => idx.get(id)).filter(Boolean);
    const m = {
      id: uid(), extrato: iE.map(i => i.id), razao: iR.map(i => i.id),
      tipo, dif: soma(iE) - soma(iR), obs: obs || '', em: new Date().toISOString()
    };
    k.matches.push(m);
    iE.concat(iR).forEach(i => { i.matchId = m.id; });
    return m;
  }

  function desfazerMatch(k, mid) {
    const m = k.matches.find(x => x.id === mid);
    if (!m) return;
    const idx = indice(k);
    m.extrato.concat(m.razao).forEach(id => { const i = idx.get(id); if (i) i.matchId = null; });
    k.matches = k.matches.filter(x => x.id !== mid);
  }

  const STOP = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'PARA', 'COM', 'REF', 'PAG', 'PGTO', 'PAGTO', 'LTDA', 'S/A', 'SA', 'ME', 'EPP', 'NF', 'VALOR', 'CONF', 'DATA']);
  function tokens(s) {
    return new Set(P.norm(s).replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(t => t.length >= 3 && !STOP.has(t)));
  }
  function similaridade(a, b) {
    const A = tokens(a.desc + ' ' + a.doc), B = tokens(b.desc + ' ' + b.doc);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    A.forEach(t => { if (B.has(t)) inter++; });
    return inter / (A.size + B.size - inter);
  }
  function digitos(s) { return String(s || '').replace(/\D/g, '').replace(/^0+/, ''); }
  function docConfere(a, b) {
    const da = digitos(a.doc), db = digitos(b.doc);
    if (da.length >= 3 && da === db) return true;
    if (da.length >= 4 && (' ' + b.desc.replace(/\D+/g, ' ') + ' ').indexOf(' ' + da + ' ') >= 0) return true;
    if (db.length >= 4 && (' ' + a.desc.replace(/\D+/g, ' ') + ' ').indexOf(' ' + db + ' ') >= 0) return true;
    return false;
  }

  /**
   * Conciliação automática.
   * 1) 1 para 1: mesmo valor, datas dentro da tolerância, priorizando documento,
   *    proximidade de data e semelhança do histórico.
   * 2) Opcional: 1 para N e N para 1 (soma de até 5 lançamentos).
   */
  function autoConciliar(k, opcoes) {
    const tol = Math.max(0, +k.tolerancia || 0);
    const pe = k.extrato.filter(i => !i.matchId && ct(i.valor) !== 0);
    const pr = k.razao.filter(i => !i.matchId && ct(i.valor) !== 0);
    const porValor = new Map();
    pr.forEach(r => { const c = ct(r.valor); if (!porValor.has(c)) porValor.set(c, []); porValor.get(c).push(r); });
    const pares = [];
    for (const e of pe) {
      for (const r of porValor.get(ct(e.valor)) || []) {
        const dd = Math.abs(dias(e.data, r.data));
        const doc = docConfere(e, r);
        if (dd <= tol || (doc && opcoes.docForaTolerancia && dd <= 45)) {
          pares.push({ e, r, p: dd * 10 - (doc ? 60 : 0) - similaridade(e, r) * 25 });
        }
      }
    }
    pares.sort((a, b) => a.p - b.p);
    const usados = new Set();
    let n1 = 0, nN = 0;
    for (const p of pares) {
      if (usados.has(p.e.id) || usados.has(p.r.id)) continue;
      usados.add(p.e.id); usados.add(p.r.id);
      criarMatch(k, [p.e.id], [p.r.id], 'auto');
      n1++;
    }
    if (opcoes.combinacoes) {
      nN += combinar(k, 'extrato', 'razao', tol);
      nN += combinar(k, 'razao', 'extrato', tol);
    }
    return { n1, nN };
  }

  function combinar(k, ladoA, ladoB, tol) {
    let n = 0;
    const alvos = k[ladoA].filter(i => !i.matchId && ct(i.valor) !== 0)
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
    for (const alvo of alvos) {
      if (alvo.matchId) continue;
      const T = ct(alvo.valor);
      const cands = k[ladoB]
        .filter(i => !i.matchId && Math.sign(i.valor) === Math.sign(T) && Math.abs(ct(i.valor)) < Math.abs(T) && Math.abs(dias(i.data, alvo.data)) <= tol)
        .sort((a, b) => Math.abs(dias(a.data, alvo.data)) - Math.abs(dias(b.data, alvo.data)))
        .slice(0, 18);
      if (cands.length < 2) continue;
      const res = subconjunto(cands.map(i => Math.abs(ct(i.valor))), Math.abs(T), 5);
      if (res) {
        const ids = res.map(ix => cands[ix].id);
        if (ladoA === 'extrato') criarMatch(k, [alvo.id], ids, 'auto');
        else criarMatch(k, ids, [alvo.id], 'auto');
        n++;
      }
    }
    return n;
  }

  /** Busca o menor subconjunto (2..maxK itens) que soma exatamente o alvo. */
  function subconjunto(vals, alvo, maxK) {
    let passos = 0;
    for (let tam = 2; tam <= maxK; tam++) {
      const pilha = [];
      const dfs = (ini, resto, faltam) => {
        if (++passos > 200000) return false;
        if (faltam === 0) return resto === 0;
        for (let i = ini; i < vals.length; i++) {
          if (vals[i] > resto) continue;
          pilha.push(i);
          if (dfs(i + 1, resto - vals[i], faltam - 1)) return true;
          pilha.pop();
        }
        return false;
      };
      if (dfs(0, alvo, tam)) return pilha;
    }
    return null;
  }

  function chaveDup(i) { return [i.data, ct(i.valor), P.norm(i.desc), P.norm(i.doc), i.fitid || ''].join('|'); }

  function importarItens(k, lado, itens, nomeLote, ignorarDup) {
    const existentes = new Map();
    k[lado].forEach(i => { const c = chaveDup(i); existentes.set(c, (existentes.get(c) || 0) + 1); });
    const vistos = new Map();
    const lote = { id: uid(), lado, nome: nomeLote, em: new Date().toISOString(), qtd: 0 };
    let dup = 0;
    const novos = [];
    for (const it of itens) {
      const c = chaveDup(it);
      const n = (vistos.get(c) || 0) + 1;
      vistos.set(c, n);
      if (ignorarDup && n <= (existentes.get(c) || 0)) { dup++; continue; }
      novos.push({
        id: uid(), data: it.data, desc: it.desc || '', doc: it.doc || '', valor: Math.round(it.valor * 100) / 100,
        fitid: it.fitid || '', matchId: null, just: '', loteId: lote.id
      });
    }
    lote.qtd = novos.length;
    if (novos.length) { k[lado].push(...novos); k.lotes.push(lote); }
    return { importados: novos.length, dup };
  }

  /* ============================ Interface: base ============================ */
  function toast(msg, tipo, tempo) {
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo || '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), tempo || 4000);
  }

  function abrirModal(o) {
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = `
      <div class="modal ${o.grande ? 'grande' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head"><h2>${o.titulo}</h2><button class="fechar" data-fechar title="Fechar">×</button></div>
        <div class="modal-body">${o.corpo || ''}</div>
        ${o.rodape !== undefined ? `<div class="modal-foot">${o.rodape}</div>` : ''}
      </div>`;
    fundo.addEventListener('mousedown', e => { if (e.target === fundo) fundo._clicouFora = true; });
    fundo.addEventListener('click', e => {
      if ((e.target === fundo && fundo._clicouFora && !o.travado) || e.target.closest('[data-fechar]')) fecharModal(fundo);
      fundo._clicouFora = false;
    });
    fundo._aoFechar = o.aoFechar;
    $('#modal-root').appendChild(fundo);
    const foco = fundo.querySelector('[autofocus]') || fundo.querySelector('input:not([type=checkbox]),select,textarea');
    if (foco) setTimeout(() => foco.focus(), 30);
    return fundo;
  }

  function fecharModal(el) {
    const alvo = el || $('#modal-root').lastElementChild;
    if (!alvo) return;
    alvo.remove();
    if (alvo._aoFechar) alvo._aoFechar();
  }

  function confirmar(msg, o) {
    o = o || {};
    return new Promise(res => {
      let respondido = false;
      const m = abrirModal({
        titulo: o.titulo || 'Confirmar',
        corpo: `<div style="line-height:1.5">${msg}</div>`,
        rodape: `<button class="btn" data-fechar>${o.cancelar || 'Cancelar'}</button>
                 <button class="btn ${o.perigo ? 'danger' : 'primary'}" data-ok autofocus>${o.ok || 'Confirmar'}</button>`,
        aoFechar: () => { if (!respondido) res(false); }
      });
      m.querySelector('[data-ok]').addEventListener('click', () => { respondido = true; fecharModal(m); res(true); });
    });
  }

  function baixar(nome, conteudo, tipo) {
    const bom = /csv/.test(tipo || 'text/csv') ? '﻿' : '';
    const blob = new Blob([bom + conteudo], { type: (tipo || 'text/csv') + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function csv(linhas) {
    return linhas.map(l => l.map(v => {
      const s = String(v == null ? '' : v);
      return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');
  }

  function nomeArquivo(k, sufixo) {
    return (P.norm(k.nome || 'conciliacao').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'conciliacao') + '-' + sufixo;
  }

  /* ============================ Render principal ============================ */
  const ABAS = [
    ['painel', 'Painel'],
    ['conciliar', 'Conciliar'],
    ['importar', 'Importar'],
    ['realizadas', 'Conciliações realizadas'],
    ['relatorio', 'Relatório'],
    ['config', 'Configurações']
  ];

  function render() {
    renderSeletor();
    renderAbas();
    renderMain();
  }

  function renderSeletor() {
    const sel = $('#selConc');
    if (!state.conciliacoes.length) { sel.style.display = 'none'; return; }
    sel.style.display = '';
    sel.innerHTML = state.conciliacoes.map(c =>
      `<option value="${c.id}" ${c.id === state.atual ? 'selected' : ''}>${esc(c.nome || 'Sem nome')}${c.empresa ? ' — ' + esc(c.empresa) : ''}</option>`
    ).join('');
  }

  function renderAbas() {
    const k = atual();
    const nav = $('#tabs');
    if (!k) { nav.innerHTML = ''; nav.style.display = 'none'; return; }
    nav.style.display = '';
    const pend = k.extrato.filter(i => !i.matchId).length + k.razao.filter(i => !i.matchId).length;
    nav.innerHTML = ABAS.map(([id, nome]) => {
      let extra = '';
      if (id === 'conciliar' && pend) extra = ` <span class="badge warn">${pend}</span>`;
      if (id === 'realizadas' && k.matches.length) extra = ` <span class="badge">${k.matches.length}</span>`;
      return `<button data-action="aba" data-aba="${id}" class="${ui.aba === id ? 'ativo' : ''}">${nome}${extra}</button>`;
    }).join('');
  }

  function renderMain() {
    const k = atual();
    const main = $('#main');
    if (!k) { main.innerHTML = viewBoasVindas(); return; }
    const views = { painel: viewPainel, conciliar: viewConciliar, importar: viewImportar, realizadas: viewRealizadas, relatorio: viewRelatorio, config: viewConfig };
    main.innerHTML = (views[ui.aba] || viewPainel)(k);
    if (ui.aba === 'conciliar') { renderListas(); }
    if (ui.aba === 'importar') { ligarDropZones(); }
  }

  /* ============================ Telas ============================ */
  function viewBoasVindas() {
    return `
      <div class="vazio">
        <h1>Bem-vindo ao sistema de Conciliação Contábil</h1>
        <p>Concilie o extrato bancário com o razão contábil de forma rápida e rastreável.
        Importe arquivos OFX, CSV, TXT ou XLSX (ou cole direto do Excel), deixe o sistema casar os lançamentos
        automaticamente, trate as pendências e emita o relatório de conciliação pronto para assinatura.</p>
        <div class="passos">
          <div><b>1. Crie a conciliação</b><span class="muted">Empresa, conta bancária, conta contábil, período e saldos.</span></div>
          <div><b>2. Importe</b><span class="muted">O extrato do banco e o razão da conta contábil.</span></div>
          <div><b>3. Concilie</b><span class="muted">Automático por valor/data/documento e ajustes manuais.</span></div>
          <div><b>4. Feche</b><span class="muted">Justifique pendências e imprima o relatório.</span></div>
        </div>
        <div class="row" style="justify-content:center">
          <button class="btn primary" data-action="nova-conc">+ Criar primeira conciliação</button>
          <button class="btn" data-action="restaurar-backup">Restaurar backup</button>
        </div>
        <p class="small" style="margin-top:28px">Seus dados ficam armazenados somente neste navegador, neste computador. Nada é enviado para a internet.</p>
      </div>`;
  }

  function viewPainel(k) {
    const r = resumo(k);
    const alertas = [];
    if (!k.extrato.length && !k.razao.length) {
      alertas.push(`<div class="alerta info">Comece importando o <b>extrato bancário</b> e o <b>razão contábil</b> na aba <a href="#" data-action="aba" data-aba="importar">Importar</a>.</div>`);
    }
    if (r.eInf != null && r.eInf !== r.eCalc) {
      alertas.push(`<div class="alerta warn">O saldo final informado do extrato (${brl(r.eInf)}) difere do calculado pelo saldo inicial + movimentos importados (${brl(r.eCalc)}) em <b>${brl(r.eInf - r.eCalc)}</b>. Verifique se todo o extrato foi importado e se o saldo inicial está correto.</div>`);
    }
    if (r.rInf != null && r.rInf !== r.rCalc) {
      alertas.push(`<div class="alerta warn">O saldo final informado do razão (${brl(r.rInf)}) difere do calculado pelo saldo inicial + lançamentos importados (${brl(r.rCalc)}) em <b>${brl(r.rInf - r.rCalc)}</b>. Verifique se todo o razão foi importado e se o saldo inicial está correto.</div>`);
    }
    const fora = (k.periodoIni || k.periodoFim) ? k.extrato.concat(k.razao).filter(i => !i.transportado && ((k.periodoIni && i.data < k.periodoIni) || (k.periodoFim && i.data > k.periodoFim))).length : 0;
    if (fora) alertas.push(`<div class="alerta warn">${fora} ${plural(fora, 'lançamento está', 'lançamentos estão')} com data fora do período da conciliação (${fdata(k.periodoIni)} a ${fdata(k.periodoFim)}).</div>`);
    if (r.total && (!state.ultimoBackup || Date.now() - Date.parse(state.ultimoBackup) > 7 * 86400000)) {
      alertas.push(`<div class="alerta info">Os dados ficam salvos apenas neste navegador. ${state.ultimoBackup ? 'Seu último backup foi em ' + new Date(state.ultimoBackup).toLocaleDateString('pt-BR') + '.' : 'Você ainda não fez nenhum backup.'} <a href="#" data-action="backup">Fazer backup agora</a>.</div>`);
    }

    let status;
    if (!r.total) status = '<span class="badge">Sem lançamentos</span>';
    else if (r.fechada) status = '<span class="badge ok">✓ Conciliação fechada</span>';
    else if (r.naoExplicada === 0) status = `<span class="badge warn">Saldos batem — ${r.semJust} ${plural(r.semJust, 'pendência', 'pendências')} sem justificativa</span>`;
    else status = '<span class="badge err">Em aberto — há diferença não explicada</span>';

    return `
      <div class="row" style="justify-content:space-between;margin-bottom:14px">
        <div>
          <h2 style="margin:0">${esc(k.nome)}</h2>
          <div class="muted small">${[k.empresa, k.bancoNome && (k.bancoNome + (k.agenciaConta ? ' ' + k.agenciaConta : '')), k.contaContabil && 'Conta contábil ' + k.contaContabil, (k.periodoIni || k.periodoFim) && `Período ${fdata(k.periodoIni)} a ${fdata(k.periodoFim)}`].filter(Boolean).map(esc).join(' · ')}</div>
        </div>
        <div>${status}</div>
      </div>
      ${alertas.join('')}
      <div class="grid4" style="margin-bottom:16px">
        <div class="kpi"><div class="rot">Saldo final do extrato</div><div class="val ${classeValor(r.eFim)}">${brl(r.eFim)}</div><div class="sub">${r.eInf == null ? 'calculado' : 'informado'}</div></div>
        <div class="kpi"><div class="rot">Saldo final contábil</div><div class="val ${classeValor(r.rFim)}">${brl(r.rFim)}</div><div class="sub">${r.rInf == null ? 'calculado' : 'informado'}</div></div>
        <div class="kpi"><div class="rot">Diferença não explicada</div><div class="val ${r.naoExplicada ? 'neg' : 'pos'}">${brl(r.naoExplicada)}</div><div class="sub">${r.naoExplicada ? 'precisa ser investigada' : 'saldos conciliados'}</div></div>
        <div class="kpi"><div class="rot">Lançamentos conciliados</div><div class="val">${r.pct.toLocaleString('pt-BR')}%</div><div class="sub">${r.conciliados} de ${r.total}</div><div class="progress"><div style="width:${r.pct}%"></div></div></div>
      </div>
      <div class="grid2">
        <div class="card"><h2>Demonstrativo da conciliação</h2>${tabelaDemonstrativo(r)}</div>
        <div class="card">
          <h2>Pendências</h2>
          <table>
            <thead><tr><th></th><th class="num">Qtd.</th><th class="num">Valor</th></tr></thead>
            <tbody>
              <tr><td>Extrato — não contabilizados</td><td class="num">${r.pendE.length}</td><td class="num ${classeValor(r.pEent + r.pEsai)}">${brl(r.pEent + r.pEsai)}</td></tr>
              <tr><td class="muted" style="padding-left:20px">justificados</td><td class="num">${r.pendE.filter(i => i.just).length}</td><td></td></tr>
              <tr><td>Razão — não constam no extrato</td><td class="num">${r.pendR.length}</td><td class="num ${classeValor(r.pRent + r.pRsai)}">${brl(r.pRent + r.pRsai)}</td></tr>
              <tr><td class="muted" style="padding-left:20px">justificados</td><td class="num">${r.pendR.filter(i => i.just).length}</td><td></td></tr>
              <tr><td>Conciliações realizadas</td><td class="num">${k.matches.length}</td><td></td></tr>
              <tr><td>Conciliações com diferença aceita</td><td class="num">${k.matches.filter(m => m.dif).length}</td><td class="num ${classeValor(r.difs)}">${brl(r.difs)}</td></tr>
            </tbody>
          </table>
          <div class="row" style="margin-top:14px">
            <button class="btn primary" data-action="auto">⚡ Conciliação automática</button>
            <button class="btn" data-action="aba" data-aba="conciliar">Conciliar manualmente</button>
            <button class="btn" data-action="aba" data-aba="importar">Importar</button>
          </div>
        </div>
      </div>`;
  }

  function tabelaDemonstrativo(r) {
    const l = (rot, v, cls) => `<tr class="${cls || ''}"><td>${rot}</td><td class="num ${classeValor(v)}">${brl(v)}</td></tr>`;
    return `<table class="demonstrativo"><tbody>
      ${l('Saldo final conforme extrato bancário', r.eFim, '')}
      ${l('(−) Entradas no extrato ainda não contabilizadas', -r.pEent, 'sub')}
      ${l('(+) Saídas no extrato ainda não contabilizadas', -r.pEsai, 'sub')}
      ${l('(+) Entradas contabilizadas que não constam no extrato', r.pRent, 'sub')}
      ${l('(−) Saídas contabilizadas que não constam no extrato', r.pRsai, 'sub')}
      ${r.difs ? l('(±) Diferenças aceitas em conciliações', -r.difs, 'sub') : ''}
      ${r.difsAnt ? l('(±) Diferenças aceitas em períodos anteriores', -r.difsAnt, 'sub') : ''}
      ${l('= Saldo contábil esperado', r.ajustado, 'total')}
      ${l('Saldo final conforme razão contábil', r.rFim, '')}
      ${l('Diferença não explicada', r.naoExplicada, 'total')}
    </tbody></table>`;
  }

  /* ---------------------------- Conciliar ---------------------------- */
  function viewConciliar(k) {
    const f = ui.f;
    return `
      <div class="filtros no-print">
        <label class="campo">Situação
          <select class="input" data-filtro="status">
            ${[['pendente', 'Pendentes (inclui justificados)'], ['semjust', 'Pendentes sem justificativa'], ['justificado', 'Justificados'], ['conciliado', 'Conciliados'], ['todos', 'Todos']]
              .map(([v, n]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
        <label class="campo">Buscar no histórico / documento
          <input class="input" data-filtro="busca" value="${esc(f.busca)}" placeholder="ex.: tarifa, 001234" style="width:180px">
        </label>
        <label class="campo">Valor
          <input class="input" data-filtro="valor" value="${esc(f.valor)}" placeholder="ex.: 1.250,00" style="width:120px" inputmode="decimal">
        </label>
        <label class="campo">De <input class="input" type="date" data-filtro="de" value="${f.de}"></label>
        <label class="campo">Até <input class="input" type="date" data-filtro="ate" value="${f.ate}"></label>
        <button class="btn sm" data-action="limpar-filtros">Limpar filtros</button>
        <div style="flex:1"></div>
        <button class="btn" data-action="lancamento" data-lado="extrato">+ Lançamento</button>
        <button class="btn primary" data-action="auto">⚡ Conciliação automática</button>
      </div>
      <div class="painel-conc">
        <div class="lado"><div id="lista-extrato"></div></div>
        <div class="lado"><div id="lista-razao"></div></div>
      </div>
      <div id="barra-sel"></div>
      <p class="muted small no-print">Dica: clique para selecionar, <b>Shift + clique</b> seleciona um intervalo. Ao selecionar de um lado, os lançamentos do outro lado com o mesmo valor ficam destacados em amarelo. Clique em um item conciliado para ver ou desfazer a conciliação.</p>`;
  }

  function filtrar(k, lado) {
    const f = ui.f;
    const busca = P.norm(f.busca);
    const valor = f.valor ? parseMoeda(f.valor) : null;
    return k[lado].filter(i => {
      if (f.status === 'pendente' && i.matchId) return false;
      if (f.status === 'semjust' && (i.matchId || i.just)) return false;
      if (f.status === 'justificado' && (i.matchId || !i.just)) return false;
      if (f.status === 'conciliado' && !i.matchId) return false;
      if (f.de && i.data < f.de) return false;
      if (f.ate && i.data > f.ate) return false;
      if (valor != null && !isNaN(valor) && Math.abs(ct(i.valor)) !== Math.abs(ct(valor))) return false;
      if (busca && P.norm(i.desc + ' ' + i.doc + ' ' + (i.just || '')).indexOf(busca) < 0) return false;
      return true;
    }).sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : a.valor - b.valor);
  }

  function renderListas() {
    const k = atual();
    ['extrato', 'razao'].forEach(lado => {
      const itens = filtrar(k, lado);
      const mostrar = itens.slice(0, MAX_LINHAS_LISTA);
      ui.visiveis[lado] = mostrar.map(i => i.id);
      const pend = k[lado].filter(i => !i.matchId);
      const selecionaveis = mostrar.filter(i => !i.matchId);
      const todosSel = selecionaveis.length > 0 && selecionaveis.every(i => ui.sel[lado].has(i.id));
      $('#lista-' + lado).innerHTML = `
        <div class="lado-head">
          <h3>${LADOS[lado].nome}</h3>
          <div class="small muted">${itens.length} ${plural(itens.length, 'exibido', 'exibidos')} · ${pend.length} ${plural(pend.length, 'pendente', 'pendentes')} (${brl(soma(pend))})</div>
        </div>
        <div class="tabela-wrap">
          <table class="lista">
            <thead><tr>
              <th style="width:28px"><input type="checkbox" data-action="sel-todos" data-lado="${lado}" ${todosSel ? 'checked' : ''} title="Selecionar todos os pendentes exibidos" style="pointer-events:auto"></th>
              <th>Data</th><th>Histórico</th><th>Doc.</th><th class="num">Valor</th><th>Situação</th><th></th>
            </tr></thead>
            <tbody>
              ${mostrar.length ? mostrar.map(i => linhaItem(i, lado)).join('') : `<tr><td colspan="7" class="muted" style="text-align:center;padding:30px">${k[lado].length ? 'Nenhum lançamento com os filtros atuais.' : `Nenhum lançamento. <a href="#" data-action="aba" data-aba="importar">Importar ${lado === 'extrato' ? 'extrato' : 'razão'}</a>`}</td></tr>`}
            </tbody>
          </table>
          ${itens.length > MAX_LINHAS_LISTA ? `<div class="alerta warn small" style="margin:8px">Exibindo os primeiros ${MAX_LINHAS_LISTA} de ${itens.length}. Use os filtros para refinar.</div>` : ''}
        </div>`;
    });
    atualizarSelecaoUI();
  }

  function linhaItem(i, lado) {
    const sel = ui.sel[lado].has(i.id);
    const conc = !!i.matchId;
    const sit = conc ? '<span class="badge ok">Conciliado</span>' : i.just ? '<span class="badge warn">Justificado</span>' : '<span class="badge">Pendente</span>';
    return `<tr data-action="item" data-lado="${lado}" data-id="${i.id}" class="${sel ? 'sel' : ''} ${conc ? 'conc' : ''}">
      <td><input type="checkbox" ${sel ? 'checked' : ''} ${conc ? 'disabled' : ''} tabindex="-1"></td>
      <td class="data">${fdata(i.data)}</td>
      <td class="desc">${esc(i.desc)}${i.transportado ? ' <span class="badge info" title="Pendência transportada do período anterior">anterior</span>' : ''}${i.just && !conc ? `<small>⚑ ${esc(i.just)}</small>` : ''}</td>
      <td class="doc">${esc(i.doc)}</td>
      <td class="num ${classeValor(i.valor)}">${numBR(ct(i.valor))}</td>
      <td>${sit}</td>
      <td><button class="btn icon" data-action="editar-item" data-lado="${lado}" data-id="${i.id}" title="Editar">✎</button></td>
    </tr>`;
  }

  function itensSelecionados(k, lado) {
    const idx = indice(k);
    return Array.from(ui.sel[lado]).map(id => idx.get(id)).filter(i => i && !i.matchId);
  }

  function atualizarSelecaoUI() {
    const k = atual();
    if (!k || ui.aba !== 'conciliar') return;
    const sE = itensSelecionados(k, 'extrato'), sR = itensSelecionados(k, 'razao');
    ui.sel.extrato = new Set(sE.map(i => i.id));
    ui.sel.razao = new Set(sR.map(i => i.id));
    const totE = soma(sE), totR = soma(sR);
    // Sugestões de mesmo valor no lado oposto
    let alvoSug = null, ladoSug = null;
    if (sE.length && !sR.length) { alvoSug = totE; ladoSug = 'razao'; }
    else if (sR.length && !sE.length) { alvoSug = totR; ladoSug = 'extrato'; }
    const idx = indice(k);
    ['extrato', 'razao'].forEach(lado => {
      $$(`#lista-${lado} tr[data-id]`).forEach(tr => {
        const id = tr.dataset.id;
        const sel = ui.sel[lado].has(id);
        tr.classList.toggle('sel', sel);
        const cb = tr.querySelector('input[type=checkbox]');
        if (cb) cb.checked = sel;
        const it = idx.get(id);
        tr.classList.toggle('sug', lado === ladoSug && it && !it.matchId && ct(it.valor) === alvoSug && alvoSug !== 0);
      });
    });
    const barra = $('#barra-sel');
    if (!barra) return;
    if (!sE.length && !sR.length) { barra.innerHTML = ''; return; }
    const dif = totE - totR;
    const algumJust = sE.concat(sR).some(i => i.just);
    barra.innerHTML = `
      <div class="barra-sel">
        <div class="grp">Extrato · ${sE.length} ${plural(sE.length, 'item', 'itens')}<b>${brl(totE)}</b></div>
        <div class="grp">Razão · ${sR.length} ${plural(sR.length, 'item', 'itens')}<b>${brl(totR)}</b></div>
        <div class="grp ${dif === 0 ? 'dif-zero' : 'dif-nz'}">Diferença<b>${brl(dif)}</b></div>
        <div class="spacer"></div>
        <button class="btn ok" data-action="conciliar-sel">✓ Conciliar${dif !== 0 ? ' com diferença' : ''}</button>
        <button class="btn" data-action="justificar-sel">⚑ Justificar</button>
        ${algumJust ? '<button class="btn" data-action="remover-just">Remover justificativa</button>' : ''}
        <button class="btn danger" data-action="excluir-sel">Excluir</button>
        <button class="btn" data-action="limpar-sel">Limpar seleção</button>
      </div>`;
  }

  /* ---------------------------- Importar ---------------------------- */
  function viewImportar(k) {
    const cartao = (lado, formatos, dica) => `
      <div class="card">
        <h2>${LADOS[lado].nome}</h2>
        <p class="muted small" style="margin-top:-6px">${formatos}</p>
        <label class="drop" data-drop="${lado}">
          <input type="file" data-arquivo="${lado}" accept=".ofx,.qfx,.csv,.txt,.tsv,.xlsx,.xlsm,.prn">
          <div style="font-size:26px">📄</div>
          <div><b>Clique para escolher</b> ou arraste o arquivo aqui</div>
        </label>
        <div style="margin-top:12px">
          <label class="campo">Ou cole aqui os dados copiados do Excel / sistema contábil
            <textarea class="input" id="colar-${lado}" rows="4" placeholder="Selecione as linhas na planilha (incluindo o cabeçalho), copie (Ctrl+C) e cole aqui (Ctrl+V)"></textarea>
          </label>
          <div class="row" style="margin-top:8px;justify-content:space-between">
            <button class="btn" data-action="processar-colado" data-lado="${lado}">Processar dados colados</button>
            <button class="btn sm" data-action="modelo" data-lado="${lado}">Baixar planilha modelo</button>
          </div>
        </div>
        <p class="muted small">${dica}</p>
      </div>`;
    const lotes = k.lotes.slice().reverse();
    return `
      <div class="grid2">
        ${cartao('extrato', 'Formatos: OFX (recomendado — disponível no internet banking de todos os bancos), CSV, TXT, XLSX ou colar do Excel.',
          'Convenção: entradas (créditos) positivas e saídas (débitos) negativas. Linhas de "saldo" do extrato são ignoradas automaticamente.')}
        ${cartao('razao', 'Formatos: CSV, TXT, XLSX ou colar do Excel — exporte o razão da conta contábil do banco no seu sistema contábil.',
          'Convenção: débitos na conta (entradas de dinheiro) positivos e créditos (saídas) negativos. Aceita colunas Débito/Crédito separadas, valor com D/C ou valor com sinal.')}
      </div>
      <div class="card">
        <h2>Importações realizadas</h2>
        ${lotes.length ? `
        <div class="tabela-wrap livre"><table>
          <thead><tr><th>Data</th><th>Origem</th><th>Arquivo</th><th class="num">Lançamentos</th><th class="num">Conciliados</th><th class="num">Soma</th><th></th></tr></thead>
          <tbody>${lotes.map(l => {
            const itens = k[l.lado].filter(i => i.loteId === l.id);
            return `<tr>
              <td>${new Date(l.em).toLocaleString('pt-BR')}</td>
              <td>${LADOS[l.lado].curto}</td>
              <td>${esc(l.nome)}</td>
              <td class="num">${itens.length}</td>
              <td class="num">${itens.filter(i => i.matchId).length}</td>
              <td class="num ${classeValor(soma(itens))}">${brl(soma(itens))}</td>
              <td><button class="btn sm danger" data-action="remover-lote" data-id="${l.id}">Remover</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>` : '<p class="muted">Nenhuma importação ainda.</p>'}
      </div>`;
  }

  function ligarDropZones() {
    $$('[data-drop]').forEach(z => {
      z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('over'); });
      z.addEventListener('dragleave', () => z.classList.remove('over'));
      z.addEventListener('drop', e => {
        e.preventDefault(); z.classList.remove('over');
        const f = e.dataTransfer.files[0];
        if (f) lerArquivoImport(f, z.dataset.drop);
      });
    });
    $$('[data-arquivo]').forEach(inp => inp.addEventListener('change', () => {
      const f = inp.files[0];
      if (f) lerArquivoImport(f, inp.dataset.arquivo);
      inp.value = '';
    }));
  }

  async function lerArquivoImport(file, lado) {
    try {
      const buf = await file.arrayBuffer();
      const b = new Uint8Array(buf.slice(0, 8));
      if (b[0] === 0x50 && b[1] === 0x4B) {
        const r = await P.parseXLSX(buf, 0);
        abrirImportTabela(lado, file.name, { linhas: r.linhas, buf, abas: r.abas, aba: 0 });
      } else if (b[0] === 0xD0 && b[1] === 0xCF) {
        toast('Arquivos .xls (Excel 97-2003) não são suportados. Abra no Excel e salve como .xlsx ou .csv — ou copie e cole os dados.', 'erro', 8000);
      } else if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
        toast('PDF não pode ser importado. Baixe o extrato em OFX ou CSV no internet banking.', 'erro', 8000);
      } else {
        const texto = P.decodificarTexto(buf);
        if (P.ehOFX(texto)) abrirImportOFX(lado, file.name, texto);
        else abrirImportTabela(lado, file.name, { texto });
      }
    } catch (e) {
      console.error(e);
      toast('Não foi possível ler o arquivo: ' + e.message, 'erro', 8000);
    }
  }

  /* ----- Importação OFX ----- */
  function abrirImportOFX(lado, nome, texto) {
    const k = atual();
    const { transacoes, info } = P.parseOFX(texto);
    const validas = transacoes.filter(t => !t.erro);
    if (!transacoes.length) { toast('Nenhuma transação encontrada no arquivo OFX.', 'erro'); return; }
    const ent = validas.filter(t => t.valor > 0).reduce((a, t) => a + ct(t.valor), 0);
    const sai = validas.filter(t => t.valor < 0).reduce((a, t) => a + ct(t.valor), 0);
    const podeSaldo = lado === 'extrato' && info.saldoFinal != null;
    const m = abrirModal({
      titulo: `Importar OFX — ${LADOS[lado].nome}`,
      grande: true,
      travado: true,
      corpo: `
        <div class="grid4" style="margin-bottom:12px">
          <div class="kpi"><div class="rot">Arquivo</div><div style="font-weight:600;word-break:break-all">${esc(nome)}</div><div class="sub">${[info.banco && 'Banco ' + info.banco, info.agencia && 'Ag. ' + info.agencia, info.conta && 'Conta ' + info.conta].filter(Boolean).map(esc).join(' · ')}</div></div>
          <div class="kpi"><div class="rot">Período do arquivo</div><div style="font-weight:600">${info.inicio ? fdata(info.inicio) : '—'} a ${info.fim ? fdata(info.fim) : '—'}</div></div>
          <div class="kpi"><div class="rot">Transações válidas</div><div class="val">${validas.length}</div><div class="sub">${transacoes.length - validas.length} com erro</div></div>
          <div class="kpi"><div class="rot">Entradas / Saídas</div><div style="font-weight:600" class="pos">${brl(ent)}</div><div style="font-weight:600" class="neg">${brl(sai)}</div></div>
        </div>
        <div class="preview"><table>
          <thead><tr><th>Data</th><th>Histórico</th><th>Documento</th><th class="num">Valor</th><th>Situação</th></tr></thead>
          <tbody>${transacoes.slice(0, 300).map(t => `<tr class="${t.erro ? 'erro' : ''}"><td>${fdata(t.data)}</td><td>${esc(t.desc)}</td><td>${esc(t.doc)}</td><td class="num ${classeValor(t.valor)}">${t.valor == null ? '' : numBR(ct(t.valor))}</td><td>${t.erro ? esc(t.erro) : 'OK'}</td></tr>`).join('')}</tbody>
        </table></div>
        ${transacoes.length > 300 ? `<p class="small muted">Exibindo 300 de ${transacoes.length} transações.</p>` : ''}
        <div class="row" style="margin-top:12px">
          <label class="chk"><input type="checkbox" id="ofx-dup" checked> Ignorar lançamentos já importados (duplicados)</label>
          ${lado === 'razao' ? '<label class="chk"><input type="checkbox" id="ofx-inv"> Inverter sinal</label>' : ''}
          ${podeSaldo ? `<label class="chk"><input type="checkbox" id="ofx-saldo" ${k.saldoFimExtrato == null ? 'checked' : ''}> Usar o saldo do OFX (${brl(ct(info.saldoFinal))}${info.dataSaldo ? ' em ' + fdata(info.dataSaldo) : ''}) como saldo final do extrato</label>` : ''}
        </div>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn primary" data-ok>Importar ${validas.length} ${plural(validas.length, 'lançamento', 'lançamentos')}</button>`
    });
    m.querySelector('[data-ok]').addEventListener('click', () => {
      const inv = m.querySelector('#ofx-inv') && m.querySelector('#ofx-inv').checked;
      const itens = validas.map(t => Object.assign({}, t, { valor: inv ? -t.valor : t.valor }));
      const r = importarItens(k, lado, itens, nome, m.querySelector('#ofx-dup').checked);
      if (podeSaldo && m.querySelector('#ofx-saldo').checked) k.saldoFimExtrato = info.saldoFinal;
      if (!k.periodoIni && info.inicio) k.periodoIni = info.inicio;
      if (!k.periodoFim && info.fim) k.periodoFim = info.fim;
      salvar();
      fecharModal(m);
      toast(`${r.importados} ${plural(r.importados, 'lançamento importado', 'lançamentos importados')}${r.dup ? ` · ${r.dup} ${plural(r.dup, 'duplicado ignorado', 'duplicados ignorados')}` : ''}.`, 'ok');
      render();
    });
  }

  /* ----- Importação de tabelas (CSV / TXT / XLSX / colado) ----- */
  let imp = null;

  function abrirImportTabela(lado, nome, fonte) {
    imp = {
      lado, nome,
      texto: fonte.texto || null,
      buf: fonte.buf || null, abas: fonte.abas || null, aba: fonte.aba || 0,
      linhasFixas: fonte.linhas || null,
      sep: fonte.texto ? P.detectarSeparador(fonte.texto) : null,
      pular: 0, cab: true,
      map: {}, modo: 'unico', fmtNum: 'auto', fmtData: 'auto', inverter: false,
      ignorarTermos: lado === 'extrato', termos: 'SALDO', ignorarDup: true
    };
    prepararLinhas(true);
    if (!imp.linhas.length) { toast('Nenhum dado encontrado.', 'erro'); imp = null; return; }
    const m = abrirModal({
      titulo: `Importar ${LADOS[lado].nome.toLowerCase()} — ${esc(nome)}`,
      grande: true,
      travado: true,
      corpo: '<div id="imp-corpo"></div>',
      rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn primary" id="imp-ok">Importar</button>',
      aoFechar: () => { imp = null; }
    });
    m.querySelector('#imp-ok').addEventListener('click', () => confirmarImportTabela(m));
    m.addEventListener('change', e => alterarImport(e.target));
    renderImport();
  }

  function prepararLinhas(adivinhar) {
    imp.linhas = imp.linhasFixas || P.parseCSV(imp.texto, imp.sep);
    if (adivinhar) {
      const l = adivinharLayout(imp.linhas);
      imp.pular = l.pular; imp.cab = l.cab;
      adivinharMapa();
    }
  }

  function linhaTemData(l) { return l.some(c => c && c.length >= 6 && P.parseData(c)); }

  function adivinharLayout(linhas) {
    for (let i = 0; i < Math.min(linhas.length, 40); i++) {
      if (linhaTemData(linhas[i]) && linhas[i].filter(c => c !== '').length >= 2) {
        if (i > 0 && !linhaTemData(linhas[i - 1]) && linhas[i - 1].filter(c => c !== '').length >= 2) return { pular: i - 1, cab: true };
        return { pular: i, cab: false };
      }
    }
    return { pular: 0, cab: true };
  }

  function cabecalho() { return imp.cab ? (imp.linhas[imp.pular] || []) : null; }
  function linhasDados() { return imp.linhas.slice(imp.pular + (imp.cab ? 1 : 0)); }
  function numColunas() { return Math.max(0, ...imp.linhas.slice(imp.pular, imp.pular + 60).map(l => l.length)); }
  function letraColuna(i) { let s = ''; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
  function nomeColuna(i) { const c = cabecalho(); return letraColuna(i) + (c && c[i] ? ' — ' + c[i] : ''); }

  function adivinharMapa() {
    const n = numColunas();
    const cab = (cabecalho() || []).map(h => P.norm(h));
    const dados = linhasDados().slice(0, 80);
    const achar = (re, evitar) => cab.findIndex(h => re.test(h) && !(evitar && evitar.test(h)));
    const map = { data: -1, desc: -1, doc: -1, valor: -1, ent: -1, sai: -1, dc: -1 };
    if (imp.cab) {
      map.data = achar(/^DATA|^DT\b|^DT\.|DATE|^DIA$|^EMISSAO|^MOVIMENTO/, /SALDO/);
      map.desc = achar(/HIST|DESCR|MEMO|LANCAMENTO|COMPLEMENTO|NARRATIVA|DETALHE|TITULO|OPERACAO|TRANSACAO|ESPECIFICA/, /^DATA|^DT|N[ºO°]?\s*LANC|VALOR/);
      map.doc = achar(/DOC|^NUM|^N[ºO°.]|CHEQUE|REFER|^NR|^LOTE|PARTIDA/);
      map.dc = achar(/^D\/?C$|^C\/?D$|NATUREZA|^TIPO|SINAL|^DC$|^CD$/);
      const cred = achar(/CREDITO|ENTRADA|RECEB|^CRED|^C$/, /SALDO|LIMITE/);
      const deb = achar(/DEBITO|SAIDA|PAGAMENTO|^DEB|^D$/, /SALDO|LIMITE/);
      map.valor = achar(/^VALOR|^VLR|VALOR|AMOUNT|MONTANTE|QUANTIA|^VALUE|^R\$/, /SALDO|LIMITE/);
      if (cred >= 0 && deb >= 0 && cred !== deb) {
        imp.modo = 'dc2';
        if (imp.lado === 'extrato') { map.ent = cred; map.sai = deb; } else { map.ent = deb; map.sai = cred; }
      } else if (map.valor >= 0 && map.dc >= 0) {
        const vals = dados.map(l => P.norm(l[map.dc])).filter(Boolean);
        imp.modo = vals.length && vals.every(v => /^[DCSE+\-]/.test(v)) ? 'indicador' : 'unico';
      } else {
        imp.modo = 'unico';
      }
    }
    // Pelo conteúdo, quando não houver cabeçalho reconhecível
    const prop = (col, fn) => { const v = dados.map(l => l[col] || '').filter(x => x !== ''); return v.length ? v.filter(fn).length / v.length : 0; };
    if (map.data < 0) {
      let melhor = -1, mp = 0;
      for (let c = 0; c < n; c++) { const p = prop(c, x => P.parseData(x)); if (p > mp) { mp = p; melhor = c; } }
      if (mp >= 0.6) map.data = melhor;
    }
    const ehNum = x => !P.parseData(x) && P.parseNumero(x, 'br') != null;
    if (imp.modo === 'unico' && map.valor < 0) {
      const numericas = [];
      for (let c = 0; c < n; c++) if (c !== map.data && prop(c, ehNum) >= 0.7) numericas.push(c);
      // Em extratos, a última coluna numérica costuma ser o saldo: prefira a penúltima
      if (numericas.length >= 2 && imp.lado === 'extrato') map.valor = numericas[numericas.length - 2];
      else if (numericas.length) map.valor = numericas[numericas.length - 1];
    }
    if (map.desc < 0) {
      let melhor = -1, mt = 0;
      for (let c = 0; c < n; c++) {
        if (c === map.data || c === map.valor) continue;
        const v = dados.map(l => l[c] || '').filter(x => x && !ehNum(x) && !P.parseData(x));
        const t = v.reduce((a, x) => a + x.length, 0) / Math.max(1, dados.length);
        if (t > mt) { mt = t; melhor = c; }
      }
      map.desc = melhor;
    }
    imp.map = map;
  }

  function sinalIndicador(ind, lado) {
    const s = P.norm(ind);
    if (!s) return 0;
    if (s[0] === '+') return 1;
    if (s[0] === '-') return -1;
    if (s[0] === 'C') return lado === 'extrato' ? 1 : -1;
    if (s[0] === 'D') return lado === 'extrato' ? -1 : 1;
    if (s[0] === 'E') return 1;
    if (s[0] === 'S') return -1;
    return 0;
  }

  function processarImport() {
    const dados = linhasDados();
    const m = imp.map;
    const cols = imp.modo === 'dc2' ? [m.ent, m.sai] : [m.valor];
    const fmt = imp.fmtNum === 'auto' ? P.detectarFormatoNumero(dados.flatMap(l => cols.filter(c => c >= 0).map(c => l[c]))) : imp.fmtNum;
    const termos = imp.ignorarTermos ? imp.termos.split(/[;,]/).map(t => P.norm(t)).filter(Boolean) : [];
    const res = { linhas: [], itens: [], fmt, ign: 0, erros: 0 };
    const g = (l, i) => (i >= 0 ? (l[i] || '').trim() : '');
    for (const l of dados) {
      const r = { l, st: 'ok', motivo: '' };
      res.linhas.push(r);
      const desc = g(l, m.desc), doc = g(l, m.doc);
      if (termos.length && termos.some(t => P.norm(desc).indexOf(t) >= 0)) { r.st = 'ign'; r.motivo = 'Linha de saldo/termo ignorado'; res.ign++; continue; }
      if (m.data < 0) { r.st = 'erro'; r.motivo = 'Selecione a coluna de data'; res.erros++; continue; }
      const data = P.parseData(g(l, m.data), imp.fmtData);
      if (!data) {
        // Linhas sem data (totais, rodapés, cabeçalhos repetidos) são ignoradas
        r.st = 'ign'; r.motivo = g(l, m.data) ? 'Data inválida' : 'Sem data'; res.ign++; continue;
      }
      let valor = null;
      if (imp.modo === 'unico') {
        const p = P.parseNumero(g(l, m.valor), fmt);
        if (p) { valor = p.v; if (p.dc) valor = Math.abs(valor) * (sinalIndicador(p.dc, imp.lado) || 1); }
      } else if (imp.modo === 'dc2') {
        const e = P.parseNumero(g(l, m.ent), fmt), s = P.parseNumero(g(l, m.sai), fmt);
        if (e || s) valor = Math.abs(e ? e.v : 0) - Math.abs(s ? s.v : 0);
      } else {
        const p = P.parseNumero(g(l, m.valor), fmt);
        if (p) {
          const sg = sinalIndicador(g(l, m.dc), imp.lado) || sinalIndicador(p.dc || '', imp.lado);
          valor = sg ? Math.abs(p.v) * sg : p.v;
        }
      }
      if (valor == null || !isFinite(valor)) { r.st = 'erro'; r.motivo = 'Valor inválido ou vazio'; res.erros++; continue; }
      if (imp.inverter) valor = -valor;
      valor = Math.round(valor * 100) / 100;
      if (valor === 0) { r.st = 'ign'; r.motivo = 'Valor zero'; res.ign++; continue; }
      r.item = { data, desc, doc, valor };
      res.itens.push(r.item);
    }
    return res;
  }

  function seletorColuna(campo, rotulo, obrig) {
    const n = numColunas();
    const v = imp.map[campo];
    let ops = `<option value="-1">${obrig ? '— selecione —' : '— nenhuma —'}</option>`;
    for (let i = 0; i < n; i++) ops += `<option value="${i}" ${v === i ? 'selected' : ''}>${esc(nomeColuna(i))}</option>`;
    return `<label class="campo">${rotulo}${obrig ? ' *' : ''}<select data-imp-map="${campo}">${ops}</select></label>`;
  }

  function renderImport() {
    if (!imp) return;
    const corpo = $('#imp-corpo');
    if (!corpo) return;
    const n = numColunas();
    const brutas = imp.linhas.slice(imp.pular, imp.pular + 8);
    const res = processarImport();
    imp.res = res;
    const L = LADOS[imp.lado];
    const ent = res.itens.filter(i => i.valor > 0).reduce((a, i) => a + ct(i.valor), 0);
    const sai = res.itens.filter(i => i.valor < 0).reduce((a, i) => a + ct(i.valor), 0);
    const amostra = res.linhas.slice(0, 200);
    corpo.innerHTML = `
      <div class="form-grid" style="grid-template-columns:repeat(4,1fr)">
        ${imp.abas && imp.abas.length > 1 ? `<label class="campo">Aba da planilha<select data-imp="aba">${imp.abas.map((a, i) => `<option value="${i}" ${i === imp.aba ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>` : ''}
        ${imp.texto != null ? `<label class="campo">Separador<select data-imp="sep">${[[';', 'Ponto e vírgula (;)'], [',', 'Vírgula (,)'], ['\t', 'Tabulação'], ['|', 'Barra vertical (|)']].map(([v, nm]) => `<option value="${esc(v)}" ${imp.sep === v ? 'selected' : ''}>${nm}</option>`).join('')}</select></label>` : ''}
        <label class="campo">Linhas a ignorar no topo<input type="number" min="0" data-imp="pular" value="${imp.pular}"></label>
        <label class="campo">&nbsp;<span class="chk" style="padding:8px 0"><input type="checkbox" data-imp="cab" ${imp.cab ? 'checked' : ''}> Primeira linha é cabeçalho</span></label>
      </div>
      <h3 style="margin-top:14px">Arquivo original</h3>
      <div class="preview"><table>
        <thead><tr>${Array.from({ length: n }, (_, i) => `<th>${letraColuna(i)}</th>`).join('')}</tr></thead>
        <tbody>${brutas.map((l, ix) => `<tr class="${ix === 0 && imp.cab ? 'cab' : ''}">${Array.from({ length: n }, (_, i) => `<td>${esc(l[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>

      <h3 style="margin-top:16px">Mapeamento das colunas</h3>
      <div class="form-grid" style="grid-template-columns:repeat(4,1fr)">
        ${seletorColuna('data', 'Data', true)}
        ${seletorColuna('desc', 'Histórico / descrição')}
        ${seletorColuna('doc', 'Documento')}
        <label class="campo">Como o valor está no arquivo?
          <select data-imp="modo">
            <option value="unico" ${imp.modo === 'unico' ? 'selected' : ''}>Uma coluna de valor (com sinal ou D/C)</option>
            <option value="dc2" ${imp.modo === 'dc2' ? 'selected' : ''}>${imp.lado === 'extrato' ? 'Colunas de Crédito e Débito separadas' : 'Colunas de Débito e Crédito separadas'}</option>
            <option value="indicador" ${imp.modo === 'indicador' ? 'selected' : ''}>Coluna de valor + coluna D/C</option>
          </select>
        </label>
        ${imp.modo === 'dc2'
          ? seletorColuna('ent', imp.lado === 'extrato' ? 'Coluna de créditos (entradas)' : 'Coluna Débito', true) + seletorColuna('sai', imp.lado === 'extrato' ? 'Coluna de débitos (saídas)' : 'Coluna Crédito', true)
          : seletorColuna('valor', 'Valor', true) + (imp.modo === 'indicador' ? seletorColuna('dc', 'Coluna D/C', true) : '')}
        <label class="campo">Formato da data<select data-imp="fmtData">
          <option value="auto" ${imp.fmtData === 'auto' ? 'selected' : ''}>Automático (dd/mm/aaaa)</option>
          <option value="mdy" ${imp.fmtData === 'mdy' ? 'selected' : ''}>mm/dd/aaaa (americano)</option>
        </select></label>
        <label class="campo">Formato do número<select data-imp="fmtNum">
          <option value="auto" ${imp.fmtNum === 'auto' ? 'selected' : ''}>Automático (detectado: ${res.fmt === 'br' ? '1.234,56' : '1,234.56'})</option>
          <option value="br" ${imp.fmtNum === 'br' ? 'selected' : ''}>Brasileiro (1.234,56)</option>
          <option value="us" ${imp.fmtNum === 'us' ? 'selected' : ''}>Americano (1,234.56)</option>
        </select></label>
      </div>
      <div class="row" style="margin-top:10px">
        <label class="chk"><input type="checkbox" data-imp="inverter" ${imp.inverter ? 'checked' : ''}> Inverter sinal dos valores</label>
        <label class="chk"><input type="checkbox" data-imp="ignorarTermos" ${imp.ignorarTermos ? 'checked' : ''}> Ignorar linhas cujo histórico contenha:</label>
        <input class="input" data-imp="termos" value="${esc(imp.termos)}" style="width:200px" title="Separe vários termos com ponto e vírgula">
        <label class="chk"><input type="checkbox" data-imp="ignorarDup" ${imp.ignorarDup ? 'checked' : ''}> Ignorar lançamentos já importados</label>
      </div>
      <p class="small muted">Convenção do sistema para o ${L.nome.toLowerCase()}: <b>${L.ent}</b> = positivo; <b>${L.sai}</b> = negativo. Confira os sinais na prévia abaixo; se estiverem trocados, marque "Inverter sinal".</p>

      <h3 style="margin-top:14px">Prévia do resultado</h3>
      <div class="row small" style="margin-bottom:8px">
        <span class="badge ok">${res.itens.length} válidos</span>
        <span class="badge">${res.ign} ignorados</span>
        ${res.erros ? `<span class="badge err">${res.erros} com erro</span>` : ''}
        <span>Entradas: <b class="pos">${brl(ent)}</b></span>
        <span>Saídas: <b class="neg">${brl(sai)}</b></span>
        <span>Líquido: <b>${brl(ent + sai)}</b></span>
      </div>
      <div class="preview"><table>
        <thead><tr><th>Data</th><th>Histórico</th><th>Documento</th><th class="num">Valor</th><th>Situação</th></tr></thead>
        <tbody>${amostra.map(r => r.item
          ? `<tr><td>${fdata(r.item.data)}</td><td>${esc(r.item.desc)}</td><td>${esc(r.item.doc)}</td><td class="num ${classeValor(r.item.valor)}">${numBR(ct(r.item.valor))}</td><td>OK</td></tr>`
          : `<tr class="${r.st === 'erro' ? 'erro' : 'ign'}"><td colspan="4">${esc(r.l.filter(Boolean).join(' | ').slice(0, 140))}</td><td style="text-decoration:none">${esc(r.motivo)}</td></tr>`).join('')}</tbody>
      </table></div>
      ${res.linhas.length > 200 ? `<p class="small muted">Prévia das primeiras 200 de ${res.linhas.length} linhas.</p>` : ''}`;
    const ok = $('#imp-ok');
    ok.textContent = `Importar ${res.itens.length} ${plural(res.itens.length, 'lançamento', 'lançamentos')}`;
    ok.disabled = !res.itens.length;
  }

  async function alterarImport(el) {
    if (!imp) return;
    if (el.dataset.impMap) { imp.map[el.dataset.impMap] = +el.value; renderImport(); return; }
    const campo = el.dataset.imp;
    if (!campo) return;
    if (el.type === 'checkbox') imp[campo] = el.checked;
    else if (campo === 'pular') imp.pular = Math.max(0, parseInt(el.value, 10) || 0);
    else if (campo === 'aba') imp.aba = +el.value;
    else imp[campo] = el.value;
    if (campo === 'sep') { prepararLinhas(false); adivinharMapa(); }
    if (campo === 'pular' || campo === 'cab') adivinharMapa();
    if (campo === 'aba') {
      try {
        const r = await P.parseXLSX(imp.buf, imp.aba);
        imp.linhasFixas = r.linhas;
        prepararLinhas(true);
      } catch (e) { toast(e.message, 'erro'); }
    }
    if (campo === 'modo') {
      // Ao trocar o modo, tenta preencher as colunas faltantes
      const salvo = imp.modo;
      if (imp.modo === 'dc2' && (imp.map.ent < 0 || imp.map.sai < 0)) { adivinharMapa(); imp.modo = salvo; }
    }
    renderImport();
  }

  function confirmarImportTabela(modal) {
    const k = atual();
    const res = processarImport();
    if (!res.itens.length) return;
    const r = importarItens(k, imp.lado, res.itens, imp.nome, imp.ignorarDup);
    salvar();
    fecharModal(modal);
    toast(`${r.importados} ${plural(r.importados, 'lançamento importado', 'lançamentos importados')}${r.dup ? ` · ${r.dup} ${plural(r.dup, 'duplicado ignorado', 'duplicados ignorados')}` : ''}.`, 'ok');
    render();
  }

  /* ---------------------------- Realizadas ---------------------------- */
  function viewRealizadas(k) {
    const idx = indice(k);
    const busca = P.norm(ui.fr.busca);
    let lista = k.matches.slice().reverse();
    if (ui.fr.tipo === 'auto') lista = lista.filter(m => m.tipo === 'auto');
    if (ui.fr.tipo === 'manual') lista = lista.filter(m => m.tipo !== 'auto');
    if (ui.fr.tipo === 'dif') lista = lista.filter(m => m.dif);
    if (busca) lista = lista.filter(m => P.norm(m.extrato.concat(m.razao).map(id => { const i = idx.get(id); return i ? i.desc + ' ' + i.doc + ' ' + numBR(ct(i.valor)) : ''; }).join(' ') + ' ' + m.obs).indexOf(busca) >= 0);
    const total = lista.length;
    lista = lista.slice(0, 1000);
    const desc = ids => ids.map(id => idx.get(id)).filter(Boolean).map(i =>
      `<div>${fdata(i.data)} · ${esc(i.desc)}${i.doc ? ' <span class="muted">(' + esc(i.doc) + ')</span>' : ''} · <b class="${classeValor(i.valor)}">${numBR(ct(i.valor))}</b></div>`).join('') || '<span class="muted">—</span>';
    const nAuto = k.matches.filter(m => m.tipo === 'auto').length;
    return `
      <div class="filtros">
        <label class="campo">Buscar<input class="input" data-filtro-r="busca" value="${esc(ui.fr.busca)}" placeholder="histórico, documento ou valor" style="min-width:260px"></label>
        <label class="campo">Tipo<select class="input" data-filtro-r="tipo">
          ${[['todos', 'Todas'], ['auto', 'Automáticas'], ['manual', 'Manuais'], ['dif', 'Com diferença']].map(([v, n]) => `<option value="${v}" ${ui.fr.tipo === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select></label>
        <div style="flex:1"></div>
        ${nAuto ? `<button class="btn danger" data-action="desfazer-autos">Desfazer todas as automáticas (${nAuto})</button>` : ''}
        <button class="btn" data-action="exportar-conc">Exportar CSV</button>
      </div>
      <div class="card" style="padding:0">
        ${lista.length ? `<div class="tabela-wrap livre"><table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Extrato bancário</th><th>Razão contábil</th><th class="num">Diferença</th><th>Observação</th><th></th></tr></thead>
          <tbody>${lista.map(m => `<tr>
            <td style="white-space:nowrap">${new Date(m.em).toLocaleDateString('pt-BR')}</td>
            <td>${m.tipo === 'auto' ? '<span class="badge info">Automática</span>' : '<span class="badge">Manual</span>'}</td>
            <td class="small">${desc(m.extrato)}</td>
            <td class="small">${desc(m.razao)}</td>
            <td class="num ${m.dif ? 'neg' : ''}">${m.dif ? brl(m.dif) : '—'}</td>
            <td class="small">${esc(m.obs)}</td>
            <td><button class="btn sm" data-action="desfazer" data-id="${m.id}">Desfazer</button></td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="muted" style="padding:20px">Nenhuma conciliação encontrada.</p>'}
      </div>
      ${total > 1000 ? `<p class="muted small">Exibindo 1000 de ${total}. Use a busca para refinar.</p>` : ''}`;
  }

  /* ---------------------------- Relatório ---------------------------- */
  function viewRelatorio(k) {
    const r = resumo(k);
    const idx = indice(k);
    const ordenar = arr => arr.slice().sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
    const tabelaPend = (itens, vazio) => itens.length ? `<table>
      <thead><tr><th>Data</th><th>Histórico</th><th>Documento</th><th>Justificativa</th><th class="num">Valor</th></tr></thead>
      <tbody>${ordenar(itens).map(i => `<tr><td>${fdata(i.data)}</td><td>${esc(i.desc)}${i.transportado ? ' <span class="muted">(período anterior)</span>' : ''}</td><td>${esc(i.doc)}</td><td>${esc(i.just) || '<span class="neg">sem justificativa</span>'}</td><td class="num ${classeValor(i.valor)}">${numBR(ct(i.valor))}</td></tr>`).join('')}
      <tr><td colspan="4"><b>Total</b></td><td class="num"><b>${numBR(soma(itens))}</b></td></tr></tbody></table>` : `<p class="muted">${vazio}</p>`;
    const comDif = k.matches.filter(m => m.dif);
    return `
      <div class="row no-print" style="justify-content:flex-end;margin-bottom:12px">
        <button class="btn" data-action="exportar-pend">Exportar pendências (CSV)</button>
        <button class="btn" data-action="exportar-conc">Exportar conciliações (CSV)</button>
        <button class="btn primary" data-action="imprimir">🖨 Imprimir / Salvar PDF</button>
      </div>
      <div class="relatorio">
        <h1>Relatório de Conciliação Bancária</h1>
        <div class="muted">${esc(k.nome)}</div>
        <div class="cab-info">
          <div><b>Empresa:</b> ${esc(k.empresa) || '—'}${k.cnpj ? ' — CNPJ ' + esc(k.cnpj) : ''}</div>
          <div><b>Período:</b> ${k.periodoIni ? fdata(k.periodoIni) : '—'} a ${k.periodoFim ? fdata(k.periodoFim) : '—'}</div>
          <div><b>Banco / conta:</b> ${esc([k.bancoNome, k.agenciaConta].filter(Boolean).join(' ')) || '—'}</div>
          <div><b>Conta contábil:</b> ${esc(k.contaContabil) || '—'}</div>
          <div><b>Situação:</b> ${r.fechada ? 'Conciliada' : r.naoExplicada === 0 ? 'Saldos conciliados com pendências sem justificativa' : 'Em aberto — diferença não explicada'}</div>
          <div><b>Emitido em:</b> ${agoraBR()}</div>
        </div>

        <h2>1. Saldos</h2>
        <table>
          <thead><tr><th></th><th class="num">Extrato bancário</th><th class="num">Razão contábil</th></tr></thead>
          <tbody>
            <tr><td>Saldo inicial</td><td class="num">${brl(ct(k.saldoIniExtrato))}</td><td class="num">${brl(ct(k.saldoIniRazao))}</td></tr>
            <tr><td>Movimentação do período</td><td class="num">${brl(r.eCalc - ct(k.saldoIniExtrato))}</td><td class="num">${brl(r.rCalc - ct(k.saldoIniRazao))}</td></tr>
            <tr><td>Saldo final calculado</td><td class="num">${brl(r.eCalc)}</td><td class="num">${brl(r.rCalc)}</td></tr>
            <tr><td>Saldo final informado</td><td class="num">${r.eInf == null ? '—' : brl(r.eInf)}</td><td class="num">${r.rInf == null ? '—' : brl(r.rInf)}</td></tr>
          </tbody>
        </table>

        <h2>2. Demonstrativo da conciliação</h2>
        ${tabelaDemonstrativo(r)}

        <h2>3. Lançamentos do extrato não contabilizados (${r.pendE.length})</h2>
        ${tabelaPend(r.pendE, 'Nenhum lançamento pendente no extrato.')}

        <h2>4. Lançamentos contábeis que não constam no extrato (${r.pendR.length})</h2>
        ${tabelaPend(r.pendR, 'Nenhum lançamento contábil pendente.')}

        ${comDif.length ? `<h2>5. Conciliações com diferença aceita (${comDif.length})</h2>
        <table><thead><tr><th>Extrato</th><th>Razão</th><th>Observação</th><th class="num">Diferença</th></tr></thead>
        <tbody>${comDif.map(m => `<tr>
          <td>${m.extrato.map(id => idx.get(id)).filter(Boolean).map(i => `${fdata(i.data)} ${esc(i.desc)} ${numBR(ct(i.valor))}`).join('<br>')}</td>
          <td>${m.razao.map(id => idx.get(id)).filter(Boolean).map(i => `${fdata(i.data)} ${esc(i.desc)} ${numBR(ct(i.valor))}`).join('<br>')}</td>
          <td>${esc(m.obs)}</td><td class="num">${numBR(m.dif)}</td></tr>`).join('')}</tbody></table>` : ''}

        <h2>Resumo</h2>
        <p>Lançamentos analisados: <b>${r.total}</b> · conciliados: <b>${r.conciliados}</b> (${r.pct.toLocaleString('pt-BR')}%) · conciliações realizadas: <b>${k.matches.length}</b>
        (${((a, b) => `${a} ${plural(a, 'automática', 'automáticas')}, ${b} ${plural(b, 'manual', 'manuais')}`)(k.matches.filter(m => m.tipo === 'auto').length, k.matches.filter(m => m.tipo !== 'auto').length)}).<br>Data-base dos saldos: ${k.periodoFim ? fdata(k.periodoFim) : '—'}.</p>

        <div class="assinaturas">
          <div>${esc(k.responsavel) || '&nbsp;'}<br><span class="muted">Elaborado por</span></div>
          <div>${esc(k.revisor) || '&nbsp;'}<br><span class="muted">Revisado / aprovado por</span></div>
        </div>
      </div>`;
  }

  /* ---------------------------- Configurações ---------------------------- */
  function camposConc(k) {
    const v = k || {};
    const t = (id, rot, val, extra) => `<label class="campo ${extra && extra.full ? 'full' : ''}">${rot}<input data-campo="${id}" value="${esc(val == null ? '' : val)}" ${extra && extra.attrs || ''}></label>`;
    return `
      <div class="form-grid">
        ${t('nome', 'Nome da conciliação *', v.nome, { full: true, attrs: 'placeholder="ex.: Banco do Brasil 12345-6 — Out/2026" autofocus' })}
        ${t('empresa', 'Empresa', v.empresa)}
        ${t('cnpj', 'CNPJ', v.cnpj)}
        ${t('bancoNome', 'Banco', v.bancoNome, { attrs: 'placeholder="ex.: Itaú"' })}
        ${t('agenciaConta', 'Agência / conta', v.agenciaConta, { attrs: 'placeholder="ex.: 0001 / 12345-6"' })}
        ${t('contaContabil', 'Conta contábil', v.contaContabil, { attrs: 'placeholder="ex.: 1.1.1.02.001 — Banco Itaú C/C"' })}
        <label class="campo">Tolerância de datas (dias) na conciliação automática<input data-campo="tolerancia" type="number" min="0" max="60" value="${v.tolerancia == null ? 3 : v.tolerancia}"></label>
        <label class="campo">Início do período<input type="date" data-campo="periodoIni" value="${v.periodoIni || ''}"></label>
        <label class="campo">Fim do período<input type="date" data-campo="periodoFim" value="${v.periodoFim || ''}"></label>
        <div class="secao-form">Saldos <span class="muted small" style="font-weight:400">— os saldos finais são opcionais: se ficarem em branco, o sistema calcula pelo saldo inicial + lançamentos importados.</span></div>
        ${t('saldoIniExtrato', 'Saldo inicial do extrato', moedaInput(v.saldoIniExtrato == null ? 0 : v.saldoIniExtrato), { attrs: 'inputmode="decimal"' })}
        ${t('saldoIniRazao', 'Saldo inicial contábil', moedaInput(v.saldoIniRazao == null ? 0 : v.saldoIniRazao), { attrs: 'inputmode="decimal"' })}
        ${t('saldoFimExtrato', 'Saldo final do extrato (opcional)', moedaInput(v.saldoFimExtrato), { attrs: 'inputmode="decimal" placeholder="em branco = calculado"' })}
        ${t('saldoFimRazao', 'Saldo final contábil (opcional)', moedaInput(v.saldoFimRazao), { attrs: 'inputmode="decimal" placeholder="em branco = calculado"' })}
        <div class="secao-form">Assinaturas do relatório</div>
        ${t('responsavel', 'Elaborado por', v.responsavel)}
        ${t('revisor', 'Revisado / aprovado por', v.revisor)}
      </div>
      <p class="small muted">Valores negativos (ex.: conta devedora/cheque especial) podem ser informados com sinal de menos: -1.500,00.</p>`;
  }

  function lerCamposConc(raiz) {
    const d = {};
    let erro = null;
    $$('[data-campo]', raiz).forEach(el => {
      const c = el.dataset.campo;
      let v = el.value.trim();
      if (/^saldo/.test(c)) {
        const n = parseMoeda(v);
        if (Number.isNaN(n)) erro = 'Valor inválido no campo de saldo: ' + v;
        d[c] = /Ini/.test(c) ? (n == null ? 0 : n) : n;
      } else if (c === 'tolerancia') {
        d[c] = Math.max(0, Math.min(60, parseInt(v, 10) || 0));
      } else d[c] = v;
    });
    if (!d.nome) erro = 'Informe o nome da conciliação.';
    if (d.periodoIni && d.periodoFim && d.periodoIni > d.periodoFim) erro = 'O início do período é posterior ao fim.';
    return { d, erro };
  }

  function viewConfig(k) {
    let usoKB = 0;
    try { usoKB = Math.round((localStorage.getItem(CHAVE) || '').length * 2 / 1024); } catch (e) { /* ignora */ }
    return `
      <div class="card" id="form-config">
        <h2>Dados da conciliação</h2>
        ${camposConc(k)}
        <div class="row" style="margin-top:12px"><button class="btn primary" data-action="salvar-config">Salvar alterações</button></div>
      </div>
      <div class="grid2">
        <div class="card">
          <h2>Próximo período</h2>
          <p class="muted">Cria a conciliação do período seguinte usando os saldos finais deste período como saldos iniciais
          e transporta as pendências em aberto (lançamentos não conciliados) para serem conciliadas no novo período.</p>
          <button class="btn primary" data-action="proximo-periodo">Iniciar próximo período</button>
          <h2 style="margin-top:22px">Exportações</h2>
          <div class="row">
            <button class="btn" data-action="exportar-pend">Pendências (CSV)</button>
            <button class="btn" data-action="exportar-conc">Conciliações (CSV)</button>
            <button class="btn" data-action="exportar-todos">Todos os lançamentos (CSV)</button>
          </div>
        </div>
        <div class="card">
          <h2>Backup e restauração</h2>
          <p class="muted">Todos os dados ficam salvos <b>somente neste navegador</b> (${usoKB.toLocaleString('pt-BR')} KB em uso).
          Limpar os dados de navegação ou trocar de computador apaga/oculta as informações — faça backups regularmente.
          ${state.ultimoBackup ? '<br>Último backup: ' + new Date(state.ultimoBackup).toLocaleString('pt-BR') : '<br>Nenhum backup realizado ainda.'}</p>
          <div class="row">
            <button class="btn primary" data-action="backup">⬇ Fazer backup (todas as conciliações)</button>
            <button class="btn" data-action="restaurar-backup">⬆ Restaurar backup</button>
          </div>
          <h2 style="margin-top:22px;color:var(--err)">Zona de perigo</h2>
          <div class="row">
            <button class="btn danger" data-action="excluir-conc">Excluir esta conciliação</button>
            <button class="btn danger" data-action="apagar-tudo">Apagar todos os dados</button>
          </div>
        </div>
      </div>`;
  }

  /* ============================ Modais de ação ============================ */
  function modalNovaConc() {
    const m = abrirModal({
      titulo: 'Nova conciliação',
      corpo: camposConc(null),
      rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn primary" data-ok>Criar conciliação</button>'
    });
    m.querySelector('[data-ok]').addEventListener('click', () => {
      const { d, erro } = lerCamposConc(m);
      if (erro) { toast(erro, 'erro'); return; }
      const k = novaConc(d);
      state.conciliacoes.push(k);
      state.atual = k.id;
      salvar();
      fecharModal(m);
      limparSelecao();
      ui.aba = 'importar';
      render();
      toast('Conciliação criada. Agora importe o extrato e o razão.', 'ok');
    });
  }

  function modalLancamento(lado, item) {
    const k = atual();
    const conc = item && item.matchId;
    const v = item || { data: k.periodoFim || hojeISO(), desc: '', doc: '', valor: 0 };
    const m = abrirModal({
      titulo: item ? 'Editar lançamento' : 'Novo lançamento manual',
      corpo: `
        ${conc ? '<div class="alerta info">Este lançamento está conciliado: data e valor só podem ser alterados após desfazer a conciliação.</div>' : ''}
        <div class="form-grid">
          <label class="campo">Origem<select id="l-lado" ${item ? 'disabled' : ''}>
            <option value="extrato" ${lado === 'extrato' ? 'selected' : ''}>Extrato bancário</option>
            <option value="razao" ${lado === 'razao' ? 'selected' : ''}>Razão contábil</option>
          </select></label>
          <label class="campo">Data<input type="date" id="l-data" value="${v.data}" ${conc ? 'disabled' : ''}></label>
          <label class="campo full">Histórico<input id="l-desc" value="${esc(v.desc)}" autofocus></label>
          <label class="campo">Documento<input id="l-doc" value="${esc(v.doc)}"></label>
          <label class="campo">Natureza<select id="l-nat" ${conc ? 'disabled' : ''}></select></label>
          <label class="campo">Valor<input id="l-valor" inputmode="decimal" value="${v.valor ? moedaInput(Math.abs(v.valor)) : ''}" placeholder="0,00" ${conc ? 'disabled' : ''}></label>
          <label class="campo full">Justificativa / observação<input id="l-just" value="${esc(v.just || '')}" placeholder="opcional"></label>
        </div>`,
      rodape: `${item && !conc ? '<button class="btn danger" data-del style="margin-right:auto">Excluir</button>' : ''}<button class="btn" data-fechar>Cancelar</button><button class="btn primary" data-ok>Salvar</button>`
    });
    const selLado = m.querySelector('#l-lado'), selNat = m.querySelector('#l-nat');
    const preencherNat = () => {
      const L = LADOS[selLado.value];
      selNat.innerHTML = `<option value="1">${L.ent}</option><option value="-1">${L.sai}</option>`;
      selNat.value = v.valor < 0 ? '-1' : '1';
    };
    preencherNat();
    selLado.addEventListener('change', preencherNat);
    m.querySelector('[data-ok]').addEventListener('click', () => {
      const data = m.querySelector('#l-data').value;
      const valor = parseMoeda(m.querySelector('#l-valor').value);
      if (!data) { toast('Informe a data.', 'erro'); return; }
      if (valor == null || Number.isNaN(valor) || valor === 0) { toast('Informe um valor válido.', 'erro'); return; }
      const dados = {
        data, desc: m.querySelector('#l-desc').value.trim(), doc: m.querySelector('#l-doc').value.trim(),
        valor: Math.round(Math.abs(valor) * 100) / 100 * (+selNat.value), just: m.querySelector('#l-just').value.trim()
      };
      if (item) {
        if (conc) { item.desc = dados.desc; item.doc = dados.doc; item.just = dados.just; }
        else Object.assign(item, dados);
      } else {
        k[selLado.value].push(Object.assign({ id: uid(), fitid: '', matchId: null, loteId: null, manual: true }, dados));
      }
      salvar(); fecharModal(m); render();
      toast('Lançamento salvo.', 'ok');
    });
    const del = m.querySelector('[data-del]');
    if (del) del.addEventListener('click', async () => {
      if (!(await confirmar('Excluir este lançamento?', { ok: 'Excluir', perigo: true }))) return;
      k[lado] = k[lado].filter(i => i.id !== item.id);
      ui.sel[lado].delete(item.id);
      salvar(); fecharModal(m); render();
    });
  }

  function modalMatch(k, mid) {
    const mt = k.matches.find(x => x.id === mid);
    if (!mt) return;
    const idx = indice(k);
    const tab = ids => `<table><thead><tr><th>Data</th><th>Histórico</th><th>Doc.</th><th class="num">Valor</th></tr></thead><tbody>${ids.map(id => idx.get(id)).filter(Boolean).map(i => `<tr><td>${fdata(i.data)}</td><td>${esc(i.desc)}</td><td>${esc(i.doc)}</td><td class="num ${classeValor(i.valor)}">${numBR(ct(i.valor))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">—</td></tr>'}</tbody></table>`;
    const m = abrirModal({
      titulo: 'Detalhes da conciliação',
      grande: true,
      corpo: `
        <div class="row small muted" style="margin-bottom:10px">
          ${mt.tipo === 'auto' ? '<span class="badge info">Automática</span>' : '<span class="badge">Manual</span>'}
          <span>Realizada em ${new Date(mt.em).toLocaleString('pt-BR')}</span>
          ${mt.dif ? `<span class="badge err">Diferença ${brl(mt.dif)}</span>` : '<span class="badge ok">Sem diferença</span>'}
        </div>
        ${mt.obs ? `<div class="alerta info">${esc(mt.obs)}</div>` : ''}
        <div class="grid2">
          <div><h3>Extrato bancário</h3>${tab(mt.extrato)}</div>
          <div><h3>Razão contábil</h3>${tab(mt.razao)}</div>
        </div>`,
      rodape: '<button class="btn danger" data-desfazer style="margin-right:auto">Desfazer conciliação</button><button class="btn" data-fechar>Fechar</button>'
    });
    m.querySelector('[data-desfazer]').addEventListener('click', () => {
      desfazerMatch(k, mid); salvar(); fecharModal(m); render();
      toast('Conciliação desfeita.');
    });
  }

  function modalAuto() {
    const k = atual();
    const pe = k.extrato.filter(i => !i.matchId).length, pr = k.razao.filter(i => !i.matchId).length;
    if (!pe || !pr) { toast('É preciso ter lançamentos pendentes no extrato e no razão.', 'erro'); return; }
    const m = abrirModal({
      titulo: '⚡ Conciliação automática',
      corpo: `
        <p>O sistema vai procurar correspondências entre <b>${pe}</b> ${plural(pe, 'lançamento', 'lançamentos')} pendentes do extrato e <b>${pr}</b> do razão.</p>
        <div class="form-grid">
          <label class="campo">Tolerância de datas (dias)<input type="number" id="a-tol" min="0" max="60" value="${k.tolerancia == null ? 3 : k.tolerancia}"></label>
          <div></div>
          <label class="chk full"><input type="checkbox" id="a-doc" checked> Aceitar diferença de data maior (até 45 dias) quando o número do documento coincidir</label>
          <label class="chk full"><input type="checkbox" id="a-comb" checked> Buscar combinações: 1 lançamento de um lado = soma de 2 a 5 do outro (mesma janela de datas)</label>
        </div>
        <p class="small muted">Critérios: valor exatamente igual; entre os candidatos, prioriza documento coincidente, datas mais próximas e históricos semelhantes. Todas as conciliações automáticas podem ser revisadas e desfeitas na aba "Conciliações realizadas".</p>`,
      rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn primary" data-ok>Executar</button>'
    });
    m.querySelector('[data-ok]').addEventListener('click', () => {
      k.tolerancia = Math.max(0, Math.min(60, parseInt(m.querySelector('#a-tol').value, 10) || 0));
      const r = autoConciliar(k, { docForaTolerancia: m.querySelector('#a-doc').checked, combinacoes: m.querySelector('#a-comb').checked });
      salvar(); fecharModal(m); limparSelecao(); render();
      const tot = r.n1 + r.nN;
      toast(tot ? `${tot} ${plural(tot, 'conciliação realizada', 'conciliações realizadas')} (${r.n1} um-para-um${r.nN ? `, ${r.nN} por combinação` : ''}).` : 'Nenhuma correspondência encontrada com os critérios informados.', tot ? 'ok' : '', 6000);
    });
  }

  const JUSTIFICATIVAS = {
    extrato: ['Tarifa bancária a contabilizar', 'Rendimento de aplicação a contabilizar', 'IOF / juros a contabilizar', 'Recebimento não identificado', 'Pagamento a contabilizar', 'Débito indevido — contestar com o banco', 'Estorno bancário'],
    razao: ['Cheque emitido não compensado', 'Depósito em trânsito', 'Pagamento agendado não compensado', 'Lançamento contábil em duplicidade — estornar', 'Lançamento em conta contábil incorreta — reclassificar', 'Erro de valor — corrigir'],
  };

  function modalJustificar() {
    const k = atual();
    const sE = itensSelecionados(k, 'extrato'), sR = itensSelecionados(k, 'razao');
    const itens = sE.concat(sR);
    if (!itens.length) return;
    const ops = (sE.length ? JUSTIFICATIVAS.extrato : []).concat(sR.length ? JUSTIFICATIVAS.razao : []);
    const m = abrirModal({
      titulo: `Justificar ${itens.length} ${plural(itens.length, 'pendência', 'pendências')}`,
      corpo: `
        <p class="muted">A justificativa explica por que o lançamento permanece em aberto e aparece no relatório de conciliação.</p>
        <label class="campo">Motivo comum<select id="j-op"><option value="">— escolha ou escreva abaixo —</option>${ops.map(o => `<option>${esc(o)}</option>`).join('')}</select></label>
        <label class="campo" style="margin-top:10px">Justificativa<textarea id="j-txt" rows="3" autofocus>${esc(itens.length === 1 ? itens[0].just || '' : '')}</textarea></label>`,
      rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn primary" data-ok>Salvar justificativa</button>'
    });
    m.querySelector('#j-op').addEventListener('change', e => { if (e.target.value) m.querySelector('#j-txt').value = e.target.value; });
    m.querySelector('[data-ok]').addEventListener('click', () => {
      const t = m.querySelector('#j-txt').value.trim();
      if (!t) { toast('Escreva a justificativa.', 'erro'); return; }
      itens.forEach(i => { i.just = t; });
      salvar(); fecharModal(m); limparSelecao(); render();
      toast('Justificativa registrada.', 'ok');
    });
  }

  function conciliarSelecionados() {
    const k = atual();
    const sE = itensSelecionados(k, 'extrato'), sR = itensSelecionados(k, 'razao');
    if (!sE.length && !sR.length) return;
    const dif = soma(sE) - soma(sR);
    const executar = obs => {
      criarMatch(k, sE.map(i => i.id), sR.map(i => i.id), 'manual', obs);
      salvar(); limparSelecao(); renderAbas(); renderListas();
      toast('Conciliado.', 'ok', 2000);
    };
    if (dif === 0) {
      if (sE.length + sR.length === 1) { toast('Selecione ao menos um lançamento de cada lado (ou lançamentos que se anulem).', 'erro'); return; }
      executar('');
      return;
    }
    const m = abrirModal({
      titulo: 'Conciliar com diferença',
      corpo: `
        <div class="alerta warn">Os valores selecionados têm diferença de <b>${brl(dif)}</b> (extrato ${brl(soma(sE))} × razão ${brl(soma(sR))}).
        A diferença ficará registrada e aparecerá no demonstrativo e no relatório.</div>
        <p class="muted small">Prefira, quando possível, registrar o lançamento faltante (ex.: tarifa, juros) com "+ Lançamento" e conciliar sem diferença.</p>
        <label class="campo">Observação (obrigatória)<textarea id="d-obs" rows="3" autofocus placeholder="ex.: diferença de juros cobrados pelo banco, a contabilizar"></textarea></label>`,
      rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn primary" data-ok>Conciliar com diferença</button>'
    });
    m.querySelector('[data-ok]').addEventListener('click', () => {
      const obs = m.querySelector('#d-obs').value.trim();
      if (!obs) { toast('Informe a observação.', 'erro'); return; }
      fecharModal(m);
      executar(obs);
    });
  }

  async function excluirSelecionados() {
    const k = atual();
    const sE = itensSelecionados(k, 'extrato'), sR = itensSelecionados(k, 'razao');
    const n = sE.length + sR.length;
    if (!n) return;
    if (!(await confirmar(`Excluir ${n} ${plural(n, 'lançamento selecionado', 'lançamentos selecionados')}? Esta ação não pode ser desfeita.`, { ok: 'Excluir', perigo: true }))) return;
    const ids = new Set(sE.concat(sR).map(i => i.id));
    k.extrato = k.extrato.filter(i => !ids.has(i.id));
    k.razao = k.razao.filter(i => !ids.has(i.id));
    limparSelecao(); salvar(); render();
    toast(`${n} ${plural(n, 'lançamento excluído', 'lançamentos excluídos')}.`);
  }

  function modalProximoPeriodo() {
    const k = atual();
    const r = resumo(k);
    let ini = '', fim = '', nome = k.nome + ' (próximo período)';
    if (k.periodoFim) {
      ini = somaDias(k.periodoFim, 1);
      fim = ultimoDiaMes(ini);
      const [y, mm] = ini.split('-');
      const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const base = k.nome.replace(/\s*[—-]?\s*(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\/\d{4}\s*$/i, '').replace(/\s*[—-]?\s*\d{2}\/\d{4}\s*$/, '');
      nome = `${base} — ${nomes[+mm - 1]}/${y}`;
    }
    const pend = r.pendE.length + r.pendR.length;
    const m = abrirModal({
      titulo: 'Iniciar próximo período',
      corpo: `
        ${!r.fechada ? `<div class="alerta warn">Esta conciliação ainda não está fechada (diferença não explicada: ${brl(r.naoExplicada)}; pendências sem justificativa: ${r.semJust}). Você pode continuar mesmo assim.</div>` : ''}
        <div class="form-grid">
          <label class="campo full">Nome da nova conciliação<input id="p-nome" value="${esc(nome)}"></label>
          <label class="campo">Início do período<input type="date" id="p-ini" value="${ini}"></label>
          <label class="campo">Fim do período<input type="date" id="p-fim" value="${fim}"></label>
        </div>
        <table style="margin-top:14px"><tbody>
          <tr><td>Saldo inicial do extrato</td><td class="num">${brl(r.eFim)}</td></tr>
          <tr><td>Saldo inicial contábil</td><td class="num">${brl(r.rFim)}</td></tr>
          <tr><td>Pendências transportadas</td><td class="num">${pend}</td></tr>
          ${r.difs + r.difsAnt ? `<tr><td>Diferenças aceitas acumuladas (transportadas)</td><td class="num">${brl(r.difs + r.difsAnt)}</td></tr>` : ''}
        </tbody></table>
        <p class="small muted">As pendências transportadas aparecem marcadas como "anterior" e não alteram os saldos do novo período — servem apenas para serem conciliadas com os lançamentos que vierem a compensar.</p>`,
      rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn primary" data-ok>Criar próximo período</button>'
    });
    m.querySelector('[data-ok]').addEventListener('click', () => {
      const novo = novaConc({
        nome: m.querySelector('#p-nome').value.trim() || nome,
        empresa: k.empresa, cnpj: k.cnpj, bancoNome: k.bancoNome, agenciaConta: k.agenciaConta, contaContabil: k.contaContabil,
        periodoIni: m.querySelector('#p-ini').value, periodoFim: m.querySelector('#p-fim').value,
        saldoIniExtrato: r.eFim / 100, saldoIniRazao: r.rFim / 100,
        tolerancia: k.tolerancia, responsavel: k.responsavel, revisor: k.revisor,
        difsAnteriores: r.difs + r.difsAnt
      });
      const copiar = i => ({ id: uid(), data: i.data, desc: i.desc, doc: i.doc, valor: i.valor, fitid: i.fitid || '', matchId: null, just: i.just || '', loteId: null, transportado: true, origemConc: k.id });
      novo.extrato = r.pendE.map(copiar);
      novo.razao = r.pendR.map(copiar);
      state.conciliacoes.push(novo);
      state.atual = novo.id;
      salvar(); fecharModal(m); limparSelecao();
      ui.aba = 'importar';
      render();
      toast('Novo período criado. Importe o extrato e o razão do período.', 'ok', 6000);
    });
  }

  /* ============================ Backup / exportação ============================ */
  function fazerBackup() {
    state.ultimoBackup = new Date().toISOString();
    salvar();
    baixar(`conciliacao-contabil-backup-${hojeISO()}.json`, JSON.stringify(state, null, 1), 'application/json');
    toast('Backup gerado. Guarde o arquivo em local seguro.', 'ok');
    if (ui.aba === 'config' || ui.aba === 'painel') renderMain();
  }

  function restaurarBackup() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.addEventListener('change', async () => {
      const f = inp.files[0];
      if (!f) return;
      let dados;
      try {
        dados = JSON.parse(P.decodificarTexto(await f.arrayBuffer()));
        if (!dados || !Array.isArray(dados.conciliacoes)) throw new Error('formato');
      } catch (e) { toast('Arquivo de backup inválido.', 'erro'); return; }
      const n = dados.conciliacoes.length;
      if (!state.conciliacoes.length) {
        state = Object.assign(estadoVazio(), dados);
      } else {
        const m = abrirModal({
          titulo: 'Restaurar backup',
          corpo: `<p>O backup contém <b>${n}</b> ${plural(n, 'conciliação', 'conciliações')}. Você já possui <b>${state.conciliacoes.length}</b> neste navegador.</p>
            <p><b>Mesclar:</b> adiciona as conciliações do backup (as que já existem com o mesmo identificador são substituídas pela versão do backup).<br>
            <b>Substituir tudo:</b> apaga os dados atuais e deixa somente o conteúdo do backup.</p>`,
          rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn danger" data-sub>Substituir tudo</button><button class="btn primary" data-mes>Mesclar</button>'
        });
        const escolha = await new Promise(res => {
          m._aoFechar = () => res('cancelar');
          m.querySelector('[data-sub]').addEventListener('click', () => { m._aoFechar = null; fecharModal(m); res('substituir'); });
          m.querySelector('[data-mes]').addEventListener('click', () => { m._aoFechar = null; fecharModal(m); res('mesclar'); });
        });
        if (escolha === 'cancelar') return;
        if (escolha === 'substituir') state = Object.assign(estadoVazio(), dados);
        else dados.conciliacoes.forEach(c => {
          const i = state.conciliacoes.findIndex(x => x.id === c.id);
          if (i >= 0) state.conciliacoes[i] = c; else state.conciliacoes.push(c);
        });
      }
      if (!state.conciliacoes.some(c => c.id === state.atual)) state.atual = state.conciliacoes.length ? state.conciliacoes[0].id : null;
      salvar(); limparSelecao(); ui.aba = 'painel'; render();
      toast('Backup restaurado.', 'ok');
    });
    inp.click();
  }

  function exportarPendencias() {
    const k = atual();
    const r = resumo(k);
    const linhas = [['Origem', 'Data', 'Histórico', 'Documento', 'Valor', 'Justificativa', 'Período anterior']];
    r.pendE.forEach(i => linhas.push(['Extrato', fdata(i.data), i.desc, i.doc, numBR(ct(i.valor)), i.just || '', i.transportado ? 'Sim' : '']));
    r.pendR.forEach(i => linhas.push(['Razão', fdata(i.data), i.desc, i.doc, numBR(ct(i.valor)), i.just || '', i.transportado ? 'Sim' : '']));
    baixar(nomeArquivo(k, 'pendencias.csv'), csv(linhas));
  }

  function exportarConciliacoes() {
    const k = atual();
    const idx = indice(k);
    const linhas = [['Nº', 'Tipo', 'Conciliado em', 'Origem', 'Data', 'Histórico', 'Documento', 'Valor', 'Diferença', 'Observação']];
    k.matches.forEach((m, n) => {
      const add = (id, origem) => { const i = idx.get(id); if (i) linhas.push([n + 1, m.tipo === 'auto' ? 'Automática' : 'Manual', new Date(m.em).toLocaleString('pt-BR'), origem, fdata(i.data), i.desc, i.doc, numBR(ct(i.valor)), numBR(m.dif || 0), m.obs]); };
      m.extrato.forEach(id => add(id, 'Extrato'));
      m.razao.forEach(id => add(id, 'Razão'));
    });
    baixar(nomeArquivo(k, 'conciliacoes.csv'), csv(linhas));
  }

  function exportarTodos() {
    const k = atual();
    const linhas = [['Origem', 'Data', 'Histórico', 'Documento', 'Valor', 'Situação', 'Justificativa', 'Período anterior']];
    const add = (i, o) => linhas.push([o, fdata(i.data), i.desc, i.doc, numBR(ct(i.valor)), i.matchId ? 'Conciliado' : i.just ? 'Justificado' : 'Pendente', i.just || '', i.transportado ? 'Sim' : '']);
    k.extrato.forEach(i => add(i, 'Extrato'));
    k.razao.forEach(i => add(i, 'Razão'));
    baixar(nomeArquivo(k, 'lancamentos.csv'), csv(linhas));
  }

  function baixarModelo(lado) {
    if (lado === 'extrato') baixar('modelo-extrato-bancario.csv', csv([['Data', 'Histórico', 'Documento', 'Valor']]));
    else baixar('modelo-razao-contabil.csv', csv([['Data', 'Histórico', 'Documento', 'Débito', 'Crédito']]));
  }

  /* ============================ Eventos ============================ */
  const acoes = {
    'aba': el => { ui.aba = el.dataset.aba; renderAbas(); renderMain(); window.scrollTo(0, 0); },
    'nova-conc': () => modalNovaConc(),
    'auto': () => modalAuto(),
    'lancamento': el => modalLancamento(el.dataset.lado || 'extrato'),
    'editar-item': el => {
      const k = atual();
      const it = k[el.dataset.lado].find(i => i.id === el.dataset.id);
      if (it) modalLancamento(el.dataset.lado, it);
    },
    'item': (el, e) => {
      const k = atual();
      const lado = el.dataset.lado, id = el.dataset.id;
      const it = k[lado].find(i => i.id === id);
      if (!it) return;
      if (it.matchId) { modalMatch(k, it.matchId); return; }
      const sel = ui.sel[lado];
      if (e.shiftKey && ui.ultimoClique[lado]) {
        const vis = ui.visiveis[lado];
        const a = vis.indexOf(ui.ultimoClique[lado]), b = vis.indexOf(id);
        if (a >= 0 && b >= 0) {
          const idx = indice(k);
          vis.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => { const i = idx.get(x); if (i && !i.matchId) sel.add(x); });
          window.getSelection && window.getSelection().removeAllRanges();
        }
      } else if (sel.has(id)) sel.delete(id);
      else sel.add(id);
      ui.ultimoClique[lado] = id;
      atualizarSelecaoUI();
    },
    'sel-todos': (el, e) => {
      e.stopPropagation();
      const k = atual();
      const lado = el.dataset.lado;
      const idx = indice(k);
      const ids = ui.visiveis[lado].filter(id => { const i = idx.get(id); return i && !i.matchId; });
      if (el.checked) ids.forEach(id => ui.sel[lado].add(id));
      else ids.forEach(id => ui.sel[lado].delete(id));
      atualizarSelecaoUI();
    },
    'conciliar-sel': () => conciliarSelecionados(),
    'justificar-sel': () => modalJustificar(),
    'remover-just': () => {
      const k = atual();
      itensSelecionados(k, 'extrato').concat(itensSelecionados(k, 'razao')).forEach(i => { i.just = ''; });
      salvar(); renderListas();
    },
    'excluir-sel': () => excluirSelecionados(),
    'limpar-sel': () => { limparSelecao(); atualizarSelecaoUI(); },
    'limpar-filtros': () => { ui.f = { status: 'pendente', busca: '', valor: '', de: '', ate: '' }; renderMain(); },
    'desfazer': el => { const k = atual(); desfazerMatch(k, el.dataset.id); salvar(); render(); toast('Conciliação desfeita.'); },
    'desfazer-autos': async () => {
      const k = atual();
      const autos = k.matches.filter(m => m.tipo === 'auto');
      if (!(await confirmar(`Desfazer ${autos.length} ${plural(autos.length, 'conciliação automática', 'conciliações automáticas')}? As conciliações manuais serão mantidas.`, { ok: 'Desfazer', perigo: true }))) return;
      autos.forEach(m => desfazerMatch(k, m.id));
      salvar(); render();
    },
    'processar-colado': el => {
      const lado = el.dataset.lado;
      const t = $('#colar-' + lado).value;
      if (!t.trim()) { toast('Cole os dados na caixa de texto primeiro.', 'erro'); return; }
      if (P.ehOFX(t)) abrirImportOFX(lado, 'Dados colados', t);
      else abrirImportTabela(lado, 'Dados colados em ' + agoraBR(), { texto: t });
    },
    'modelo': el => baixarModelo(el.dataset.lado),
    'remover-lote': async el => {
      const k = atual();
      const lote = k.lotes.find(l => l.id === el.dataset.id);
      if (!lote) return;
      const itens = k[lote.lado].filter(i => i.loteId === lote.id);
      const conc = itens.filter(i => i.matchId).length;
      if (!(await confirmar(`Remover a importação "<b>${esc(lote.nome)}</b>" com ${itens.length} ${plural(itens.length, 'lançamento', 'lançamentos')}?${conc ? `<br><br>${conc} ${plural(conc, 'lançamento está conciliado', 'lançamentos estão conciliados')}: as conciliações correspondentes serão desfeitas.` : ''}`, { ok: 'Remover', perigo: true }))) return;
      const ids = new Set(itens.map(i => i.id));
      new Set(itens.filter(i => i.matchId).map(i => i.matchId)).forEach(mid => desfazerMatch(k, mid));
      k[lote.lado] = k[lote.lado].filter(i => !ids.has(i.id));
      k.lotes = k.lotes.filter(l => l.id !== lote.id);
      salvar(); render();
      toast('Importação removida.');
    },
    'imprimir': () => window.print(),
    'exportar-pend': () => exportarPendencias(),
    'exportar-conc': () => exportarConciliacoes(),
    'exportar-todos': () => exportarTodos(),
    'salvar-config': () => {
      const k = atual();
      const { d, erro } = lerCamposConc($('#form-config'));
      if (erro) { toast(erro, 'erro'); return; }
      Object.assign(k, d);
      salvar(); render();
      toast('Alterações salvas.', 'ok');
    },
    'proximo-periodo': () => modalProximoPeriodo(),
    'backup': () => fazerBackup(),
    'restaurar-backup': () => restaurarBackup(),
    'excluir-conc': async () => {
      const k = atual();
      if (!(await confirmar(`Excluir a conciliação "<b>${esc(k.nome)}</b>" e todos os seus lançamentos? Esta ação não pode ser desfeita (a menos que você tenha um backup).`, { ok: 'Excluir conciliação', perigo: true }))) return;
      state.conciliacoes = state.conciliacoes.filter(c => c.id !== k.id);
      state.atual = state.conciliacoes.length ? state.conciliacoes[state.conciliacoes.length - 1].id : null;
      salvar(); limparSelecao(); ui.aba = 'painel'; render();
    },
    'apagar-tudo': async () => {
      if (!(await confirmar('Apagar <b>todas</b> as conciliações deste navegador? Recomenda-se fazer um backup antes.', { ok: 'Apagar tudo', perigo: true }))) return;
      if (!(await confirmar('Tem certeza? Esta ação é definitiva.', { ok: 'Sim, apagar tudo', perigo: true }))) return;
      state = estadoVazio();
      salvar(); limparSelecao(); ui.aba = 'painel'; render();
    }
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (!acoes[a]) return;
    if (el.tagName === 'A') e.preventDefault();
    acoes[a](el, e);
  });

  let temporizador = null;
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.filtro) {
      ui.f[el.dataset.filtro] = el.value;
      clearTimeout(temporizador);
      temporizador = setTimeout(renderListas, el.type === 'date' || el.tagName === 'SELECT' ? 0 : 200);
    } else if (el.dataset.filtroR) {
      ui.fr[el.dataset.filtroR] = el.value;
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        const pos = el.selectionStart;
        renderMain();
        const novo = $(`[data-filtro-r="${el.dataset.filtroR}"]`);
        if (novo && novo.tagName === 'INPUT') { novo.focus(); novo.setSelectionRange(pos, pos); }
      }, 250);
    }
  });

  $('#selConc').addEventListener('change', e => {
    state.atual = e.target.value;
    salvar(); limparSelecao();
    ui.f = { status: 'pendente', busca: '', valor: '', de: '', ate: '' };
    render();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#modal-root').lastElementChild) {
      const topo = $('#modal-root').lastElementChild;
      fecharModal(topo);
    }
  });

  // Sincroniza alterações feitas em outra aba do navegador
  window.addEventListener('storage', e => {
    if (e.key === CHAVE) { state = carregar(); limparSelecao(); render(); }
  });

  if (state.conciliacoes.length && !atual()) state.atual = state.conciliacoes[0].id;
  render();

  // Exposto apenas para testes automatizados
  window.__conciliacao = { resumo, autoConciliar, importarItens, criarMatch, desfazerMatch, novaConc, subconjunto, estado: () => state };
})();
