const APIC =
  "https://script.google.com/macros/s/AKfycbxgR6d6FU0riIt5wEtD3Nm1kPjuRyO5gl1e-TnyypjRBWki4sPuFGRbXosiLm5jJPOZ/exec?sheet=db_fluxo";
const APIFunc =
  "https://script.google.com/macros/s/AKfycbyP5WM6Avgiv6fHjWfLfwPSBtpN4O229QrYH7bzrohGED1tSDzKuRzfDamaH1WHcrCO/exec";
const APIFluxo =
  "https://script.google.com/macros/s/AKfycbxFAaFl9GmtzC53rNYDQX2PxyWY6EnC5ZAVLTG__eMQLYSljXOTfU20fSvF6YegNuQ6OA/exec";
const APIFin =
  "https://script.google.com/macros/s/AKfycbzfd_UlE2AECViyL0DZuh3a2BVely4HePD_3w6N8TeRYpVqeM9v6I8AwqUbnqgcwUKQ/exec";
const CACHE_KEY = "cache_func";
const cached = localStorage.getItem(CACHE_KEY);
const table = document.getElementById("funcionarios");
const tbody = table.querySelector("tbody");
function fmtBRL(v) {
  var formattedValue = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((typeof v === "number" ? v : parseFloat(v) || 0).toFixed(2));
  return formattedValue;
}
function fmtf(v, spaces = 2) {
  return (typeof v === "number" ? v : parseFloat(v) || 0).toFixed(spaces);
}

var dados = [
  {
    nome: "Carregando..",
    atividade: "",
    occ: "",
    obs: "",
    obra: 0,
    valor: 0,
  },
];
let banco = [];
let categoria = [];

if (cached) {
  try {
    console.log("Carregando dados em cache...");
    processar(JSON.parse(cached));
    console.log("banco:", banco);
    console.log("categoria:", categoria);
  } catch (e) {
    console.warn("Erro ao ler cache", e);
  }
} else {
  console.log("não há dados em cache");
}

var valorTotal = dados.reduce(
  (acc, item) => acc + (parseFloat(item.valor) || 0),
  0,
);
document.getElementById("viewValor").textContent = fmtBRL(valorTotal);

// var CampoData = document.getElementById("inputData");
// var CampoValor = document.getElementById("viewValor");
// var CampoCategoria = document.getElementById("inputCategoria");
// var CampoBanco = document.getElementById("inputBanco");

function atualizar(input) {
  const row = input.closest("tr");
  const index = row.sectionRowIndex;
  const obj = dados[index];

  const contratada = parseFloat(obj.qtdeContratada) || 0;

  let val = input.value;
  let str = String(val).replace(",", ".").trim();
  let isPercent = str.includes("%");
  let num = parseFloat(str);
  let add = 0;

  if (!isNaN(num)) {
    if (isPercent) {
      add = (num / 100) * contratada;
    } else {
      add = num;
    }
  }

  valorTotal -= obj.adicional ? obj.adicional : 0;
  obj.adicional = add;
  valorTotal += add;

  document.getElementById("viewValor").textContent = fmtBRL(valorTotal);
}

function selectAdd(input) {
  const row = input.closest("tr");
  const index = row.sectionRowIndex;
  const obj = dados[index];
  input.value = (obj.adicional || 0).toFixed(2);
  input.select();
}

function finalizaEdicaoAdicional(input) {
  const row = input.closest("tr");
  const index = row.sectionRowIndex;
  const obj = dados[index];
  atualizar(input);
  input.value = fmtBRL(obj.adicional);
}

