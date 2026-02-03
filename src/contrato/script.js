var dados = {};
var dadosOriginais = {};
var servicosContrato = [];
var dadosServ = [];
var i = 0;
var medicaoAtualAprovada = false;
const tbody = document.querySelector("tbody");
const APIC = "https://script.google.com/macros/s/AKfycbxHgMbBoCWopmEX0OOZCUgkkWuWC75KutfgpQqBj_wv6i7eAC2mstX3a_7FpYUWLOFEyw/exec"
const formatarMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function SalvarDados() {
  const diff = extrairAlteracoes();
  if (diff) {
    console.log("Enviando alterações:", diff);
    
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.style.display = "block";

    Toastify({
      text: "Salvando...",
      duration: 2000,
      style: { background: "#2196F3" }
    }).showToast();

    fetch(APIC, {
      method: "POST",
      body: JSON.stringify(diff)
    })
    .then(r => r.ok ? r.text() : Promise.reject(r.statusText))
    .then(res => {
      console.log("Salvo:", res);
      Toastify({
        text: "Salvo! Atualizando dados...",
        duration: 2000,
        style: { background: "#2196F3" }
      }).showToast();
      
      return fetch(APIC);
    })
    .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
    .then(json => {
      console.log("Dados atualizados via API:", json);
      localStorage.setItem(CACHE_KEY, JSON.stringify(json));
      processarDados(json);
      Toastify({
        text: "Dados salvos e atualizados com sucesso!",
        duration: 3000,
        style: { background: "#00aa25" }
      }).showToast();
    })
    .catch(err => {
      console.error("Erro ao salvar/atualizar:", err);
      Toastify({
        text: "Erro ao processar.",
        duration: 3000,
        style: { background: "#bd1717" }
      }).showToast();
    })
    .finally(() => {
      if (overlay) overlay.style.display = "none";
    });
  } else {
    console.log("Nenhuma alteração detectada.");
    Toastify({
      text: "Nenhuma alteração para salvar.",
      duration: 3000,
      style: { background: "#555" }
    }).showToast();
  }
}

function atualizarLinhasLocais(payload) {
  if (!payload || !payload.dados || !payload.dados.contratos) return;

  const deletedRows = [];
  payload.dados.contratos.forEach(c => {
    if (c.medicoes) {
      c.medicoes.forEach(m => {
        if (m.servicos) {
          m.servicos.forEach(s => {
            if (s.tipo === "delete" && s.row) {
              deletedRows.push(parseInt(s.row));
            }
          });
        }
      });
    }
  });

  if (deletedRows.length === 0) return;

  if (dados.contratos) {
    dados.contratos.forEach(c => {
      if (c.medicoes) {
        c.medicoes.forEach(m => {
          if (m.servicos) {
            m.servicos.forEach(s => {
              if (s.row) {
                const r = parseInt(s.row);
                const shift = deletedRows.filter(delRow => delRow < r).length;
                if (shift > 0) {
                  s.row = r - shift;
                }
              }
            });
          }
        });
      }
    });
  }
}

function extrairAlteracoes() {
  if (!dadosOriginais || !dadosOriginais.contratos) return null;
  const diff = { contratos: [] };

  dados.contratos.forEach(c => {
    const cOrig = dadosOriginais.contratos.find(x => x.id == c.id);
    if (!cOrig) return;

    const contratoDiff = { id: c.id, medicoes: [] };

    c.medicoes.forEach(m => {
      const mOrig = cOrig.medicoes.find(x => x.id == m.id);
      if (!mOrig) {
        const mClean = { ...m };
        delete mClean.new;
        if (mClean.servicos) {
          mClean.servicos = mClean.servicos.map(s => ({
            idServ: s.idServ,
            quantidade: s.quantidade,
            tipo: "create"
          }));
        }
        contratoDiff.medicoes.push(mClean); // Nova medição
      } else {
        const medicaoDiff = { id: m.id, servicos: [] };
        let changed = false;
        const fields = ['data', 'observacoes', 'pago', 'aprovado', 'dataAprovacao', 'dataPagamento', 'autorizador', 'statusAprovacao'];
        
        fields.forEach(f => {
          const v1 = m[f] === undefined || m[f] === null ? "" : m[f];
          const v2 = mOrig[f] === undefined || mOrig[f] === null ? "" : mOrig[f];
          if (v1 != v2) {
            medicaoDiff[f] = m[f];
            changed = true;
          }
        });

        const servicos = m.servicos || [];
        const servicosOrig = mOrig.servicos || [];

        servicos.forEach(s => {
          const sOrig = servicosOrig.find(x => x.idServ == s.idServ);
          if (!sOrig) {
            medicaoDiff.servicos.push({ idServ: s.idServ, quantidade: s.quantidade, tipo: "create" }); // Novo serviço
            changed = true;
          } else {
            if (s.quantidade != sOrig.quantidade) {
              medicaoDiff.servicos.push({ idServ: s.idServ, row: sOrig.row, quantidade: s.quantidade, tipo: "update" });
              changed = true;
            }
          }
        });

        servicosOrig.forEach(sOrig => {
          if (!servicos.find(x => x.idServ == sOrig.idServ)) {
            medicaoDiff.servicos.push({ idServ: sOrig.idServ, row: sOrig.row, tipo: "delete" });
            changed = true;
          }
        });

        if (changed) contratoDiff.medicoes.push(medicaoDiff);
      }
    });

    if (contratoDiff.medicoes.length > 0) diff.contratos.push(contratoDiff);
  });

  if (diff.contratos.length > 0) {
    return {
      type: "servico_medicao_empreita",
      dados: diff
    };
  }
  return null;
}
function abrirModalAprovacao() {
  const contratoId = (document.getElementById("contrato-id").value || "").split(" - ")[0];
  const medicaoId = document.getElementById("medicao-numero").value;

  if (!contratoId || !medicaoId || !dados.contratos) return;

  const contrato = dados.contratos.find((c) => c.id == contratoId);
  if (!contrato) return;

  const medicao = contrato.medicoes.find((m) => m.id == medicaoId);
  if (!medicao) return;

  // Preencher campos
  const statusAprov = medicao.statusAprovacao || (medicao.aprovado ? "Aprovado" : "Pendente");
  document.getElementById("input-status-aprovacao").value = statusAprov;
  
  const statusPag = medicao.pago ? "Pago" : "Pendente";
  document.getElementById("input-status-pagamento").value = statusPag;

  let dataPag = medicao.dataPagamento || "";
  if (dataPag && dataPag.includes("T")) dataPag = dataPag.split("T")[0];
  document.getElementById("input-data-pagamento").value = dataPag;

  document.getElementById("modal-aprovacao").style.display = "flex";
}

