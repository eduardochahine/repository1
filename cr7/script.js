// ---------- Dados ----------
const CLUBS = [
  { id:"sporting", name:"Sporting CP", short:"SCP", years:"2002–2003", color:"#008057",
    games:31, goals:5,
    facts:["Estreou como profissional aos 17 anos","Marcou dois gols logo na estreia na liga portuguesa","Um amistoso contra o Man. United mudou tudo"] },
  { id:"mufc1", name:"Manchester United", short:"MUN", years:"2003–2009", color:"#DA291C",
    games:292, goals:118,
    facts:["Herdou a camisa 7 de Beckham, Cantona e Best","3 Premier Leagues seguidas (2007–2009)","Champions League 2008 e primeira Bola de Ouro"] },
  { id:"real", name:"Real Madrid", short:"RMA", years:"2009–2018", color:"#B8963A",
    games:438, goals:450,
    facts:["Maior artilheiro da história do clube","4 Champions League, incluindo o tri 2016–2018","4 Bolas de Ouro com a camisa branca"] },
  { id:"juve", name:"Juventus", short:"JUV", years:"2018–2021", color:"#444444",
    games:134, goals:101,
    facts:["Campeão da Serie A em 2019 e 2020","Artilheiro da Serie A 2020–21","Mais de 100 gols em apenas três temporadas"] },
  { id:"mufc2", name:"Manchester United", short:"MUN", years:"2021–2022", color:"#A51C24",
    games:54, goals:27,
    facts:["Retorno emocionante a Old Trafford","Artilheiro do time na Premier League 2021–22","Hat-tricks contra Tottenham e Norwich"] },
  { id:"nassr", name:"Al-Nassr", short:"NSR", years:"2023–hoje", color:"#F2B705",
    games:null, goals:null,
    facts:["Chegou em janeiro de 2023, transformando a Saudi Pro League","Artilheiro da liga saudita com recorde de gols em 2023–24","Passou dos 900 gols na carreira em 2024"] },
  { id:"por", name:"Seleção de Portugal", short:"POR", years:"2003–hoje", color:"#046A38",
    games:null, goals:null,
    facts:["Campeão da Eurocopa 2016 e de duas Ligas das Nações","Maior artilheiro da história das seleções","Capitão e recordista de jogos pela seleção"] },
];

const BARS = [
  { label:"Real Madrid", value:450, color:"#B8963A" },
  { label:"Portugal", value:140, color:"#046A38", plus:true },
  { label:"Man. United", value:145, color:"#DA291C" },
  { label:"Juventus", value:101, color:"#777" },
  { label:"Al-Nassr", value:90, color:"#F2B705", plus:true },
  { label:"Sporting", value:5, color:"#008057" },
];

const QUIZ = [
  { q:"Em que cidade Cristiano Ronaldo nasceu?", opts:["Lisboa","Porto","Funchal","Braga"], a:2,
    info:"Ele nasceu em Funchal, na ilha da Madeira, em 5 de fevereiro de 1985." },
  { q:"Por qual clube ele começou a carreira profissional?", opts:["Benfica","Sporting","Porto","Nacional"], a:1,
    info:"Foi formado na academia do Sporting, em Lisboa." },
  { q:"Em que ano ganhou a primeira Bola de Ouro?", opts:["2006","2008","2011","2013"], a:1,
    info:"2008, ainda no Manchester United, após vencer Premier League e Champions." },
  { q:"Quantas Champions League ele conquistou?", opts:["3","4","5","6"], a:2,
    info:"Cinco: uma pelo Manchester United (2008) e quatro pelo Real Madrid." },
  { q:"Qual título Portugal conquistou em 2016 com CR7 como capitão?", opts:["Copa do Mundo","Copa das Confederações","Liga das Nações","Eurocopa"], a:3,
    info:"A Eurocopa de 2016, na França — primeiro grande título da seleção portuguesa." },
  { q:"De qual clube ele é o maior artilheiro da história?", opts:["Manchester United","Juventus","Real Madrid","Sporting"], a:2,
    info:"Real Madrid: 450 gols em 438 jogos." },
];

// ---------- Navegação ----------
const nav = document.getElementById("nav");
const navLinks = document.getElementById("navLinks");
const navToggle = document.getElementById("navToggle");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 40), { passive:true });
navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", open);
});
navLinks.addEventListener("click", e => { if (e.target.tagName === "A") navLinks.classList.remove("open"); });

// ---------- Clubes ----------
const tabs = document.getElementById("clubTabs");
const card = document.getElementById("clubCard");
function showClub(id){
  const c = CLUBS.find(x => x.id === id);
  tabs.querySelectorAll(".club-tab").forEach(t => t.setAttribute("aria-selected", t.dataset.id === id));
  card.style.setProperty("--club", c.color);
  const numbers = c.games
    ? `<div class="club-numbers"><div><b>${c.games}</b><span>jogos</span></div><div><b>${c.goals}</b><span>gols</span></div><div><b>${(c.goals/c.games).toFixed(2)}</b><span>gols/jogo</span></div></div>`
    : "";
  card.innerHTML = `
    <div class="club-badge" style="--club:${c.color}">${c.short}</div>
    <div>
      <h3>${c.name}</h3>
      <p class="club-meta">${c.years}</p>
      ${numbers}
      <ul>${c.facts.map(f => `<li>${f}</li>`).join("")}</ul>
    </div>`;
  card.style.animation = "none"; card.offsetHeight; card.style.animation = "";
}
CLUBS.forEach(c => {
  const b = document.createElement("button");
  b.className = "club-tab"; b.dataset.id = c.id; b.setAttribute("role","tab");
  b.style.setProperty("--club", c.color);
  b.innerHTML = `${c.name}<small>${c.years}</small>`;
  b.addEventListener("click", () => showClub(c.id));
  tabs.appendChild(b);
});
showClub("real");

