/* =====================================================================
 * Conciliação Contábil — leitores de arquivos e conversores
 * CSV / TXT delimitado, colado do Excel, OFX e XLSX.
 * Funções puras: não dependem da interface.
 * ===================================================================== */
(function (root) {
  'use strict';

  const MESES = { JAN: 1, FEV: 2, FEB: 2, MAR: 3, ABR: 4, APR: 4, MAI: 5, MAY: 5, JUN: 6, JUL: 7, AGO: 8, AUG: 8, SET: 9, SEP: 9, OUT: 10, OCT: 10, NOV: 11, DEZ: 12, DEC: 12 };

  function pad(n) { return String(n).padStart(2, '0'); }

  function montarData(y, m, d) {
    if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null; // ex.: 31/02
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  function serialExcelParaData(n) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
    return montarData(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  /** Converte texto em data ISO (AAAA-MM-DD). formato: auto | dmy | mdy | ymd */
  function parseData(raw, formato) {
    formato = formato || 'auto';
    let s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    let m;
    // Número serial do Excel
    if (/^\d{5}([.,]\d+)?$/.test(s)) {
      const n = parseFloat(s.replace(',', '.'));
      if (n > 20000 && n < 80000) return serialExcelParaData(n);
    }
    // AAAAMMDD (OFX e alguns sistemas)
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{0,6})(\.\d+)?(\[.*\])?$/))) {
      return montarData(+m[1], +m[2], +m[3]);
    }
    // AAAA-MM-DD
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(\b|T|\s|$)/))) {
      return montarData(+m[1], +m[2], +m[3]);
    }
    // DD/MM/AAAA ou MM/DD/AAAA
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})(\b|\s|$)/))) {
      let a = +m[1], b = +m[2], y = +m[3];
      if (m[3].length === 2) y += y < 70 ? 2000 : 1900;
      if (formato === 'mdy') return montarData(y, a, b);
      if (formato === 'ymd') return null;
      return montarData(y, b, a);
    }
    // 05-jan-2024 / 05 JAN 2024
    if ((m = s.match(/^(\d{1,2})[\s\-\/.]+([A-Za-zÀ-ú]{3})[A-Za-zÀ-ú]*\.?[\s\-\/.]+(\d{2,4})/))) {
      const mes = MESES[m[2].normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()];
      let y = +m[3];
      if (m[3].length === 2) y += y < 70 ? 2000 : 1900;
      if (mes) return montarData(y, mes, +m[1]);
    }
    return null;
  }

  /**
   * Converte texto em número. Aceita "1.234,56", "1234.56", "-1.234,56", "(1.234,56)",
   * "R$ 1.234,56", "1.234,56-", "1.234,56 D", "1.234,56 C".
   * formato: br | us (usado apenas quando o separador é ambíguo).
   * Retorna { v: número, dc: 'D'|'C'|null } ou null.
   */
  function parseNumero(raw, formato) {
    if (raw == null) return null;
    if (typeof raw === 'number') return isFinite(raw) ? { v: raw, dc: null } : null;
    let s = String(raw).trim();
    if (!s) return null;
    let neg = false, dc = null;
    const mdc = s.match(/^(.*\d)\s*([DCdc])$/);
    if (mdc) { s = mdc[1]; dc = mdc[2].toUpperCase(); }
    s = s.replace(/R\$/gi, '').replace(/[\s ]/g, '');
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (s.endsWith('-')) { neg = !neg; s = s.slice(0, -1); }
    if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
    else if (s.startsWith('+')) s = s.slice(1);
    if (!/^\d[\d.,]*$/.test(s) && !/^[.,]\d+$/.test(s)) return null;
    const ultPonto = s.lastIndexOf('.'), ultVirg = s.lastIndexOf(',');
    if (ultPonto >= 0 && ultVirg >= 0) {
      if (ultVirg > ultPonto) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (ultVirg >= 0) {
      if (formato === 'us' && /^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
      else if ((s.match(/,/g) || []).length > 1) s = s.replace(/,/g, '');
      else s = s.replace(',', '.');
    } else if (ultPonto >= 0) {
      if (formato !== 'us' && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
      else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    }
    const v = parseFloat(s);
    if (!isFinite(v)) return null;
    return { v: neg ? -v : v, dc };
  }

  /** Detecta o formato numérico predominante de uma lista de valores. */
  function detectarFormatoNumero(valores) {
    let br = 0, us = 0;
    for (const raw of valores) {
      const s = String(raw || '').replace(/[^\d.,]/g, '');
      const p = s.lastIndexOf('.'), v = s.lastIndexOf(',');
      if (p >= 0 && v >= 0) { if (v > p) br++; else us++; }
      else if (v >= 0) { if (/^\d{1,3}(,\d{3})+$/.test(s)) us += 0.2; else br++; }
      else if (p >= 0) { if (/\.\d{1,2}$/.test(s)) us += 0.5; }
    }
    return us > br ? 'us' : 'br';
  }

  /** Detecta o separador de um texto delimitado. */
  function detectarSeparador(texto) {
    const linhas = texto.split(/\r?\n/).filter(l => l.trim()).slice(0, 40);
    const candidatos = [';', '\t', ',', '|'];
    let melhor = ';', melhorPont = -1;
    for (const sep of candidatos) {
      const contagens = linhas.map(l => contarForaDeAspas(l, sep));
      const freq = {};
      contagens.forEach(c => { if (c > 0) freq[c] = (freq[c] || 0) + 1; });
      let moda = 0, qtd = 0;
      for (const k in freq) if (freq[k] > qtd || (freq[k] === qtd && +k > moda)) { moda = +k; qtd = freq[k]; }
      const pont = qtd * 10 + Math.min(moda, 30);
      if (pont > melhorPont) { melhorPont = pont; melhor = sep; }
    }
    return melhor;
  }

  function contarForaDeAspas(linha, sep) {
    let q = false, n = 0;
    for (const ch of linha) {
      if (ch === '"') q = !q;
      else if (ch === sep && !q) n++;
    }
    return n;
  }

  /** Lê texto delimitado (RFC 4180, com aspas). Retorna matriz de strings. */
  function parseCSV(texto, sep) {
    const linhas = [];
    let linha = [], campo = '', q = false, inicioCampo = true;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (q) {
        if (ch === '"') {
          if (texto[i + 1] === '"') { campo += '"'; i++; } else q = false;
        } else campo += ch;
      } else if (ch === '"' && inicioCampo) {
        q = true; inicioCampo = false;
      } else if (ch === sep) {
        linha.push(campo); campo = ''; inicioCampo = true;
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && texto[i + 1] === '\n') i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = ''; inicioCampo = true;
      } else {
        campo += ch;
        if (ch !== ' ') inicioCampo = false;
      }
    }
    if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas
      .map(l => l.map(c => c.trim()))
      .filter(l => l.some(c => c !== ''));
  }

  function ehOFX(texto) {
    return /<OFX>|OFXHEADER|<STMTTRN>/i.test(texto.slice(0, 5000)) || /<STMTTRN>/i.test(texto);
  }

  function tagOFX(bloco, tag) {
    const re = new RegExp('<' + tag + '>([^<\\r\\n]*)', 'i');
    const m = bloco.match(re);
    return m ? m[1].trim() : '';
  }

  function decodificarEntidades(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  }

  /** Lê arquivo OFX (SGML 1.x ou XML 2.x). */
  function parseOFX(texto) {
    const transacoes = [];
    const partes = texto.split(/<STMTTRN>/i).slice(1);
    for (const parte of partes) {
      const bloco = parte.split(/<\/STMTTRN>/i)[0];
      const valor = parseNumero(tagOFX(bloco, 'TRNAMT'), 'us');
      const data = parseData(tagOFX(bloco, 'DTPOSTED')) || parseData(tagOFX(bloco, 'DTUSER'));
      const memo = decodificarEntidades(tagOFX(bloco, 'MEMO'));
      const nome = decodificarEntidades(tagOFX(bloco, 'NAME'));
      let desc = memo || nome;
      if (memo && nome && norm(memo).indexOf(norm(nome)) < 0 && norm(nome).indexOf(norm(memo)) < 0) desc = nome + ' - ' + memo;
      transacoes.push({
        data,
        desc: desc || tagOFX(bloco, 'TRNTYPE'),
        doc: tagOFX(bloco, 'CHECKNUM') || tagOFX(bloco, 'REFNUM') || '',
        fitid: tagOFX(bloco, 'FITID'),
        valor: valor ? Math.round(valor.v * 100) / 100 : null,
        erro: !data ? 'Data inválida' : (!valor ? 'Valor inválido' : null)
      });
    }
    const info = {};
    const ledger = texto.match(/<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL>|<\/STMTRS>)/i);
    if (ledger) {
      const v = parseNumero(tagOFX(ledger[1], 'BALAMT'), 'us');
      if (v) info.saldoFinal = Math.round(v.v * 100) / 100;
      info.dataSaldo = parseData(tagOFX(ledger[1], 'DTASOF'));
    }
    info.banco = tagOFX(texto, 'BANKID');
    info.agencia = tagOFX(texto, 'BRANCHID');
    info.conta = tagOFX(texto, 'ACCTID');
    info.inicio = parseData(tagOFX(texto, 'DTSTART'));
    info.fim = parseData(tagOFX(texto, 'DTEND'));
    return { transacoes, info };
  }

  /* ------------------------- XLSX (sem bibliotecas) ------------------------- */

  async function unzip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65558); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Arquivo XLSX inválido ou corrompido.');
    const total = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const arquivos = {};
    const td = new TextDecoder();
    for (let n = 0; n < total; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(p + 10, true);
      const tamComp = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const nome = td.decode(u8.subarray(p + 46, p + 46 + nl));
      arquivos[nome] = { metodo, tamComp, off };
      p += 46 + nl + el + cl;
    }
    return async function ler(nome) {
      const f = arquivos[nome];
      if (!f) return null;
      const nl = dv.getUint16(f.off + 26, true), el = dv.getUint16(f.off + 28, true);
      const ini = f.off + 30 + nl + el;
      const dados = u8.subarray(ini, ini + f.tamComp);
      if (f.metodo === 0) return td.decode(dados);
      if (typeof DecompressionStream === 'undefined') throw new Error('Seu navegador não suporta leitura de XLSX. Salve a planilha como CSV.');
      const stream = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(stream).text();
    };
  }

  function xml(texto) { return new DOMParser().parseFromString(texto, 'application/xml'); }
  function tags(el, nome) { return Array.from(el.getElementsByTagNameNS('*', nome)); }

  function colunaIndice(ref) {
    const letras = (ref.match(/^[A-Z]+/i) || [''])[0].toUpperCase();
    let n = 0;
    for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }

  /** Lê a primeira planilha (ou a indicada) de um XLSX. Retorna { abas, linhas }. */
  async function parseXLSX(buf, indiceAba) {
    const ler = await unzip(buf);
    const wbTxt = await ler('xl/workbook.xml');
    if (!wbTxt) throw new Error('Arquivo XLSX inválido.');
    const wb = xml(wbTxt);
    const abas = tags(wb, 'sheet').map(s => ({
      nome: s.getAttribute('name'),
      rid: s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    }));
    const relsTxt = await ler('xl/_rels/workbook.xml.rels');
    const rels = {};
    if (relsTxt) tags(xml(relsTxt), 'Relationship').forEach(r => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const aba = abas[indiceAba || 0] || abas[0];
    let alvo = rels[aba && aba.rid] || 'worksheets/sheet1.xml';
    alvo = alvo.replace(/^\/?xl\//, '').replace(/^\//, '');
    const sheetTxt = await ler('xl/' + alvo);
    if (!sheetTxt) throw new Error('Não foi possível ler a planilha.');

    const compartilhadas = [];
    const ssTxt = await ler('xl/sharedStrings.xml');
    if (ssTxt) tags(xml(ssTxt), 'si').forEach(si => compartilhadas.push(tags(si, 't').map(t => t.textContent).join('')));

    // Estilos de data
    const estilosData = new Set();
    const stTxt = await ler('xl/styles.xml');
    if (stTxt) {
      const st = xml(stTxt);
      const fmtsData = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
      tags(st, 'numFmt').forEach(nf => {
        const cod = (nf.getAttribute('formatCode') || '').replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
        if (/[dmy]/i.test(cod) && !/0\.0|#/.test(cod)) fmtsData.add(+nf.getAttribute('numFmtId'));
      });
      const xfs = tags(st, 'cellXfs')[0];
      if (xfs) Array.from(xfs.children).forEach((xf, i) => { if (fmtsData.has(+xf.getAttribute('numFmtId'))) estilosData.add(i); });
    }

    const linhas = [];
    tags(xml(sheetTxt), 'row').forEach(row => {
      const linha = [];
      tags(row, 'c').forEach((c, pos) => {
        const ref = c.getAttribute('r');
        const idx = ref ? colunaIndice(ref) : pos;
        const t = c.getAttribute('t');
        const vEl = tags(c, 'v')[0];
        let v = vEl ? vEl.textContent : '';
        if (t === 's') v = compartilhadas[+v] || '';
        else if (t === 'inlineStr') v = tags(c, 't').map(x => x.textContent).join('');
        else if (t === 'b') v = v === '1' ? 'VERDADEIRO' : 'FALSO';
        else if ((t === null || t === 'n') && v !== '') {
          const n = parseFloat(v);
          if (estilosData.has(+c.getAttribute('s')) && n > 0 && n < 2958466) {
            const iso = serialExcelParaData(n);
            v = iso ? iso.split('-').reverse().join('/') : v;
          } else if (isFinite(n)) {
            v = String(Math.round(n * 100) / 100);
          }
        }
        linha[idx] = String(v).trim();
      });
      for (let i = 0; i < linha.length; i++) if (linha[i] == null) linha[i] = '';
      if (linha.some(x => x !== '')) linhas.push(linha);
    });
    return { abas: abas.map(a => a.nome), linhas };
  }

  /** Lê um arquivo de texto tentando UTF-8 e, se falhar, Windows-1252. */
  function decodificarTexto(buf) {
    let t = new TextDecoder('utf-8').decode(buf);
    if (t.indexOf('�') >= 0) t = new TextDecoder('windows-1252').decode(buf);
    return t.replace(/^﻿/, '');
  }

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  root.Parsers = {
    parseData, parseNumero, detectarFormatoNumero, detectarSeparador, parseCSV,
    ehOFX, parseOFX, parseXLSX, decodificarTexto, norm, montarData
  };
})(typeof window !== 'undefined' ? window : globalThis);