function fecharModalAprovacao() {
  document.getElementById("modal-aprovacao").style.display = "none";
}

function salvarAprovacaoPagamento() {
  const contratoId = (document.getElementById("contrato-id").value || "").split(" - ")[0];
  const medicaoId = document.getElementById("medicao-numero").value;

  if (!contratoId || !medicaoId || !dados.contratos) return;

  const contrato = dados.contratos.find((c) => c.id == contratoId);
  if (!contrato) return;

  const medicao = contrato.medicoes.find((m) => m.id == medicaoId);
  if (!medicao) return;

  const statusAprov = document.getElementById("input-status-aprovacao").value;
  const dataAprov = document.getElementById("input-data-aprovacao").value;
  const statusPag = document.getElementById("input-status-pagamento").value;
  const dataPag = document.getElementById("input-data-pagamento").value;

  medicao.statusAprovacao = statusAprov;
  medicao.aprovado = (statusAprov === "Aprovado");
  medicao.dataAprovacao = dataAprov || null;

  if (medicao.aprovado) {
    if (!medicao.autorizador) medicao.autorizador = "Usuário do Sistema";
  } else {
    medicao.autorizador = null;
  }

  medicao.pago = (statusPag === "Pago");
  medicao.dataPagamento = dataPag || null;

  carregarMedicao(contratoId, medicaoId);
  fecharModalAprovacao();

  const diff = extrairAlteracoes();
  if (diff) {
    console.log("Alterações após Aprovação/Pagamento:", JSON.stringify(diff, null, 2));
  }
}
function adicionarMedicao() {
  const contratoId = (document.getElementById("contrato-id").value || "").split(" - ")[0];
  if (!contratoId || !dados.contratos) return;

  const contrato = dados.contratos.find((c) => c.id == contratoId);
  if (!contrato) return;

  const lastMedicao = contrato.medicoes[contrato.medicoes.length - 1];

  if (lastMedicao && !lastMedicao.aprovado) {
    Toastify({
      text: "A última medição precisa ser aprovada antes de criar uma nova.",
      duration: 3000,
      close: true,
      gravity: "top",
      position: "center",
      style: {
        background: "#bd1717",
      }
    }).showToast();
    return;
  }

  const newId = lastMedicao ? parseInt(lastMedicao.id) + 1 : 1;

  const novaMedicao = {
    id: newId,
    new: true,
    data: new Date().toISOString().split("T")[0],
    servicos: [],
    observacoes: "",
    pago: false,
    aprovado: false,
    dataAprovacao: null,
    dataPagamento: null,
    autorizador: null
  };

  contrato.medicoes.push(novaMedicao);

  const medInput = document.getElementById("medicao-numero");
  const list = medInput.nextElementSibling;
  if (list) list.innerHTML = "";
  medInput.value = newId;
  carregarMedicao(contratoId, newId);
}
function imprimir() {
  window.print();
}

function gerarNovoIdServico() {
  i++;
  return i;
}

function adicionarLinhaServico(dados) {
  const idServ = dados.idServ ?? "";
  const descricao = dados.descricaoServ ?? "";
  const atividade = dados.atividade ?? "";
  const quantidade = dados.quantidade ?? 0;
  const unidade = dados.unidade ?? "";
  const percMedido = dados.percMedido ?? 0;
  const qtdeContratada = dados.qtdeContratada ?? 0;
  const percMedidoAcum = dados.percMedidoAcum ?? 0;
  const qtdeMedidaAcum = dados.qtdeMedidaAcum ?? 0;
  const percMedidoAcumAtual = dados.percMedidoAcumAtual ?? 0;

  const valorAcumulado = formatarMoeda.format(dados.valorAcumulado ?? 0);
  const valorUnitario = formatarMoeda.format(dados.valorUnitario ?? 0);
  const valorTotal = formatarMoeda.format(dados.valorTotal ?? 0);

  const textoConcatenado = `${idServ} - ${descricao}`;
  const fmt = (v) =>
    (typeof v === "number" ? v : parseFloat(v) || 0).toFixed(2);

  const disabledAttr = medicaoAtualAprovada ? "disabled" : "";
  const btnStyle = medicaoAtualAprovada ? "display: none;" : "";
  const editavelClass = medicaoAtualAprovada ? "" : "editavel";

  const linhaHTML = `
  <tr data-id-serv="${idServ}">
    <td colspan="2">
      <div class="dropdown-wrapper">
        <input type="text" class="${editavelClass} side-padding table-field input-descricao" value="${textoConcatenado}" oninput="filtrarServicos(this); atualizarDetalhesServico(this)" onfocus="filtrarServicos(this)" onblur="setTimeout(() => this.nextElementSibling.style.display = 'none', 200)" ${disabledAttr}>
        <div class="dropdown-list"></div>
      </div>
    </td>
    <td class="side-padding td-atividade">${atividade}</td>
    <td><input type="text" class="${editavelClass} side-padding table-field input-qtde" value="${fmt(quantidade)}" oninput="atualizarCalculos(this)" onblur="finalizarEdicaoQuantidade(this)" ${disabledAttr}></td>
    <td class="side-padding tCenter td-unidade">${unidade}</td>
    <td class="side-padding td-perc-medido">${fmt(percMedido)}%</td>
    <td class="side-padding td-qtde-contratada">${fmt(qtdeContratada)}</td>
    <td class="side-padding td-perc-medido-acum">${fmt(percMedidoAcum)}%</td>
    <td class="side-padding td-qtde-medida-acum">${fmt(qtdeMedidaAcum)}</td>
    <td class="side-padding td-perc-medido-acum-atual">${fmt(percMedidoAcumAtual)}%</td>
    <td class="side-padding td-valor-acumulado">${valorAcumulado}</td>
    <td class="side-padding td-valor-unitario">${valorUnitario}</td>
    <td class="side-padding td-valor-total">${valorTotal}</td>
    <td class="acao-coluna">
      <button type="button" class="delete-button" onclick="removerServico(this)" aria-label="Remover serviço" ${disabledAttr} style="${btnStyle}">
        <svg width="15" height="15" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fill="currentColor" d="M9 3h6l1 2h5v2H3V5h5l1-2Zm-1 6v10h2V9H8Zm4 0v10h2V9h-2Zm4 0v10h2V9h-2Zm-9 0h10l-.9 11.3a2 2 0 0 1-2 1.7H8.9a2 2 0 0 1-2-1.7L6 9Z"/>
        </svg>
      </button>
    </td>
  </tr>
`;
  tbody.insertAdjacentHTML("beforeend", linhaHTML);
}