function salvar() {
  const catVal = document.getElementById("inputCategoria").value;
  const bancoVal = document.getElementById("inputBanco").value;
  const dataVal = document.getElementById("inputData").value;

  if (!catVal || !bancoVal || !dataVal) {
    Toastify({
      text: "Preencha todos os dados.",
      duration: 3000,
      position: "center",
      gravity: "bottom",
      style: { background: "#bd1717" },
    }).showToast();
    return;
  }

  google.script.run
    .withSuccessHandler((v) => {
      Toastify({
        text: "Salvando...",
        duration: 2000,
        position: "center",
        gravity: "bottom",
        style: { background: "#2196F3" },
      }).showToast();

      const payload = {
        opFunc: v.opFunc,
        opDiaria: v.opDiaria,
        nomeUsuario: v.nomeUsuario,
        categoria: catVal,
        banco: bancoVal,
        data: dataVal,
        valorTotal: valorTotal,
        diarista: dados,
      };
      console.log(payload);

      fetch(APIFluxo, {
        method: "POST",
        body: JSON.stringify(payload),
      })
        .then((r) => (r.ok ? r.text() : Promise.reject(r.statusText)))
        .then((res) => {
          console.log("Salvo em fluxo:", res);
          Toastify({
            text: "Enviado para fluxo de caixa com sucesso..",
            duration: 2000,
            position: "center",
            gravity: "bottom",
            style: { background: "#00aa25" },
          }).showToast();
        })
        .catch((err) => {
          console.error(err);
          Toastify({
            text: "Erro ao enviar ao Fluxo de Caixa",
            duration: 2000,
            position: "center",
            gravity: "bottom",
            style: { background: "#bd1717" },
          }).showToast();
        });

      fetch(APIFin, {
        method: "POST",
        body: JSON.stringify(payload),
      })
        .then((r) => (r.ok ? r.text() : Promise.reject(r.statusText)))
        .then((res) => {
          console.log("Salvo em financeiro:", res);
          Toastify({
            text: "Enviado para financeiro com sucesso..",
            duration: 2000,
            position: "center",
            gravity: "bottom",
            style: { background: "#00aa25" },
          }).showToast();
        })
        .catch((err) => {
          console.error(err);
          Toastify({
            text: "Erro ao enviar ao Financeiro",
            duration: 2000,
            position: "center",
            gravity: "bottom",
            style: { background: "#bd1717" },
          }).showToast();
        });

      fetch(APIFunc, {
        method: "POST",
        body: JSON.stringify(payload),
      })
        .then((r) => (r.ok ? r.text() : Promise.reject(r.statusText)))
        .then((res) => {
          console.log("Salvo:", res);
          Toastify({
            text: "Salvo com sucesso!",
            duration: 2000,
            position: "center",
            gravity: "bottom",
            style: { background: "#00aa25" },
          }).showToast();
          setTimeout(function () {
            try {
              google.script.host.close();
            } catch (e) {}
          }, 500);
        })
        .catch((err) => {
          console.error(err);
          Toastify({
            text: "Erro ao salvar em RH",
            duration: 2000,
            position: "center",
            gravity: "bottom",
            style: { background: "#bd1717" },
          }).showToast();
        });
    })
    .withFailureHandler((error) => {
      Toastify({
        text: `Erro ao obter OP: ${error.message}`,
        duration: -1,
        close: true,
        gravity: "top",
        position: "center",
        stopOnFocus: true,
        style: {
          background: "#bd1717",
          color: "#ffffff",
        },
      }).showToast();
      console.warn(error);
      throw new Error(`Erro ao obter OP: ${error.message}`);
    })
    .getOp();
}

function reloadData() {
  tbody.innerHTML = "";
  dados.forEach(function (dados, index) {
    tbody.innerHTML += `
        <tr>
          <td>${dados.nome}</td>
          <td>${dados.occ}</td>
          <td>${dados.obs}</td>
          <td>${fmtBRL(dados.valor)}</td>
          <td>
            <input 
              class="side-pad input editavel" 
              type="text" 
              style="
                border-radius:5px;
                background-color:#fce5cd;
              "
              value="${fmtBRL(dados.adicional)}" 
              oninput="atualizar(this)" 
              onblur="finalizaEdicaoAdicional(this)" 
              onfocus="selectAdd(this)"
            >
          </td>
        </tr>`;
  });

  valorTotal = dados.reduce(
    (acc, item) => acc + (parseFloat(item.valor) || 0),
    0,
  );
  document.getElementById("viewValor").textContent = fmtBRL(valorTotal);
}

