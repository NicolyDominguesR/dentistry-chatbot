# OdontoBot – Assistente Virtual Odontológico

Chatbot educativo de saúde bucal, desenvolvido para a disciplina de **Saúde Digital** (Odontologia).
Funciona no navegador do celular ou do computador, sem instalação, por meio de um link público e de um QR Code.

---

## 1. Tecnologias utilizadas (todas gratuitas)

| Parte | Tecnologia | Função |
|---|---|---|
| Interface | **HTML, CSS e JavaScript** | Telas, visual responsivo e lógica do chat |
| Base de conhecimento | **Google Planilhas** (publicada como CSV) | Onde a equipe cadastra perguntas, respostas e vídeos |
| Leitura da planilha | **PapaParse** | Converte a planilha em dados que o chatbot entende |
| Vídeos | **YouTube incorporado** (*embed*) | Os vídeos tocam dentro do chatbot, sem sair da página |
| QR Code | **QRCode.js** | Gera o QR Code de acesso para a turma |
| Hospedagem | **Netlify** | Link público, gratuito e com HTTPS |

**Não há servidor (backend).** A planilha funciona como banco de dados e o navegador de cada pessoa executa toda a lógica. Por isso o sistema é gratuito e suporta muitos acessos simultâneos.

---

## 2. Como funciona a lógica do chatbot

O OdontoBot é um **chatbot baseado em regras e em recuperação de informação**. Ele **não inventa respostas**: só mostra conteúdo que a equipe cadastrou e revisou. Em saúde, isso garante segurança e confiabilidade.

### a) Navegação por menu (botões)
O menu inicial tem 5 opções. Cada botão leva diretamente ao conteúdo daquela seção, como uma árvore de decisão:

```
Menu inicial
├── Perguntas frequentes  → lista de perguntas → resposta
├── Higiene bucal         → temas → explicação + vídeo
├── Pré-operatório        → procedimento → antes / depois
├── Vídeos educativos     → vídeos que tocam na própria página
└── Quando procurar um dentista → situações → orientação
```

### b) Perguntas digitadas (busca por palavras-chave)
Quando o paciente digita uma pergunta, o OdontoBot executa estas etapas:

1. **Normalização:** converte para minúsculas e remove acentos e pontuação.
   *"Como passo o FIO DENTAL?"* → *"como passo o fio dental"*
2. **Limpeza:** remove palavras sem significado (*como, o, de, meu...*) e troca sinônimos (*dói → dor*, *arrancar → extração*).
3. **Correção de digitação:** palavras que não existem no conteúdo são trocadas pela palavra cadastrada mais parecida (*"estracao" → "extração"*, *"bruxsmo" → "bruxismo"*). Aceita 1 letra errada em palavras de até 7 letras e 2 nas maiores.
4. **Comparação:** confere as palavras da pergunta com o título, as palavras-chave e a resposta de cada item cadastrado. Aceita variações da mesma palavra (*escovar ≈ escovação ≈ escova*).
5. **Pontuação:** cada item recebe uma nota de 0 a 1. Palavras raras pesam mais que palavras comuns (*siso* diz mais que *dente*).
6. **Decisão:**
   - Nota alta → mostra a resposta cadastrada, sugere assuntos relacionados e exibe o vídeo, se houver.
   - Nota baixa → *"Não tenho essa informação. Procure um cirurgião-dentista."*

### c) Voz (sem custo, usa o próprio navegador)
- **Ouvir:** o botão 🔊 *Ouvir* em cada resposta lê o texto em voz alta, em português.
- **Perguntar falando:** toque no 🎤 ao lado do campo de digitação, fale a pergunta e o bot responde **e lê a resposta em voz alta**.
- Funciona no **Safari (iPhone e Mac)**, Chrome, Edge e Android. No iPhone, o **Siri/Ditado precisa estar ativado** em Ajustes. No Firefox, que não reconhece voz, o bot sugere usar o microfone do teclado.

Essa técnica corresponde à etapa de **recuperação** (*retrieval*) dos sistemas de IA conhecidos como RAG, sem a etapa de geração de texto. Isso foi intencional, para evitar respostas inventadas em temas de saúde.

---

## 3. Como atualizar o conteúdo (para a equipe)

O conteúdo fica em uma **Planilha Google** com estas colunas:

| Coluna | O que colocar | Exemplo |
|---|---|---|
| `secao` | `faq`, `higiene`, `preoperatorio` ou `dentista` | `higiene` |
| `subcategoria` | Tema (opcional). Se preenchida, a seção mostra primeiro a lista de temas. Um tema com um único item abre a resposta direto. | `Implante dentário`, `Anestesia` |
| `titulo` | A pergunta ou o título que aparece no botão | `Como passar o fio dental?` |
| `resposta` | O texto da resposta. Pode ter quebras de linha. Use `**texto**` para **negrito**. | |
| `palavras_chave` | Palavras que o paciente pode usar ao perguntar, separadas por vírgula | `fio dental, fita, entre os dentes` |
| `video` | Link do YouTube (opcional) | `https://www.youtube.com/watch?v=...` |
| `fonte` | De onde veio a informação (opcional). Aparece embaixo da resposta. | `INCA – Câncer de boca` |

- Toda linha com vídeo aparece automaticamente em **Vídeos educativos**.
- Depois de editar a planilha, o chatbot atualiza sozinho. O Google pode levar **até 5 minutos** para refletir a mudança.
- Quanto mais palavras-chave, melhor o bot entende as perguntas digitadas.

### Configuração inicial da planilha (feita uma única vez)
1. No Google Planilhas: **Arquivo → Importar → Upload** → envie o arquivo `conteudo.csv` deste projeto.
2. **Arquivo → Compartilhar → Publicar na Web** → escolha a aba → formato **CSV** → Publicar → copie o link.
3. Cole o link em `config.js`, no campo `planilhaCSV`.
4. Compartilhe a planilha (como editoras) com as pessoas que vão alimentar o conteúdo.

> Se a planilha ficar fora do ar, o chatbot usa automaticamente a cópia local `conteudo.csv`.

---

## 4. Estrutura dos arquivos

```
index.html     → estrutura das telas (inicial, chat, vídeo, QR Code)
estilo.css     → identidade visual (azul + menta), responsiva, com modo escuro automático
config.js      → link da planilha, mensagens, sugestões de perguntas e nível de exigência da busca
busca.js       → algoritmo que encontra a resposta para perguntas digitadas (com correção de digitação)
voz.js         → leitura em voz alta e perguntas por voz
app.js         → fluxo da conversa, menu, vídeos e QR Code
conteudo.csv   → conteúdo inicial / cópia de segurança da planilha
```

## 5. Rodar no computador
```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

Dica para a apresentação: abra o site com `?qr` no final do link (ex.: `.../odontobot/?qr`) para mostrar o QR Code direto na tela do projetor.

---

> ⚠️ Conteúdo educativo. Não substitui a consulta com o cirurgião-dentista.
> As orientações de exemplo devem ser **revisadas pela equipe** antes do uso.