function filtrarServicos(input) {
  const wrapper = input.parentElement;
  const list = wrapper.querySelector(".dropdown-list");
  const term = input.value.toLowerCase();

  const row = input.closest("tr");
  const currentRowIndex = row ? row.sectionRowIndex : -1;

  const usedIds = new Set();
  dadosServ.forEach((item, idx) => {
    if (idx !== currentRowIndex && item.idServ) {
      usedIds.add(item.idServ);
    }
  });

  list.innerHTML = "";
  const filtered = servicosContrato.filter((s) => !usedIds.has(s.idServ));

  if (filtered.length === 0) {
    list.style.display = "none";
    return;
  }

  filtered.forEach((s) => {
    const div = document.createElement("div");
    div.className = "dropdown-item";
    div.textContent = `${s.idServ} - ${s.descricaoServ}`;
    div.onmousedown = function () {
      input.value = div.textContent;
      atualizarDetalhesServico(input);
      list.style.display = "none";
    };
    list.appendChild(div);
  });

  list.style.display = "block";

  Array.from(list.children).forEach(
    (child) => (child.style.backgroundColor = "")
  );

  if (term) {
    const match = Array.from(list.children).find((item) =>
      item.textContent.toLowerCase().includes(term)
    );
    if (match) {
      match.scrollIntoView({ block: "nearest" });
      match.style.backgroundColor = "#d0d0d0";
    }
  }
}

function filtrarContratos(input) {
  const list = input.nextElementSibling;
  const term = input.value.toLowerCase();

  const medList =
    document.getElementById("medicao-numero").nextElementSibling;
  if (medList) medList.innerHTML = "";

  if (!dados.contratos) return;

  if (list.children.length === 0) {
    dados.contratos.forEach((c) => {
      const div = document.createElement("div");
      div.className = "dropdown-item";
      div.textContent = `${c.id} - ${c.fornecedor ? c.fornecedor.name : ''}`;
      div.onmousedown = () => {
        selecionarContrato(c);
      };
      list.appendChild(div);
    });
  }

  list.style.display = "block";

  Array.from(list.children).forEach(
    (child) => (child.style.backgroundColor = "")
  );

  if (term) {
    const match = Array.from(list.children).find((item) =>
      item.textContent.toLowerCase().includes(term)
    );
    if (match) {
      match.scrollIntoView({ block: "nearest" });
      match.style.backgroundColor = "#d0d0d0";
    }
  }
}

function selecionarContrato(c) {
  const input = document.getElementById("contrato-id");
  input.value = `${c.id} - ${c.fornecedor ? c.fornecedor.name : ''}`;
  
  const printEl = document.getElementById("contrato-id-print");
  if (printEl) printEl.textContent = c.id;
  
  const medList = document.getElementById("medicao-numero").nextElementSibling;
  document.getElementById("medicao-numero").value = "";
  document.getElementById("medicao-data").value = "";

  if (medList) medList.innerHTML = "";

  tbody.innerHTML = "";
  dadosServ = [];

  medicaoAtualAprovada = false;
  document.getElementById("medicao-data").disabled = false;
  document.getElementById("medicao-data").classList.add("editavel");
  document.getElementById("observacoes").disabled = false;
  document.getElementById("observacoes").classList.add("editavel");
  document.getElementById("observacoes").parentElement.style.display = "";
  const btnAdd = document.getElementById("add-col");
  if (btnAdd) {
    btnAdd.disabled = false;
  }

  if (c.medicoes && c.medicoes.length > 0) {
    document.getElementById("medicao-numero").value = c.medicoes[0].id;
    carregarMedicao(c.id, c.medicoes[0].id);
  }
  
  const list = input.nextElementSibling;
  if (list) list.style.display = "none";
}

function selecionarContratoPorInput(input) {
  const val = input.value;
  if (!val || !dados.contratos) return;
  const id = val.split(" - ")[0];
  const c = dados.contratos.find(x => x.id == id);
  if (c) {
    selecionarContrato(c);
  }
}

