const CACHE_KEY = "app_dados_cache";
const CACHE_TIME_KEY = "app_dados_cache_time";
const CACHE_LOCAL_KEY = "app_dados_local_changes";
const CACHE_DRAFT_KEY = "op_nf_draft_cache_v1";
const CACHE_REFERENCIAS_KEY = "op_referencias_cache_v1";
const CACHE_REFERENCIAS_TIME_KEY = "op_referencias_cache_time_v1";
const CACHE_REFERENCIAS_MAX_AGE_MS = 1000 * 60 * 60 * 12;

const API_SALVAR_FINANCEIRO = "https://script.google.com/macros/s/AKfycbzzJLCNOBEvxJxv2TL4T3DPqwgNo-M4t8V9851y9Sq-N4su4nqmlnWL20lgwpqBow-7/exec?modo=nf_avista";
const API_SALVAR_FLUXO = "https://script.google.com/macros/s/AKfycbwakyWjmPenEHt_iRRllU9t_3hUB4NgcBSZh-EUnk1OKdRS4hGlPZk7Fs3Wb_ow7JsnSA/exec";
const API_REFERENCIA_FLUXO = "https://script.google.com/macros/s/AKfycbxgR6d6FU0riIt5wEtD3Nm1kPjuRyO5gl1e-TnyypjRBWki4sPuFGRbXosiLm5jJPOZ/exec?sheet=db_fluxo";
const API_REFERENCIA_CUSTOS_BASE = "https://script.google.com/macros/s/AKfycbyYvvaSGMslJ6tT7oWrZewi7Cwx6lJ1IVvfkpJj-a-mczTbGmd8fkJwJMeuT-7gUybEvw/exec";
const API_REFERENCIA_CADASTRO = "https://script.google.com/macros/s/AKfycbyz2rvWZCg4JKaK_v3ySa_FB7LaAcrJ29L67_JsItpLfa2I8ilXatBbmsc0NTy2X31tdg/exec";
const API_REFERENCIA_ADMINISTRATIVO = "https://script.google.com/macros/s/AKfycbyAntnFWyzJaaGDJRWlYdVFinD1XPoc3b3igvYSpRVn6cDZ4d4LbGoFNWOUIbrAShF8/exec?script=cadastroItensAdministrativos";

const tbody = document.querySelector("tbody");
const somaTotalEl = document.getElementById("soma-total");
const camposCabecalho = document.querySelectorAll("[data-field]");
const medicaoAtualAprovada = false;
const refStatusState = {
  obra: "idle",
  pagador: "idle",
  fornecedor: "idle",
  bancos: "idle",
  categoria: "idle",
  administrativo: "idle",
  material: "idle",
  servico: "idle",
  equipamento: "idle",
};

let proximoIdItem = 1;
let dados = {
  nf: "",
  obra: "",
  obraId: "",
  pagador: "",
  pagadorId: "",
  fornecedor: "",
  fornecedorId: "",
  categoria: "",
  categoriaId: "",
  tipo: "",
  tipoId: "",
  data: "",
  banco: "",
  bancoId: "",
  usuario: "",
  itens: [],
};
window.dados = dados;
let dadosReferencia = {
  obra: [],
  bancos: [],
  pagador: [],
  fornecedor: [],
  administrativo: [],
  material: [],
  servico: [],
  equipamento: [],
  tipo_pagamento: [],
  categoria: [],
};

function dedupeListaPorNome(lista = [], campoNome = "nome") {
  const vistos = new Set();
  const resultado = [];

  toArray(lista).forEach((item) => {
    const nome = String(item?.[campoNome] ?? item?.name ?? "").trim();
    if (!nome) return;

    const chave = nome.toLowerCase();
    if (vistos.has(chave)) return;
    vistos.add(chave);

    resultado.push({
      ...item,
      id: item?.id ?? resultado.length + 1,
      nome,
    });
  });

  return resultado;
}

window.setDadosReferencia = function setDadosReferencia(payload = {}) {
  const normalizarListaComCod = (lista = []) =>
    toArray(lista).map((item) => ({
      ...item,
      id: item.id ?? item.cod ?? "",
      cod: item.cod ?? item.id ?? "",
    }));

  dadosReferencia = {
    obra: payload.obra ?? [],
    bancos: payload.bancos ?? [],
    pagador: dedupeListaPorNome(payload.pagador, "nome"),
    fornecedor: toArray(payload.fornecedor ?? payload.fornecedores).map((f) => ({
      ...f,
      id: f.id ?? "",
      nome: f.nome ?? f.name ?? "",
    })),
    administrativo: normalizarListaComCod(payload.administrativo ?? []),
    material: normalizarListaComCod(payload.material ?? []),
    servico: normalizarListaComCod(payload.servico ?? []),
    equipamento: normalizarListaComCod(payload.equipamento ?? []),
    tipo_pagamento: payload.tipo_pagamento ?? [],
    categoria: payload.categoria ?? [],
  };
};

function aplicarClasseStatusRef(idEl, status) {
  const el = document.getElementById(idEl);
  if (!el) return;
  el.classList.remove("loading", "done", "error");
  if (status === "loading" || status === "done" || status === "error") {
    el.classList.add(status);
  }
}

function statusCompostoDescricao() {
  const chaves = ["administrativo", "servico", "material", "equipamento"];
  const statuses = chaves.map((k) => refStatusState[k]);
  if (statuses.some((s) => s === "loading")) return "loading";
  if (statuses.some((s) => s === "error")) return "error";
  if (statuses.every((s) => s === "done")) return "done";
  return "idle";
}

function renderizarStatusReferencias() {
  aplicarClasseStatusRef("status-obra", refStatusState.obra);
  aplicarClasseStatusRef("status-atividade", refStatusState.obra);
  aplicarClasseStatusRef("status-pagador", refStatusState.pagador);
  aplicarClasseStatusRef("status-fornecedor", refStatusState.fornecedor);
  aplicarClasseStatusRef("status-bancos", refStatusState.bancos);
  aplicarClasseStatusRef("status-categoria", refStatusState.categoria);
  aplicarClasseStatusRef("status-descricao", statusCompostoDescricao());
}

function definirStatusReferencia(chave, status) {
  if (!Object.prototype.hasOwnProperty.call(refStatusState, chave)) return;
  refStatusState[chave] = status;
  renderizarStatusReferencias();
}

function definirStatusReferenciasPorDadosEmCache() {
  if (toArray(dadosReferencia.obra).length) definirStatusReferencia("obra", "done");
  if (toArray(dadosReferencia.pagador).length) definirStatusReferencia("pagador", "done");
  if (toArray(dadosReferencia.fornecedor).length) definirStatusReferencia("fornecedor", "done");
  if (toArray(dadosReferencia.bancos).length) definirStatusReferencia("bancos", "done");
  if (toArray(dadosReferencia.categoria).length) definirStatusReferencia("categoria", "done");
  if (toArray(dadosReferencia.administrativo).length) definirStatusReferencia("administrativo", "done");
  if (toArray(dadosReferencia.material).length) definirStatusReferencia("material", "done");
  if (toArray(dadosReferencia.servico).length) definirStatusReferencia("servico", "done");
  if (toArray(dadosReferencia.equipamento).length) definirStatusReferencia("equipamento", "done");
}

