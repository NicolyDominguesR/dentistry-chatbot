// =============================================================
//  ODONTOBOT — lógica da conversa
// =============================================================

const MENU = [
  { secao: "faq",           icone: "💬", cor: "#2f6fe4", rotulo: "Perguntas frequentes",        desc: "Dúvidas mais comuns" },
  { secao: "higiene",       icone: "🪥", cor: "#19b597", rotulo: "Higiene bucal",               desc: "Escovação, fio e língua" },
  { secao: "preoperatorio", icone: "🩺", cor: "#8b5cf6", rotulo: "Orientações pré-operatórias", desc: "Antes e depois de procedimentos" },
  { secao: "videos",        icone: "🎬", cor: "#f43f5e", rotulo: "Vídeos educativos",           desc: "Assista aqui mesmo" },
  { secao: "dentista",      icone: "🦷", cor: "#f59e0b", rotulo: "Quando procurar um dentista", desc: "Sinais de alerta" },
];

const INTRO_SECAO = {
  faq: "Escolha um tema para ver as perguntas mais frequentes:",
  higiene: "Uma boa higiene bucal previne cáries, gengivite e mau hálito. Escolha um tema:",
  preoperatorio: "Escolha o tema ou procedimento para ver as orientações revisadas pela nossa equipe:",
  videos: "Toque em um vídeo para assistir aqui mesmo:",
  dentista: "Procure um cirurgião-dentista nas situações abaixo. Toque para saber mais:",
};

const estado = { itens: [], indice: null };
const $ = (id) => document.getElementById(id);
const areaMensagens = $("mensagens");

// ---------- Carregamento do conteúdo (Planilha Google → arquivo local) ----------

function identificarSecao(texto) {
  const s = normalizar(texto);
  if (s.includes("faq") || s.includes("frequent")) return "faq";
  if (s.includes("higien")) return "higiene";
  if (s.includes("pre") && s.includes("oper")) return "preoperatorio";
  if (s.includes("video")) return "videos";
  if (s.includes("dentista") || s.includes("procurar")) return "dentista";
  return s;
}

function idYoutube(url) {
  if (!url) return "";
  const m = url.trim().match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : "";
}

function interpretarCSV(texto) {
  const { data } = Papa.parse(texto, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizar(h).replace(/ /g, "_"),
  });
  return data
    .map((l, i) => ({
      id: i,
      secao: identificarSecao(l.secao),
      subcategoria: (l.subcategoria || "").trim(),
      titulo: (l.titulo || "").trim(),
      resposta: (l.resposta || "").trim(),
      palavras: l.palavras_chave || "",
      video: idYoutube(l.video),
      fonte: (l.fonte || "").trim(),
    }))
    .filter((i) => i.titulo && i.resposta);
}

async function baixar(url, ms = 7000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

async function carregarConteudo() {
  const fontes = [CONFIG.planilhaCSV, "conteudo.csv"].filter(Boolean);
  for (const url of fontes) {
    try {
      const itens = interpretarCSV(await baixar(url));
      if (itens.length) {
        console.info(`OdontoBot: ${itens.length} itens carregados de ${url}`);
        return itens;
      }
    } catch (e) {
      console.warn("OdontoBot: falha ao carregar", url, e);
    }
  }
  return [];
}

// ---------- Renderização das mensagens ----------

function formatar(texto) {
  const esc = texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
}

function rolarParaFim() {
  requestAnimationFrame(() => areaMensagens.scrollTo({ top: areaMensagens.scrollHeight, behavior: "smooth" }));
}

function linhaBot(conteudo) {
  const linha = document.createElement("div");
  linha.className = "linha-bot";
  linha.innerHTML = '<div class="mini-avatar" aria-hidden="true"><img src="icone.png" alt=""></div>';
  linha.appendChild(conteudo);
  return linha;
}

function botaoOpcao(op) {
  const b = document.createElement("button");
  if (op.menu) {
    b.className = "cartao-menu";
    b.style.setProperty("--cor-icone", `color-mix(in srgb, ${op.cor} 16%, transparent)`);
    b.innerHTML = `<span class="icone" aria-hidden="true">${op.icone}</span><span><b></b><small></small></span>`;
    b.querySelector("b").textContent = op.rotulo;
    b.querySelector("small").textContent = op.desc || "";
  } else {
    b.className = "opcao" + (op.voltar ? " opcao-voltar" : "");
    b.textContent = op.rotulo;
  }
  b.onclick = () => {
    msgUsuario(op.rotulo.replace(/^[\p{Extended_Pictographic}️↩]+\s*/u, ""));
    op.acao();
  };
  return b;
}

const ICONE_SOM = '<svg class="i-som" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const ICONE_PARAR = '<svg class="i-parar" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

function botaoOuvir(texto) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-ouvir";
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `${ICONE_SOM}${ICONE_PARAR}<span class="rotulo">Ouvir</span>`;
  b.onclick = () => (b.classList.contains("falando") ? Voz.parar() : Voz.falar(texto, b));
  return b;
}