function filtrarMedicoes(input) {
  const contratoId = (document.getElementById("contrato-id").value || "").split(" - ")[0];
  const contrato = dados.contratos
    ? dados.contratos.find((c) => c.id == contratoId)
    : null;

  if (!contrato || !contrato.medicoes) return;

  const list = input.nextElementSibling;
  const term = input.value.toLowerCase();

  if (list.children.length === 0) {
    contrato.medicoes.forEach((m) => {
      const div = document.createElement("div");
      div.className = "dropdown-item";
      div.textContent = m.id;
      div.onmousedown = () => {
        input.value = m.id;
        carregarMedicao(contrato.id, m.id);
        list.style.display = "none";
      };
      list.appendChild(div);
    });
  }

  list.style.display = "block";

  Array.from(list.children).forEach(
    (child) => (child.style.backgroundColor = "")
  );

  if (term) {
    const match = Array.from(list.children).find((item) =>
      item.textContent.toLowerCase().includes(term)
    );
    if (match) {
      match.scrollIntoView({ block: "nearest" });
      match.style.backgroundColor = "#d0d0d0";
    }
  }
}

function selecionarMedicaoPorInput(input) {
  const contratoId = (document.getElementById("contrato-id").value || "").split(" - ")[0];
  const medicaoId = input.value;
  if (contratoId && medicaoId) {
    carregarMedicao(contratoId, medicaoId);
    const list = input.nextElementSibling;
    if (list) list.style.display = "none";
  }
}

function atualizarDadosCabecalho(input) {
  const contratoId = (document.getElementById("contrato-id").value || "").split(" - ")[0];
  const medicaoId = document.getElementById("medicao-numero").value;

  if (!contratoId || !medicaoId || !dados.contratos) return;

  const contrato = dados.contratos.find((c) => c.id == contratoId);
  if (!contrato) return;

  const medicao = contrato.medicoes.find((m) => m.id == medicaoId);
  if (!medicao) return;

  if (input.id === "medicao-data") medicao.data = input.value;
  if (input.id === "observacoes") medicao.observacoes = input.value;
}

function calcularAcumulados(contratoId, medicaoId, idServ) {
  const contrato = dados.contratos.find((c) => c.id == contratoId);
  if (!contrato) return { qtdeAcum: 0, percAcum: 0 };

  let qtdeAcum = 0;
  let percAcum = 0;

  const targetId = parseInt(medicaoId);
  const prevMedicoes = contrato.medicoes.filter((m) => parseInt(m.id) < targetId);
  prevMedicoes.forEach((pm) => {
    const servicosEncontrados = pm.servicos.filter(
      (s) => s.idServ == idServ
    );
    servicosEncontrados.forEach((ps) => {
      qtdeAcum += parseFloat(ps.quantidade || 0);
      percAcum += parseFloat(ps.percMedido || 0);
    });
  });
  return { qtdeAcum, percAcum };
}

function atualizarDetalhesServico(input) {
  const row = input.closest("tr");
  const index = row.sectionRowIndex;
  const val = input.value;
  const idMatch = val.match(/^(\d+)\s-/);

  if (idMatch && servicosContrato.length > 0) {
    const id = parseInt(idMatch[1]);
    const servico = servicosContrato.find((s) => s.idServ === id);

    if (servico) {
      const obj = dadosServ[index];
      const contratoId = (document.getElementById("contrato-id").value || "").split(" - ")[0];
      const medicaoId = document.getElementById("medicao-numero").value;

      obj.idServ = servico.idServ;
      obj.descricaoServ = servico.descricaoServ;
      obj.atividade = servico.atividade;
      obj.unidade = servico.unidade;
      obj.qtdeContratada = servico.qtdeContratada;
      obj.valorUnitario = servico.valorUnitario;

      const acumulados = calcularAcumulados(
        contratoId,
        medicaoId,
        servico.idServ
      );
      obj.qtdeMedidaAcum = acumulados.qtdeAcum;
      obj.percMedidoAcum = acumulados.percAcum;

      obj.valorAcumulado =
        (obj.percMedidoAcum / 100) * obj.qtdeContratada * obj.valorUnitario;

      row.querySelector(".td-atividade").textContent = obj.atividade;
      row.querySelector(".td-unidade").textContent = obj.unidade;
      row.querySelector(".td-qtde-contratada").textContent = (
        obj.qtdeContratada || 0
      ).toFixed(2);
      row.querySelector(".td-valor-unitario").textContent =
        formatarMoeda.format(obj.valorUnitario);

      row.querySelector(".td-qtde-medida-acum").textContent =
        obj.qtdeMedidaAcum.toFixed(2);
      row.querySelector(".td-perc-medido-acum").textContent =
        obj.percMedidoAcum.toFixed(2) + "%";
      row.querySelector(".td-valor-acumulado").textContent =
        formatarMoeda.format(obj.valorAcumulado);

      const qtdeInput = row.querySelector(".input-qtde");
      atualizarCalculos(qtdeInput);
    }
  }
}

function finalizarEdicaoQuantidade(input) {
  const row = input.closest("tr");
  const index = row.sectionRowIndex;
  const obj = dadosServ[index];
  input.value = (obj.quantidade || 0).toFixed(2);
  atualizarCalculos(input);
}

function atualizarCalculos(input) {
  const row = input.closest("tr");
  const index = row.sectionRowIndex;
  const obj = dadosServ[index];

  const contratada = parseFloat(obj.qtdeContratada) || 0;
  
  let val = input.value;
  let str = String(val).replace(',', '.').trim();
  let isPercent = str.includes('%');
  let num = parseFloat(str);
  let qtd = 0;

  if (!isNaN(num)) {
      if (isPercent) {
           qtd = (num / 100) * contratada;
      } else {
           qtd = num;
      }
  }
  
  const acumulado = parseFloat(obj.qtdeMedidaAcum) || 0;
  if ((acumulado + qtd) > contratada + 0.0001) {
      qtd = Math.max(0, contratada - acumulado);
      input.value = qtd.toFixed(2);
  }
  obj.quantidade = qtd;
  input.classList.remove('input-error');

  const valorUnit = parseFloat(obj.valorUnitario) || 0;

  obj.percMedido = contratada > 0 ? (qtd / contratada) * 100 : 0;

  const percAcum = parseFloat(obj.percMedidoAcum) || 0;
  obj.percMedidoAcumAtual = percAcum + obj.percMedido;

  obj.valorTotal = qtd * valorUnit;

  row.querySelector(".td-valor-total").textContent = formatarMoeda.format(
    obj.valorTotal
  );
  row.querySelector(".td-perc-medido-acum-atual").textContent =
    obj.percMedidoAcumAtual.toFixed(2) + "%";
  row.querySelector(".td-perc-medido").textContent =
    obj.percMedido.toFixed(2) + "%";
  calcularTotais();
}

