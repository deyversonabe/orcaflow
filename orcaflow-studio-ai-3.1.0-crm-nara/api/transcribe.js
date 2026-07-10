export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRequestBody(req, maxBytes) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error("Arquivo muito grande.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function getBoundary(contentType = "") {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] || match?.[2] || "";
}

function parseMultipart(buffer, boundary) {
  const boundaryText = `--${boundary}`;
  const raw = buffer.toString("binary");
  const parts = raw
    .split(boundaryText)
    .filter((part) => part.includes("Content-Disposition"));

  for (const part of parts) {
    const [rawHeaders, ...bodyParts] = part.split("\r\n\r\n");
    if (!rawHeaders || !bodyParts.length) continue;

    const rawBody = bodyParts.join("\r\n\r\n");
    const nameMatch = rawHeaders.match(/name="([^"]+)"/i);
    const filenameMatch = rawHeaders.match(/filename="([^"]+)"/i);
    const typeMatch = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i);

    if (nameMatch?.[1] !== "file" || !filenameMatch) continue;

    let body = rawBody;
    body = body.replace(/\r\n--$/, "").replace(/\r\n$/, "");

    return {
      filename: filenameMatch[1],
      contentType: typeMatch?.[1] || "application/octet-stream",
      data: Buffer.from(body, "binary"),
    };
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    if (!enforceSameOrigin(req, res)) return;
    if (!(await requireSession(req, res))) return;
    if (!rateLimit(req, res, { id: "transcribe", limit: 6, windowMs: 60 * 1000 })) return;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY não configurada no Vercel.",
      });
    }

    const contentType = req.headers["content-type"] || "";
    const boundary = getBoundary(contentType);

    if (!boundary) {
      return res.status(400).json({ error: "Arquivo inválido." });
    }

    const limiteBytes = 25 * 1024 * 1024;
    const limiteComMultipart = limiteBytes + 1024 * 1024;
    if (rejectOversizedRequest(req, res, limiteComMultipart)) return;

    const bodyBuffer = await readRequestBody(req, limiteComMultipart);
    const uploaded = parseMultipart(bodyBuffer, boundary);

    if (!uploaded?.data?.length) {
      return res.status(400).json({ error: "Nenhum arquivo recebido." });
    }

    if (uploaded.data.length > limiteBytes) {
      return res.status(400).json({
        error: "Arquivo muito grande. Limite máximo: 25 MB.",
      });
    }

    const allowedExtensions = [".ogg", ".opus", ".mp3", ".wav", ".m4a", ".mp4", ".webm"];
    const allowedTypes = new Set([
      "audio/ogg", "audio/opus", "audio/mpeg", "audio/wav", "audio/x-wav",
      "audio/mp4", "audio/webm", "video/mp4", "video/webm", "application/octet-stream",
    ]);
    const lowerName = uploaded.filename.toLowerCase();
    const ok = allowedExtensions.some((ext) => lowerName.endsWith(ext));

    if (!ok || !allowedTypes.has(uploaded.contentType.toLowerCase())) {
      return res.status(400).json({
        error: "Formato não permitido. Envie .ogg, .opus, .mp3, .wav, .m4a, .mp4 ou .webm.",
      });
    }

    const formData = new FormData();
    const blob = new Blob([uploaded.data], {
      type: uploaded.contentType,
    });

    formData.append("file", blob, uploaded.filename);
    formData.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
    formData.append("language", "pt");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Erro ao transcrever áudio.",
      });
    }

    return res.status(200).json({
      text: data.text || "",
    });
  } catch (error) {
    console.error("Erro em transcribe:", error);

    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Erro interno ao transcrever.",
    });
  }
}
import {
  enforceSameOrigin,
  rateLimit,
  rejectOversizedRequest,
  requireSession,
} from "./_security.js";
