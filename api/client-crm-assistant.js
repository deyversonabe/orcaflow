import {
  enforceSameOrigin,
  rateLimit,
  rejectOversizedRequest,
  requireSession,
} from "./_security.js";

function clean(valor, limite = 4000) {
  return String(valor || "")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, limite);
}

function limparJson(texto) {
  return String(texto || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function extrairTextoResposta(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const partes = [];
  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (Array.isArray(item?.content)) {
        for (const content of item.content) {
          if (typeof content?.text === "string") partes.push(content.text);
          if (typeof content?.output_text === "string") partes.push(content.output_text);
        }
      }
    }
  }
  return partes.join("\n").trim();
}

function isGpt5Model(modelo = "") {
  return /^gpt-5(?:\.|$|-)/i.test(String(modelo || ""));
}

function normalizarReasoningEffort(valor = "medium") {
  const effort = String(valor || "").trim().toLowerCase();
  return ["low", "medium", "high", "xhigh"].includes(effort) ? effort : "medium";
}

function normalizarVerbosity(valor = "medium") {
  const verbosity = String(valor || "").trim().toLowerCase();
  return ["low", "medium", "high"].includes(verbosity) ? verbosity : "medium";
}

function imagemValida(valor) {
  return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(String(valor || ""));
}

function montarPayloadOpenAI(prompt, imagem = "") {
  const model = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_BUDGET_MODEL || "gpt-5.5";
  const payload = {
    model,
    input: imagem
      ? [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: imagem },
            ],
          },
        ]
      : prompt,
    max_output_tokens: 3600,
  };

  if (isGpt5Model(model)) {
    payload.reasoning = {
      effort: normalizarReasoningEffort(process.env.OPENAI_CHAT_REASONING_EFFORT || "medium"),
    };
    payload.text = {
      verbosity: normalizarVerbosity(process.env.OPENAI_CHAT_VERBOSITY || "medium"),
    };
  } else {
    payload.temperature = 0.35;
  }

  return payload;
}

function resumirContatos(contatos = []) {
  if (!Array.isArray(contatos)) return [];
  return contatos.slice(0, 40).map((item) => ({
    canal: clean(item?.canal, 40),
    direcao: clean(item?.direcao, 40),
    tipo: clean(item?.tipo, 80),
    assunto: clean(item?.assunto, 140),
    mensagem: clean(item?.mensagem || item?.conteudo, 1400),
    arquivoNome: clean(item?.arquivoNome, 160),
    arquivoResumo: clean(item?.arquivoResumo || item?.arquivoTexto, 1800),
    orcamentoNumero: clean(item?.orcamentoNumero, 80),
    criadoEm: clean(item?.criadoEm, 80),
  }));
}

function resumirOrcamentos(orcamentos = []) {
  if (!Array.isArray(orcamentos)) return [];
  return orcamentos.slice(0, 20).map((item) => ({
    id: clean(item?.id, 80),
    origem: clean(item?.origem, 40),
    numero: clean(item?.numero, 80),
    titulo: clean(item?.titulo || item?.cliente || item?.arquivoNome, 180),
    cliente: clean(item?.cliente, 180),
    empresaNome: clean(item?.empresaNome, 180),
    valorGlobal: clean(item?.valorGlobal || item?.valor, 80),
    status: clean(item?.status, 80),
    proximoContato: clean(item?.proximoContato, 80),
    resumo: clean(item?.resumo || item?.arquivoResumo || item?.arquivoTexto, 1200),
    lembreteIA: clean(item?.lembreteIA, 700),
    resumoConversas: clean(item?.resumoConversas, 900),
    descricao: clean(
      item?.orcamentoCompleto?.campos?.escopo ||
        item?.orcamentoCompleto?.campos?.objetivo ||
        item?.descricao ||
      "",
      1400
    ),
    historico: Array.isArray(item?.historico)
      ? item.historico.slice(0, 18).map((msg) => ({
        canal: clean(msg?.canal, 40),
        tipo: clean(msg?.tipo, 80),
        assunto: clean(msg?.assunto, 140),
        mensagem: clean(msg?.mensagem, 1200),
        criadoEm: clean(msg?.criadoEm, 80),
      }))
      : [],
  }));
}

