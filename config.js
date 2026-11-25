// =============================================================
//  CONFIGURAÇÕES DO ODONTOBOT — edite aqui sem medo
// =============================================================
const CONFIG = {
  // Link CSV da Planilha Google (Arquivo > Compartilhar > Publicar na Web > CSV).
  // Deixe vazio ("") para usar o arquivo conteudo.csv que está junto do site.
  planilhaCSV: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOKUYLL1sM7uEWdEytebb46zvwuD_spNeT7KoOEECQsgrTYV1iLVDnWAYrd2lPpeihzD_SVazVkA0w/pub?output=csv",

  // Link público do site (usado no QR Code). Se vazio, usa o endereço atual.
  linkPublico: "https://nicoly-odontobot-up.netlify.app",

  mensagemBoasVindas:
    "Olá! 😊 Eu sou o **OdontoBot**, seu assistente virtual odontológico.\nEscolha uma das opções abaixo ou digite sua pergunta.",

  mensagemNaoSei:
    "Desculpe, não tenho essa informação no meu conteúdo. 🙁\nPara a sua segurança, procure um **cirurgião-dentista** para uma avaliação personalizada.",

  // Quão parecida a pergunta precisa ser com o conteúdo (0 a 1).
  // Mais alto = mais exigente (responde menos, erra menos).
  limiarConfianca: 0.45,

  // Perguntas prontas que aparecem acima do campo de digitação.
  // Use perguntas que existam na planilha. Deixe [] para esconder.
  sugestoes: [
    "Como passar o fio dental?",
    "Cuidados após extração",
    "Preciso fazer jejum?",
    "Dente sensível ao gelado",
    "Minha gengiva sangra",
    "O que é bruxismo?",
  ],
};