function msgUsuario(texto) {
  Voz.parar();
  const div = document.createElement("div");
  div.className = "msg msg-usuario";
  div.textContent = texto;
  areaMensagens.appendChild(div);
  rolarParaFim();
}

// opcoes: [{ rotulo, acao, voltar? }]  |  extra: elemento HTML adicional (ex.: vídeo)
// ouvir: mostra o botão "Ouvir" (leitura em voz alta)
// Devolve { texto, botaoOuvir } quando a mensagem aparece na tela.
function msgBot(texto, opcoes = [], extra = null, { ouvir = false } = {}) {
  const bolinhas = document.createElement("div");
  bolinhas.className = "msg msg-bot digitando";
  bolinhas.innerHTML = "<span></span><span></span><span></span>";
  const digitando = linhaBot(bolinhas);
  areaMensagens.appendChild(digitando);
  rolarParaFim();

  return new Promise((ok) =>
    setTimeout(() => {
      digitando.remove();
      const bloco = document.createElement("div");
      bloco.className = "bloco-bot";

      const balao = document.createElement("div");
      balao.className = "msg msg-bot";
      balao.innerHTML = formatar(texto);
      const ouvirBtn = ouvir && Voz.podeFalar ? botaoOuvir(texto) : null;
      if (ouvirBtn) balao.appendChild(ouvirBtn);
      if (extra) balao.appendChild(extra);
      bloco.appendChild(balao);

      if (opcoes.length) {
        const lista = document.createElement("div");
        lista.className = opcoes.some((o) => o.menu) ? "opcoes opcoes-menu" : "opcoes";
        opcoes.forEach((op) => lista.appendChild(botaoOpcao(op)));
        bloco.appendChild(lista);
      }
      areaMensagens.appendChild(linhaBot(bloco));
      rolarParaFim();
      ok({ texto, botaoOuvir: ouvirBtn });
    }, 450)
  );
}

function cartaoVideo(item) {
  const c = document.createElement("button");
  c.className = "cartao-video";
  c.innerHTML = `
    <span class="miniatura" style="background-image:url(https://i.ytimg.com/vi/${item.video}/hqdefault.jpg)">
      <span class="play">▶</span>
    </span>
    <span class="cartao-titulo">${formatar(item.titulo)}</span>`;
  c.onclick = () => abrirVideo(item);
  return c;
}

// ---------- Fluxos da conversa ----------

const voltarMenu = { rotulo: "🏠 Menu inicial", acao: () => mostrarMenu(), voltar: true };

function mostrarMenu(texto = "Como posso te ajudar? Escolha uma opção ou digite sua pergunta. 👇") {
  return msgBot(
    texto,
    MENU.map((m) => ({ ...m, menu: true, acao: () => abrirSecao(m.secao) }))
  );
}

function itensDaSecao(secao) {
  return estado.itens.filter((i) => i.secao === secao);
}

// Se a seção tiver subcategorias preenchidas, mostra primeiro os temas;
// senão, lista as perguntas direto.
function abrirSecao(secao) {
  if (secao === "videos") return mostrarVideos();

  const itens = itensDaSecao(secao);
  if (!itens.length) return msgBot("Ainda não há conteúdo cadastrado nesta seção.", [voltarMenu]);

  const temas = [...new Set(itens.map((i) => i.subcategoria).filter(Boolean))];
  if (temas.length) {
    return msgBot(INTRO_SECAO[secao], [
      ...temas.map((t) => ({ rotulo: t, acao: () => mostrarTema(secao, t) })),
      voltarMenu,
    ]);
  }
  return msgBot(INTRO_SECAO[secao], [
    ...itens.map((i) => ({ rotulo: i.titulo, acao: () => responder(i, () => abrirSecao(secao)) })),
    voltarMenu,
  ]);
}