function montarPrompt({ usuarioNome, cliente, contatos, orcamentos, pedido, temImagem }) {
  return `
Voce e Nara, assistente pessoal comercial do OrcaFlow Studio AI.

PERSONALIDADE:
- Fale com o usuario do sistema pelo nome: ${clean(usuarioNome, 80) || "responsavel"}.
- Seja uma amiga de trabalho: objetiva, humana, estrategica e prestativa.
- Nao seja generica. Pense no contexto real do cliente, nos orcamentos e no historico.
- Quando existirem varios orcamentos, trate cada orcamento pelo seu proprio historico. Nao misture tratativas de um orcamento com outro.
- Quando faltar informacao, faca perguntas especificas e uteis para melhorar a chance de fechamento.
- Nao invente dados, prazo, desconto, condicao comercial, garantia ou promessa.
- Se um arquivo ou orcamento nao tiver texto pesquisavel, diga que precisa de informacao complementar em vez de presumir conteudo.

TAREFA:
Analisar o perfil do cliente, historico de contatos, anexos e orcamentos relacionados para recomendar o proximo passo comercial mais inteligente.

CLIENTE:
${JSON.stringify(cliente || {}, null, 2)}

HISTORICO DE CONTATOS:
${JSON.stringify(resumirContatos(contatos), null, 2)}

IMAGEM/PRINT RECENTE ANEXADO:
${temImagem ? "sim, use leitura visual/OCR para interpretar o print ou foto recente" : "nao"}

ORCAMENTOS VINCULADOS OU RELACIONADOS:
${JSON.stringify(resumirOrcamentos(orcamentos), null, 2)}

PEDIDO DO USUARIO:
${clean(pedido || "Gerar estrategia de proximo passo.", 1200)}

RETORNE SOMENTE JSON VALIDO, SEM MARKDOWN, NESTE FORMATO:
{
  "resumoCliente": "",
  "leituraDaSituacao": "",
  "orcamentoProvavel": "",
  "proximoPasso": "",
  "estrategia": "",
  "mensagemSugerida": "",
  "dadosFaltantes": ["pergunta objetiva 1"],
  "perguntaParaUsuario": "",
  "prioridade": "baixa|media|alta|critica",
  "lembreteSugerido": "",
  "proximoContatoSugerido": "YYYY-MM-DD ou vazio",
  "tomRecomendado": "",
  "riscoPerda": ""
}
`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    if (!enforceSameOrigin(req, res)) return;
    if (!(await requireSession(req, res))) return;
    if (!rateLimit(req, res, { id: "client-crm-assistant", limit: 24, windowMs: 60 * 1000 })) return;
    if (rejectOversizedRequest(req, res, 1_900_000)) return;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY nao configurada no Vercel.",
        code: "MISSING_OPENAI_API_KEY",
      });
    }

    const { usuarioNome = "", cliente = {}, contatos = [], orcamentos = [], pedido = "", imagem = "" } = req.body || {};
    const safeImage = typeof imagem === "string" ? imagem.trim() : "";
    const temImagem = imagemValida(safeImage);

    if (safeImage && !temImagem) {
      return res.status(400).json({ error: "Imagem em formato invalido.", code: "INVALID_IMAGE" });
    }

    if (safeImage.length > 800000) {
      return res.status(413).json({ error: "Imagem muito grande para analise da Nara.", code: "IMAGE_TOO_LARGE" });
    }

    if (!cliente || typeof cliente !== "object") {
      return res.status(400).json({ error: "Cliente invalido para analise.", code: "INVALID_CLIENT" });
    }

    const prompt = montarPrompt({ usuarioNome, cliente, contatos, orcamentos, pedido, temImagem });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(montarPayloadOpenAI(prompt, temImagem ? safeImage : "")),
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Erro ao consultar a Nara.",
        code: data?.error?.code || "OPENAI_REQUEST_FAILED",
      });
    }

    const outputText = extrairTextoResposta(data);
    if (!outputText) {
      return res.status(500).json({ error: "A Nara nao retornou conteudo.", code: "EMPTY_AI_RESPONSE" });
    }

    let parsed;
    try {
      parsed = JSON.parse(limparJson(outputText));
    } catch {
      return res.status(500).json({ error: "A Nara retornou um formato invalido.", code: "INVALID_AI_JSON" });
    }

    return res.status(200).json({
      analise: {
        resumoCliente: clean(parsed.resumoCliente, 900),
        leituraDaSituacao: clean(parsed.leituraDaSituacao, 1200),
        orcamentoProvavel: clean(parsed.orcamentoProvavel, 250),
        proximoPasso: clean(parsed.proximoPasso, 900),
        estrategia: clean(parsed.estrategia, 1400),
        mensagemSugerida: clean(parsed.mensagemSugerida, 1600),
        dadosFaltantes: Array.isArray(parsed.dadosFaltantes)
          ? parsed.dadosFaltantes.map((item) => clean(item, 220)).filter(Boolean).slice(0, 8)
          : [],
        perguntaParaUsuario: clean(parsed.perguntaParaUsuario, 600),
        prioridade: clean(parsed.prioridade, 20),
        lembreteSugerido: clean(parsed.lembreteSugerido, 800),
        proximoContatoSugerido: clean(parsed.proximoContatoSugerido, 40),
        tomRecomendado: clean(parsed.tomRecomendado, 300),
        riscoPerda: clean(parsed.riscoPerda, 600),
      },
    });
  } catch (error) {
    console.error("Erro em client-crm-assistant:", error);
    return res.status(500).json({ error: "Erro interno na analise da Nara.", code: "CLIENT_CRM_INTERNAL_ERROR" });
  }
}
