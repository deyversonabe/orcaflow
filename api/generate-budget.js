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

function limparTexto(valor, limite = 220) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limite);
}

function parseNumero(valor) {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  let texto = String(valor)
    .trim()
    .replace(/r\$/gi, "")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!texto) return 0;

  const temVirgula = texto.includes(",");
  const temPonto = texto.includes(".");

  if (temVirgula && temPonto) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    texto = texto.replace(",", ".");
  } else if (temPonto) {
    const partes = texto.split(".");
    const ultima = partes[partes.length - 1];
    if (partes.length > 1 && ultima.length === 3) texto = texto.replace(/\./g, "");
  }

  const numero = Number.parseFloat(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function paraCentavos(valor) {
  return Math.round(parseNumero(valor) * 100);
}

function deCentavos(centavos) {
  return Number((Number(centavos || 0) / 100).toFixed(2));
}

function normalizarQuantidade(valor) {
  const numero = parseNumero(valor);
  return numero > 0 ? Number(numero.toFixed(4)) : 1;
}

function primeiraListaValida(...listas) {
  for (const lista of listas) {
    if (Array.isArray(lista) && lista.length) return lista;
  }
  return [];
}

function normalizarMateriaisTabela(orcamentoEmpresa = {}, valorGlobal) {
  const lista = primeiraListaValida(
    orcamentoEmpresa.materiaisTabela,
    orcamentoEmpresa.tabelaMateriais,
    orcamentoEmpresa.itensMateriais,
    orcamentoEmpresa.planilhaMateriais
  );

  const itens = lista
    .map((item, index) => {
      const descricao =
        limparTexto(item?.descricao || item?.item || item?.material || item?.nome, 180) ||
        `Item ${index + 1}`;
      const quantidade = normalizarQuantidade(item?.quantidade || item?.qtd || 1);
      const unidade = limparTexto(item?.unidade || item?.un || "un", 18) || "un";

      let originalTotal =
        parseNumero(item?.valorOriginalTotal) ||
        parseNumero(item?.valorTotalOriginal) ||
        parseNumero(item?.valorOriginal) ||
        parseNumero(item?.custoOriginal) ||
        parseNumero(item?.custoTotal);

      const originalUnitario =
        parseNumero(item?.valorUnitarioOriginal) ||
        parseNumero(item?.custoUnitarioOriginal) ||
        parseNumero(item?.custoUnitario);

      if (!originalTotal && originalUnitario) {
        originalTotal = originalUnitario * quantidade;
      }

      const subtotalIA =
        parseNumero(item?.subtotal) ||
        parseNumero(item?.valorProposto) ||
        parseNumero(item?.valorFinal) ||
        parseNumero(item?.total);

      return {
        descricao,
        unidade,
        quantidade,
        pesoPercentual: Math.max(0, parseNumero(item?.pesoPercentual || item?.peso || item?.percentual)),
        valorOriginalCentavos: Math.max(0, paraCentavos(originalTotal)),
        subtotalIACentavos: Math.max(0, paraCentavos(subtotalIA)),
        observacao: limparTexto(item?.observacao || item?.obs || "", 180),
      };
    })
    .filter((item) => item.descricao);

  if (!itens.length) {
    return {
      materiaisTabela: [],
      precificacao: {
        valorGlobal: deCentavos(paraCentavos(valorGlobal)),
        valorOriginalTotal: 0,
        acrescimoPercentualMedio: 0,
        totalTabela: 0,
        diferenca: deCentavos(paraCentavos(valorGlobal)),
        criterio: "sem_lista_de_materiais",
      },
    };
  }

  const valorGlobalCentavos = Math.max(0, paraCentavos(valorGlobal));
  const totalOriginalCentavos = itens.reduce((acc, item) => acc + item.valorOriginalCentavos, 0);
  const totalIACentavos = itens.reduce((acc, item) => acc + item.subtotalIACentavos, 0);
  const totalPeso = itens.reduce((acc, item) => acc + item.pesoPercentual, 0);

  let criterio = "sem_valor_global";
  let acumulado = 0;

  const tabela = itens.map((item, index) => {
    let subtotalCentavos = 0;

    if (valorGlobalCentavos > 0 && totalOriginalCentavos > 0) {
      criterio = "rateio_por_valor_original";
      subtotalCentavos =
        index === itens.length - 1
          ? valorGlobalCentavos - acumulado
          : Math.round((item.valorOriginalCentavos / totalOriginalCentavos) * valorGlobalCentavos);
    } else if (valorGlobalCentavos > 0 && totalPeso > 0) {
      criterio = "rateio_por_peso_ia";
      subtotalCentavos =
        index === itens.length - 1
          ? valorGlobalCentavos - acumulado
          : Math.round((item.pesoPercentual / totalPeso) * valorGlobalCentavos);
    } else if (valorGlobalCentavos > 0) {
      criterio = "rateio_linear_do_valor_global";
      subtotalCentavos =
        index === itens.length - 1
          ? valorGlobalCentavos - acumulado
          : Math.round(valorGlobalCentavos / itens.length);
    } else if (item.subtotalIACentavos > 0) {
      criterio = "subtotal_informado_pela_ia";
      subtotalCentavos = item.subtotalIACentavos;
    } else if (item.valorOriginalCentavos > 0) {
      criterio = "valor_original_sem_acrescimo";
      subtotalCentavos = item.valorOriginalCentavos;
    }

    subtotalCentavos = Math.max(0, subtotalCentavos);
    acumulado += subtotalCentavos;

    const acrescimo =
      item.valorOriginalCentavos > 0
        ? ((subtotalCentavos - item.valorOriginalCentavos) / item.valorOriginalCentavos) * 100
        : 0;

    return {
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: item.quantidade,
      valorOriginal: deCentavos(item.valorOriginalCentavos),
      acrescimoPercentual: Number(acrescimo.toFixed(2)),
      valorUnitario: Number((deCentavos(subtotalCentavos) / item.quantidade).toFixed(2)),
      subtotal: deCentavos(subtotalCentavos),
      observacao: item.observacao,
    };
  });

  const totalTabelaCentavos = tabela.reduce((acc, item) => acc + paraCentavos(item.subtotal), 0);
  const acrescimoMedio =
    totalOriginalCentavos > 0
      ? ((totalTabelaCentavos - totalOriginalCentavos) / totalOriginalCentavos) * 100
      : 0;

  return {
    materiaisTabela: tabela,
    precificacao: {
      valorGlobal: deCentavos(valorGlobalCentavos),
      valorOriginalTotal: deCentavos(totalOriginalCentavos),
      acrescimoPercentualMedio: Number(acrescimoMedio.toFixed(2)),
      totalTabela: deCentavos(totalTabelaCentavos),
      diferenca: deCentavos(valorGlobalCentavos > 0 ? valorGlobalCentavos - totalTabelaCentavos : 0),
      totalSugeridoPelaIA: deCentavos(totalIACentavos),
      criterio,
    },
  };
}

function normalizarIdentidadeDocumento(orcamentoEmpresa = {}, empresa = {}, indice = 0) {
  const identidade = orcamentoEmpresa.identidadeDocumento || orcamentoEmpresa.identidade || {};
  const variantes = [
    "tecnica-executiva",
    "comercial-consultiva",
    "memorial-descritivo",
    "proposta-sintetica",
    "parecer-operacional",
  ];
  const variante = limparTexto(identidade.variante || identidade.modelo || variantes[indice % variantes.length], 40);

  const ordemRecebida = Array.isArray(identidade.ordemSecoes)
    ? identidade.ordemSecoes
    : Array.isArray(orcamentoEmpresa.ordemSecoes)
      ? orcamentoEmpresa.ordemSecoes
      : [];

  return {
    tituloDocumento: limparTexto(identidade.tituloDocumento || orcamentoEmpresa.tituloDocumento || "Proposta Comercial", 80),
    subtitulo: limparTexto(identidade.subtitulo || "", 120),
    variante,
    assinaturaVisual: limparTexto(identidade.assinaturaVisual || empresa.nomeFantasia || empresa.nome || variante, 120),
    ordemSecoes: ordemRecebida.map((secao) => limparTexto(secao, 30)).filter(Boolean),
    rotulos: {
      intro: limparTexto(identidade.rotulos?.intro || identidade.labels?.intro || "Apresentacao", 40),
      objetivo: limparTexto(identidade.rotulos?.objetivo || identidade.labels?.objetivo || "Objetivo", 40),
      escopo: limparTexto(identidade.rotulos?.escopo || identidade.labels?.escopo || "Escopo do Servico", 40),
      materiais: limparTexto(identidade.rotulos?.materiais || identidade.labels?.materiais || "Materiais e Equipamentos", 45),
      consideracoes: limparTexto(identidade.rotulos?.consideracoes || identidade.labels?.consideracoes || "Consideracoes Tecnicas", 45),
      recursos: limparTexto(identidade.rotulos?.recursos || identidade.labels?.recursos || "Recursos Operacionais", 45),
      itens: limparTexto(identidade.rotulos?.itens || identidade.labels?.itens || "Itens Incluidos", 40),
      fechamento: limparTexto(identidade.rotulos?.fechamento || identidade.labels?.fechamento || "Fechamento", 40),
    },
  };
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
  const model = process.env.OPENAI_BUDGET_MODEL || "gpt-5.5";
  const payload = {
    model,
    input: prompt,
    max_output_tokens: 9000,
  };

  if (isGpt5Model(model)) {
    payload.reasoning = {
      effort: normalizarReasoningEffort(process.env.OPENAI_BUDGET_REASONING_EFFORT),
    };
    payload.text = {
      verbosity: normalizarVerbosity(process.env.OPENAI_BUDGET_VERBOSITY),
    };
  } else {
    payload.temperature = 0.55;
  }

  return payload;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    if (!enforceSameOrigin(req, res)) return;
    if (!(await requireSession(req, res))) return;
    if (!rateLimit(req, res, { id: "generate-budget", limit: 12, windowMs: 60 * 1000 })) return;
    if (rejectOversizedRequest(req, res, 1_200_000)) return;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY nao configurada no Vercel.",
      });
    }

    const { cliente, texto, obs, empresas, selecao } = req.body || {};

    if (
      typeof cliente !== "string" ||
      typeof texto !== "string" ||
      !cliente.trim() ||
      !texto.trim() ||
      !Array.isArray(empresas) ||
      !Array.isArray(selecao)
    ) {
      return res.status(400).json({
        error: "Dados insuficientes para gerar o orcamento.",
      });
    }

    if (cliente.length > 300 || texto.length > 20_000 || String(obs || "").length > 10_000) {
      return res.status(400).json({ error: "Os textos enviados ultrapassam o limite permitido." });
    }

    if (empresas.length > 80 || selecao.length > 20) {
      return res.status(400).json({ error: "Quantidade de empresas acima do limite permitido." });
    }

    const empresasSelecionadas = selecao
      .map((s, indice) => {
        const emp = empresas.find((e) => e.id === s.empId);
        if (!emp) return null;

        return {
          indice,
          id: emp.id,
          nome: emp.nome || "",
          nomeFantasia: emp.nomeFantasia || "",
          tom: emp.tom || "",
          dnaLinguagem: emp.dnaLinguagem || "",
          estruturaOrcamento: emp.estruturaOrcamento || "",
          padraoDocumental: emp.padraoDocumental || "",
          assinaturaVisual: emp.assinaturaVisual || "",
          diferenciais: emp.diferenciais || "",
          fonteTitulo: emp.fonteTitulo || "",
          fonteCorpo: emp.fonteCorpo || "",
          corPrimaria: emp.corPrimaria || "",
          corSecundaria: emp.corSecundaria || "",
          temPapelTimbrado: Boolean(emp.papelTimbrado),
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
Voce e um especialista senior em orcamentos tecnicos, engenharia, construcao, servicos comerciais e automacao documental.

TAREFA
Gerar um orcamento individual para cada empresa selecionada, usando o resumo do servico informado pelo usuario.

REGRA DE DIFERENCIACAO
Os orcamentos NAO podem parecer copias entre si. Para cada empresa, crie uma identidade documental propria:
- titulo do documento diferente quando fizer sentido;
- ordem das secoes diferente;
- rotulos de secoes diferentes;
- ritmo de frase, vocabulario e fechamento diferentes;
- forma de apresentar escopo diferente;
- sem misturar o DNA de uma empresa com outra.

MATERIAIS E PRECIFICACAO
- Se o texto do usuario trouxer lista de materiais, equipamentos ou itens com valores originais/custos, gere "materiaisTabela".
- A tabela deve ter descricao, unidade, quantidade, valorOriginal, acrescimoPercentual, valorUnitario e subtotal.
- Use o valor global informado da empresa como total final da tabela quando ele existir.
- Distribua o acrescimo proporcionalmente aos valores originais para que a soma dos subtotais feche dentro do valor global.
- Se houver materiais sem valor original, use pesoPercentual para indicar a distribuicao sugerida; o servidor fara o fechamento matematico final.
- Nao invente materiais que nao estejam no resumo.
- Nao invente datas, prazos, garantias, validade ou condicoes nao informadas.

REGRAS GERAIS
- Nao use emojis.
- Nao use linguagem promocional generica.
- Nao crie escopos nao informados.
- Use apenas informacoes fornecidas pelo usuario e pelo cadastro da empresa.
- Se uma informacao nao foi fornecida, deixe o campo vazio ou escreva somente o que for tecnicamente seguro.
- O valor global deve ser usado somente quando estiver informado na selecao da empresa.

CLIENTE / DESTINATARIO:
${cliente}

DESCRICAO DO SERVICO INFORMADA PELO USUARIO:
${texto}

OBSERVACOES OPCIONAIS:
${obs || "Nao informado."}

EMPRESAS SELECIONADAS:
${JSON.stringify(empresasSelecionadas, null, 2)}

RETORNE SOMENTE JSON VALIDO, SEM MARKDOWN, NESTE FORMATO EXATO:

{
  "itens": [
    "item tecnico objetivo 1",
    "item tecnico objetivo 2"
  ],
  "empresas": {
    "ID_DA_EMPRESA": {
      "identidadeDocumento": {
        "tituloDocumento": "titulo proprio da proposta",
        "subtitulo": "subtitulo opcional",
        "variante": "nome curto do modelo visual/documental",
        "assinaturaVisual": "descricao curta da identidade visual aplicada",
        "ordemSecoes": ["intro", "escopo", "materiais", "objetivo", "consideracoes", "recursos", "itens", "fechamento"],
        "rotulos": {
          "intro": "rotulo da apresentacao",
          "objetivo": "rotulo do objetivo",
          "escopo": "rotulo do escopo",
          "materiais": "rotulo da tabela de materiais",
          "consideracoes": "rotulo das consideracoes",
          "recursos": "rotulo dos recursos",
          "itens": "rotulo dos itens inclusos",
          "fechamento": "rotulo do fechamento"
        }
      },
      "intro": "texto de apresentacao conforme a linguagem da empresa",
      "objetivo": "objetivo tecnico do servico",
      "escopo": "escopo completo seguindo a estrutura da empresa",
      "materiais": "resumo textual dos materiais, somente quando informados",
      "materiaisTabela": [
        {
          "descricao": "material ou equipamento informado pelo usuario",
          "unidade": "un",
          "quantidade": 1,
          "valorOriginal": 0,
          "acrescimoPercentual": 0,
          "valorUnitario": 0,
          "subtotal": 0,
          "pesoPercentual": 0,
          "observacao": ""
        }
      ],
      "consideracoes": "consideracoes tecnicas aplicaveis",
      "recursos": "recursos operacionais aplicaveis",
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
      body: JSON.stringify(montarPayloadOpenAI(prompt)),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Erro ao gerar orcamento com IA.",
      });
    }

    const outputText = extrairTextoResposta(data);

    if (!outputText) {
      return res.status(500).json({
        error: "A IA nao retornou conteudo.",
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(limparJson(outputText));
    } catch {
      return res.status(500).json({
        error: "A IA retornou um formato invalido.",
      });
    }

    if (!parsed.empresas || typeof parsed.empresas !== "object") {
      return res.status(500).json({
        error: "A IA nao retornou os orcamentos por empresa.",
      });
    }

    for (const empresa of empresasSelecionadas) {
      const atual = parsed.empresas[empresa.id] || {};
      const fechamento = normalizarMateriaisTabela(atual, empresa.valorGlobal);
      parsed.empresas[empresa.id] = {
        ...atual,
        identidadeDocumento: normalizarIdentidadeDocumento(atual, empresa, empresa.indice),
        materiaisTabela: fechamento.materiaisTabela,
        precificacao: fechamento.precificacao,
      };
    }

    return res.status(200).json({
      itens: Array.isArray(parsed.itens) ? parsed.itens : [],
      empresas: parsed.empresas,
    });
  } catch (error) {
    console.error("Erro em generate-budget:", error);

    return res.status(500).json({
      error: "Erro interno ao gerar orcamento.",
    });
  }
}