function adicionarServico() {
  if (medicaoAtualAprovada) return;
  const novoServico = {
    idServ: gerarNovoIdServico(),
    descricaoServ: "Novo Item",
    atividade: "",
    quantidade: 0,
    unidade: "un",
    percMedido: 0,
    qtdeContratada: 0,
    percMedidoAcum: 0,
    qtdeMedidaAcum: 0,
    percMedidoAcumAtual: 0,
    valorAcumulado: 0,
    valorUnitario: 0,
    valorTotal: 0,
  };

  adicionarLinhaServico(novoServico);
  dadosServ.push(novoServico);
  console.log(dadosServ);
  calcularTotais();
}

function removerServico(botao) {
  if (medicaoAtualAprovada) return;
  const linha = botao.closest("tr");
  if (!linha) return;

  const idServ = linha.dataset.idServ;
  let index = -1;

  if (idServ) {
    index = dadosServ.findIndex((serv) => String(serv.idServ) === idServ);
  }

  if (index === -1) {
    const linhasAtuais = Array.from(tbody.children);
    index = linhasAtuais.indexOf(linha);
  }

  if (index > -1) {
    dadosServ.splice(index, 1);
  }

  linha.remove();
  calcularTotais();
}

function updateField(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const val = value || '';
  el.textContent = val;
  
  const parent = el.parentElement;
  if (parent) {
    const hasInfoName = parent.querySelector('.infoName');
    const hasDataBanc = parent.querySelector('.dataBanc');
    const isPix = (id === 'pix-data');
    
    if (hasInfoName || hasDataBanc || isPix) {
      parent.style.display = (!val || val.trim() === '') ? 'none' : '';
    }
  }
}

function carregarMedicao(contratoId, medicaoId) {
  const contrato = dados.contratos.find((c) => c.id == contratoId);
  if (!contrato) return;

  const f = contrato.fornecedor || {};
  updateField('fornecedor-data', f.name);
  updateField('cpnj-fornecedor-data', f.cnpj);
  updateField('endereco-fornecedor-data', f.endereco);
  updateField('banco-data', f.banco);
  updateField('agencia-data', f.agencia);
  updateField('conta-data', f.conta);
  updateField('pix-data', f.pix);
  
  const elLower = document.getElementById('fornecedor-lower-data');
  if(elLower) elLower.textContent = f.name || '';
  
  const p = contrato.pagador || {};
  if(document.getElementById('pagante-data')) document.getElementById('pagante-data').textContent = p.name || '';
  if(document.getElementById('cnpj-pagante-data')) document.getElementById('cnpj-pagante-data').textContent = p.cnpj || '';
  if(document.getElementById('endereco-pagante-data')) document.getElementById('endereco-pagante-data').textContent = p.endereco || '';

  updateField('obra-contrato-data', contrato.obra);
  updateField('endereco-obra-data', contrato.enderecoObra);

  servicosContrato = contrato.servicos;

  const medicao = contrato.medicoes.find((m) => m.id == medicaoId);
  if (!medicao) return;

  localStorage.setItem("app_selecao_cache", JSON.stringify({ contratoId, medicaoId }));

  medicaoAtualAprovada = !!medicao.aprovado;

  const table = document.getElementById("contratos");
  if (medicaoAtualAprovada) {
    table.classList.add("medicao-aprovada");
  } else {
    table.classList.remove("medicao-aprovada");
  }

  const medicaoIndex = contrato.medicoes.findIndex(m => m.id == medicaoId);
  const prevMedicao = medicaoIndex > 0 ? contrato.medicoes[medicaoIndex - 1] : null;
  const elDataAnt = document.getElementById("medicao-data-anterior");
  const elDataAte = document.getElementById("data-ate");

  if (elDataAnt && elDataAte) {
    if (prevMedicao && prevMedicao.data) {
      let dataAntFormatted = String(prevMedicao.data).split('T')[0];
      if (dataAntFormatted.includes('-')) {
        const [ano, mes, dia] = dataAntFormatted.split('-');
        dataAntFormatted = `${dia}/${mes}/${ano}`;
      }
      elDataAnt.textContent = dataAntFormatted;

      if (medicaoAtualAprovada) {
        elDataAnt.style.display = "block";
        elDataAte.style.display = "block";
      } else {
        elDataAnt.style.display = "none";
        elDataAte.style.display = "none";
      }
    } else {
      elDataAnt.style.display = "none";
      elDataAte.style.display = "none";
    }
  }

  document.getElementById('autorizador-data').textContent = medicao.autorizador || '';
  
  let dataAprovacaoFormatted = '';
  if (medicao.dataAprovacao) {
    const datePart = String(medicao.dataAprovacao).split('T')[0];
    if (datePart.includes('-')) {
      const [ano, mes, dia] = datePart.split('-');
      dataAprovacaoFormatted = `${dia}/${mes}/${ano}`;
    } else {
      dataAprovacaoFormatted = medicao.dataAprovacao;
    }
  }
  document.getElementById('dia-autorizador-data').textContent = dataAprovacaoFormatted;

  const dataInput = document.getElementById("medicao-data");
  const obsInput = document.getElementById("observacoes");
  const addButton = document.getElementById("add-col");

  dataInput.value = medicao.data ? String(medicao.data).split('T')[0] : '';
  dataInput.disabled = medicaoAtualAprovada;
  if (medicaoAtualAprovada) dataInput.classList.remove("editavel");
  else dataInput.classList.add("editavel");

  obsInput.value = medicao.observacoes || "";
  obsInput.disabled = medicaoAtualAprovada;

  if (medicaoAtualAprovada && !obsInput.value) {
    obsInput.parentElement.style.display = "none";
  } else {
    obsInput.parentElement.style.display = "";
  }

  if (medicaoAtualAprovada) obsInput.classList.remove("editavel");
  else obsInput.classList.add("editavel");

  if (addButton) {
    addButton.disabled = medicaoAtualAprovada;
    addButton.style.display = medicaoAtualAprovada
      ? "none"
      : "";
  }

  const badgePago = document.getElementById("badge-pago");
  const badgeAprovado = document.getElementById("badge-aprovado");

  if (badgePago) {
    badgePago.textContent = medicao.pago ? "Pago" : "Pendente";
    badgePago.style.backgroundColor = medicao.pago ? "#90ee90" : "#ffcccb";
  }
  if (badgeAprovado) {
    badgeAprovado.textContent = medicao.statusAprovacao || (medicao.aprovado ? "Aprovado" : "Pendente");
    badgeAprovado.style.backgroundColor = medicao.aprovado
      ? "#90ee90"
      : "#ffcccb";
  }

  const btnNova = document.getElementById("btn-nova-medicao");
  if (btnNova) {
    const lastMedicao = contrato.medicoes[contrato.medicoes.length - 1];
    if (lastMedicao && !lastMedicao.aprovado) {
      btnNova.style.display = "none";
    } else {
      btnNova.style.display = "";
    }
  }

  dadosServ = medicao.servicos || [];

  dadosServ.forEach((serv) => {
    const acumulados = calcularAcumulados(
      contratoId,
      medicaoId,
      serv.idServ
    );
    serv.qtdeMedidaAcum = acumulados.qtdeAcum;
    serv.percMedidoAcum = acumulados.percAcum;

    const contratada = parseFloat(serv.qtdeContratada) || 0;
    const qtd = parseFloat(serv.quantidade) || 0;

    serv.percMedido = contratada > 0 ? (qtd / contratada) * 100 : 0;
    serv.percMedidoAcumAtual = serv.percMedidoAcum + serv.percMedido;

    serv.valorAcumulado =
      (serv.percMedidoAcum / 100) * contratada * (serv.valorUnitario || 0);
    serv.valorTotal = qtd * (serv.valorUnitario || 0);
  });

  tbody.innerHTML = "";
  dadosServ.forEach((serv) => adicionarLinhaServico(serv));
  calcularTotais();
}