const LOCAL_API_DELAY_MS = 250;
const localApi = {
  async getDadosReferencia() {
    await new Promise((resolve) => setTimeout(resolve, LOCAL_API_DELAY_MS));
    return {
      ok: true,
      dados: {
        obra: [
          {
            franquia: "MCG",
            id: 1000,
            nome: "Custos Escritório",
            cliente_faturamento: "MESSA PROJETOS E CONSTRUCOES LTDA",
            cpf_cnpj: "37.665.039/0001-38",
            endereco_faturamento: "Rua Doutor Antonio Leite de Campos, 257, Santo Antonio, Campo Grande / MS",
            endereco_entrega_obra: "Rua Doutor Antonio Leite de Campos, 257, Bairro Santo Antonio - Campo Grande / MS",
            status: true,
            atividade: [
              { cod: "1", descricao: "Manutencoes de Veiculos" },
              { cod: "1.1", descricao: "Manutencao de veiculos - Chevrolet S10 - QPO-7F07" },
              { cod: "1.2", descricao: "Manutencao de veiculos - Nissan Frontier - NRY-7049" },
              { cod: "1.3", descricao: "Manutencao de veiculos - Volkswagen Saveiro - OOR-1434" },
              { cod: "1.4", descricao: "Manutencao de veiculos - Volkswagen Kombi - AOQ-OH22" },
              { cod: "1.5", descricao: "Manutencao de veiculos - Volkswagen Kombi - MWF-3D27" },
              { cod: "1.6", descricao: "Manutencao de veiculos - Ford KA - PZI-4345" },
              { cod: "1.7", descricao: "Manutencao de veiculos - Outros veiculos" },
              { cod: "2", descricao: "Combustivel" },
              { cod: "2.1", descricao: "Combustivel - Chevrolet S10 - QPO-7F07" },
              { cod: "2.2", descricao: "Combustivel - Nissan Frontier - NRY-7049" },
              { cod: "2.3", descricao: "Combustivel - Volkswagen Saveiro - OOR-1434" },
              { cod: "2.4", descricao: "Combustivel - Volkswagen Kombi - AOQ-OH22" },
              { cod: "2.5", descricao: "Combustivel - Volkswagen Kombi - MWF-3D27" },
              { cod: "2.6", descricao: "Combustivel - Ford KA - PZI-4345" },
              { cod: "2.7", descricao: "Combustivel - Outros veiculos" },
              { cod: "3", descricao: "Viagens" },
              { cod: "3.1", descricao: "Viagens - Hospedagem" },
              { cod: "3.2", descricao: "Viagens - Passagens" },
              { cod: "3.3", descricao: "Viagens - Refeicoes" },
              { cod: "3.4", descricao: "Viagens - Pedagio" },
              { cod: "4", descricao: "Custos fixos" },
              { cod: "4.1", descricao: "Custos fixos - Aluguel" },
              { cod: "4.2", descricao: "Custos fixos - Telefonia e internet" },
              { cod: "4.3", descricao: "Custos fixos - Agua e esgoto" },
              { cod: "4.4", descricao: "Custos fixos - Energia" },
              { cod: "4.5", descricao: "Custos fixos - Material de consumo e limpeza" },
              { cod: "4.6", descricao: "Custos fixos - Material de escritorio" },
              { cod: "4.7", descricao: "Custos fixos - Despesa com impressao" },
              { cod: "4.8", descricao: "Custos fixos - Seguros de Bens" },
              { cod: "4.9", descricao: "Custos fixos - CFTV e Seguranca" },
              { cod: "5", descricao: "Marketing" },
              { cod: "5.1", descricao: "Marketing - Trafego pago" },
              { cod: "5.2", descricao: "Marketing - Consultoria" },
              { cod: "5.3", descricao: "Marketing - Sites" },
              { cod: "5.4", descricao: "Marketing - Papelaria" },
              { cod: "5.5", descricao: "Marketing - Audio Visual" },
              { cod: "5.6", descricao: "Marketing - Brindes e premiacoes" },
              { cod: "5.7", descricao: "Marketing - Eventos e Confraternizacoes" },
              { cod: "5.8", descricao: "Marketing - Comercial e vendas" },
              { cod: "6", descricao: "RH" },
              { cod: "6.1", descricao: "RH - Assistencia medica e medicamentes" },
              { cod: "6.2", descricao: "RH - Selecao" },
              { cod: "6.3", descricao: "RH - Folha salarial" },
              { cod: "6.4", descricao: "RH - Seguro Funcionario" },
              { cod: "6.5", descricao: "RH - Cafe da manha e alimentacao" },
              { cod: "7", descricao: "Juridico" },
              { cod: "7.1", descricao: "Juridico - Assessoria" },
              { cod: "7.2", descricao: "Juridico - Processos" },
              { cod: "7.3", descricao: "Juridico - Honorario" },
              { cod: "8", descricao: "Contabilidade" },
              { cod: "8.1", descricao: "Contabilidade - Assessoria" },
              { cod: "8.2", descricao: "Contabilidade - Impostos e taxas" },
              { cod: "9", descricao: "Seguranca do Trabalho" },
              { cod: "9.1", descricao: "Seguranca do Trabalho - Assessoria" },
              { cod: "9.2", descricao: "Seguranca do trabalho - EPIS" },
              { cod: "10", descricao: "Informatica" },
              { cod: "10.1", descricao: "Informatica - Softwares" },
              { cod: "10.2", descricao: "Informatica - Hardware" },
              { cod: "10.3", descricao: "Informatica - Redes" },
              { cod: "11", descricao: "Manutencao predial" },
              { cod: "11.1", descricao: "Manutencao predial - Civil" },
              { cod: "11.2", descricao: "Manutencao predial - Eletrica" },
              { cod: "11.3", descricao: "Manutencao predial - Climatizacao" },
              { cod: "11.4", descricao: "Manutencao predial - Hidraulica" },
              { cod: "11.5", descricao: "Manutencao predial - Pintura" },
              { cod: "11.6", descricao: "Manutencao predial - Acabamentos e decoracoes" },
              { cod: "11.7", descricao: "Manutencao predial - Outros servicos" },
              { cod: "12", descricao: "Moveis e eletrodomesticos" },
              { cod: "12.1", descricao: "Moveis e eletrodomesticos - Assentos" },
              { cod: "12.2", descricao: "Moveis e eletrodomesticos - Marcenaria" },
              { cod: "12.3", descricao: "Moveis e eletrodomesticos - Eletros de cozinha" },
              { cod: "13", descricao: "Treinamentos e cursos" },
              { cod: "13.1", descricao: "Treinamentos e cursos - Treinamentos" },
              { cod: "13.2", descricao: "Treinamentos e cursos - Cursos" },
              { cod: "13.3", descricao: "Treinamentos e cursos - Palestras" },
              { cod: "14", descricao: "Outros" },
              { cod: "14.1", descricao: "Outros - Confraternizacoes" },
              { cod: "14.2", descricao: "Outros - Brindes" },
              { cod: "14.3", descricao: "Outros - Orcamentos (prospeccao de clientes)" },
              { cod: "15", descricao: "Equipamentos e Ferramentas" },
              { cod: "15.1", descricao: "Equipamentos e Ferramentas - Material de Seguranca" },
              { cod: "15.2", descricao: "Equipamentos e Ferramentas - Ferramentas Manuais" },
              { cod: "15.3", descricao: "Equipamentos e Ferramentas - Equipamentos" },
              { cod: "15.4", descricao: "Equipamentos e Ferramentas - Equipamento de Grande Porte" },
            ],
          },
        ],
        bancos: [
          { id: 1, nome: "Banco do Brasil" },
          { id: 2, nome: "Caixa Economica Federal" },
          { id: 3, nome: "Itau" },
        ],
        pagador: [
          { id: 1, nome: "Construtora Messa" },
          { id: 2, nome: "Incorporadora Horizonte" },
        ],
        fornecedor: [
          { id: 1, nome: "Center Mak Ferramentas" },
        ],
        administrativo: [],
        tipo_pagamento: [],
        categoria: [],
        material: [
          { id: 1, descricao: "Cimento CP-II" },
          { id: 2, descricao: "Areia media" },
          { id: 3, descricao: "Brita 1" },
        ],
        servico: [
          { id: 11, descricao: "Concretagem de viga" },
          { id: 12, descricao: "Instalacao de eletroduto" },
        ],
        equipamento: [
          { id: 21, descricao: "Locacao de betoneira" },
          { id: 22, descricao: "Locacao de martelete" },
        ],
      },
    };
  },
};
window.localApi = localApi;

