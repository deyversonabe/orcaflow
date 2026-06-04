import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Método não permitido",
      });
    }

    const {
      cliente,
      texto,
      obs,
      empresas,
      selecao,
    } = req.body;

    const resultadoEmpresas = {};

    for (const item of selecao) {
      const empresa = empresas.find(
        (e) => e.id === item.empId
      );

      const prompt = `
Você é um especialista em elaboração de orçamentos técnicos.

EMPRESA:
${empresa?.nome || ""}

TOM DE VOZ:
${empresa?.tom || ""}

DNA DA EMPRESA:
${empresa?.dnaLinguagem || ""}

ESTRUTURA DO ORÇAMENTO:
${empresa?.estruturaOrcamento || ""}

CLIENTE:
${cliente}

DESCRIÇÃO DO SERVIÇO:
${texto}

OBSERVAÇÕES:
${obs || ""}

Gere:

1. Introdução
2. Objetivo
3. Escopo técnico
4. Materiais envolvidos
5. Recursos operacionais
6. Considerações finais
7. Fechamento comercial

Retorne SOMENTE JSON.
`;

      const resposta = await openai.chat.completions.create({
        model: "gpt-5",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "Você é especialista em propostas comerciais e orçamentos.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_object",
        },
      });

      const conteudo =
        resposta.choices[0].message.content;

      resultadoEmpresas[item.empId] =
        JSON.parse(conteudo);
    }

    return res.status(200).json({
      empresas: resultadoEmpresas,
      itens: [],
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message,
    });
  }
}