function atualizarPopupSaldo() {
  const contratoId = (document.getElementById("contrato-id").value || "").split(" - ")[0];
  if (!contratoId || !dados.contratos) return;
  const contrato = dados.contratos.find((c) => c.id == contratoId);
  if (!contrato) return;

  const popup = document.getElementById("saldo-popup-content");
  
  const medidoPorServico = {};

  contrato.medicoes.forEach(m => {
    if (m.servicos) {
      m.servicos.forEach(s => {
        if (!medidoPorServico[s.idServ]) {
          medidoPorServico[s.idServ] = { qtd: 0 };
        }
        medidoPorServico[s.idServ].qtd += (parseFloat(s.quantidade) || 0);
      });
    }
  });

  let html = `<table class="saldo-table"><thead><tr><th>Serviço</th><th>Qtd Restante</th><th>Valor Restante</th></tr></thead><tbody>`;

  contrato.servicos.forEach(s => {
    const medido = medidoPorServico[s.idServ] ? medidoPorServico[s.idServ].qtd : 0;
    const contratado = parseFloat(s.qtdeContratada) || 0;
    const restanteQtd = contratado - medido;
    const valorUnit = parseFloat(s.valorUnitario) || 0;
    const restanteValor = restanteQtd * valorUnit;

    if (restanteQtd <= 0) return;

    html += `<tr>
        <td>${s.idServ} - ${s.descricaoServ}</td>
        <td class="num">${restanteQtd.toFixed(2)} ${s.unidade}</td>
        <td class="num">${formatarMoeda.format(restanteValor)}</td>
      </tr>`;
  });

  html += `</tbody></table>`;
  popup.innerHTML = html;
}

function abrirModalSaldo() {
  const contratoId = (document.getElementById("contrato-id").value || "").split(" - ")[0];
  if (!contratoId || !dados.contratos) return;
  const contrato = dados.contratos.find((c) => c.id == contratoId);
  if (!contrato) return;

  const tbodySaldo = document.querySelector("#tabela-saldo-full tbody");
  tbodySaldo.innerHTML = "";

  const headerCheck = document.querySelector("#tabela-saldo-full thead input[type='checkbox']");
  if (headerCheck) headerCheck.checked = false;

  const medidoPorServico = {};
  contrato.medicoes.forEach(m => {
    if (m.servicos) {
      m.servicos.forEach(s => {
        if (!medidoPorServico[s.idServ]) {
          medidoPorServico[s.idServ] = 0;
        }
        medidoPorServico[s.idServ] += (parseFloat(s.quantidade) || 0);
      });
    }
  });

  contrato.servicos.forEach(s => {
    const medido = medidoPorServico[s.idServ] || 0;
    const contratado = parseFloat(s.qtdeContratada) || 0;
    const restante = contratado - medido;
    const valorRestante = restante * (parseFloat(s.valorUnitario) || 0);

    const tr = document.createElement("tr");
    tr.onclick = (e) => {
      const cb = tr.querySelector(".check-saldo");
      if (e.target !== cb) {
        cb.checked = !cb.checked;
      }
      if (cb.checked) tr.classList.add("selected");
      else tr.classList.remove("selected");
    };
    tr.innerHTML = `
      <td style="text-align: center;"><input type="checkbox" class="check-saldo" value="${s.idServ}"></td>
      <td>${s.idServ} - ${s.descricaoServ}</td>
      <td>${s.atividade}</td>
      <td class="tCenter">${s.unidade}</td>
      <td class="num">${contratado.toFixed(2)}</td>
      <td class="num">${medido.toFixed(2)}</td>
      <td class="num" style="font-weight: bold; color: ${restante < 0 ? 'red' : 'inherit'}">${restante.toFixed(2)}</td>
      <td class="num">${formatarMoeda.format(valorRestante)}</td>
    `;
    tbodySaldo.appendChild(tr);
  });

  document.getElementById("modal-saldo").style.display = "flex";
}

