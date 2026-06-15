const fileInput = document.querySelector("#fileInput");
const chooseButton = document.querySelector("#chooseButton");
const uploadPanel = document.querySelector("#uploadPanel");
const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");
const questionsEl = document.querySelector("#questions");
const searchInput = document.querySelector("#searchInput");
const subjectFilter = document.querySelector("#subjectFilter");
let paper = null;

chooseButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => fileInput.files[0] && upload(fileInput.files[0]));
document.querySelector("#newButton").addEventListener("click", reset);
document.querySelector("#exportButton").addEventListener("click", exportExcel);
searchInput.addEventListener("input", render);
subjectFilter.addEventListener("change", render);

["dragenter", "dragover"].forEach(name => uploadPanel.addEventListener(name, event => {
  event.preventDefault(); uploadPanel.classList.add("drag");
}));
["dragleave", "drop"].forEach(name => uploadPanel.addEventListener(name, event => {
  event.preventDefault(); uploadPanel.classList.remove("drag");
}));
uploadPanel.addEventListener("drop", event => {
  const file = event.dataTransfer.files[0];
  if (file) upload(file);
});

async function upload(file) {
  status.textContent = `Parsing ${file.name}...`;
  chooseButton.disabled = true;
  const form = new FormData();
  form.append("file", file);
  try {
    const response = await fetch("/api/parse", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to parse this document.");
    paper = result;
    prepareWorkspace();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    chooseButton.disabled = false;
  }
}

function prepareWorkspace() {
  uploadPanel.classList.add("hidden");
  workspace.classList.remove("hidden");
  document.querySelector("#paperName").textContent = paper.sourceFile;
  document.querySelector("#stats").innerHTML = [
    ["Questions", paper.stats.questionCount],
    ["Subjects", new Set(paper.questions.map(q => q.subject).filter(Boolean)).size],
    ["Options", paper.questions.reduce((sum, q) => sum + q.options.length, 0)]
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  const subjects = [...new Set(paper.questions.map(q => q.subject).filter(Boolean))];
  subjectFilter.innerHTML = `<option value="">All subjects</option>${subjects.map(s => `<option>${escapeHtml(s)}</option>`).join("")}`;
  render();
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const subject = subjectFilter.value;
  const visible = paper.questions.filter(q =>
    (!subject || q.subject === subject) &&
    (!query || String(q.number).includes(query) || q.question.toLowerCase().includes(query))
  );
  document.querySelector("#visibleCount").textContent = `${visible.length} shown`;
  questionsEl.innerHTML = visible.map(questionCard).join("");
  questionsEl.querySelectorAll("[data-question]").forEach(input => {
    input.addEventListener("input", updateQuestion);
    input.addEventListener("change", updateQuestion);
  });
}

function questionCard(q) {
  const options = q.options.map((option, index) => `
    <div class="option">
      <span class="option-label">${option.label}</span>
      <div>
        <input data-question="${q.number}" data-option="${index}" value="${escapeAttr(option.text)}">
      </div>
    </div>`).join("");
  return `<article class="question-card">
    <div class="question-top"><span class="number">Question ${q.number}</span><span class="badge">${escapeHtml(q.subject || q.type)}</span></div>
    <textarea class="question-text" data-question="${q.number}" data-field="question">${escapeHtml(q.question)}</textarea>
    <div class="options">${options}</div>
  </article>`;
}

function updateQuestion(event) {
  const q = paper.questions.find(item => item.number === Number(event.target.dataset.question));
  if (event.target.dataset.option !== undefined) q.options[Number(event.target.dataset.option)].text = event.target.value;
  else q[event.target.dataset.field] = event.target.value;
}

async function exportExcel() {
  const button = document.querySelector("#exportButton");
  button.disabled = true;
  button.textContent = "Creating Excel...";
  const response = await fetch("/api/export-excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(paper)
  });
  if (!response.ok) {
    button.disabled = false;
    button.textContent = "Export Excel";
    alert("Unable to create the Excel file.");
    return;
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(await response.blob());
  link.download = `${paper.sourceFile.replace(/\.docx$/i, "")}-questions.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
  button.disabled = false;
  button.textContent = "Export Excel";
}
function reset() {
  paper = null; fileInput.value = ""; status.textContent = "";
  workspace.classList.add("hidden"); uploadPanel.classList.remove("hidden");
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function escapeAttr(value = "") { return escapeHtml(value); }