reloadData();

function processar(json) {
  let start = performance.now();
  banco = [];
  categoria = [];
  json.data.forEach((v) => {
    if (v.banco) banco.push(v.banco);
    if (v.categoria) categoria.push(v.categoria);
  });
  console.log(`took ${fmtf(performance.now() - start)}ms to process objects`);
}

function closeDropdown(input) {
  const dropdown = input.nextElementSibling;

  dropdown.classList.add("hiding");
  dropdown.addEventListener(
    "animationend",
    () => {
      dropdown.style.display = "none";
      dropdown.classList.remove("hiding");
    },
    { once: true },
  );
}

function filtrarContratos(input) {
  // const wrapper = input.parentElement;
  // const list = wrapper.querySelector(".dropdown-list");
  const list = input.nextElementSibling;
  const term = input.value.toLowerCase();

  let items = [];
  if (input.id === "inputCategoria") items = categoria;
  else if (input.id === "inputBanco") items = banco;

  // Populate list with all items if empty
  if (list.children.length === 0) {
    [...new Set(items)].forEach((s) => {
      const div = document.createElement("div");
      div.className = "dropdown-item";
      div.textContent = `${s}`;
      div.onmousedown = function () {
        input.value = div.textContent;
        closeDropdown(input);
      };
      list.appendChild(div);
    });
  }

  list.style.display = "block";
  list.classList.remove("hiding");

  // Reset highlights
  Array.from(list.children).forEach(
    (child) => (child.style.backgroundColor = ""),
  );

  if (term) {
    const match = Array.from(list.children).find((item) =>
      item.textContent.toLowerCase().includes(term),
    );
    if (match) {
      match.scrollIntoView({ block: "nearest" });
      match.style.backgroundColor = "#d0d0d0";
    }
  }
}

if (true) {
  let start = performance.now();
  Toastify({
    text: "Atualizando dados...",
    duration: 2000,
    position: "center",
    gravity: "bottom",
    style: { background: "#2196F3" },
  }).showToast();

  fetch(APIC)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
    .then((json) => {
      console.log(
        `took ${fmtf(performance.now() - start)}ms to update via api`,
      );
      console.log("Dados via API:");
      processar(json);
      console.log("banco:", banco);
      console.log("categoria:", categoria);
      localStorage.setItem(CACHE_KEY, JSON.stringify(json));
      Toastify({
        text: "Atualizado.",
        duration: 2000,
        position: "center",
        gravity: "bottom",
        style: { background: "#00aa25" },
      }).showToast();
    })
    .catch((err) => {
      console.log(`took ${fmtf(performance.now() - start)}ms to error`);
      Toastify({
        text: "Erro ao atualizar.",
        duration: 3000,
        position: "center",
        gravity: "bottom",
        style: { background: "#bd1717" },
      }).showToast();
      console.warn("Falha na API:", err);
    });

  fetch(APIFunc)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
    .then((json) => {
      console.log(`took ${fmtf(performance.now() - start)}ms to get func`);
      console.log("Dados func:");
      dados = json.data;
      Toastify({
        text: "func puxados.",
        duration: 2000,
        position: "center",
        gravity: "bottom",
        style: { background: "#00aa25" },
      }).showToast();
      document.getElementById("btn-salvar").disabled = false;
      reloadData();
      console.log(json.data);
    })
    .catch((err) => {
      console.log(`took ${fmtf(performance.now() - start)}ms to error`);
      Toastify({
        text: "Erro ao puxar funcionario.",
        duration: 3000,
        position: "center",
        gravity: "bottom",
        style: { background: "#bd1717" },
      }).showToast();
      console.warn("Falha na API:", err);
      if (!dados) {
        console.warn("Nao ha dados em cache.");
      }
      dados = [
        {
          nome: "Erro ao carregar..",
          atividade: "",
          occ: "",
          obs: "",
          obra: 0,
          valor: 0,
        },
      ];
      reloadData();
    });
}
