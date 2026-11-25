// =============================================================
//  VOZ — ouvir as respostas em voz alta e perguntar falando
//
//  Usa recursos que já vêm no navegador (grátis, sem servidor):
//   • speechSynthesis   → lê o texto em voz alta
//                         (Safari no iPhone e Mac, Chrome, Edge, Firefox, Android)
//   • SpeechRecognition → transforma a fala em texto
//                         (Safari 14.5+ no iPhone e Mac, Chrome, Edge, Android)
//                         No Firefox não existe: o bot sugere o microfone do teclado.
//
//  Cuidados para o Safari/iPhone:
//   • a primeira fala precisa acontecer dentro de um toque do usuário;
//   • o reconhecimento às vezes não termina sozinho → encerramos após silêncio;
//   • o iPhone usa o Siri para reconhecer: o Siri/Ditado precisa estar ativado.
// =============================================================

const Voz = (() => {
  const sintese = "speechSynthesis" in window ? window.speechSynthesis : null;
  const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const ehApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

  // ---------- Escolha da voz em português ----------
  let vozPt = null;
  function escolherVoz() {
    const todas = sintese.getVoices();
    const br = todas.filter((v) => /^pt[-_]BR/i.test(v.lang));
    const lista = br.length ? br : todas.filter((v) => /^pt/i.test(v.lang));
    // Vozes mais naturais primeiro: Edge (Natural), Apple (Luciana), Google
    const preferidas = [/natural/i, /luciana/i, /google/i, /francisca|thalita|maria/i];
    vozPt = preferidas.map((r) => lista.find((v) => r.test(v.name))).find(Boolean) || lista[0] || null;
  }
  if (sintese) {
    escolherVoz();
    sintese.onvoiceschanged = escolherVoz; // as vozes carregam depois em alguns navegadores
  }

  // ---------- Preparação do texto ----------
  function limpar(texto) {
    return texto
      .replace(/\*\*/g, "")
      .replace(/[\p{Extended_Pictographic}️‍]/gu, "")
      .replace(/[•↩▶✔→]/g, "")
      .replace(/(\d+)\s*cm\b/g, "$1 centímetros")
      .replace(/(\d+)\s*h\b/g, "$1 horas")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => (/[.!?:;]$/.test(l) ? l : l + ".")) // pausa no fim de cada linha
      .join(" ");
  }

  // O Chrome corta falas longas (~15 s): dividimos em pedaços curtos
  function pedacos(texto) {
    const frases = (texto.match(/[^.!?;:]+[.!?;:]*/g) || [texto])
      .flatMap((f) => (f.length > 180 ? f.match(/[^,]+,?/g) : [f]));
    const saida = [];
    let atual = "";
    for (const f of frases) {
      if (atual && (atual + f).length > 180) { saida.push(atual.trim()); atual = ""; }
      atual += f;
    }
    if (atual.trim()) saida.push(atual.trim());
    return saida;
  }

  // ---------- Falar ----------
  let sessao = 0;       // cada fala tem um número; falas antigas não mexem no botão atual
  let botaoAtivo = null;

  function marcar(botao, ativo) {
    if (!botao) return;
    botao.classList.toggle("falando", ativo);
    botao.setAttribute("aria-pressed", ativo);
    const rotulo = botao.querySelector(".rotulo");
    if (rotulo) rotulo.textContent = ativo ? "Parar" : "Ouvir";
  }

  let lendo = false; // true enquanto uma resposta está sendo lida

  function parar() {
    sessao++;
    marcar(botaoAtivo, false);
    botaoAtivo = null;
    // Só cancela leituras de verdade (não a fala silenciosa que libera o áudio no iPhone)
    if (sintese && lendo) sintese.cancel();
    lendo = false;
  }

  function falar(texto, botao = null) {
    if (!sintese) return false;
    const estavaFalando = lendo;
    parar();
    const partes = pedacos(limpar(texto));
    if (!partes.length) return false;

    const minha = sessao;
    lendo = true;
    botaoAtivo = botao;
    marcar(botao, true);
    const terminar = () => {
      if (minha !== sessao) return;
      marcar(botao, false);
      botaoAtivo = null;
      lendo = false;
    };

    const enfileirar = () => {
      if (minha !== sessao) return;
      partes.forEach((p, i) => {
        const u = new SpeechSynthesisUtterance(p);
        u.lang = "pt-BR";
        if (vozPt) u.voice = vozPt;
        u.rate = 1;
        if (i === partes.length - 1) u.onend = terminar;
        u.onerror = terminar;
        sintese.speak(u);
      });
      sintese.resume(); // destrava o Chrome quando ele fica "pausado" sozinho
    };

    // Safari e Chrome às vezes ignoram uma fala logo depois de cancel(): esperamos um pouco.
    // Sem fala anterior, falamos na hora (o iPhone exige isso dentro do toque).
    if (estavaFalando) setTimeout(enfileirar, 150);
    else enfileirar();
    return true;
  }

  // iPhone: libera a fala automática (ex.: ler a resposta de uma pergunta feita por voz).
  // Precisa ser chamada dentro de um toque do usuário.
  let desbloqueado = false;
  function desbloquear() {
    if (!sintese || desbloqueado) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    sintese.speak(u);
    desbloqueado = true;
  }

  // ---------- Ouvir (reconhecimento de fala) ----------
  function ouvir({ aoParcial, aoFinal, aoErro, aoFim } = {}) {
    if (!Reconhecimento) return null;
    parar(); // o microfone não pode ouvir o próprio bot

    const rec = new Reconhecimento(); // uma instância nova a cada vez (mais estável no Safari)
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let texto = "";
    let erro = null;
    let acabou = false;
    let silencio, limite, seguranca;

    const terminar = () => {
      if (acabou) return;
      acabou = true;
      clearTimeout(silencio); clearTimeout(limite); clearTimeout(seguranca);
      if (texto) aoFinal?.(texto);
      else if (erro !== "aborted") aoErro?.(erro || "no-speech");
      aoFim?.();
    };
    const encerrar = () => {
      try { rec.stop(); } catch (e) { /* já parado */ }
      // Se o navegador não avisar que terminou, terminamos mesmo assim
      seguranca = setTimeout(terminar, 1500);
    };

    rec.onresult = (e) => {
      texto = Array.from(e.results).map((r) => r[0].transcript).join(" ").replace(/\s+/g, " ").trim();
      aoParcial?.(texto);
      clearTimeout(silencio);
      if (e.results[e.results.length - 1].isFinal) encerrar();
      else silencio = setTimeout(encerrar, 1600); // iPhone: encerra depois de 1,6 s calado
    };
    rec.onerror = (e) => { erro = e.error; };
    rec.onend = terminar;

    limite = setTimeout(encerrar, 12000); // ninguém fala uma pergunta por mais de 12 s
    try {
      rec.start();
    } catch (e) {
      erro = "start";
      terminar();
      return null;
    }
    return {
      parar: encerrar,
      cancelar() { texto = ""; erro = "aborted"; try { rec.abort(); } catch (e) { /* ok */ } terminar(); },
    };
  }

  function mensagemErro(codigo) {
    switch (codigo) {
      case "not-allowed":
        return "Permita o uso do microfone para este site nas configurações do navegador.";
      case "service-not-allowed":
        return ehApple
          ? "Para perguntar por voz, ative o Siri e o Ditado em Ajustes do aparelho."
          : "O reconhecimento de voz está bloqueado neste navegador.";
      case "no-speech":
        return "Não ouvi nada. Toque no microfone e fale sua pergunta.";
      case "audio-capture":
        return "Nenhum microfone encontrado neste aparelho.";
      case "network":
        return "Sem internet para reconhecer a voz. Tente digitar a pergunta.";
      case "language-not-supported":
        return "Este navegador não reconhece português falado. Tente digitar.";
      default:
        return "Não consegui ouvir. Tente de novo ou digite sua pergunta.";
    }
  }

  return {
    podeFalar: !!sintese,
    podeOuvir: !!Reconhecimento,
    falar,
    parar,
    desbloquear,
    ouvir,
    mensagemErro,
  };
})();