function mostrarTema(secao, tema) {
  const itens = itensDaSecao(secao).filter((i) => i.subcategoria === tema);
  const voltarTemas = { rotulo: "↩ Outros temas", acao: () => abrirSecao(secao), voltar: true };
  if (itens.length === 1) return responder(itens[0], () => abrirSecao(secao));
  return msgBot(`**${tema}**: o que você quer saber?`, [
    ...itens.map((i) => ({ rotulo: i.titulo, acao: () => responder(i, () => mostrarTema(secao, tema)) })),
    voltarTemas,
    voltarMenu,
  ]);
}

function mostrarVideos() {
  const comVideo = estado.itens.filter((i) => i.video);
  if (!comVideo.length) return msgBot("Ainda não há vídeos cadastrados.", [voltarMenu]);
  const grade = document.createElement("div");
  grade.className = "grade-videos";
  comVideo.forEach((i) => grade.appendChild(cartaoVideo(i)));
  return msgBot(INTRO_SECAO.videos, [voltarMenu], grade);
}

function responder(item, voltar, relacionados = []) {
  let extra = null;
  if (item.video || item.fonte) {
    extra = document.createElement("div");
    if (item.video) extra.appendChild(cartaoVideo(item));
    if (item.fonte) {
      const f = document.createElement("p");
      f.className = "fonte";
      f.textContent = "📚 Fonte: " + item.fonte;
      extra.appendChild(f);
    }
  }
  const opcoes = [
    ...relacionados.map((r) => ({ rotulo: "🔎 " + r.titulo, acao: () => responder(r, voltar) })),
    ...(voltar ? [{ rotulo: "↩ Voltar", acao: voltar, voltar: true }] : []),
    voltarMenu,
  ];
  return msgBot(`**${item.titulo}**\n\n${item.resposta}`, opcoes, extra, { ouvir: true });
}

// ---------- Perguntas digitadas ----------

function tratarPergunta(texto) {
  const t = normalizar(texto);

  if (/^(oi+|ola|opa|eai|e ai|hey|bom dia|boa tarde|boa noite)\b/.test(t) && t.split(" ").length <= 3) {
    return mostrarMenu("Olá! 😊 Como posso te ajudar hoje?");
  }
  if (/\b(obrigad[oa]|valeu|agradeco)\b/.test(t)) {
    return msgBot("Por nada! 😊 Cuide bem do seu sorriso. Posso ajudar em mais alguma coisa?", [voltarMenu]);
  }
  if (/^(menu|inicio|voltar)$/.test(t)) return mostrarMenu();

  const resultados = buscar(estado.indice, texto, 4);
  const melhor = resultados[0];

  if (!melhor || melhor.nota < CONFIG.limiarConfianca) {
    return msgBot(CONFIG.mensagemNaoSei, [
      { rotulo: "🦷 Quando procurar um dentista", acao: () => abrirSecao("dentista") },
      voltarMenu,
    ], null, { ouvir: true });
  }

  const relacionados = resultados
    .slice(1)
    .filter((r) => r.nota >= CONFIG.limiarConfianca && r.nota >= melhor.nota * 0.75)
    .map((r) => r.item);
  return responder(melhor.item, null, relacionados);
}

// ---------- Modais ----------

function abrirModal(id) { $(id).hidden = false; }
function fecharModal(modal) {
  modal.hidden = true;
  if (modal.id === "modal-video") $("video-frame").src = "";
}

function abrirVideo(item) {
  Voz.parar();
  $("video-titulo").textContent = item.titulo;
  $("video-frame").src = `https://www.youtube-nocookie.com/embed/${item.video}?autoplay=1&rel=0&playsinline=1`;
  $("video-link").href = `https://www.youtube.com/watch?v=${item.video}`;
  abrirModal("modal-video");
}

function linkDoSite() {
  return CONFIG.linkPublico || location.origin + location.pathname;
}

