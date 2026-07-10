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

function limparJson(texto) {
  return String(texto || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
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
    max_output_tokens: 2200,
  };

  if (isGpt5Model(model)) {
    payload.reasoning = {
      effort: normalizarReasoningEffort(process.env.OPENAI_CHAT_REASONING_EFFORT || "medium"),
    };
    payload.text = {
      verbosity: normalizarVerbosity(process.env.OPENAI_CHAT_VERBOSITY || "medium"),
    };
  } else {
    payload.temperature = 0.15;
  }

  return payload;
}

function montarPrompt({ texto, filename, temImagem }) {
  return `
Voce e um extrator de dados do Cartao CNPJ brasileiro.

TAREFA:
Ler o PDF oficial do Cartao CNPJ e devolver os dados cadastrais da empresa em JSON.
Quando houver imagem anexada, use leitura visual/OCR da imagem para preencher os campos.

REGRAS:
- Retorne somente JSON valido, sem markdown.
- Nao invente informacoes.
- Se um campo nao estiver claro, retorne string vazia.
- Se o texto extraido estiver vazio ou incompleto, priorize a imagem anexada.
- Priorize "NOME EMPRESARIAL" para razao social.
- Priorize "TITULO DO ESTABELECIMENTO (NOME DE FANTASIA)" para nome fantasia.
- Monte o endereco com logradouro, numero, complemento, bairro, municipio, UF e CEP quando existirem.
- Preserve CNPJ, e-mail, telefone e site no formato brasileiro quando possivel.
- Gere "assinatura" e "rodape" usando somente dados encontrados.

ARQUIVO:
${clean(filename, 180)}

IMAGEM ANEXADA:
${temImagem ? "sim, ler visualmente a primeira pagina do PDF" : "nao"}

TEXTO EXTRAIDO:
${clean(texto, 45000) || "(sem texto pesquisavel extraido)"}

FORMATO EXATO:
{
  "nome": "",
  "nomeFantasia": "",
  "cnpj": "",
  "email": "",
  "telefone": "",
  "site": "",
  "endereco": "",
  "assinatura": "",
  "rodape": "",
  "confianca": "alta|media|baixa",
  "observacoes": ""
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
    if (!rateLimit(req, res, { id: "read-company-card", limit: 18, windowMs: 60 * 1000 })) return;
    if (rejectOversizedRequest(req, res, 6_500_000)) return;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY nao configurada no Vercel." });
    }

    const { texto, imagem, filename = "" } = req.body || {};
    const safeText = clean(texto, 50000);
    const safeImage = typeof imagem === "string" ? imagem.trim() : "";
    const temImagem = imagemValida(safeImage);

    if (safeImage && !temImagem) {
      return res.status(400).json({ error: "Imagem do PDF em formato invalido." });
    }

    if (safeImage.length > 5_800_000) {
      return res.status(413).json({ error: "Imagem do PDF muito grande. Tente um PDF menor." });
    }

    if ((!safeText || safeText.length < 40) && !temImagem) {
      return res.status(400).json({ error: "Texto insuficiente extraido do PDF e nenhuma imagem OCR foi enviada." });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        montarPayloadOpenAI(montarPrompt({ texto: safeText, filename, temImagem }), temImagem ? safeImage : "")
      ),
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

    const dados = {
      nome: clean(parsed.nome, 180),
      nomeFantasia: clean(parsed.nomeFantasia, 140),
      cnpj: clean(parsed.cnpj, 32),
      email: clean(parsed.email, 140),
      telefone: clean(parsed.telefone, 40),
      site: clean(parsed.site, 160),
      endereco: clean(parsed.endereco, 420),
      assinatura: clean(parsed.assinatura, 180),
      rodape: clean(parsed.rodape, 360),
      confianca: clean(parsed.confianca, 20),
      observacoes: clean(parsed.observacoes, 500),
    };

    return res.status(200).json({ dados });
  } catch (error) {
    console.error("Erro em read-company-card:", error);
    return res.status(500).json({ error: "Erro interno ao ler Cartao CNPJ com IA." });
  }
}
