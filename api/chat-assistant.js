import {
  enforceSameOrigin,
  rateLimit,
  rejectOversizedRequest,
  requireSession,
} from "./_security.js";

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

function clean(valor, limite = 4000) {
  return String(valor || "")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, limite);
}

function isGpt5Model(modelo = "") {
  return /^gpt-5(?:\.|$|-)/i.test(String(modelo || ""));
}

function normalizarReasoningEffort(valor = "high") {
  const effort = String(valor || "").trim().toLowerCase();
  return ["low", "medium", "high", "xhigh"].includes(effort) ? effort : "high";
}

function normalizarVerbosity(valor = "medium") {
  const verbosity = String(valor || "").trim().toLowerCase();
  return ["low", "medium", "high"].includes(verbosity) ? verbosity : "medium";
}

function montarPayloadOpenAI(prompt) {
  const model = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_BUDGET_MODEL || "gpt-5.5";
  const payload = {
    model,
    input: prompt,
    max_output_tokens: 4500,
  };

  if (isGpt5Model(model)) {
    payload.reasoning = {
      effort: normalizarReasoningEffort(process.env.OPENAI_CHAT_REASONING_EFFORT || process.env.OPENAI_BUDGET_REASONING_EFFORT),
    };
    payload.text = {
      verbosity: normalizarVerbosity(process.env.OPENAI_CHAT_VERBOSITY || process.env.OPENAI_BUDGET_VERBOSITY),
    };
  } else {
    payload.temperature = 0.45;
  }

  return payload;
}

function resumoCRM(crm = []) {
  if (!Array.isArray(crm)) return [];
  return crm.slice(0, 20).map((item) => {
    const conversas = Array.isArray(item?.conversas) ? item.conversas : [];
    return {
      numero: item?.numero || "",
      cliente: item?.cliente || "",
      empresaNome: item?.empresaNome || "",
      valorGlobal: item?.valorGlobal || "",
      status: item?.status || "",
      proximoContato: item?.proximoContato || "",
      resumoConversas: clean(item?.resumoConversas || "", 900),
      conversasRecentes: conversas.slice(0, 4).map((msg) => ({
        canal: msg?.canal || "",
        direcao: msg?.direcao || "",
        tipo: msg?.tipo || "",
        mensagem: clean(msg?.mensagem || msg?.conteudo || "", 700),
        criadoEm: msg?.criadoEm || "",
      })),
    };
  });
}

function resumoEmpresas(empresas = []) {
  if (!Array.isArray(empresas)) return [];
  return empresas.slice(0, 20).map((emp) => ({
    nome: emp?.nome || "",
    nomeFantasia: emp?.nomeFantasia || "",
    tom: emp?.tom || "",
    diferenciais: emp?.diferenciais || "",
    dnaLinguagem: clean(emp?.dnaLinguagem || "", 1200),
    padraoDocumental: clean(emp?.padraoDocumental || "", 900),
  }));
}

function modoTitulo(modo = "geral") {
  const mapa = {
    geral: "assistente comercial",
    email: "gerador de corpo de e-mail",
    cobranca: "cobranca e follow-up",
    resposta_cliente: "resposta para cliente",
    whatsapp: "mensagem de WhatsApp",
    orcamento: "orientacao para gerar orcamentos",
  };
  return mapa[modo] || mapa.geral;
}

function montarPrompt({ messages, mode, context }) {
  const historico = messages
    .slice(-18)
    .map((msg) => {
      const role = msg?.role === "assistant" ? "ASSISTENTE" : "USUARIO";
      return `${role}: ${clean(msg?.content || "", 2500)}`;
    })
    .join("\n\n");

  return `
Voce e o chat interno do OrcaFlow Studio AI, especializado em propostas comerciais, cobrancas, e-mails, respostas para clientes, mensagens de WhatsApp, follow-up e orientacao para gerar orcamentos.

MODO ATUAL:
${modoTitulo(mode)}

REGRAS DE RESPOSTA:
- Responda sempre em portugues do Brasil.
- Seja profissional, direto e comercialmente util.
- Quando o usuario pedir e-mail, entregue assunto e corpo.
- Quando pedir cobranca, use tom firme, educado e preservando relacionamento.
- Quando pedir resposta para cliente, considere clareza, cordialidade e proximo passo.
- Quando pedir WhatsApp, escreva mensagem curta e natural.
- Quando pedir ajuda para orcamento, organize em checklist, dados faltantes e sugestao de texto.
- Nao diga que enviou e-mail, mensagem ou cobranca; apenas gere o texto.
- Nao invente dados de cliente, valor, prazo, garantia, data ou condicao comercial.
- Se faltar informacao importante, entregue uma versao segura e liste o que precisa ser confirmado.
- Evite emojis, salvo se o usuario pedir explicitamente.

CONTEXTO DISPONIVEL DO ORCAFLOW:
Empresas cadastradas:
${JSON.stringify(resumoEmpresas(context?.empresas), null, 2)}

Orcamentos/CRM recentes:
${JSON.stringify(resumoCRM(context?.crm), null, 2)}

CONVERSA:
${historico}

Responda agora ao ultimo pedido do usuario.
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
    if (!rateLimit(req, res, { id: "chat-assistant", limit: 24, windowMs: 60 * 1000 })) return;
    if (rejectOversizedRequest(req, res, 1_800_000)) return;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY nao configurada no Vercel.",
      });
    }

    const { messages, mode = "geral", context = {} } = req.body || {};

    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: "Envie uma mensagem para a IA." });
    }

    const safeMessages = messages
      .filter((msg) => msg && ["user", "assistant"].includes(msg.role) && clean(msg.content, 1).length)
      .slice(-18)
      .map((msg) => ({
        role: msg.role,
        content: clean(msg.content, 5000),
      }));

    const ultimo = safeMessages[safeMessages.length - 1];
    if (!ultimo || ultimo.role !== "user") {
      return res.status(400).json({ error: "A ultima mensagem deve ser do usuario." });
    }

    const prompt = montarPrompt({ messages: safeMessages, mode, context });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(montarPayloadOpenAI(prompt)),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Erro ao consultar a IA.",
      });
    }

    const answer = extrairTextoResposta(data);
    if (!answer) {
      return res.status(500).json({ error: "A IA nao retornou conteudo." });
    }

    return res.status(200).json({
      answer,
      model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_BUDGET_MODEL || "gpt-5.5",
    });
  } catch (error) {
    console.error("Erro em chat-assistant:", error);
    return res.status(500).json({ error: "Erro interno no chat com IA." });
  }
}
