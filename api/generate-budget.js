export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY não configurada no Vercel.",
      });
    }

    const { cliente, texto, obs, empresas, selecao } = req.body || {};

    if (!cliente || !texto || !Array.isArray(empresas) || !Array.isArray(selecao)) {
      return res.status(400).json({
        error: "Dados insuficientes para gerar o orçamento.",
      });
    }

    const empresasSelecionadas = selecao
      .map((s) => {
        const emp = empresas.find((e) => e.id === s.empId);
        if (!emp) return null;

        return {
          id: emp.id,
          nome: emp.nome,
          tom: emp.tom || "",
          dnaLinguagem: emp.dnaLinguagem || "",
          estruturaOrcamento: emp.estruturaOrcamento || "",
          valorGlobal: s.valorGlobal || "",
        };
      })
      .filter(Boolean);

    if (!empresasSelecionadas.length) {
      return res.status(400).json({
        error: "Nenhuma empresa selecionada foi encontrada.",
      });
    }

    const prompt = `
Você é um sistema especializado em geração de orçamentos técnicos.

O usuário informou um serviço na tela principal do sistema.
Você deve gerar um orçamento individual para cada empresa selecionada.

REGRA PRINCIPAL:
Cada empresa possui regras próprias cadastradas nos campos "dnaLinguagem" e "estruturaOrcamento".
Você deve respeitar rigorosamente as regras de cada empresa.
Não misture estilos entre empresas.

REGRAS GERAIS:
- Não inventar informações.
- Não criar datas.
- Não criar prazos.
- Não criar valores.
- Não criar materiais que não foram informados.
- Não criar escopos não informados.
- Não usar emojis.
- Não usar linguagem promocional.
- Não fugir da estrutura cadastrada.
- Usar apenas as informações fornecidas pelo usuário.
- Se alguma informação não foi fornecida, não preencher com suposição.
- Gerar cada orçamento de forma individual, respeitando a personalidade da empresa correspondente.

CLIENTE / DESTINATÁRIO:
${cliente}

DESCRIÇÃO DO SERVIÇO INFORMADA PELO USUÁRIO:
${texto}

OBSERVAÇÕES OPCIONAIS:
${obs || "Não informado."}

EMPRESAS SELECIONADAS:
${JSON.stringify(empresasSelecionadas, null, 2)}

RETORNE SOMENTE JSON VÁLIDO, SEM MARKDOWN, NESTE FORMATO:

{
  "itens": [
    "item técnico objetivo 1",
    "item técnico objetivo 2"
  ],
  "empresas": {
    "ID_DA_EMPRESA": {
      "intro": "texto de apresentação da proposta conforme a linguagem da empresa",
      "objetivo": "objetivo técnico do serviço",
      "escopo": "escopo completo seguindo a estrutura da empresa",
      "materiais": "materiais e equipamentos somente se informados ou necessários de forma evidente",
      "consideracoes": "considerações técnicas aplicáveis",
      "recursos": "recursos operacionais aplicáveis",
      "fechamento": "fechamento formal da proposta"
    }
  }
}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        temperature: 0.2,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Erro ao gerar orçamento com IA.",
      });
    }

    const outputText =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      "";

    if (!outputText) {
      return res.status(500).json({
        error: "A IA não retornou conteúdo.",
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(
        outputText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim()
      );
    } catch {
      return res.status(500).json({
        error: "A IA retornou um formato inválido.",
        raw: outputText,
      });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Erro interno ao gerar orçamento.",
    });
  }
}
