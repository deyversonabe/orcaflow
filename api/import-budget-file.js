import mammoth from "mammoth";
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

function dataUrlParaBuffer(dataUrl = "") {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;
  return Buffer.from(match[2], "base64");
}

async function extrairDocx(dataUrl) {
  const buffer = dataUrlParaBuffer(dataUrl);
  if (!buffer) return "";
  const result = await mammoth.extractRawText({ buffer });
  return clean(result.value || "", 60000);
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
    payload.temperature = 0.1;
  }

  return payload;
}

function resumoEmpresas(empresas = []) {
  if (!Array.isArray(empresas)) return [];
  return empresas.slice(0, 60).map((emp) => ({
    id: emp?.id || "",
    nome: emp?.nome || "",
    nomeFantasia: emp?.nomeFantasia || "",
    cnpj: emp?.cnpj || "",
    email: emp?.email || "",
    assinatura: emp?.assinatura || "",
    rodape: emp?.rodape || "",
  }));
}

function montarPrompt({ filename, fileModifiedAt, texto, temImagem, empresas }) {
  return `
Voce e um importador de orcamentos antigos para o CRM do OrcaFlow.

TAREFA:
Leia o arquivo de orcamento/cotacao e extraia dados para cadastro no controle comercial.

REGRAS:
- Retorne somente JSON valido, sem markdown.
- Nao invente dados.
- Identifique a empresa proponente comparando o arquivo com a lista de empresas cadastradas.
- Se encontrar a empresa cadastrada, retorne o "empresaId" exatamente como informado na lista.
- Se nao tiver certeza da empresa, deixe empresaId vazio e informe a empresa identificada em "empresaNomeDetectada".
- Extraia o cliente/destinatario, numero do orcamento, descricao curta e valor total/global.
- Para valor, priorize "valor total", "valor global", "investimento", "total", "sub-total" apenas quando for claramente o total da proposta.
- Extraia a data do documento somente se ela aparecer no arquivo. Se nao aparecer, retorne string vazia.
- A data do arquivo enviada pelo navegador e apenas referencia de importacao: ${clean(fileModifiedAt, 80)}
- Nao crie prazo, validade, forma de pagamento, condicoes comerciais ou condicoes de execucao.
- A descricao deve resumir o objeto do orcamento em 1 a 3 linhas.

EMPRESAS CADASTRADAS:
${JSON.stringify(resumoEmpresas(empresas), null, 2)}

ARQUIVO:
${clean(filename, 220)}

IMAGEM ANEXADA:
${temImagem ? "sim, usar leitura visual/OCR quando o texto estiver fraco" : "nao"}

TEXTO EXTRAIDO:
${clean(texto, 60000) || "(sem texto pesquisavel extraido)"}

FORMATO EXATO:
{
  "numero": "",
  "cliente": "",
  "empresaId": "",
  "empresaNomeDetectada": "",
  "descricao": "",
  "valorGlobal": 0,
  "dataDocumento": "",
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
    if (!rateLimit(req, res, { id: "import-budget-file", limit: 36, windowMs: 60 * 1000 })) return;
    if (rejectOversizedRequest(req, res, 9_500_000)) return;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY nao configurada no Vercel." });
    }

    const {
      filename = "",
      mimeType = "",
      texto = "",
      imagem = "",
      fileData = "",
      fileModifiedAt = "",
      empresas = [],
    } = req.body || {};

    const nome = clean(filename, 240);
    const safeImage = typeof imagem === "string" ? imagem.trim() : "";
    const temImagem = imagemValida(safeImage);
    let safeText = clean(texto, 70000);

    if (safeImage && !temImagem) {
      return res.status(400).json({ error: "Imagem do arquivo em formato invalido." });
    }

    const pareceDocx = /\.docx$/i.test(nome) || /officedocument\.wordprocessingml\.document/i.test(String(mimeType));
    if (pareceDocx && !safeText && fileData) {
      safeText = await extrairDocx(fileData);
    }

    if ((!safeText || safeText.length < 25) && !temImagem) {
      return res.status(400).json({ error: "Nao foi possivel extrair texto suficiente do arquivo." });
    }

    const prompt = montarPrompt({
      filename: nome,
      fileModifiedAt,
      texto: safeText,
      temImagem,
      empresas,
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
        numero: clean(parsed.numero, 80),
        cliente: clean(parsed.cliente, 180),
        empresaId: clean(parsed.empresaId, 120),
        empresaNomeDetectada: clean(parsed.empresaNomeDetectada, 180),
        descricao: clean(parsed.descricao, 900),
        valorGlobal: Number(parsed.valorGlobal || 0) || 0,
        dataDocumento: clean(parsed.dataDocumento, 80),
        confianca: clean(parsed.confianca, 20),
        observacoes: clean(parsed.observacoes, 600),
      },
    });
  } catch (error) {
    console.error("Erro em import-budget-file:", error);
    return res.status(500).json({ error: "Erro interno ao importar orcamento com IA." });
  }
}