// ---------- Barras ----------
const barsEl = document.getElementById("goalBars");
const max = Math.max(...BARS.map(b => b.value));
BARS.sort((a,b) => b.value - a.value).forEach(b => {
  barsEl.insertAdjacentHTML("beforeend", `
    <div class="bar-row">
      <span class="bar-label">${b.label}</span>
      <div class="bar-track"><div class="bar-fill" style="--club:${b.color}" data-w="${(b.value/max*100).toFixed(1)}"></div></div>
      <span class="bar-val">${b.value}${b.plus ? "+" : ""}</span>
    </div>`);
});

// ---------- Animações ao rolar ----------
function countUp(el){
  const target = +el.dataset.count, suffix = el.dataset.suffix || "", dur = 1600, t0 = performance.now();
  const step = t => {
    const p = Math.min((t - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + (p === 1 ? suffix : "");
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
document.querySelectorAll(".section .container > *, .stat, .trophy, .records li").forEach(el => el.classList.add("reveal"));
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  const el = e.target;
  el.classList.add("in");
  if (el.dataset.count) countUp(el);
  if (el.classList.contains("bars")) el.querySelectorAll(".bar-fill").forEach(f => f.style.width = f.dataset.w + "%");
  io.unobserve(el);
}), { threshold:.2 });
document.querySelectorAll(".reveal, [data-count], .bars").forEach(el => io.observe(el));

// ---------- SIUUU ----------
const siuBtn = document.getElementById("siuBtn"), siuCount = document.getElementById("siuCount"), siuSec = siuBtn.parentElement;
let siu = 0;
try { siu = +localStorage.getItem("cr7-siu") || 0; } catch {}
siuCount.textContent = siu;
siuBtn.addEventListener("click", () => {
  siu++; siuCount.textContent = siu;
  try { localStorage.setItem("cr7-siu", siu); } catch {}
  siuBtn.classList.remove("pop"); siuBtn.offsetWidth; siuBtn.classList.add("pop");
  const colors = ["#d4af37","#fff","#c8102e","#046a38","#f1d27a"];
  for (let i = 0; i < 40; i++){
    const c = document.createElement("span");
    c.className = "confetti";
    c.style.left = Math.random()*100 + "%";
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = (1.2 + Math.random()*1.4) + "s";
    c.style.animationDelay = Math.random()*.3 + "s";
    siuSec.appendChild(c);
    setTimeout(() => c.remove(), 3000);
  }
});

// ---------- Quiz ----------
const quizBox = document.getElementById("quizBox");
let qi = 0, score = 0;
function renderQuiz(){
  if (qi >= QUIZ.length){
    const msg = score === QUIZ.length ? "Perfeito! Você é um verdadeiro fã do CR7. SIUUU!"
      : score >= 4 ? "Muito bem! Quase uma Bola de Ouro."
      : score >= 2 ? "Nada mal — mas dá para treinar mais."
      : "Hora de rever a carreira lá em cima!";
    quizBox.innerHTML = `<div class="quiz-result"><strong>${score}/${QUIZ.length}</strong><p>${msg}</p>
      <button class="btn btn-gold quiz-next" id="quizRestart">Jogar de novo</button></div>`;
    document.getElementById("quizRestart").onclick = () => { qi = 0; score = 0; renderQuiz(); };
    return;
  }
  const item = QUIZ[qi];
  quizBox.innerHTML = `
    <p class="quiz-progress">Pergunta ${qi+1} de ${QUIZ.length} · ${score} acerto(s)</p>
    <p class="quiz-q">${item.q}</p>
    <div class="quiz-opts">${item.opts.map((o,i) => `<button class="quiz-opt" data-i="${i}">${o}</button>`).join("")}</div>
    <p class="quiz-feedback" id="quizFb"></p>`;
  quizBox.querySelectorAll(".quiz-opt").forEach(btn => btn.onclick = () => {
    const i = +btn.dataset.i, ok = i === item.a;
    if (ok) score++;
    quizBox.querySelectorAll(".quiz-opt").forEach((b,j) => {
      b.disabled = true;
      if (j === item.a) b.classList.add("correct"); else if (j === i) b.classList.add("wrong");
    });
    document.getElementById("quizFb").textContent = (ok ? "✅ Acertou! " : "❌ Errou. ") + item.info;
    const next = document.createElement("button");
    next.className = "btn btn-gold quiz-next";
    next.textContent = qi < QUIZ.length - 1 ? "Próxima pergunta →" : "Ver resultado";
    next.onclick = () => { qi++; renderQuiz(); };
    quizBox.appendChild(next);
  });
}
renderQuiz();
