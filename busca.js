// =============================================================
//  BUSCA — encontra o conteúdo cadastrado mais parecido com a pergunta
//
//  1. Normaliza o texto (minúsculas, sem acentos, sem pontuação)
//  2. Remove palavras vazias ("como", "o", "de"...) e aplica sinônimos
//  3. Compara as palavras da pergunta com as de cada item cadastrado
//     (título, palavras-chave e resposta), aceitando variações
//     ("escovar" ≈ "escovação" porque começam igual)
//  4. Palavras raras pesam mais que palavras comuns (ex.: "siso" > "dente")
//  5. Nota final de 0 a 1. Abaixo do limite → "não sei, procure um dentista"
// =============================================================

const PALAVRAS_VAZIAS = new Set((
  "a o as os um uma uns umas de do da dos das no na nos nas em por para pra pro com sem " +
  "e ou que qual quais quando como onde porque por que pq quem eu me meu minha meus minhas " +
  "voce vc seu sua seus suas ele ela eles elas isso isto esse essa este esta ao aos se " +
  "ja nao sim mais muito muita muitos pode posso devo deve preciso precisa tenho tem ter " +
  "fazer faz fica ficar estou esta estao ser sou e eh foi vai vou sobre algum alguma " +
  "dia dias depois antes apos ate tambem entao gostaria queria quero saber duvida ola oi"
).split(" "));

const SINONIMOS = {
  doi: "dor", doendo: "dor", dolorido: "dor", dores: "dor", doer: "dor",
  sangue: "sangramento", sangrando: "sangramento",
  arrancar: "extracao", arranquei: "extracao", extrai: "extracao", tirei: "extracao", tirou: "extracao",
  comendo: "comer", comida: "comer", alimentar: "comer", alimentacao: "comer",
  fita: "fio", hilo: "fio",
  lavar: "escovar", limpar: "higienizar", limpeza: "higienizacao",
  bafo: "halito", cheiro: "halito",
  criancas: "crianca", filho: "crianca", bebe: "crianca", infantil: "crianca",
  branco: "clareamento", branquear: "clareamento", clarear: "clareamento",
  pasta: "creme", remedio: "medicamentos", remedios: "medicamentos", medicamento: "medicamentos",
};

function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "escovação", "escovar", "escova" → "escov"
function radical(palavra) {
  return palavra.length >= 5 ? palavra.slice(0, 5) : palavra;
}

function extrairPalavras(texto) {
  return normalizar(texto)
    .split(" ")
    .filter((p) => p.length >= 2 && !PALAVRAS_VAZIAS.has(p))
    .map((p) => SINONIMOS[p] || p);
}

// Pesos de cada campo do item
const PESOS = { titulo: 1, palavras: 0.9, subcategoria: 0.6, resposta: 0.35 };

function criarIndice(itens) {
  const docs = itens.map((item) => {
    const exatas = new Map();
    const radicais = new Map();
    for (const [campo, peso] of Object.entries(PESOS)) {
      for (const p of extrairPalavras(item[campo])) {
        exatas.set(p, Math.max(exatas.get(p) || 0, peso));
        const r = radical(p);
        radicais.set(r, Math.max(radicais.get(r) || 0, peso));
      }
    }
    return { item, exatas, radicais };
  });

  // Frequência de cada radical → palavras raras valem mais (IDF)
  const freq = new Map();
  for (const d of docs) for (const r of d.radicais.keys()) freq.set(r, (freq.get(r) || 0) + 1);
  const N = docs.length || 1;
  const importancia = (r) => Math.log(1 + N / (freq.get(r) || 1));

  // Vocabulário: todas as palavras cadastradas (usado para corrigir erros de digitação)
  const vocabulario = new Map();
  for (const d of docs) for (const p of d.exatas.keys()) vocabulario.set(p, (vocabulario.get(p) || 0) + 1);

  return { docs, importancia, vocabulario, radicais: freq };
}

// ---------- Tolerância a erros de digitação ----------

// Quantas letras precisam ser trocadas, incluídas, apagadas ou invertidas
// para uma palavra virar a outra. Ex.: "dentau" → "dental" = 1; "bruxsmo" → "bruxismo" = 1
function distancia(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let ant2 = null;
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (ant2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, ant2[j - 2] + 1);
      atual.push(v);
      menor = Math.min(menor, v);
    }
    if (menor > max) return max + 1; // já passou do limite: desiste cedo
    ant2 = ant;
    ant = atual;
  }
  return ant[b.length];
}

// Palavras curtas não são corrigidas (muito risco de confundir).
// Até 7 letras aceita 1 erro; 8 ou mais aceita 2.
function errosAceitos(palavra) {
  if (palavra.length < 4) return 0;
  return palavra.length >= 8 ? 2 : 1;
}

// Erro de digitação de uma palavra vazia ("presiso" → "preciso") também é ignorado
function pareceVazia(palavra) {
  if (palavra.length < 4) return false;
  for (const v of PALAVRAS_VAZIAS) if (v.length >= 4 && v[0] === palavra[0] && distancia(palavra, v, 1) <= 1) return true;
  return false;
}

// Para cada palavra da pergunta, devolve as formas a comparar com o conteúdo:
// a palavra original e, se ela não existir no conteúdo, a palavra cadastrada mais parecida.
// Exige a mesma primeira letra (quase ninguém erra a primeira) para evitar trocas absurdas.
function corrigirPalavra(indice, palavra) {
  const original = { palavra, fator: 1 };
  if (indice.vocabulario.has(palavra)) return [original];
  const max = errosAceitos(palavra);
  if (!max) return [original];

  let melhor = null;
  for (const [candidata, vezes] of indice.vocabulario) {
    if (candidata[0] !== palavra[0] || candidata.length < 4) continue;
    const d = distancia(palavra, candidata, max);
    if (d > max) continue;
    if (!melhor || d < melhor.d || (d === melhor.d && vezes > melhor.vezes)) melhor = { candidata, d, vezes };
  }
  if (!melhor) return indice.radicais.has(radical(palavra)) || !pareceVazia(palavra) ? [original] : [];
  // A forma corrigida vem primeiro: é ela que define o peso da palavra
  return [{ palavra: melhor.candidata, fator: melhor.d === 1 ? 0.85 : 0.7 }, original];
}

function buscar(indice, pergunta, limite = 3) {
  const vistas = new Set();
  const termos = extrairPalavras(pergunta)
    .map((p) => corrigirPalavra(indice, p))
    .filter((formas) => formas.length && !vistas.has(formas[0].palavra) && vistas.add(formas[0].palavra));
  if (!termos.length) return [];

  const pesosPergunta = termos.map((formas) => indice.importancia(radical(formas[0].palavra)));
  const total = pesosPergunta.reduce((a, b) => a + b, 0);

  return indice.docs
    .map((d) => {
      let soma = 0;
      termos.forEach((formas, i) => {
        let melhor = 0;
        for (const { palavra: p, fator } of formas) {
          const exata = d.exatas.get(p) || 0;
          const parecida = (d.radicais.get(radical(p)) || 0) * 0.85;
          melhor = Math.max(melhor, Math.max(exata, parecida) * fator);
        }
        soma += pesosPergunta[i] * melhor;
      });
      return { item: d.item, nota: soma / total };
    })
    .filter((r) => r.nota > 0)
    .sort((a, b) => b.nota - a.nota)
    .slice(0, limite);
}

if (typeof module !== "undefined") module.exports = { normalizar, extrairPalavras, criarIndice, buscar };
