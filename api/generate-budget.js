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

function textoBusca(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function perfilDocumentoEmpresa(empresa = {}, indice = 0) {
  const alvo = textoBusca(
    [
      empresa.nome,
      empresa.nomeFantasia,
      empresa.dnaLinguagem,
      empresa.estruturaOrcamento,
      empresa.padraoDocumental,
      empresa.assinaturaVisual,
    ].join(" ")
  );

  if (/eletro\s*lider|pupo|agnelo|materiais\s+eletricos/.test(alvo)) {
    return {
      tipo: "loja-materiais-eletricos",
      tituloDocumento: "Orcamento comercial",
      tom: "cotacao comercial objetiva de loja/distribuidora de materiais eletricos",
      ordemSecoes: ["intro", "materiais", "escopo", "fechamento"],
      rotulos: {
        intro: "Dados da cotacao",
        escopo: "Resumo do fornecimento",
        materiais: "Itens cotados",
        fechamento: "Registro comercial",
      },
      proibicoes: "Nao usar linguagem de obra, engenharia consultiva, equipe de campo, assinatura formal longa ou texto generico sobre materiais nao discriminados.",
    };
  }

  if (/h&h|decoracoes|decoracao|eventos|ambientacao/.test(alvo)) {
    return {
      tipo: "eventos-ambientacao",
      tituloDocumento: "Proposta de atendimento",
      tom: "institucional leve, voltado a producao, organizacao e experiencia do evento",
      ordemSecoes: ["intro", "escopo", "recursos", "fechamento"],
      rotulos: {
        intro: "Apresentacao",
        escopo: "Servicos propostos",
        recursos: "Estrutura envolvida",
        fechamento: "Encerramento",
      },
      proibicoes: "Nao usar formato tecnico de engenharia, numeracao rigida de obra ou assinatura com rodape comercial extenso.",
    };
  }

  if (/orlovic/.test(alvo)) {
    return {
      tipo: "modernizacao-infraestrutura",
      tituloDocumento: "Proposta comercial",
      tom: "executivo, corporativo e institucional para melhorias e conservacao de infraestrutura",
      ordemSecoes: ["objetivo", "escopo", "consideracoes", "fechamento"],
      rotulos: {
        objetivo: "Objeto da contratacao",
        escopo: "Escopo de servicos",
        consideracoes: "Composicao da proposta",
        fechamento: "Resumo executivo",
      },
      proibicoes: "Nao usar linguagem de licitacao, memorial descritivo, gatilhos de venda ou fechamento igual ao das outras empresas.",
    };
  }

  if (/ad\s+solucoes|consultoria|diagnostico|levantamento|laudo|parecer/.test(alvo)) {
    return {
      tipo: "consultoria-tecnica",
      tituloDocumento: "Proposta tecnica",
      tom: "consultivo, metodologico e documental, com foco em analise e tomada de decisao",
      ordemSecoes: ["objetivo", "escopo", "consideracoes", "fechamento"],
      rotulos: {
        objetivo: "Finalidade tecnica",
        escopo: "Atividades previstas",
        consideracoes: "Documentacao entregavel",
        fechamento: "Conclusao tecnica",
      },
      proibicoes: "Nao citar execucao de obra, mobilizacao, caminhoes, instalacao de campo ou venda agressiva.",
    };
  }

  if (/power|service|operacional|execucao/.test(alvo)) {
    return {
      tipo: "execucao-operacional",
      tituloDocumento: "Orcamento operacional",
      tom: "direto, pratico e voltado a capacidade de mobilizacao e execucao",
      ordemSecoes: ["objetivo", "escopo", "recursos", "materiais", "fechamento"],
      rotulos: {
        objetivo: "Objetivo operacional",
        escopo: "Descricao dos servicos",
        recursos: "Recursos operacionais envolvidos",
        materiais: "Pecas e materiais",
        fechamento: "Resumo final",
      },
      proibicoes: "Nao parecer escritorio de engenharia consultiva e nao usar formato academico.",
    };
  }

  if (/construir|construcao|obra|reforma/.test(alvo)) {
    return {
      tipo: "solucao-obras",
      tituloDocumento: "Proposta de solucao",
      tom: "comercial moderno, organizado e focado no resultado final da melhoria",
      ordemSecoes: ["intro", "escopo", "itens", "fechamento"],
      rotulos: {
        intro: "Visao geral",
        escopo: "Etapas de atendimento",
        itens: "Servicos inclusos",
        fechamento: "Resumo final",
      },
      proibicoes: "Nao usar memorial descritivo, linguagem de licitacao ou numeracao tecnica 1.1.",
    };
  }

  if (/lider|engenharia\s+lider|eng\./.test(alvo)) {
    return {
      tipo: "engenharia-tecnica",
      tituloDocumento: "Proposta tecnica comercial",
      tom: "tecnico, claro e confiavel, com foco em engenharia eletrica e infraestrutura",
      ordemSecoes: ["intro", "objetivo", "escopo", "consideracoes", "fechamento"],
      rotulos: {
        intro: "Apresentacao tecnica",
        objetivo: "Objetivo",
        escopo: "Escopo tecnico",
        consideracoes: "Consideracoes tecnicas",
        fechamento: "Conclusao",
      },
      proibicoes: "Nao usar texto de loja de materiais, eventos ou consultoria pura quando houver execucao tecnica.",
    };
  }

  const variantes = [
    "proposta institucional",
    "orcamento executivo",
    "documento comercial sintetico",
    "proposta tecnica objetiva",
  ];

  return {
    tipo: `perfil-${indice + 1}`,
    tituloDocumento: variantes[indice % variantes.length],
    tom: "identidade documental propria e diferente das demais empresas selecionadas",
    ordemSecoes: ["intro", "objetivo", "escopo", "fechamento"],
    rotulos: {},
    proibicoes: "Nao repetir a estrutura, o fechamento ou os rotulos usados por outra empresa.",
  };
}

const PADROES_GENERICOS_PROIBIDOS = [
  /prestacao de mao de obra mencionada de forma geral/i,
  /materiais citados sem lista/i,
  /natureza tecnica especifica.*nao detalhada/i,
  /sem lista de itens/i,
  /nao discriminados no resumo/i,
  /nao detalhad[ao] no resumo/i,
];

const PADROES_COMERCIAIS_PROIBIDOS = [
  /validade da proposta/i,
  /forma[s]? de pagamento/i,
  /condi[cç][oõ]es comerciais/i,
  /condi[cç][oõ]es de execu[cç][aã]o/i,
  /\bprazo[s]?\b/i,
  /cronograma/i,
  /garantia/i,
];

function normalizarTextoDocumento(valor = "") {
  const texto = String(valor || "").trim();
  if (!texto) return "";

  const linhas = texto
    .split(/\n+/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .filter((linha) => {
      const semAcento = textoBusca(linha);
      return !PADROES_GENERICOS_PROIBIDOS.some((rx) => rx.test(semAcento)) &&
        !PADROES_COMERCIAIS_PROIBIDOS.some((rx) => rx.test(semAcento));
    });

  return linhas.join("\n");
}

function normalizarIdentidadeDocumento(orcamentoEmpresa = {}, empresa = {}, indice = 0) {
  const identidade = orcamentoEmpresa.identidadeDocumento || orcamentoEmpresa.identidade || {};
  const perfil = empresa.perfilDocumento || {};
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
  const ordemPerfil = Array.isArray(perfil.ordemSecoes) ? perfil.ordemSecoes : [];

  return {
    tituloDocumento: limparTexto(identidade.tituloDocumento || orcamentoEmpresa.tituloDocumento || perfil.tituloDocumento || "Proposta Comercial", 80),
    subtitulo: limparTexto(identidade.subtitulo || "", 120),
    variante,
    assinaturaVisual: limparTexto(identidade.assinaturaVisual || empresa.nomeFantasia || empresa.nome || variante, 120),
    ordemSecoes: (ordemRecebida.length ? ordemRecebida : ordemPerfil).map((secao) => limparTexto(secao, 30)).filter(Boolean),
    rotulos: {
      intro: limparTexto(identidade.rotulos?.intro || identidade.labels?.intro || perfil.rotulos?.intro || "Apresentacao", 40),
      objetivo: limparTexto(identidade.rotulos?.objetivo || identidade.labels?.objetivo || perfil.rotulos?.objetivo || "Objetivo", 40),
      escopo: limparTexto(identidade.rotulos?.escopo || identidade.labels?.escopo || perfil.rotulos?.escopo || "Escopo do Servico", 40),
      materiais: limparTexto(identidade.rotulos?.materiais || identidade.labels?.materiais || perfil.rotulos?.materiais || "Materiais e Equipamentos", 45),
      consideracoes: limparTexto(identidade.rotulos?.consideracoes || identidade.labels?.consideracoes || perfil.rotulos?.consideracoes || "Consideracoes Tecnicas", 45),
      recursos: limparTexto(identidade.rotulos?.recursos || identidade.labels?.recursos || perfil.rotulos?.recursos || "Recursos Operacionais", 45),
      itens: limparTexto(identidade.rotulos?.itens || identidade.labels?.itens || perfil.rotulos?.itens || "Itens Incluidos", 40),
      fechamento: limparTexto(identidade.rotulos?.fechamento || identidade.labels?.fechamento || perfil.rotulos?.fechamento || "Fechamento", 40),
    },
  };
}

function isGpt5Model(modelo = "") {
  return /^gpt-5(?:\.|$|-)/i.test(String(modelo || ""));
}

function normalizarReasoningEffort(valor = "low") {
  const effort = String(valor || "").trim().toLowerCase();
  return ["low", "medium", "high", "xhigh"].includes(effort) ? effort : "low";
}

function normalizarVerbosity(valor = "medium") {
  const verbosity = String(valor || "").trim().toLowerCase();
  return ["low", "medium", "high"].includes(verbosity) ? verbosity : "medium";
}

function montarPayloadOpenAI(prompt, quantidadeEmpresas = 1) {
  const model = process.env.OPENAI_BUDGET_MODEL || "gpt-5.5";
  const maxOutput = Math.min(7200, 3000 + Math.max(1, Number(quantidadeEmpresas) || 1) * 1400);
  const payload = {
    model,
    input: prompt,
    max_output_tokens: maxOutput,
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
    if (rejectOversizedRequest(req, res, 4_200_000)) return;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY nao configurada no Vercel.",
        code: "MISSING_OPENAI_API_KEY",
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
        code: "INSUFFICIENT_DATA",
      });
    }

    if (cliente.length > 300 || texto.length > 20_000 || String(obs || "").length > 10_000) {
      return res.status(400).json({ error: "Os textos enviados ultrapassam o limite permitido.", code: "TEXT_TOO_LONG" });
    }

    if (empresas.length > 80 || selecao.length > 20) {
      return res.status(400).json({ error: "Quantidade de empresas acima do limite permitido.", code: "TOO_MANY_COMPANIES" });
    }

    const empresasSelecionadas = selecao
      .map((s, indice) => {
        const emp = empresas.find((e) => e.id === s.empId);
        if (!emp) return null;
        const perfilDocumento = perfilDocumentoEmpresa(emp, indice);

        return {
          indice,
          id: emp.id,
          nome: limparTexto(emp.nome, 180),
          nomeFantasia: limparTexto(emp.nomeFantasia, 140),
          tom: limparTexto(emp.tom, 320),
          dnaLinguagem: limparTexto(emp.dnaLinguagem, 4500),
          estruturaOrcamento: limparTexto(emp.estruturaOrcamento, 2800),
          padraoDocumental: limparTexto(emp.padraoDocumental, 2200),
          assinaturaVisual: limparTexto(emp.assinaturaVisual, 1600),
          diferenciais: limparTexto(emp.diferenciais, 900),
          fonteTitulo: limparTexto(emp.fonteTitulo, 80),
          fonteCorpo: limparTexto(emp.fonteCorpo, 80),
          corPrimaria: limparTexto(emp.corPrimaria, 20),
          corSecundaria: limparTexto(emp.corSecundaria, 20),
          temPapelTimbrado: Boolean(emp.papelTimbrado),
          valorGlobal: s.valorGlobal || "",
          perfilDocumento,
        };
      })
      .filter(Boolean);

    if (!empresasSelecionadas.length) {
      return res.status(400).json({
        error: "Nenhuma empresa selecionada foi encontrada.",
        code: "SELECTED_COMPANY_NOT_FOUND",
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
- use "perfilDocumento" de cada empresa como comando obrigatorio de linguagem, abertura, fechamento e rotulos.
- se duas empresas forem geradas na mesma rodada, compare uma com a outra e evite repetir a mesma abertura, mesmo fechamento, mesmo titulo e mesma sequencia de secoes.

MATERIAIS E PRECIFICACAO
- Gere "materiaisTabela" SOMENTE quando o usuario trouxer uma lista real de materiais, produtos ou itens, de preferencia com quantidade, unidade, valor original/custo ou descricao itemizada.
- Se o usuario mencionar "materiais" de forma generica, sem lista, nao crie tabela, nao crie itens ficticios e deixe "materiaisTabela" vazio.
- A tabela deve ter descricao, unidade, quantidade, valorOriginal, acrescimoPercentual, valorUnitario e subtotal.
- Use o valor global informado da empresa como total final da tabela quando ele existir.
- Distribua o acrescimo proporcionalmente aos valores originais para que a soma dos subtotais feche dentro do valor global.
- Se houver materiais sem valor original, use pesoPercentual para indicar a distribuicao sugerida; o servidor fara o fechamento matematico final.
- Nao invente materiais que nao estejam no resumo.
- Nunca escreva frases como "materiais citados sem lista", "prestacao de mao de obra mencionada de forma geral", "natureza tecnica nao detalhada" ou qualquer observacao de falta de informacao.

REGRAS GERAIS
- Nao use emojis.
- Nao use linguagem promocional generica.
- Nao crie escopos nao informados.
- Use apenas informacoes fornecidas pelo usuario e pelo cadastro da empresa.
- Se uma informacao nao foi fornecida, deixe o campo vazio ou escreva somente o que for tecnicamente seguro.
- O valor global deve ser usado somente quando estiver informado na selecao da empresa.
- Nao incluir prazo, data, validade, garantia, condicoes de pagamento, condicoes comerciais, cronograma ou condicoes para execucao.
- Nao criar rodape, assinatura longa ou dados cadastrais iguais para todas as empresas; o fechamento deve seguir o perfil de cada empresa.
- Quando o resumo for curto, entregue documento curto e limpo. Nao preencha com texto generico.

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
      body: JSON.stringify(montarPayloadOpenAI(prompt, empresasSelecionadas.length)),
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Erro ao gerar orcamento com IA.",
        code: data?.error?.code || "OPENAI_REQUEST_FAILED",
      });
    }

    const outputText = extrairTextoResposta(data);

    if (!outputText) {
      return res.status(500).json({
        error: "A IA nao retornou conteudo.",
        code: "EMPTY_AI_RESPONSE",
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(limparJson(outputText));
    } catch {
      return res.status(500).json({
        error: "A IA retornou um formato invalido.",
        code: "INVALID_AI_JSON",
      });
    }

    if (!parsed.empresas || typeof parsed.empresas !== "object") {
      return res.status(500).json({
        error: "A IA nao retornou os orcamentos por empresa.",
        code: "MISSING_COMPANY_BUDGETS",
      });
    }

    for (const empresa of empresasSelecionadas) {
      const atual = parsed.empresas[empresa.id] || {};
      for (const campo of ["intro", "objetivo", "escopo", "materiais", "consideracoes", "recursos", "fechamento"]) {
        atual[campo] = normalizarTextoDocumento(atual[campo]);
      }

      const itensLimpos = Array.isArray(parsed.itens)
        ? parsed.itens.map((item) => normalizarTextoDocumento(item)).filter(Boolean)
        : [];
      parsed.itens = itensLimpos;

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
      code: "GENERATE_BUDGET_INTERNAL_ERROR",
    });
  }
}