function dedupePorNome(valores = []) {
  const vistos = new Set();
  const resultado = [];
  valores.forEach((v) => {
    const nome = String(v || "").trim();
    if (!nome) return;
    const chave = nome.toLowerCase();
    if (vistos.has(chave)) return;
    vistos.add(chave);
    resultado.push({ id: resultado.length + 1, nome });
  });
  return resultado;
}

function extrairListasFluxo(rows = []) {
  const bancos = dedupePorNome(rows.map((r) => r?.banco));
  const tipoPagamento = dedupePorNome(rows.map((r) => r?.tipo_pagamento));
  const categoria = dedupePorNome(rows.map((r) => r?.categoria));
  return {
    bancos,
    tipo_pagamento: tipoPagamento,
    categoria,
  };
}

async function carregarDadosReferenciaFluxo() {
  const resposta = await fetch(API_REFERENCIA_FLUXO);
  if (!resposta.ok) throw new Error(`Falha ao carregar db_fluxo: ${resposta.status}`);
  const json = await resposta.json();
  const rows = Array.isArray(json?.data) ? json.data : [];
  return extrairListasFluxo(rows);
}

function normalizarDadosComCod(rows = []) {
  return toArray(rows)
    .map((row) => {
      const descricao = String(row?.descricao ?? row?.descrição ?? "").trim();
      return {
        ...row,
        id: row?.id ?? row?.cod ?? "",
        cod: row?.cod ?? row?.id ?? "",
        descricao,
      };
    })
    .filter((row) => row.descricao);
}

