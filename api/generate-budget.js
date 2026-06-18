function extrairTextoResposta(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const partes = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") partes.push(content.text);
      if (typeof content?.output_text === "string") partes.push(content.output_text);
    }
  }
  return partes.join("\n").trim();
}

function limparJson(texto) {
  return String(texto || "").replace(/```json/gi, "").replace(/```/g, "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY não configurada no Vercel." });
    }

    const { cliente, texto, obs, empresas, selecao } = req.body || {};
    if (!cliente || !texto || !Array.isArray(empresas) || !Array.isArray(selecao)) {
      return res.status(400).json({ error: "Dados insuficientes para gerar o orçamento." });
    }

    const empresasSelecionadas = selecao.map((s) => {
      const emp = empresas.find((e) => e.id === s.empId);
      if (!emp) return null;
      return {
        id: emp.id,
        nome: emp.nome || "",
        nomeFantasia: emp.nomeFantasia || "",
        tom: emp.tom || "",
        dnaLinguagem: emp.dnaLinguagem || "",
        estruturaOrcamento: emp.estruturaOrcamento || "",
        preferenciaTabela: emp.preferenciaTabela || "automatica",
        analiseModelo: emp.analiseModelo || "",
        diferenciais: emp.diferenciais || "",
        valorGlobal: s.valorGlobal || "",
      };
    }).filter(Boolean);

    if (!empresasSelecionadas.length) {
      return res.status(400).json({ error: "Nenhuma empresa selecionada foi encontrada." });
    }

    const prompt = `
Você é um especialista em elaboração de propostas e orçamentos técnicos brasileiros.
Gere um documento individual para cada empresa, usando obrigatoriamente a descrição informada pelo usuário.

REGRAS DE CONTEÚDO:
- Não invente datas, prazos, garantias, marcas, materiais, quantidades, locais ou condições não informadas.
- Não invente preços. O único valor financeiro autorizado é o valor global informado para cada empresa.
- Preserve detalhes concretos fornecidos pelo usuário.
- Use o DNA e a estrutura de cada empresa sem misturar estilos.
- Não use emojis.
- Escreva com qualidade profissional, clareza técnica e sem frases promocionais vazias.

REGRAS DE TABELA:
- "nunca": retorne tipo "nenhuma".
- "sempre_tecnica": use tabela técnica se houver pelo menos 2 linhas identificáveis.
- "sempre_precificada": use tabela precificada se houver pelo menos 2 itens e valor global.
- "automatica": só gere tabela quando a descrição trouxer variedade real de itens, equipamentos, locais, fases ou serviços que possam formar pelo menos 2 linhas.
- Se houver somente um serviço principal, texto narrativo ou lista genérica de etapas, não gere tabela comercial.
- Tabela técnica não contém valores por item.
- Tabela precificada pode retornar peso relativo, quantidade e unidade, mas não deve calcular nem inventar preços. O sistema fará o rateio exato usando o valor global manual.
- Não transforme cada frase de um escopo narrativo em tabela apenas para preencher espaço.

CLIENTE:
${cliente}

DESCRIÇÃO DO CORPO DO ORÇAMENTO:
${texto}

OBSERVAÇÕES:
${obs || "Não informado."}

EMPRESAS:
${JSON.stringify(empresasSelecionadas, null, 2)}

Retorne somente JSON válido neste formato:
{
  "empresas": {
    "ID_DA_EMPRESA": {
      "titulo": "título específico da proposta",
      "secoes": [
        { "titulo": "Nome da seção", "conteudo": "texto profissional da seção" }
      ],
      "tabela": {
        "tipo": "nenhuma|tecnica|precificada",
        "titulo": "título da tabela",
        "itens": [
          {
            "item": "01",
            "local": "",
            "equipamento": "",
            "descricao": "",
            "quantidade": 1,
            "unidade": "un.",
            "peso": 1
          }
        ]
      },
      "fechamento": "fechamento formal, vazio quando não fizer parte do padrão"
    }
  }
}`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_BUDGET_MODEL || "gpt-4.1-mini",
        input: prompt,
        temperature: 0.15,
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || "Erro ao gerar orçamento com IA." });

    const outputText = extrairTextoResposta(data);
    if (!outputText) return res.status(500).json({ error: "A IA não retornou conteúdo." });

    let parsed;
    try {
      parsed = JSON.parse(limparJson(outputText));
    } catch {
      return res.status(500).json({ error: "A IA retornou um formato inválido.", raw: outputText });
    }
    if (!parsed.empresas || typeof parsed.empresas !== "object") {
      return res.status(500).json({ error: "A IA não retornou os orçamentos por empresa.", raw: parsed });
    }

    return res.status(200).json({ empresas: parsed.empresas });
  } catch (error) {
    console.error("Erro em generate-budget:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao gerar orçamento." });
  }
}
