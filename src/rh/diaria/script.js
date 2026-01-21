const APIC = "https://script.google.com/macros/s/AKfycbxgR6d6FU0riIt5wEtD3Nm1kPjuRyO5gl1e-TnyypjRBWki4sPuFGRbXosiLm5jJPOZ/exec?sheet=db_fluxo";
const APIFunc = "https://script.google.com/macros/s/AKfycbzqa2HMZ4IAsUI1MXYd48TpxNH1LEvNIRO7lqi6om7WEA1Vdps-93UYI1B2xSwinkQP/exec";
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
    nome: "aaa",
    atividade: "aba",
    occ: "123",
    obs: "1b",
    obra: 0,
    valor: 15,
    adicional: 0,
  },
  {
    nome: "bbb",
    atividade: "bab",
    occ: "456",
    obs: "2b",
    obra: 0,
    valor: 15,
    adicional: 0,
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

  valorTotal -= obj.adicional?obj.adicional:0;
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
  console.log(dados)
  Toastify({
    text: "Erro ao salvar",
    duration: 2000,
    position: "center",
    gravity: "bottom",
    style: { background: "#bd1717" }
  }).showToast();
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
          <td style="padding: 0;"><input class="side-pad" type="text" value="${fmtBRL(dados.adicional)}" oninput="atualizar(this)" onblur="finalizaEdicaoAdicional(this)" onfocus="selectAdd(this)"></td>
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
  console.log(`took ${fmtf(performance.now() - start)}ms to process objects`)
}

{
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
      console.log(`took ${fmtf(performance.now() - start)}ms to update via api`)
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
      console.log(`took ${fmtf(performance.now() - start)}ms to error`)
      Toastify({
        text: "Erro ao atualizar.",
        duration: 3000,
        position: "center",
        gravity: "bottom",
        style: { background: "#bd1717" }
      }).showToast();
      console.warn("Falha na API:", err);
    });

  fetch(APIFunc)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
    .then((json) => {
      console.log(`took ${fmtf(performance.now() - start)}ms to get func`)
      console.log("Dados func:");
      dados = json.data
      Toastify({
        text: "func puxados.",
        duration: 2000,
        position: "center",
        gravity: "bottom",
        style: { background: "#00aa25" },
      }).showToast();
      reloadData()
      console.log(json.data)
    })
    .catch((err) => {
      console.log(`took ${fmtf(performance.now() - start)}ms to error`)
      Toastify({
        text: "Erro ao puxar funcionario.",
        duration: 3000,
        position: "center",
        gravity: "bottom",
        style: { background: "#bd1717" }
      }).showToast();
      console.warn("Falha na API:", err);
      if (!dados) {
        console.warn("Nao ha dados em cache.");
      }
    });
}