function fecharModalSaldo() {
  document.getElementById("modal-saldo").style.display = "none";
}

function toggleAllSaldo(source) {
  const checkboxes = document.querySelectorAll(".check-saldo");
  checkboxes.forEach(cb => {
    cb.checked = source.checked;
    const tr = cb.closest("tr");
    if (tr) {
      if (source.checked) tr.classList.add("selected");
      else tr.classList.remove("selected");
    }
  });
}

function adicionarSelecionadosSaldo() {
  const contratoId = (document.getElementById("contrato-id").value || "").split(" - ")[0];
  if (!contratoId || !dados.contratos) return;
  const contrato = dados.contratos.find((c) => c.id == contratoId);
  if (!contrato) return;

  const checkboxes = document.querySelectorAll(".check-saldo:checked");
  if (checkboxes.length === 0) {
    Toastify({
      text: "Selecione ao menos um item.",
      duration: 3000,
      close: true,
      gravity: "top",
      position: "center",
      style: {
        background: "#921212",
      }
    }).showToast();
    return;
  }

  const idsSelecionados = Array.from(checkboxes).map(cb => parseInt(cb.value));
  
  let targetMedicao = null;
  const lastMedicao = contrato.medicoes[contrato.medicoes.length - 1];
  let isNew = false;

  if (!lastMedicao || lastMedicao.aprovado) {
    const newId = lastMedicao ? parseInt(lastMedicao.id) + 1 : 1;
    targetMedicao = {
      id: newId,
      new: true,
      data: new Date().toISOString().split("T")[0],
      servicos: [],
      observacoes: "",
      pago: false,
      aprovado: false,
      dataAprovacao: null,
      dataPagamento: null,
      autorizador: null
    };
    contrato.medicoes.push(targetMedicao);
    isNew = true;
  } else {
    targetMedicao = lastMedicao;
  }

  idsSelecionados.forEach(id => {
    const exists = targetMedicao.servicos.find(s => s.idServ == id);
    if (!exists) {
      const servicoContrato = contrato.servicos.find(s => s.idServ == id);
      if (servicoContrato) {
          targetMedicao.servicos.push({
            idServ: servicoContrato.idServ,
            descricaoServ: servicoContrato.descricaoServ,
            atividade: servicoContrato.atividade,
            quantidade: 0,
            unidade: servicoContrato.unidade,
            qtdeContratada: servicoContrato.qtdeContratada,
            valorUnitario: servicoContrato.valorUnitario,
          });
      }
    }
  });

  fecharModalSaldo();
  
  const medInput = document.getElementById("medicao-numero");
  const list = medInput.nextElementSibling;
  if (list) list.innerHTML = "";

  medInput.value = targetMedicao.id;
  carregarMedicao(contrato.id, targetMedicao.id);
  
  if (isNew) {
    Toastify({
      text: `Medição ${targetMedicao.id} criada com selecionados.`,
      duration: 3000,
      close: true,
      gravity: "top",
      position: "center",
      style: {
        background: "#00aa25",
        color: "#000000",
      }
    }).showToast();
  } else {
    Toastify({
      text: `Itens adicionados à medição ${targetMedicao.id}.`,
      duration: 3000,
      close: true,
      gravity: "top",
      position: "center",
      style: {
        background: "#00aa25",
        color: "#000000",
      }
    }).showToast();
  }
}

function calcularTotais() {
  const contratoId = (document.getElementById("contrato-id").value || "").split(" - ")[0];
  if (!contratoId || !dados.contratos) return;

  const contrato = dados.contratos.find((c) => c.id == contratoId);
  if (!contrato) return;

  const totalMedicao = dadosServ.reduce(
    (acc, item) => acc + (parseFloat(item.valorTotal) || 0),
    0
  );

  const totalContrato = contrato.servicos.reduce((acc, item) => {
    return (
      acc +
      (parseFloat(item.qtdeContratada) || 0) *
        (parseFloat(item.valorUnitario) || 0)
    );
  }, 0);

  let totalMedidoGlobal = 0;
  contrato.medicoes.forEach((m) => {
    if (m.servicos) {
      m.servicos.forEach((s) => {
        totalMedidoGlobal += parseFloat(s.valorTotal) || 0;
      });
    }
  });

  const saldo = totalContrato - totalMedidoGlobal;

  document.getElementById("badge-total").textContent =
    formatarMoeda.format(totalMedicao);
  document.getElementById("badge-saldo").textContent =
    formatarMoeda.format(saldo);
    
  atualizarPopupSaldo();
}