async function carregarDadosReferenciaCustos(sheet) {
  const url = `${API_REFERENCIA_CUSTOS_BASE}?sheet=${encodeURIComponent(sheet)}`;
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Falha ao carregar ${sheet}: ${resposta.status}`);
  const json = await resposta.json();
  return normalizarDadosComCod(Array.isArray(json?.data) ? json.data : []);
}

function normalizarDadosAdministrativos(rows = []) {
  return toArray(rows)
    .map((row) => {
      const cod = row?.cod ?? row?.Cod ?? row?.COD ?? "";
      const descricao = String(
        row?.descricao ??
          row?.descrição ??
          row?.["Descrição"] ??
          row?.["DescriÃ§Ã£o"] ??
          ""
      ).trim();
      const unidade = row?.unidade ?? row?.Unidade ?? "";
      const valorUnitario = row?.valor_unitario ?? row?.["Valor Unitario"] ?? row?.["Valor Unitário"] ?? "";
      return {
        ...row,
        id: row?.id ?? cod ?? "",
        cod: cod ?? row?.id ?? "",
        descricao,
        unidade,
        valor_unitario: valorUnitario,
      };
    })
    .filter((row) => row.descricao);
}

async function carregarDadosReferenciaAdministrativos() {
  const resposta = await fetch(API_REFERENCIA_ADMINISTRATIVO);
  if (!resposta.ok) throw new Error(`Falha ao carregar itens administrativos: ${resposta.status}`);
  const json = await resposta.json();
  return normalizarDadosAdministrativos(Array.isArray(json?.data) ? json.data : []);
}

function normalizarPessoas(rows = []) {
  return toArray(rows)
    .map((row) => ({
      ...row,
      id: row?.id ?? "",
      nome: String(row?.nome ?? row?.name ?? "").trim(),
    }))
    .filter((row) => row.nome);
}

async function carregarDadosReferenciaCadastro() {
  const resposta = await fetch(API_REFERENCIA_CADASTRO);
  if (!resposta.ok) throw new Error(`Falha ao carregar cadastro: ${resposta.status}`);
  const json = await resposta.json();
  return {
    pagadores: normalizarPessoas(json?.pagadores),
    fornecedores: normalizarPessoas(json?.fornecedores),
  };
}

function compactarListaReferencia(lista = []) {
  return toArray(lista).map((item) => ({
    id: item.id ?? item.cod ?? "",
    cod: item.cod ?? item.id ?? "",
    nome: item.nome ?? "",
    descricao: item.descricao ?? "",
    unidade: item.unidade ?? "",
    valor_unitario: item.valor_unitario ?? "",
  }));
}

function compactarReferenciasParaCache(payload = {}) {
  return {
    obra: toArray(payload.obra).map((obra) => ({
      id: obra.id ?? "",
      nome: obra.nome ?? obra.descricao ?? "",
      atividade: toArray(obra.atividade).map((a) => ({
        id: a.id ?? a.cod ?? "",
        cod: a.cod ?? "",
        descricao: a.descricao ?? "",
      })),
    })),
    bancos: toArray(payload.bancos).map((b) => ({
      id: b.id ?? "",
      nome: b.nome ?? "",
    })),
    pagador: toArray(payload.pagador).map((p) => ({
      id: p.id ?? "",
      nome: p.nome ?? "",
    })),
    fornecedor: toArray(payload.fornecedor).map((f) => ({
      id: f.id ?? "",
      nome: f.nome ?? "",
    })),
    administrativo: compactarListaReferencia(payload.administrativo),
    material: compactarListaReferencia(payload.material),
    servico: compactarListaReferencia(payload.servico),
    equipamento: compactarListaReferencia(payload.equipamento),
    tipo_pagamento: toArray(payload.tipo_pagamento).map((t) => ({
      id: t.id ?? "",
      nome: t.nome ?? "",
    })),
    categoria: toArray(payload.categoria).map((c) => ({
      id: c.id ?? "",
      nome: c.nome ?? "",
    })),
  };
}

function salvarReferenciasCache(payload = {}) {
  try {
    const compacto = compactarReferenciasParaCache(payload);
    localStorage.setItem(CACHE_REFERENCIAS_KEY, JSON.stringify(compacto));
    localStorage.setItem(CACHE_REFERENCIAS_TIME_KEY, new Date().toISOString());
  } catch (error) {
    console.warn("Nao foi possivel salvar referencias em cache:", error);
  }
}

function restaurarReferenciasCache() {
  try {
    const raw = localStorage.getItem(CACHE_REFERENCIAS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    setDadosReferencia(parsed);
    return true;
  } catch (error) {
    console.warn("Erro ao restaurar cache de referencias:", error);
    return false;
  }
}

function cacheReferenciasEstaVencido() {
  const ts = localStorage.getItem(CACHE_REFERENCIAS_TIME_KEY);
  if (!ts) return true;
  const diff = Date.now() - new Date(ts).getTime();
  return !Number.isFinite(diff) || diff > CACHE_REFERENCIAS_MAX_AGE_MS;
}

function aplicarAtualizacaoReferenciasParcial(patch = {}, origem = "", concluidas = []) {
  const payloadAtualizado = {
    ...dadosReferencia,
    ...patch,
  };
  setDadosReferencia(payloadAtualizado);
  salvarReferenciasCache(payloadAtualizado);
  concluidas.forEach((chave) => definirStatusReferencia(chave, "done"));
  if (origem) console.log(`Referencias atualizadas: ${origem}`);
}

async function atualizarReferenciasEmParaleloProgressivo() {
  ["obra", "pagador", "fornecedor", "bancos", "categoria", "administrativo", "material", "servico", "equipamento"].forEach((k) =>
    definirStatusReferencia(k, "loading")
  );

  let payloadLocal = {};
  try {
    const respostaLocal = await localApi.getDadosReferencia();
    payloadLocal = respostaLocal?.dados ?? {};
    aplicarAtualizacaoReferenciasParcial(payloadLocal, "local", ["obra"]);
  } catch (error) {
    console.warn("Falha ao carregar fallback local:", error);
    definirStatusReferencia("obra", "error");
  }

  const tarefas = [
    carregarDadosReferenciaFluxo()
      .then((fluxo) => {
        const bancosCombinados = dedupePorNome([
          ...toArray(dadosReferencia.bancos).map((b) => b?.nome),
          ...toArray(fluxo.bancos).map((b) => b?.nome),
        ]);
        aplicarAtualizacaoReferenciasParcial(
          {
            bancos: bancosCombinados,
            tipo_pagamento: fluxo.tipo_pagamento ?? [],
            categoria: fluxo.categoria ?? [],
          },
          "fluxo",
          ["bancos", "categoria"]
        );
      })
      .catch((error) => {
        console.warn("Falha ao carregar referencias de fluxo:", error);
        definirStatusReferencia("bancos", "error");
        definirStatusReferencia("categoria", "error");
      }),
    carregarDadosReferenciaCadastro()
      .then((cadastro) => {
        aplicarAtualizacaoReferenciasParcial(
          {
            pagador: cadastro.pagadores.length ? cadastro.pagadores : payloadLocal.pagador,
            fornecedor: cadastro.fornecedores.length ? cadastro.fornecedores : payloadLocal.fornecedor,
          },
          "cadastro",
          ["pagador", "fornecedor"]
        );
      })
      .catch((error) => {
        console.warn("Falha ao carregar cadastro (pagadores/fornecedores):", error);
        definirStatusReferencia("pagador", "error");
        definirStatusReferencia("fornecedor", "error");
      }),
    carregarDadosReferenciaAdministrativos()
      .then((administrativoApi) => {
        aplicarAtualizacaoReferenciasParcial(
          { administrativo: administrativoApi.length ? administrativoApi : payloadLocal.administrativo },
          "administrativo",
          ["administrativo"]
        );
      })
      .catch((error) => {
        console.warn("Falha ao carregar itens administrativos:", error);
        definirStatusReferencia("administrativo", "error");
      }),
    carregarDadosReferenciaCustos("Servicos")
      .then((servicosApi) => {
        aplicarAtualizacaoReferenciasParcial(
          { servico: servicosApi.length ? servicosApi : payloadLocal.servico },
          "servicos",
          ["servico"]
        );
      })
      .catch((error) => {
        console.warn("Falha ao carregar Servicos:", error);
        definirStatusReferencia("servico", "error");
      }),
    carregarDadosReferenciaCustos("Materiais")
      .then((materiaisApi) => {
        aplicarAtualizacaoReferenciasParcial(
          { material: materiaisApi.length ? materiaisApi : payloadLocal.material },
          "materiais",
          ["material"]
        );
      })
      .catch((error) => {
        console.warn("Falha ao carregar Materiais:", error);
        definirStatusReferencia("material", "error");
      }),
    carregarDadosReferenciaCustos("Equipamentos")
      .then((equipamentosApi) => {
        aplicarAtualizacaoReferenciasParcial(
          { equipamento: equipamentosApi.length ? equipamentosApi : payloadLocal.equipamento },
          "equipamentos",
          ["equipamento"]
        );
      })
      .catch((error) => {
        console.warn("Falha ao carregar Equipamentos:", error);
        definirStatusReferencia("equipamento", "error");
      }),
  ];

  await Promise.allSettled(tarefas);
}

const formatarMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

let userMail = "";
let userName = "";

if (typeof google === "undefined") {
  var google = {
    script: {
      run: {
        withSuccessHandler: function (callback) {
          this.callback = callback;
          return this;
        },
        withFailureHandler: function (err) {
          this.err = err;
          return this;
        },
        obterEmailUsuario: function () {
          this.callback("r.lopes@construtoramessa.com.br");
        },
        procuraUsuario: function (email) {
          this.callback(email);
        },
      },
    },
  };
}

function verificarPermissaoUsuario() {
  if (typeof google !== "undefined" && google.script) {
    google.script.run
      .withSuccessHandler(function (email) {
        userMail = email || "";
        window.userMail = userMail;
        google.script.run
          .withSuccessHandler(function (user) {
            userName = user || "";
            window.userName = userName;
          })
          .procuraUsuario(email);
      })
      .obterEmailUsuario();
  }
}

function obterUsuarioAtual() {
  return String(window.userName ?? userName ?? window.usuarioAtual ?? window.usuarioEmail ?? window.usuario ?? "").trim();
}

function respostaApiSucesso(respostaHttp, body) {
  if (!respostaHttp?.ok) return false;
  if (!body) return true;
  if (typeof body === "string") {
    const t = body.toLowerCase();
    return t.includes("ok") || t.includes("sucesso") || t.includes("success");
  }
  if (body.ok === true || body.success === true) return true;
  if (String(body.status ?? "").toLowerCase() === "ok") return true;
  if (String(body.result ?? "").toLowerCase() === "success") return true;
  if (body.ok === false || body.success === false) return false;
  return true;
}

function montarPayloadSaidaManual(idOp) {
  const idOpFormatado = String(idOp ?? "").trim();
  return {
    tipo: "saida",
    data: dados.data,
    categoria: dados.categoria,
    banco: dados.banco,
    valorTotal: calcularSomaTotalItens(),
    descricao: `OP Manual: ${idOpFormatado} - NF: ${dados.nf}`,
    fornecedor: dados.fornecedor,
  };
}

async function enviarPostJson(url, payload) {
  const resposta = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const texto = await resposta.text();
  let body = texto;
  try {
    body = texto ? JSON.parse(texto) : null;
  } catch (_e) {
    body = texto;
  }

  return { resposta, body };
}

async function SalvarDados() {
  const botaoSalvar = document.getElementById("btn-salvar");
  if (botaoSalvar?.disabled) return;

  if (!temPeloMenosUmItemAdicionado()) {
    Toastify({
      text: "Adicione ao menos 1 item antes de salvar.",
      duration: 3000,
      style: { background: "#bd1717" },
    }).showToast();
    return;
  }

  if (!validarFormularioAntesDeSalvar()) {
    Toastify({
      text: "Preencha todos os campos obrigatorios com valores validos.",
      duration: 3000,
      style: { background: "#bd1717" },
    }).showToast();
    return;
  }

  const usuarioAtual = obterUsuarioAtual();
  if (usuarioAtual) dados.usuario = usuarioAtual;

  const payload = {
    nf: dados.nf,
    obra: dados.obra,
    obraId: dados.obraId,
    pagador: dados.pagador,
    pagadorId: dados.pagadorId,
    fornecedor: dados.fornecedor,
    fornecedorId: dados.fornecedorId,
    categoria: dados.categoria,
    categoriaId: dados.categoriaId,
    tipo: dados.tipo,
    tipoId: dados.tipoId,
    data: dados.data,
    banco: dados.banco,
    bancoId: dados.bancoId,
    usuario: dados.usuario || usuarioAtual || "",
    itens: dados.itens,
  };

  console.log("Payload que seria enviado para a API:", payload);
  definirEstadoLoadingBotaoSalvar(true);
  try {
    const { resposta, body } = await enviarPostJson(API_SALVAR_FINANCEIRO, payload);

    if (!respostaApiSucesso(resposta, body)) {
      throw new Error("Falha ao salvar no financeiro.");
    }

    Toastify({
      text: "Dados salvos no financeiro.",
      duration: 2500,
      style: { background: "#00aa25" },
    }).showToast();

    const idOp = body?.idOp;
    if (idOp === undefined || idOp === null || String(idOp).trim() === "") {
      throw new Error("Resposta da API sem idOp.");
    }

    const payloadSaidaManual = montarPayloadSaidaManual(idOp);
    console.log("Payload de saida manual:", payloadSaidaManual);

    const { resposta: respostaSaida, body: bodySaida } = await enviarPostJson(
      API_SALVAR_FLUXO,
      payloadSaidaManual
    );

    if (!respostaApiSucesso(respostaSaida, bodySaida)) {
      throw new Error("Falha ao salvar no fluxo.");
    }

    Toastify({
      text: "Dados salvos no fluxo.",
      duration: 2500,
      style: { background: "#00aa25" },
    }).showToast();
    limparTelaSemConfirmacao();
  } catch (error) {
    console.error("Erro ao salvar dados:", error);
    Toastify({
      text: error?.message || "Falha ao salvar dados na API.",
      duration: 3500,
      style: { background: "#bd1717" },
    }).showToast();
  } finally {
    definirEstadoLoadingBotaoSalvar(false);
  }
}

function normalizarItem(item = {}) {
  const id = item.id ?? item.idServ ?? proximoIdItem++;
  const descricao = item.descricao ?? item.descricaoServ ?? "";
  const descricaoId = item.descricaoId ?? "";
  const atividadeId = item.atividadeId ?? "";
  const atividade = item.atividade ?? "";
  const qtde = Number(item.qtde ?? item.quantidade ?? 0) || 0;
  const unidade = item.unidade ?? "un";
  const unitario = Number(item.unitario ?? item.valorUnitario ?? 0) || 0;

  return { id, descricao, descricaoId, atividadeId, atividade, qtde, unidade, unitario };
}

function formatarQuantidade(valor) {
  return (typeof valor === "number" ? valor : parseFloat(valor) || 0).toFixed(2);
}

function parseNumeroEntrada(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return NaN;

  let normalizado = texto.replace(/\s/g, "").replace(/R\$/gi, "");
  if (normalizado.includes(".") && normalizado.includes(",")) {
    normalizado = normalizado.replace(/\./g, "").replace(",", ".");
  } else if (normalizado.includes(",")) {
    normalizado = normalizado.replace(",", ".");
  }

  normalizado = normalizado.replace(/[^0-9.-]/g, "");
  return parseFloat(normalizado);
}

function calcularTotalItem(item) {
  return (Number(item.qtde) || 0) * (Number(item.unitario) || 0);
}

function calcularSomaTotalItens() {
  return dados.itens.reduce((acc, item) => acc + calcularTotalItem(item), 0);
}

function atualizarSomaTotalTabela() {
  if (!somaTotalEl) return;
  somaTotalEl.textContent = formatarMoeda.format(calcularSomaTotalItens());
}

function obterItemPorId(idItem) {
  return dados.itens.find((item) => String(item.id) === String(idItem));
}

function atualizarCampoItem(idItem, chave, valor) {
  const item = obterItemPorId(idItem);
  if (!item) return;
  item[chave] = valor;
  salvarRascunhoCache();
}

function atualizarTotalLinha(linha, idItem) {
  const item = obterItemPorId(idItem);
  if (!item || !linha) return;

  const totalCell = linha.querySelector(".td-valor-total");
  if (totalCell) totalCell.textContent = formatarMoeda.format(calcularTotalItem(item));
  atualizarSomaTotalTabela();
}

function vincularLinhaItem(linha, idItem) {
  const inputDescricao = linha.querySelector(".input-descricao");
  const inputAtividade = linha.querySelector(".input-atividade");
  const inputQtde = linha.querySelector(".input-qtde");
  const inputUnidade = linha.querySelector(".input-unidade");
  const inputUnitario = linha.querySelector(".input-unitario");

  if (inputDescricao) {
    inputDescricao.addEventListener("input", (event) => {
      atualizarCampoItem(idItem, "descricao", event.target.value);
      atualizarCampoItem(idItem, "descricaoId", event.target.dataset.selectedId || "");
    });
  }

  if (inputAtividade) {
    inputAtividade.addEventListener("input", (event) => {
      atualizarCampoItem(idItem, "atividade", event.target.value);
      atualizarCampoItem(idItem, "atividadeId", event.target.dataset.selectedId || "");
    });
  }

  if (inputQtde) {
    inputQtde.addEventListener("input", (event) => {
      const valor = parseNumeroEntrada(event.target.value);
      atualizarCampoItem(idItem, "qtde", Number.isFinite(valor) ? valor : 0);
      atualizarTotalLinha(linha, idItem);
    });

    inputQtde.addEventListener("blur", (event) => {
      const item = obterItemPorId(idItem);
      event.target.value = formatarQuantidade(item?.qtde ?? 0);
    });
  }

  if (inputUnidade) {
    inputUnidade.addEventListener("input", (event) => {
      atualizarCampoItem(idItem, "unidade", event.target.value);
    });
  }

  if (inputUnitario) {
    inputUnitario.addEventListener("focus", (event) => {
      const item = obterItemPorId(idItem);
      event.target.value = formatarQuantidade(item?.unitario ?? 0);
      event.target.select();
    });

    inputUnitario.addEventListener("input", (event) => {
      const valor = parseNumeroEntrada(event.target.value);
      atualizarCampoItem(idItem, "unitario", Number.isFinite(valor) ? valor : 0);
      atualizarTotalLinha(linha, idItem);
    });

    inputUnitario.addEventListener("blur", (event) => {
      const item = obterItemPorId(idItem);
      event.target.value = formatarMoeda.format(item?.unitario ?? 0);
    });
  }
}

function adicionarLinhaItem(item) {
  const valorTotal = formatarMoeda.format(calcularTotalItem(item));

  const disabledAttr = medicaoAtualAprovada ? "disabled" : "";
  const btnStyle = medicaoAtualAprovada ? "display: none;" : "";
  const editavelClass = medicaoAtualAprovada ? "" : "editavel";

  const linhaHTML = `
  <tr data-id-item="${item.id}">
    <td colspan="2">
      <div class="dropdown-wrapper" data-dropdown-source="itens_descricao" data-dropdown-label-key="descricao" data-dropdown-mode="filter">
        <input type="text" class="${editavelClass} side-padding table-field input-descricao" value="${item.descricao}" placeholder="Descricao" autocomplete="off" oninput="limparSelecaoDropdown(this); filtrarDropdown(this)" onFocus="filtrarDropdown(this); this.select()" onblur="finalizarDropdownInput(this)" data-selected-id="${item.descricaoId ?? ""}" ${disabledAttr}>
        <div class="dropdown-list"></div>
      </div>
    </td>
    <td class="td-atividade">
      <div class="dropdown-wrapper" data-dropdown-source="atividades" data-dropdown-label-key="descricao">
        <input type="text" class="${editavelClass} side-padding table-field input-atividade" value="${item.atividade}" placeholder="Atividade" autocomplete="off" ${disabledAttr} oninput="limparSelecaoDropdown(this); filtrarDropdown(this)" onFocus="filtrarDropdown(this); this.select()" onblur="finalizarDropdownInput(this)" data-selected-id="${item.atividadeId ?? ""}">
        <div class="dropdown-list"></div>
      </div>
    </td>
    <td><input type="text" class="${editavelClass} side-padding table-field input-qtde" value="${formatarQuantidade(item.qtde)}" autocomplete="off" onFocus="this.select()" ${disabledAttr}></td>
    <td>
      <div class="dropdown-wrapper" data-dropdown-source="unidades" data-dropdown-label-key="descricao">
        <input type="text" class="${editavelClass} side-padding table-field input-unidade tCenter" value="${item.unidade}" placeholder="UND" autocomplete="off" oninput="filtrarDropdown(this)" onFocus="filtrarDropdown(this); this.select()" onblur="fecharDropdownInput(this, 200)" ${disabledAttr}>
        <div class="dropdown-list"></div>
      </div>
    </td>
    <td><input type="text" class="${editavelClass} side-padding table-field input-unitario" value="${formatarMoeda.format(item.unitario)}" autocomplete="off" onFocus="this.select()" ${disabledAttr}></td>
    <td class="side-padding td-valor-total">${valorTotal}</td>
    <td class="acao-coluna">
      <button type="button" class="delete-button" onclick="removerItem(this)" title="Remover" aria-label="Remover item" ${disabledAttr} style="${btnStyle}">
        <svg width="15" height="15" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fill="currentColor" d="M9 3h6l1 2h5v2H3V5h5l1-2Zm-1 6v10h2V9H8Zm4 0v10h2V9h-2Zm4 0v10h2V9h-2Zm-9 0h10l-.9 11.3a2 2 0 0 1-2 1.7H8.9a2 2 0 0 1-2-1.7L6 9Z"/>
        </svg>
      </button>
    </td>
  </tr>
`;

  tbody.insertAdjacentHTML("beforeend", linhaHTML);
  const linha = tbody.lastElementChild;
  vincularLinhaItem(linha, item.id);
}

function adicionarItem() {
  const novoItem = normalizarItem({
    id: proximoIdItem++,
    descricao: "",
    atividade: "",
    qtde: 0,
    unidade: "",
    unitario: 0,
  });

  dados.itens.push(novoItem);
  adicionarLinhaItem(novoItem);
  atualizarSomaTotalTabela();
  salvarRascunhoCache();
  console.log(dados);
}

function removerItem(botao) {
  if (medicaoAtualAprovada) return;
  const linha = botao.closest("tr");
  if (!linha) return;

  const idItem = linha.dataset.idItem;
  let index = -1;

  if (idItem) {
    index = dados.itens.findIndex((item) => String(item.id) === idItem);
  }

  if (index === -1) {
    const linhasAtuais = Array.from(tbody.children);
    index = linhasAtuais.indexOf(linha);
  }

  if (index > -1) {
    dados.itens.splice(index, 1);
    atualizarSomaTotalTabela();
    salvarRascunhoCache();
  }

  linha.remove();
}

function iniciarCamposPagamento() {
  camposCabecalho.forEach((campo) => {
    const chave = campo.dataset.field;
    if (!Object.prototype.hasOwnProperty.call(dados, chave)) return;

    campo.value = dados[chave] ?? "";
    const chaveId = `${chave}Id`;
    if (Object.prototype.hasOwnProperty.call(dados, chaveId)) {
      campo.dataset.selectedId = dados[chaveId] || "";
      campo.dataset.selectedLabel = dados[chave] || "";
    }

    campo.addEventListener("input", (event) => {
      dados[chave] = event.target.value;
      const chaveId = `${chave}Id`;
      if (Object.prototype.hasOwnProperty.call(dados, chaveId)) {
        dados[chaveId] = event.target.dataset.selectedId || "";
      }
      if (chave === "obra") {
        limparAtividadesItens();
      }
      salvarRascunhoCache();
    });
  });
}


//#region fn dropdown
function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return [v];
  return [];
}

function obterOpcoesDropdown(sourceKey) {
  if (!sourceKey) return [];

  if (sourceKey === "obra") {
    return toArray(dadosReferencia.obra).map((obra) => ({
      id: obra.id,
      descricao: `${obra.id ?? ""} - ${obra.nome ?? obra.descricao ?? ""}`.trim(),
      raw: obra,
    }));
  }

  if (sourceKey === "atividades") {
    const obras = toArray(dadosReferencia.obra);
    const obraSelecionadaId = String(dados.obraId || "");
    if (!obraSelecionadaId) return [];
    const atividades = [];
    obras.forEach((obra) => {
      if (String(obra.id) !== obraSelecionadaId) return;
      toArray(obra.atividade).forEach((atividade) => {
        atividades.push({
          id: atividade.id ?? atividade.cod ?? "",
          descricao: `${atividade.cod ?? ""} ${atividade.descricao ?? ""}`.trim(),
          raw: atividade,
          obraId: obra.id,
        });
      });
    });
    return atividades;
  }

  if (sourceKey === "bancos") {
    return toArray(dadosReferencia.bancos).map((banco) => ({
      id: banco.id,
      nome: banco.nome ?? "",
      raw: banco,
    }));
  }

  if (sourceKey === "pagador") {
    return toArray(dadosReferencia.pagador).map((pagador) => ({
      id: pagador.id,
      nome: pagador.nome ?? "",
      raw: pagador,
    }));
  }

  if (sourceKey === "fornecedor") {
    return toArray(dadosReferencia.fornecedor).map((fornecedor) => ({
      id: fornecedor.id,
      nome: fornecedor.nome ?? "",
      raw: fornecedor,
    }));
  }

  if (sourceKey === "categoria") {
    return toArray(dadosReferencia.categoria).map((categoria) => ({
      id: categoria.id,
      nome: categoria.nome ?? "",
      raw: categoria,
    }));
  }

  if (sourceKey === "tipo") {
    const tipos = [
      "Boleto",
      "Cartão de Crédito",
      "Cartão de Débito",
      "Pix",
      "Deposito Bancario",
    ];
    return tipos.map((descricao, idx) => ({
      id: idx + 1,
      descricao,
      raw: descricao,
    }));
  }

  if (sourceKey === "unidades") {
    const unidades = [
      "vb",
      "und",
      "m",
      "m²",
      "m³",
      "kg",
      "g",
      "L",
      "mL",
      "gl",
      "rl",
      "cx",
      "pct",
      "sc",
      "par",
      "jg",
      "h",
      "dia",
      "mes",
    ];
    return unidades.map((u, idx) => ({
      id: idx + 1,
      descricao: u,
      raw: u,
    }));
  }

  if (sourceKey === "itens_descricao") {
    const tipoSigla = {
      administrativo: "A",
      material: "M",
      servico: "S",
      equipamento: "E",
    };

    const mapear = (lista, tipo) =>
      toArray(lista).map((item) => ({
        id: `${tipo}:${item.id ?? ""}`,
        descricao: `${tipoSigla[tipo] || "I"} ${item.id ?? ""} - ${item.descricao ?? item.nome ?? ""}`.trim(),
        tipo,
        raw: item,
      }));

    return [
      ...mapear(dadosReferencia.administrativo, "administrativo"),
      ...mapear(dadosReferencia.servico, "servico"),
      ...mapear(dadosReferencia.material, "material"),
      ...mapear(dadosReferencia.equipamento, "equipamento"),
    ];
  }

  return toArray(dadosReferencia[sourceKey]);
}

function filtrarDropdown(input) {
  const wrapper = input.closest(".dropdown-wrapper");
  if (!wrapper) return;

  const list = wrapper.querySelector(".dropdown-list");
  if (!list) return;

  const sourceKey = wrapper.dataset.dropdownSource || input.dataset.dropdownSource;
  const labelKey = wrapper.dataset.dropdownLabelKey || input.dataset.dropdownLabelKey || "nome";
  const mode = wrapper.dataset.dropdownMode || "rank";
  const opcoes = obterOpcoesDropdown(sourceKey);
  const termo = (input.value || "").toLowerCase();

  list.innerHTML = "";
  if (!opcoes.length) {
    ocultarDropdownComAnimacao(list);
    return;
  }

  const listaOrdenada = opcoes
    .map((opcao) => {
      const texto = String(opcao[labelKey] ?? opcao.nome ?? opcao.descricao ?? "");
      const isMatch = termo ? texto.toLowerCase().includes(termo) : false;
      return { opcao, texto, isMatch };
    })
    .filter((item) => item.texto)
    .filter((item) => {
      if (mode !== "filter") return true;
      if (!termo) return true;
      return item.isMatch;
    })
    .sort((a, b) => {
      const aMatch = a.isMatch ? 0 : 1;
      const bMatch = b.isMatch ? 0 : 1;
      return aMatch - bMatch;
    });

  listaOrdenada.forEach(({ opcao, texto, isMatch }) => {
    const div = document.createElement("div");
    div.className = "dropdown-item";
    div.textContent = texto;
    if (isMatch && mode !== "filter") {
      div.style.backgroundColor = "rgba(33, 150, 243, 0.1)";
    }
    div.onmousedown = function () {
      selecionarOpcaoDropdown(input, opcao, labelKey);
    };
    list.appendChild(div);
  });

  if (list.children.length) {
    mostrarDropdownComAnimacao(list);
  } else {
    ocultarDropdownComAnimacao(list);
  }
}

function filtrarServicos(input) {
  filtrarDropdown(input);
}
//#region fim

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function distanciaLevenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + custo
      );
    }
  }
  return dp[m][n];
}

function obterConfigDropdown(input) {
  const wrapper = input.closest(".dropdown-wrapper");
  if (!wrapper) return null;
  const sourceKey = wrapper.dataset.dropdownSource || input.dataset.dropdownSource;
  const labelKey = wrapper.dataset.dropdownLabelKey || input.dataset.dropdownLabelKey || "nome";
  const list = wrapper.querySelector(".dropdown-list");
  return { wrapper, sourceKey, labelKey, list };
}

function marcarCampoErro(input, comErro) {
  input.classList.toggle("input-error", Boolean(comErro));
}

function obterTextoOpcao(opcao, labelKey) {
  return String(opcao[labelKey] ?? opcao.nome ?? opcao.descricao ?? "").trim();
}

function selecionarOpcaoDropdown(input, opcao, labelKey) {
  const texto = obterTextoOpcao(opcao, labelKey);
  input.dataset.ignorarLimpeza = "1";
  input.value = texto;
  input.dataset.selectedId = opcao.id ?? "";
  input.dataset.selectedLabel = texto;
  marcarCampoErro(input, false);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  delete input.dataset.ignorarLimpeza;

  const cfg = obterConfigDropdown(input);
  if (cfg?.list) ocultarDropdownComAnimacao(cfg.list);
}

function buscarMelhorOpcaoDropdown(input) {
  const cfg = obterConfigDropdown(input);
  if (!cfg) return null;
  const opcoes = obterOpcoesDropdown(cfg.sourceKey);
  const termoOriginal = String(input.value || "").trim();
  const termo = normalizarTexto(termoOriginal);
  if (!termo || !opcoes.length) return null;

  let melhor = null;
  opcoes.forEach((opcao) => {
    const texto = obterTextoOpcao(opcao, cfg.labelKey);
    if (!texto) return;
    const textoNorm = normalizarTexto(texto);

    let score = 999;
    if (textoNorm.startsWith(termo)) score = 0;
    else if (textoNorm.includes(termo)) score = 1;
    else score = 10 + distanciaLevenshtein(termo, textoNorm);

    if (!melhor || score < melhor.score) {
      melhor = { opcao, score, texto };
    }
  });

  if (!melhor) return null;
  if (melhor.score <= 1) return melhor.opcao;

  const scoreDist = melhor.score - 10;
  const limiar = Math.max(2, Math.floor(termo.length * 0.35));
  if (scoreDist <= limiar) return melhor.opcao;
  return null;
}

function limparSelecaoDropdown(input) {
  if (input.dataset.ignorarLimpeza === "1") return;
  input.dataset.selectedId = "";
  input.dataset.selectedLabel = "";
  marcarCampoErro(input, false);
}

function finalizarDropdownInput(input) {
  const cfg = obterConfigDropdown(input);
  if (!cfg) return;

  setTimeout(() => {
    const selecionadoId = String(input.dataset.selectedId || "");
    const selecionadoLabel = String(input.dataset.selectedLabel || "");
    const valorDigitado = String(input.value || "").trim();

    if (selecionadoId && valorDigitado && valorDigitado === selecionadoLabel) {
      marcarCampoErro(input, false);
      if (cfg.list) ocultarDropdownComAnimacao(cfg.list);
      return;
    }

    const melhor = buscarMelhorOpcaoDropdown(input);
    if (melhor) {
      selecionarOpcaoDropdown(input, melhor, cfg.labelKey);
      return;
    }

    input.dataset.selectedId = "";
    input.dataset.selectedLabel = "";
    marcarCampoErro(input, true);
    if (cfg.list) ocultarDropdownComAnimacao(cfg.list);
  }, 200);
}

function mostrarDropdownComAnimacao(list) {
  if (!list) return;
  if (list._hideTimer) {
    clearTimeout(list._hideTimer);
    list._hideTimer = null;
  }
  if (list._onCloseAnimEnd) {
    list.removeEventListener("animationend", list._onCloseAnimEnd);
    list._onCloseAnimEnd = null;
  }
  list.classList.remove("is-closing");
  list.classList.add("is-open");
}

function ocultarDropdownComAnimacao(list) {
  if (!list) return;
  if (!list.classList.contains("is-open") && !list.classList.contains("is-closing")) {
    list.classList.remove("is-open", "is-closing");
    return;
  }

  if (list._onCloseAnimEnd) {
    list.removeEventListener("animationend", list._onCloseAnimEnd);
    list._onCloseAnimEnd = null;
  }

  list.classList.remove("is-open");
  list.classList.add("is-closing");

  list._onCloseAnimEnd = () => {
    list.classList.remove("is-closing");
    list.removeEventListener("animationend", list._onCloseAnimEnd);
    list._onCloseAnimEnd = null;
  };
  list.addEventListener("animationend", list._onCloseAnimEnd);
}

function fecharDropdownInput(input, delayMs = 0) {
  const list = input?.nextElementSibling;
  if (!list || !list.classList.contains("dropdown-list")) return;
  setTimeout(() => ocultarDropdownComAnimacao(list), delayMs);
}

function validarDropdownObrigatorio(input) {
  const cfg = obterConfigDropdown(input);
  if (!cfg) return false;

  const idAtual = String(input.dataset.selectedId || "");
  const labelAtual = String(input.dataset.selectedLabel || "");
  const valorAtual = String(input.value || "").trim();
  if (!(idAtual && valorAtual && valorAtual === labelAtual)) {
    const melhor = buscarMelhorOpcaoDropdown(input);
    if (melhor) {
      selecionarOpcaoDropdown(input, melhor, cfg.labelKey);
    }
  }

  const id = String(input.dataset.selectedId || "");
  const valor = String(input.value || "").trim();
  const valido = Boolean(id && valor);
  marcarCampoErro(input, !valido);
  return valido;
}

function validarTextoObrigatorio(input) {
  const valido = Boolean(String(input.value || "").trim());
  marcarCampoErro(input, !valido);
  return valido;
}

function validarNumeroObrigatorio(input, minimo = 0) {
  const valor = parseNumeroEntrada(input.value);
  const valido = Number.isFinite(valor) && valor > minimo;
  marcarCampoErro(input, !valido);
  return valido;
}

function validarFormularioAntesDeSalvar() {
  let valido = true;

  const nfInput = document.getElementById("nf");
  const dataInput = document.getElementById("data");
  const obraInput = document.getElementById("obra");
  const pagadorInput = document.getElementById("pagador");
  const fornecedorInput = document.getElementById("fornecedor");
  const categoriaInput = document.getElementById("categoria");
  const tipoInput = document.getElementById("tipo");
  const bancoInput = document.getElementById("banco");

  if (nfInput && !validarTextoObrigatorio(nfInput)) valido = false;
  if (dataInput && !validarTextoObrigatorio(dataInput)) valido = false;
  if (obraInput && !validarDropdownObrigatorio(obraInput)) valido = false;
  if (pagadorInput && !validarDropdownObrigatorio(pagadorInput)) valido = false;
  if (fornecedorInput && !validarDropdownObrigatorio(fornecedorInput)) valido = false;
  if (categoriaInput && !validarDropdownObrigatorio(categoriaInput)) valido = false;
  if (tipoInput && !validarDropdownObrigatorio(tipoInput)) valido = false;
  if (bancoInput && !validarDropdownObrigatorio(bancoInput)) valido = false;

  if (!dados.itens.length) valido = false;

  const linhas = Array.from(tbody.querySelectorAll("tr"));
  linhas.forEach((linha) => {
    const descricao = linha.querySelector(".input-descricao");
    const atividade = linha.querySelector(".input-atividade");
    const qtde = linha.querySelector(".input-qtde");
    const unidade = linha.querySelector(".input-unidade");
    const unitario = linha.querySelector(".input-unitario");

    if (descricao && !validarDropdownObrigatorio(descricao)) valido = false;
    if (atividade && !validarDropdownObrigatorio(atividade)) valido = false;
    if (qtde && !validarNumeroObrigatorio(qtde, 0)) valido = false;
    if (unidade && !validarTextoObrigatorio(unidade)) valido = false;
    if (unitario && !validarNumeroObrigatorio(unitario, 0)) valido = false;
  });

  return valido;
}

function temPeloMenosUmItemAdicionado() {
  return dados.itens.some((item) => {
    const descricao = String(item.descricao || "").trim();
    const atividade = String(item.atividade || "").trim();
    const unidade = String(item.unidade || "").trim();
    const qtde = Number(item.qtde) || 0;
    const unitario = Number(item.unitario) || 0;

    return Boolean(descricao || atividade || unidade || qtde > 0 || unitario > 0);
  });
}

function limparAtividadesItens() {
  dados.itens.forEach((item) => {
    item.atividade = "";
    item.atividadeId = "";
  });
  document.querySelectorAll(".input-atividade").forEach((input) => {
    input.value = "";
    input.dataset.selectedId = "";
  });
  salvarRascunhoCache();
}

function criarEstadoVazio() {
  return {
    nf: "",
    obra: "",
    obraId: "",
    pagador: "",
    pagadorId: "",
    fornecedor: "",
    fornecedorId: "",
    categoria: "",
    categoriaId: "",
    tipo: "",
    tipoId: "",
    data: "",
    banco: "",
    bancoId: "",
    usuario: "",
    itens: [],
  };
}

function serializarDadosParaCache() {
  return {
    nf: dados.nf,
    obra: dados.obra,
    obraId: dados.obraId,
    pagador: dados.pagador,
    pagadorId: dados.pagadorId,
    fornecedor: dados.fornecedor,
    fornecedorId: dados.fornecedorId,
    categoria: dados.categoria,
    categoriaId: dados.categoriaId,
    tipo: dados.tipo,
    tipoId: dados.tipoId,
    data: dados.data,
    banco: dados.banco,
    bancoId: dados.bancoId,
    usuario: dados.usuario,
    itens: dados.itens.map((item) => ({
      id: item.id,
      descricao: item.descricao,
      descricaoId: item.descricaoId || "",
      atividadeId: item.atividadeId || "",
      atividade: item.atividade,
      qtde: Number(item.qtde) || 0,
      unidade: item.unidade,
      unitario: Number(item.unitario) || 0,
    })),
  };
}

function salvarRascunhoCache() {
  try {
    const payload = serializarDadosParaCache();
    localStorage.setItem(CACHE_DRAFT_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error("Erro ao salvar cache local:", error);
  }
}

function limparCacheRascunho() {
  localStorage.removeItem(CACHE_DRAFT_KEY);
}

function renderizarItens() {
  tbody.innerHTML = "";
  dados.itens.forEach((item) => adicionarLinhaItem(item));
  atualizarSomaTotalTabela();
}

function restaurarRascunhoCache() {
  const raw = localStorage.getItem(CACHE_DRAFT_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    const base = criarEstadoVazio();

    dados = {
      ...base,
      ...parsed,
      itens: Array.isArray(parsed?.itens)
        ? parsed.itens.map((item) => normalizarItem(item))
        : [],
    };
    window.dados = dados;

    const maiorId = dados.itens.reduce((max, item) => {
      const id = Number(item.id) || 0;
      return id > max ? id : max;
    }, 0);
    proximoIdItem = maiorId + 1;

    renderizarItens();
    return true;
  } catch (error) {
    console.error("Erro ao restaurar cache local:", error);
    return false;
  }
}

function limparTelaComConfirmacao() {
  const confirmou = window.confirm("Deseja limpar todos os dados da tela?");
  if (!confirmou) return;

  limparTelaSemConfirmacao();
}

function limparTelaSemConfirmacao() {
  dados = criarEstadoVazio();
  window.dados = dados;
  proximoIdItem = 1;

  camposCabecalho.forEach((campo) => {
    campo.value = "";
    campo.dataset.selectedId = "";
    campo.dataset.selectedLabel = "";
    marcarCampoErro(campo, false);
  });

  tbody.innerHTML = "";
  adicionarItem();
  atualizarSomaTotalTabela();
  limparCacheRascunho();
}

async function carregarDadosReferenciaTeste() {
  const temCache = restaurarReferenciasCache();
  if (temCache) {
    console.log("Referencias carregadas do cache local.");
    definirStatusReferenciasPorDadosEmCache();
  }

  const precisaAtualizar = !temCache || cacheReferenciasEstaVencido();
  if (!precisaAtualizar) return;

  try {
    await atualizarReferenciasEmParaleloProgressivo();
    console.log("Dados de referencia atualizados via API.");
  } catch (error) {
    console.error("Erro ao atualizar dados de referencia:", error);
  }
}

function definirEstadoLoadingBotaoAtualizar(loading) {
  const botao = document.getElementById("btn-atualizar-ref");
  if (!botao) return;

  if (!botao.dataset.originalText) {
    botao.dataset.originalText = botao.textContent.trim();
  }

  botao.disabled = Boolean(loading);
  botao.classList.toggle("is-loading", Boolean(loading));
  botao.textContent = loading ? "Atualizando..." : botao.dataset.originalText;
}

function definirEstadoLoadingBotaoSalvar(loading) {
  const botao = document.getElementById("btn-salvar");
  if (!botao) return;

  if (!botao.dataset.originalText) {
    botao.dataset.originalText = botao.textContent.trim();
  }

  botao.disabled = Boolean(loading);
  botao.classList.toggle("is-loading", Boolean(loading));
  botao.textContent = loading ? "Salvando..." : botao.dataset.originalText;
}

async function forcarAtualizacaoReferencias() {
  definirEstadoLoadingBotaoAtualizar(true);
  try {
    await atualizarReferenciasEmParaleloProgressivo();
    Toastify({
      text: "Referencias atualizadas com sucesso.",
      duration: 2500,
      style: { background: "#00aa25" },
    }).showToast();
  } catch (error) {
    console.error("Erro na atualizacao forcada de referencias:", error);
    Toastify({
      text: "Falha ao atualizar referencias.",
      duration: 3000,
      style: { background: "#bd1717" },
    }).showToast();
  } finally {
    definirEstadoLoadingBotaoAtualizar(false);
  }
}

verificarPermissaoUsuario();
const restaurouCache = restaurarRascunhoCache();
iniciarCamposPagamento();
renderizarStatusReferencias();
carregarDadosReferenciaTeste();

if (!restaurouCache || !dados.itens.length) {
  adicionarItem();
}
