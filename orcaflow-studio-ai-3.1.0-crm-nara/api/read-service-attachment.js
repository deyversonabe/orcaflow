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
    max_output_tokens: 2600,
  };

  if (isGpt5Model(model)) {
    payload.reasoning = {
      effort: normalizarReasoningEffort(process.env.OPENAI_CHAT_REASONING_EFFORT || "medium"),
    };
    payload.text = {
      verbosity: normalizarVerbosity(process.env.OPENAI_CHAT_VERBOSITY || "medium"),
    };
  } else {
    payload.temperature = 0.1;
  }

  return payload;
}

function montarPrompt({ filename, texto, temImagem }) {
  return `
Voce e o leitor de anexos de briefing do OrcaFlow Studio AI.

TAREFA:
Ler um PDF ou imagem enviada pelo usuario e transformar o conteudo em dados uteis para preencher a descricao de um orcamento.

REGRAS:
- Retorne somente JSON valido, sem markdown.
- Nao invente dados.
- Nao crie prazo, validade, data, condicoes comerciais, condicoes de pagamento, garantia ou condicoes de execucao.
- Extraia somente informacoes que aparecam no arquivo ou texto enviado.
- Se houver destinatario/cliente claro, retorne em "cliente".
- Resuma o objeto do servico em linguagem direta.
- Se houver lista de materiais, itens, quantidades ou valores unitarios, organize em "materiaisTexto".
- Se houver valor total/global explicito no anexo, retorne em "valorGlobalIdentificado"; se nao houver, retorne 0.
- Se o arquivo parecer apenas imagem sem texto, use OCR visual pela imagem anexada.
- A descricao deve ajudar a montar um orcamento, sem copiar texto irrelevante do arquivo.

ARQUIVO:
${clean(filename, 220)}

IMAGEM ANEXADA:
${temImagem ? "sim" : "nao"}

TEXTO EXTRAIDO DO PDF:
${clean(texto, 60000) || "(sem texto pesquisavel extraido)"}

FORMATO EXATO:
{
  "cliente": "",
  "descricaoServico": "",
  "materiaisTexto": "",
  "valorGlobalIdentificado": 0,
  "observacoes": "",
  "confianca": "alta|media|baixa"
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
    if (!rateLimit(req, res, { id: "read-service-attachment", limit: 24, windowMs: 60 * 1000 })) return;
    if (rejectOversizedRequest(req, res, 8_500_000)) return;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY nao configurada no Vercel." });
    }

    const { texto = "", imagem = "", filename = "" } = req.body || {};
    const safeText = clean(texto, 70000);
    const safeImage = typeof imagem === "string" ? imagem.trim() : "";
    const temImagem = imagemValida(safeImage);

    if (safeImage && !temImagem) {
      return res.status(400).json({ error: "Imagem em formato invalido." });
    }

    if (safeImage.length > 7_800_000) {
      return res.status(413).json({ error: "Imagem muito grande. Tente reduzir o arquivo ou enviar um PDF menor." });
    }

    if ((!safeText || safeText.length < 20) && !temImagem) {
      return res.status(400).json({ error: "Nao foi possivel extrair texto suficiente do arquivo." });
    }

    const prompt = montarPrompt({
      filename,
      texto: safeText,
      temImagem,
    });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(montarPayloadOpenAI(prompt, temImagem ? safeImage : "")),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Erro ao consultar a IA.",
      });
    }

    const outputText = extrairTextoResposta(data);
    if (!outputText) {
      return res.status(500).json({ error: "A IA nao retornou conteudo." });
    }

    let parsed;
    try {
      parsed = JSON.parse(limparJson(outputText));
    } catch {
      return res.status(500).json({ error: "A IA retornou um formato invalido." });
    }

    return res.status(200).json({
      dados: {
        cliente: clean(parsed.cliente, 180),
        descricaoServico: clean(parsed.descricaoServico, 2200),
        materiaisTexto: clean(parsed.materiaisTexto, 2200),
        valorGlobalIdentificado: Number(parsed.valorGlobalIdentificado || 0) || 0,
        observacoes: clean(parsed.observacoes, 700),
        confianca: clean(parsed.confianca, 20),
      },
    });
  } catch (error) {
    console.error("Erro em read-service-attachment:", error);
    return res.status(500).json({ error: "Erro interno ao ler anexo com IA." });
  }
}