const DADOS_ESTATICOS = {
  contratos: [
    {
      id: 5001,
      fornecedor: {
        id: 1,
        name: "XYZ Ltda",
        cnpj: "12.345.678/0001-90",
        endereco: "Rua das Pedras, 123 - Centro",
        banco: "Banco do Brasil",
        agencia: "1234-5",
        conta: "98765-4",
        pix: "12.345.678/0001-90"
      },
      pagador: {
        id: 1,
        name: "Incorporadora Messa",
        cnpj: "11.222.333/0001-44",
        endereco: "Rua da Matriz, 500"
      },
      obra: "Obra Residencial 1",
      enderecoObra: "Rua da Obra 1, 100",
      servicos: [
        {
          idServ: 1001,
          descricaoServ: "Lançamento de concreto - Rouparia 2",
          atividade: "Fundação",
          unidade: "m³",
          qtdeContratada: 500,
          valorUnitario: 150
        },
        {
          idServ: 1002,
          descricaoServ: "Alvenaria - Rouparia 2",
          atividade: "Alvenaria",
          unidade: "m²",
          qtdeContratada: 1000,
          valorUnitario: 50
        }
      ],
      medicoes: [
        {
          id: 1,
          data: new Date().toISOString().split("T")[0],
          observacoes: "Primeira medição",
          pago: true,
          aprovado: true,
          dataAprovacao: new Date().toISOString().split("T")[0],
          dataPagamento: new Date().toISOString().split("T")[0],
          autorizador: "Eng. Responsável",
          servicos: [
            {
              idServ: 1001,
              descricaoServ: "Lançamento de concreto - Rouparia 2",
              atividade: "Fundação",
              quantidade: 100,
              unidade: "m³",
              qtdeContratada: 500,
              valorUnitario: 150
            }
          ]
        },
        {
          id: 2,
          data: new Date().toISOString().split("T")[0],
          observacoes: "Segunda medição",
          pago: false,
          aprovado: false,
          dataAprovacao: null,
          dataPagamento: null,
          autorizador: null,
          servicos: [
            {
              idServ: 1001,
              descricaoServ: "Lançamento de concreto - Rouparia 2",
              atividade: "Fundação",
              quantidade: 50,
              unidade: "m³",
              qtdeContratada: 500,
              valorUnitario: 150
            },
            {
              idServ: 1002,
              descricaoServ: "Alvenaria - Rouparia 2",
              atividade: "Alvenaria",
              quantidade: 200,
              unidade: "m²",
              qtdeContratada: 1000,
              valorUnitario: 50
            }
          ]
        }
      ]
    }
  ]
};

const CACHE_KEY = "app_dados_cache";

function processarDados(json) {
  dados = json;
  
  if (dados.contratos) {
    dados.contratos.forEach(c => {
      const servicoMap = {};
      if (c.servicos) {
        c.servicos.forEach(s => servicoMap[s.idServ] = s);
      }
      if (c.medicoes) {
        c.medicoes.forEach(m => {
          m.new = false;
          if (m.servicos) {
            m.servicos.forEach(s => {
              if ((s.qtdeContratada == null || s.qtdeContratada === 0) && servicoMap[s.idServ]) {
                s.qtdeContratada = servicoMap[s.idServ].qtdeContratada;
              }
              if ((s.valorUnitario == null || s.valorUnitario === 0) && servicoMap[s.idServ]) {
                s.valorUnitario = servicoMap[s.idServ].valorUnitario;
              }

              const qtd = parseFloat(s.quantidade) || 0;
              const contratada = parseFloat(s.qtdeContratada) || 0;
              const valorUnit = parseFloat(s.valorUnitario) || 0;

              s.valorTotal = qtd * valorUnit;
              s.percMedido = contratada > 0 ? (qtd / contratada) * 100 : 0;
            });
          }
        });
      }
    });
  }

  dadosOriginais = JSON.parse(JSON.stringify(dados));

  if (dados.contratos && dados.contratos.length > 0) {
    const cInput = document.getElementById("contrato-id");
    const mInput = document.getElementById("medicao-numero");

    let savedSelection = null;
    try {
      savedSelection = JSON.parse(localStorage.getItem("app_selecao_cache"));
    } catch (e) { console.warn(e); }
    
    let cId = null;
    let mId = null;

    if (savedSelection && savedSelection.contratoId) {
      const c = dados.contratos.find(x => x.id == savedSelection.contratoId);
      if (c) {
        cId = c.id;
        if (c.medicoes.some(m => m.id == savedSelection.medicaoId)) {
          mId = savedSelection.medicaoId;
        } else if (c.medicoes.length > 0) {
          mId = c.medicoes[0].id;
        }
      }
    }

    if (!cId) {
      const c174 = dados.contratos.find(x => x.id == 174);
      if (c174) {
        cId = 174;
        if (c174.medicoes.some(m => m.id == 8)) mId = 8;
      }
    }

    if (!cId && dados.contratos.length > 0) cId = dados.contratos[0].id;
    if (!mId && cId) {
       const c = dados.contratos.find(x => x.id == cId);
       if (c && c.medicoes && c.medicoes.length > 0) mId = c.medicoes[0].id;
    }

    if (cId) {
      const cObj = dados.contratos.find(x => x.id == cId);
      cInput.value = cObj ? `${cObj.id} - ${cObj.fornecedor ? cObj.fornecedor.name : ''}` : cId;
      const printEl = document.getElementById("contrato-id-print");
      if (printEl) printEl.textContent = cId;
    } else {
      cInput.value = "";
    }
    mInput.value = mId || "";
    if (cId && mId) carregarMedicao(cId, mId);
  }
}

const cached = localStorage.getItem(CACHE_KEY);
if (cached) {
  try {
    console.log("Carregando dados em cache...");
    console.log(JSON.parse(cached))
    processarDados(JSON.parse(cached));
  } catch (e) {
    console.warn("Erro ao ler cache", e);
  }
}

fetch(APIC)
  .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
  .then(json => {
    console.log("Dados atualizados via API:", json);
    localStorage.setItem(CACHE_KEY, JSON.stringify(json));
    processarDados(json);
  })
  .catch(err => {
    console.warn("Falha na API:", err);
    if (!dados || !dados.contratos) {
      console.warn("Erro na API, sem dados em cache, carregando dados estaticos...");
      processarDados(DADOS_ESTATICOS)
    }
  });