function abrirQR() {
  const alvo = $("qrcode");
  alvo.innerHTML = "";
  new QRCode(alvo, { text: linkDoSite(), width: 240, height: 240, colorDark: "#0d47a1", colorLight: "#ffffff" });
  $("qr-link").textContent = linkDoSite();
  abrirModal("modal-qr");
}

document.querySelectorAll(".modal").forEach((m) => {
  m.addEventListener("click", (e) => {
    if (e.target === m || e.target.hasAttribute("data-fechar")) fecharModal(m);
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".modal:not([hidden])").forEach(fecharModal);
});

// ---------- Inicialização ----------

const conteudoPronto = carregarConteudo().then((itens) => {
  estado.itens = itens;
  estado.indice = criarIndice(itens);
});

async function iniciarChat() {
  $("tela-inicial").hidden = true;
  $("app").hidden = false;
  await conteudoPronto;
  await mostrarMenu(CONFIG.mensagemBoasVindas);
  if (!estado.itens.length) msgBot("⚠️ Não consegui carregar o conteúdo agora. Tente recarregar a página.");
}

$("btn-iniciar").onclick = iniciarChat;
$("btn-qr").onclick = abrirQR;
$("btn-qr-inicial").onclick = abrirQR;
$("btn-menu").onclick = () => { Voz.parar(); mostrarMenu(); };

// porVoz: a pergunta foi falada → a resposta é lida em voz alta automaticamente
function enviarPergunta(texto, { porVoz = false } = {}) {
  texto = texto.trim();
  if (!texto) return;
  $("sugestoes").innerHTML = ""; // as sugestões somem depois da primeira pergunta
  msgUsuario(texto);
  conteudoPronto
    .then(() => tratarPergunta(texto))
    .then((r) => { if (porVoz && r) Voz.falar(r.texto, r.botaoOuvir); });
}

const campo = $("campo-pergunta");
const atualizarEnviar = () => { $("btn-enviar").disabled = !campo.value.trim(); };
campo.addEventListener("input", atualizarEnviar);

$("form-pergunta").addEventListener("submit", (e) => {
  e.preventDefault();
  if (escuta) escuta.cancelar();
  const texto = campo.value;
  campo.value = "";
  atualizarEnviar();
  enviarPergunta(texto);
});

// ---------- Perguntar por voz ----------

let avisoTimer;
function avisoVoz(texto) {
  const el = $("aviso-voz");
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

let escuta = null;
function modoOuvindo(ativo) {
  $("btn-voz").classList.toggle("ouvindo", ativo);
  $("btn-voz").setAttribute("aria-label", ativo ? "Parar de ouvir" : "Perguntar por voz");
  $("form-pergunta").classList.toggle("ouvindo", ativo);
  campo.placeholder = ativo ? "Ouvindo... fale sua pergunta" : "Digite ou fale sua pergunta...";
}

$("btn-voz").onclick = () => {
  if (escuta) return escuta.parar(); // tocar de novo = terminei de falar
  if (!Voz.podeOuvir) {
    // Firefox e alguns navegadores de aplicativos: o teclado do celular tem ditado (🎤)
    avisoVoz("Este navegador não reconhece voz. Toque no campo e use o microfone 🎤 do teclado para ditar.");
    campo.focus();
    return;
  }
  $("aviso-voz").hidden = true;
  Voz.desbloquear(); // iPhone: libera a leitura automática da resposta
  modoOuvindo(true);
  escuta = Voz.ouvir({
    aoParcial: (t) => { campo.value = t; atualizarEnviar(); },
    aoFinal: (t) => {
      campo.value = "";
      atualizarEnviar();
      enviarPergunta(t, { porVoz: true });
    },
    aoErro: (codigo) => avisoVoz(Voz.mensagemErro(codigo)),
    aoFim: () => { escuta = null; modoOuvindo(false); },
  });
};

// Sugestões de perguntas acima do campo de digitação (config.js → sugestoes)
for (const s of CONFIG.sugestoes || []) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "sugestao";
  b.textContent = s;
  b.onclick = () => enviarPergunta(s);
  $("sugestoes").appendChild(b);
}

// ?qr na URL abre o QR Code direto (útil para projetar na sala)
if (new URLSearchParams(location.search).has("qr")) abrirQR();
