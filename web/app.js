// ===================== GLOBAL UTILITIES =====================
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 3000);
}

// ===================== AUTHENTICATION MODULE =====================

// --- Credential Store (hashed for security) ---
// SHA-256 hash of "Manash@123"
const AUTH_USERS = [
  {
    email: "manashjyoti.barman07@gmail.com",
    passwordHash: "a]HASH_PLACEHOLDER", // will be computed on first run
    displayName: "Manashjyoti Barman"
  }
];

// Simple SHA-256 using SubtleCrypto
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Pre-compute the hash at startup for comparison
let EXPECTED_HASH = null;
(async () => {
  EXPECTED_HASH = await sha256("Manash@123");
  AUTH_USERS[0].passwordHash = EXPECTED_HASH;
})();

// --- Session Management ---
const SESSION_KEY = "qbp_session";
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function createSession(user) {
  const session = {
    email: user.email,
    displayName: user.displayName,
    loginTime: Date.now(),
    expiresAt: Date.now() + SESSION_EXPIRY_MS
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// --- Login UI Handling ---
const loginScreen = document.getElementById("loginScreen");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const loginEmailInput = document.getElementById("loginEmail");
const loginPasswordInput = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const togglePasswordBtn = document.getElementById("togglePassword");
const logoutBtn = document.getElementById("logoutBtn");
const userGreeting = document.getElementById("userGreeting");

function showLogin() {
  loginScreen.classList.remove("hidden");
  appShell.classList.add("hidden");
  loginEmailInput.value = "";
  loginPasswordInput.value = "";
  loginError.classList.add("hidden");
  loginEmailInput.focus();
}

function showApp(session) {
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  userGreeting.textContent = session.displayName;
  document.getElementById("dashboardWelcome").textContent = `Welcome, ${session.displayName}`;
  initializeApp();
}

// Toggle password visibility
togglePasswordBtn.addEventListener("click", () => {
  const isPassword = loginPasswordInput.type === "password";
  loginPasswordInput.type = isPassword ? "text" : "password";
  togglePasswordBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
});

// Login form submission
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");

  const email = loginEmailInput.value.trim().toLowerCase();
  const password = loginPasswordInput.value;

  if (!email || !password) {
    loginError.textContent = "Please enter both Email and Password.";
    loginError.classList.remove("hidden");
    return;
  }

  // Hash the entered password and compare
  const enteredHash = await sha256(password);
  const user = AUTH_USERS.find(u => u.email.toLowerCase() === email && u.passwordHash === enteredHash);

  if (user) {
    const session = createSession(user);
    showApp(session);
  } else {
    loginError.textContent = "Invalid Email or Password";
    loginError.classList.remove("hidden");
    loginPasswordInput.value = "";
    loginPasswordInput.focus();
  }
});

// Logout
logoutBtn.addEventListener("click", () => {
  clearSession();
  showLogin();
  showToast("You have been logged out successfully.");
});

// ===================== MAIN APPLICATION =====================
let appInitialized = false;

// --- Check session on page load ---
const existingSession = getSession();
if (existingSession) {
  showApp(existingSession);
} else {
  showLogin();
}

function initializeApp() {
  if (appInitialized) {
    // If already initialized, just refresh dashboard stats
    if (window.updateDashboardStats) window.updateDashboardStats();
    return;
  }
  appInitialized = true;

  // Run the rest of app initialization
  _bootstrapApp();
}

function _bootstrapApp() {

const fileInput = document.querySelector("#fileInput");
const chooseButton = document.querySelector("#chooseButton");
const uploadPanel = document.querySelector("#uploadPanel");
const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");
const questionsEl = document.querySelector("#questions");
const searchInput = document.querySelector("#searchInput");
const subjectFilter = document.querySelector("#subjectFilter");

// --- Master Question Bank State & Elements ---
let configuredAssessments = [];
let configuredMediums = [];
let masterData = [];
let mappingHistory = [];
let paper = null;

let currentProject = null;
let autoSaveInterval = null;
let isDirty = false;

const myFilesView = document.querySelector("#myFilesView");
const workspaceView = document.querySelector("#workspaceView");
const navMyFiles = document.querySelector("#navMyFiles");
const navWorkspace = document.querySelector("#navWorkspace");
const myFilesTableBody = document.querySelector("#myFilesTable tbody");
const createNewBankBtn = document.querySelector("#createNewBankBtn");

const docNameInput = document.querySelector("#docNameInput");
const autoSaveStatus = document.querySelector("#autoSaveStatus");
const saveDraftBtn = document.querySelector("#saveDraftBtn");

const mapSubject = document.querySelector("#mapSubject");
const mapGrade = document.querySelector("#mapGrade");
const mapMedium = document.querySelector("#mapMedium");
const mapRange = document.querySelector("#mapRange");
const previewMapButton = document.querySelector("#previewMapButton");
const addToMasterButton = document.querySelector("#addToMasterButton");

const masterPreviewSection = document.querySelector("#masterPreviewSection");
const masterTableBody = document.querySelector("#masterTable tbody");
const historyTableBody = document.querySelector("#historyTable tbody");
const filterMasterSubject = document.querySelector("#filterMasterSubject");
const filterMasterGrade = document.querySelector("#filterMasterGrade");
const filterMasterMedium = document.querySelector("#filterMasterMedium");
const downloadMasterBtn = document.querySelector("#downloadMasterBtn");

const masterFileInput = document.querySelector("#masterFileInput");
const chooseMasterButton = document.querySelector("#chooseMasterButton");
const masterUploadPanel = document.querySelector("#masterUploadPanel");
const masterStatus = document.querySelector("#masterStatus");

const toggleExpandBtn = document.querySelector("#toggleExpandBtn");
let isAllExpanded = true;

localforage.config({
  name: 'QuestionBankBuilder',
  storeName: 'projects'
});

// --- Initialize App ---
initMyFiles();

function switchView(view) {
  const dashboardStats = document.getElementById('dashboardStats');
  if (view === 'myFiles') {
    myFilesView.classList.remove('hidden');
    workspaceView.classList.add('hidden');
    navMyFiles.classList.add('active');
    navWorkspace.classList.remove('active');
    if (dashboardStats) dashboardStats.classList.remove('hidden');
    initMyFiles();
    if (autoSaveInterval) clearInterval(autoSaveInterval);
  } else {
    myFilesView.classList.add('hidden');
    workspaceView.classList.remove('hidden');
    navMyFiles.classList.remove('active');
    navWorkspace.classList.add('active');
    if (dashboardStats) dashboardStats.classList.add('hidden');
    startAutoSave();
  }
}

navMyFiles.addEventListener("click", () => {
  if (isDirty) saveDraft();
  switchView('myFiles');
});
navWorkspace.addEventListener("click", () => {
  // Now disabled as requested by user. 
  // User must use Action -> Open to access the Workspace.
});

createNewBankBtn.addEventListener("click", () => {
  currentProject = {
    id: Date.now().toString(),
    documentName: "Untitled Question Bank",
    status: "Draft",
    createdDate: new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric'}),
    modifiedDate: new Date().toISOString(),
    configuration: { assessments: [], mediums: [] },
    masterData: [],
    mappingHistory: [],
    paper: null
  };
  loadProjectState(currentProject);
  switchView('workspace');
  setDirty();
  saveDraft();
});

// --- My Files Logic ---
async function initMyFiles() {
  const keys = await localforage.keys();
  const projects = await Promise.all(keys.map(k => localforage.getItem(k)));
  projects.sort((a,b) => new Date(b.modifiedDate) - new Date(a.modifiedDate));
  
  myFilesTableBody.innerHTML = projects.map(p => `
    <tr>
      <td>${escapeHtml(p.documentName)}</td>
      <td>${p.createdDate}</td>
      <td>${new Date(p.modifiedDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric'})}</td>
      <td>${p.masterData ? p.masterData.length : 0}</td>
      <td><span class="status-badge status-${p.status.toLowerCase()}">${p.status}</span></td>
      <td>
        ${p.status === 'Draft' 
          ? `<button class="action-btn" onclick="openProject('${p.id}')">Open</button>` 
          : `<button class="action-btn" onclick="openProject('${p.id}')">View</button>
             <button class="action-btn" onclick="createNewVersion('${p.id}')">Create New Version</button>`
        }
        <button class="action-btn" onclick="renameProject('${p.id}')">Rename</button>
        <button class="action-btn" onclick="duplicateProject('${p.id}')">Duplicate</button>
        ${p.status !== 'Archived' ? `<button class="action-btn" onclick="archiveProject('${p.id}')">Archive</button>` : ''}
        <button class="action-btn" style="color: #ff4d4f;" onclick="deleteProject('${p.id}')">Delete</button>
      </td>
    </tr>
  `).join("");
  if (window.updateDashboardStats) window.updateDashboardStats();
}

window.openProject = async function(id) {
  const p = await localforage.getItem(id);
  if (p) {
    currentProject = p;
    loadProjectState(p);
    switchView('workspace');
  }
};

window.createNewVersion = async function(id) {
  const p = await localforage.getItem(id);
  if (p) {
    const newP = JSON.parse(JSON.stringify(p));
    newP.id = Date.now().toString();
    newP.documentName = newP.documentName + "_v2";
    newP.status = "Draft";
    newP.modifiedDate = new Date().toISOString();
    await localforage.setItem(newP.id, newP);
    initMyFiles();
  }
};

window.renameProject = async function(id) {
  const p = await localforage.getItem(id);
  if (p) {
    const newName = prompt("Enter new Document Name:", p.documentName);
    if (newName && newName.trim()) {
      p.documentName = newName.trim();
      p.modifiedDate = new Date().toISOString();
      await localforage.setItem(id, p);
      initMyFiles();
      if (currentProject && currentProject.id === id) {
        docNameInput.value = newName.trim();
      }
    }
  }
};

window.duplicateProject = async function(id) {
  const p = await localforage.getItem(id);
  if (p) {
    const newP = JSON.parse(JSON.stringify(p));
    newP.id = Date.now().toString();
    newP.documentName = newP.documentName + " (Copy)";
    newP.modifiedDate = new Date().toISOString();
    newP.status = "Draft";
    await localforage.setItem(newP.id, newP);
    initMyFiles();
  }
};

window.archiveProject = async function(id) {
  const p = await localforage.getItem(id);
  if (p) {
    p.status = "Archived";
    p.modifiedDate = new Date().toISOString();
    await localforage.setItem(id, p);
    initMyFiles();
  }
};

window.deleteProject = async function(id) {
  if (confirm("Are you sure you want to delete this file?")) {
    await localforage.removeItem(id);
    if (currentProject && currentProject.id === id) {
      currentProject = null;
      switchView('myFiles');
    } else {
      initMyFiles();
    }
  }
};

// --- Project State Management ---
function loadProjectState(p) {
  docNameInput.value = p.documentName;
  configuredAssessments = p.configuration.assessments || [];
  configuredMediums = p.configuration.mediums || [];
  masterData = p.masterData || [];
  mappingHistory = p.mappingHistory || [];
  paper = p.paper || null;

  renderAssessments();
  renderSelects(["#mapMedium", "#filterMasterMedium"], configuredMediums);
  renderConfigList("#mediumList", configuredMediums, (v) => removeConfig(v, configuredMediums, "#mediumList", ["#mapMedium", "#filterMasterMedium"]));

  renderMappingHistory();
  renderMasterPreview();

  if (masterData.length > 0) {
    masterUploadPanel.classList.add("hidden");
    masterPreviewSection.classList.remove("hidden");
  } else {
    masterUploadPanel.classList.remove("hidden");
    masterPreviewSection.classList.add("hidden");
    masterStatus.textContent = "";
  }

  if (paper) {
    prepareWorkspace();
  } else {
    resetPaperState();
  }
  
  autoSaveStatus.textContent = "Last Saved: " + formatSavedTime(p.modifiedDate);
  isDirty = false;
}

function updateCurrentProjectObject() {
  if (!currentProject) return;
  currentProject.documentName = docNameInput.value.trim() || "Untitled Question Bank";
  currentProject.configuration = {
    assessments: configuredAssessments,
    mediums: configuredMediums
  };
  currentProject.masterData = masterData;
  currentProject.mappingHistory = mappingHistory;
  currentProject.paper = paper;
  currentProject.modifiedDate = new Date().toISOString();
}

async function saveDraft(force = false) {
  if (!currentProject) return;
  if (!isDirty && !force) return;
  
  updateCurrentProjectObject();
  await localforage.setItem(currentProject.id, currentProject);
  autoSaveStatus.textContent = "Last Saved: " + formatSavedTime(currentProject.modifiedDate);
  isDirty = false;
}

function startAutoSave() {
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(() => saveDraft(), 30000);
}

function setDirty() {
  isDirty = true;
  if (currentProject && currentProject.status === 'Downloaded') {
    currentProject.status = 'Draft';
  }
}


saveDraftBtn.addEventListener("click", async () => {
  setDirty();
  await saveDraft(true);
  currentProject = null;
  switchView('myFiles');
  showToast("Saved successfully");
});

docNameInput.addEventListener("input", setDirty);

function formatSavedTime(isoString) {
  const d = new Date(isoString);
  const dateStr = d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric'});
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

// --- Config Handling ---
function addConfig(inputId, listId, array, renderSelectIds) {
  const input = document.querySelector(inputId);
  const val = input.value.trim();
  if (val && !array.includes(val)) {
    array.push(val);
    input.value = "";
    renderConfigList(listId, array, (item) => removeConfig(item, array, listId, renderSelectIds));
    renderSelects(renderSelectIds, array);
    setDirty();
    saveDraft();
  }
}

function removeConfig(item, array, listId, renderSelectIds) {
  const index = array.indexOf(item);
  if (index > -1) array.splice(index, 1);
  renderConfigList(listId, array, (val) => removeConfig(val, array, listId, renderSelectIds));
  renderSelects(renderSelectIds, array);
  setDirty();
  saveDraft();
}

function renderConfigList(listId, array, removeCallback) {
  const container = document.querySelector(listId);
  container.innerHTML = "";
  array.forEach(item => {
    const div = document.createElement("div");
    div.className = "tag";
    div.innerHTML = `<span>${escapeHtml(item)}</span><button>&times;</button>`;
    div.querySelector("button").onclick = () => removeCallback(item);
    container.appendChild(div);
  });
}

function renderSelects(selectIds, array) {
  selectIds.forEach(id => {
    const sel = document.querySelector(id);
    const firstOpt = sel.options[0];
    sel.innerHTML = "";
    sel.appendChild(firstOpt);
    array.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      sel.appendChild(opt);
    });
  });
}

function generateAssessmentId(subject, grade) {
  const subPrefix = subject.substring(0, 3).toUpperCase();
  const match = grade.match(/\d+/);
  const num = match ? match[0] : grade.substring(0, 1).toUpperCase();
  return `${subPrefix}G${num}`;
}

document.querySelector("#addAssessmentBtn").addEventListener("click", () => {
  const subInput = document.querySelector("#subjectInput");
  const graInput = document.querySelector("#gradeInput");
  const subject = subInput.value.trim();
  const grade = graInput.value.trim();
  
  if (!subject || !grade) {
    alert("Please enter both Subject and Grade.");
    return;
  }
  
  const id = generateAssessmentId(subject, grade);
  
  if (configuredAssessments.some(a => a.assessmentId === id)) {
    alert("This Subject and Grade combination (or Assessment ID) already exists.");
    return;
  }
  
  configuredAssessments.push({ subject, grade, assessmentId: id });
  subInput.value = "";
  graInput.value = "";
  
  renderAssessments();
  setDirty();
  saveDraft();
});

window.removeAssessment = function(id) {
  configuredAssessments = configuredAssessments.filter(a => a.assessmentId !== id);
  renderAssessments();
  setDirty();
  saveDraft();
};

function renderAssessments() {
  const tbody = document.querySelector("#assessmentConfigTable tbody");
  tbody.innerHTML = configuredAssessments.map(a => `
    <tr>
      <td>${escapeHtml(a.subject)}</td>
      <td>${escapeHtml(a.grade)}</td>
      <td><strong>${escapeHtml(a.assessmentId)}</strong></td>
      <td><button class="action-btn" style="color: #ff4d4f; padding: 0;" onclick="removeAssessment('${a.assessmentId}')">Remove</button></td>
    </tr>
  `).join("");
  
  const mapAssessmentId = document.querySelector("#mapAssessmentId");
  const firstOptId = mapAssessmentId.options[0];
  mapAssessmentId.innerHTML = "";
  mapAssessmentId.appendChild(firstOptId);
  
  const uniqueSubjects = [...new Set(configuredAssessments.map(a => a.subject))];
  const uniqueGrades = [...new Set(configuredAssessments.map(a => a.grade))];
  
  renderSelects(["#mapSubject", "#filterMasterSubject"], uniqueSubjects);
  renderSelects(["#mapGrade", "#filterMasterGrade"], uniqueGrades);
  
  configuredAssessments.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.assessmentId;
    opt.textContent = a.assessmentId;
    mapAssessmentId.appendChild(opt);
  });
}

const mapAssessmentId = document.querySelector("#mapAssessmentId");

function updateAssessmentIdDropdown() {
  const s = mapSubject.value;
  const g = mapGrade.value;
  if (s && g) {
    const a = configuredAssessments.find(x => x.subject === s && x.grade === g);
    if (a) {
      mapAssessmentId.value = a.assessmentId;
    } else {
      mapAssessmentId.value = "";
    }
  }
}

mapSubject.addEventListener("change", updateAssessmentIdDropdown);
mapGrade.addEventListener("change", updateAssessmentIdDropdown);

mapAssessmentId.addEventListener("change", () => {
  const val = mapAssessmentId.value;
  if (!val) return;
  const a = configuredAssessments.find(x => x.assessmentId === val);
  if (a) {
    mapSubject.value = a.subject;
    mapGrade.value = a.grade;
  }
});

document.querySelector("#addMediumBtn").addEventListener("click", () => addConfig("#mediumInput", "#mediumList", configuredMediums, ["#mapMedium", "#filterMasterMedium"]));

// --- Master Excel Upload ---
chooseMasterButton.addEventListener("click", () => {
  masterFileInput.click();
});
masterFileInput.addEventListener("change", (e) => {
  if (e.target.files[0]) handleMasterFile(e.target.files[0]);
});

["dragenter", "dragover"].forEach(name => masterUploadPanel.addEventListener(name, event => {
  event.preventDefault(); masterUploadPanel.classList.add("drag");
}));
["dragleave", "drop"].forEach(name => masterUploadPanel.addEventListener(name, event => {
  event.preventDefault(); masterUploadPanel.classList.remove("drag");
}));
masterUploadPanel.addEventListener("drop", event => {
  const file = event.dataTransfer.files[0];
  if (file) handleMasterFile(file);
});

function handleMasterFile(file) {
  masterStatus.textContent = `Reading ${file.name}...`;
  masterStatus.style.color = "var(--muted)";
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      masterData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
      masterStatus.textContent = "Master Excel Loaded Successfully";
      masterStatus.style.color = "var(--brand)";
      masterUploadPanel.classList.add("hidden");
      masterPreviewSection.classList.remove("hidden");
      renderMasterPreview();
      setDirty();
      saveDraft();
    } catch (err) {
      masterStatus.textContent = "Error reading Excel file.";
      masterStatus.style.color = "red";
    }
  };
  reader.readAsBinaryString(file);
}

// --- Parsing Word Doc ---
chooseButton.addEventListener("click", () => {
  fileInput.click();
});
fileInput.addEventListener("change", () => fileInput.files[0] && upload(fileInput.files[0]));
document.querySelector("#newButton").addEventListener("click", () => {
  resetPaperState();
});
document.querySelector("#exportButton").addEventListener("click", exportExcel);
searchInput.addEventListener("input", render);
subjectFilter.addEventListener("change", render);

toggleExpandBtn.addEventListener("click", () => {
  isAllExpanded = !isAllExpanded;
  toggleExpandBtn.textContent = isAllExpanded ? "Collapse All" : "Expand All";
  applyGlobalExpandState();
});

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
    setDirty();
    saveDraft();
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
  attachQuestionListeners();
  applyGlobalExpandState();
}

function renderRange(start, end) {
  const visible = paper.questions.filter(q => q.number >= start && q.number <= end);
  document.querySelector("#visibleCount").textContent = `${visible.length} mapped questions shown`;
  questionsEl.innerHTML = visible.map(questionCard).join("");
  attachQuestionListeners();
  applyGlobalExpandState();
}

function applyGlobalExpandState() {
  document.querySelectorAll(".question-card").forEach(card => {
    if (isAllExpanded) card.classList.remove("collapsed");
    else card.classList.add("collapsed");
  });
}

function attachQuestionListeners() {
  questionsEl.querySelectorAll(".question-top").forEach(top => {
    top.addEventListener("click", () => {
      top.closest(".question-card").classList.toggle("collapsed");
    });
  });
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
  setDirty();
}

// --- Mapping Module ---
function getSelectedRange() {
  const rangeStr = mapRange.value.trim();
  const match = rangeStr.match(/^(\d+)\s*-\s*(\d+)$/);
  if (match) return [parseInt(match[1]), parseInt(match[2])];
  return null;
}

previewMapButton.addEventListener("click", () => {
  if (!paper) return;
  const range = getSelectedRange();
  if (range) renderRange(range[0], range[1]);
  else alert("Please enter a valid Question Range (e.g., 1-10)");
});

addToMasterButton.addEventListener("click", () => {
  if (!paper) return;
  
  const assessmentId = mapAssessmentId.value;
  const medium = mapMedium.value;
  const range = getSelectedRange();
  
  if (!assessmentId || !medium || !range) {
    alert("Please select Assessment ID, Medium, and enter Question Range.");
    return;
  }
  
  const assessmentObj = configuredAssessments.find(a => a.assessmentId === assessmentId);
  if (!assessmentObj) return;
  
  const subject = assessmentObj.subject;
  const grade = assessmentObj.grade;
  
  const [start, end] = range;
  const selectedQs = paper.questions.filter(q => q.number >= start && q.number <= end);
  if (selectedQs.length === 0) {
    alert("No questions found in this range.");
    return;
  }

  let duplicates = [];
  let additions = [];
  
  selectedQs.forEach(q => {
    const newRecord = {
      "Assessment ID": assessmentId,
      "Subject": subject,
      "Grade": grade,
      "Medium": medium,
      "Question Number": q.number,
      "Question Text": q.question,
      "Option A": q.options[0]?.text || "",
      "Option B": q.options[1]?.text || "",
      "Option C": q.options[2]?.text || "",
      "Option D": q.options[3]?.text || ""
    };
    
    const existingIndex = masterData.findIndex(item => 
      item["Assessment ID"] === assessmentId && 
      item["Medium"] === medium && 
      String(item["Question Number"]) === String(q.number)
    );
    
    if (existingIndex > -1) duplicates.push({ index: existingIndex, record: newRecord });
    else additions.push(newRecord);
  });

  if (duplicates.length > 0) {
    const action = confirm(`Questions already exist for this Subject, Grade and Medium combination (${duplicates.length} duplicates found). \n\nClick OK to Replace Existing, or Cancel to Skip Existing.`);
    if (action) {
      duplicates.forEach(d => masterData[d.index] = d.record);
      masterData.push(...additions);
    } else {
      masterData.push(...additions);
    }
  } else {
    masterData.push(...additions);
  }

  const addedCount = duplicates.length > 0 ? (additions.length + duplicates.length) : additions.length;
  mappingHistory.unshift({
    assessmentId, subject, grade, medium, range: mapRange.value,
    added: addedCount,
    timestamp: new Date().toLocaleString()
  });
  
  renderMappingHistory();
  masterPreviewSection.classList.remove("hidden");
  renderMasterPreview();
  
  setDirty();
  saveDraft();
  
  alert(`Processed ${addedCount} questions into the Master Excel mapping.`);
  
  // Reset fields and restore full view
  mapSubject.value = "";
  mapGrade.value = "";
  mapAssessmentId.value = "";
  mapMedium.value = "";
  mapRange.value = "";
  render();
});

function renderMappingHistory() {
  historyTableBody.innerHTML = mappingHistory.map(h => `
    <tr>
      <td><strong>${escapeHtml(h.assessmentId)}</strong></td>
      <td>${escapeHtml(h.subject)}</td>
      <td>${escapeHtml(h.grade)}</td>
      <td>${escapeHtml(h.medium)}</td>
      <td>${escapeHtml(h.range)}</td>
      <td>${h.added}</td>
      <td>${escapeHtml(h.timestamp)}</td>
    </tr>
  `).join("");
}

function renderMasterPreview() {
  const fSub = filterMasterSubject ? filterMasterSubject.value : "";
  const fGra = filterMasterGrade ? filterMasterGrade.value : "";
  const fMed = filterMasterMedium ? filterMasterMedium.value : "";
  
  const visible = masterData.filter(item => 
    (!fSub || item["Subject"] === fSub) &&
    (!fGra || item["Grade"] === fGra) &&
    (!fMed || item["Medium"] === fMed)
  );
  
  masterTableBody.innerHTML = visible.map(item => `
    <tr>
      <td><strong>${escapeHtml(item["Assessment ID"] || "")}</strong></td>
      <td>${escapeHtml(item["Subject"] || "")}</td>
      <td>${escapeHtml(item["Grade"] || "")}</td>
      <td>${escapeHtml(item["Medium"] || "")}</td>
      <td>${escapeHtml(String(item["Question Number"] || ""))}</td>
      <td title="${escapeAttr(item["Question Text"] || "")}">${escapeHtml((item["Question Text"] || "").substring(0, 30))}...</td>
      <td title="${escapeAttr(item["Option A"] || "")}">${escapeHtml((item["Option A"] || "").substring(0, 15))}</td>
      <td title="${escapeAttr(item["Option B"] || "")}">${escapeHtml((item["Option B"] || "").substring(0, 15))}</td>
      <td title="${escapeAttr(item["Option C"] || "")}">${escapeHtml((item["Option C"] || "").substring(0, 15))}</td>
      <td title="${escapeAttr(item["Option D"] || "")}">${escapeHtml((item["Option D"] || "").substring(0, 15))}</td>
    </tr>
  `).join("");
}

if (filterMasterSubject && filterMasterGrade && filterMasterMedium) {
  [filterMasterSubject, filterMasterGrade, filterMasterMedium].forEach(el => el.addEventListener("change", renderMasterPreview));
}

downloadMasterBtn.addEventListener("click", () => {
  if (masterData.length === 0) {
    alert("No data in Master Excel.");
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(masterData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Master");
  XLSX.writeFile(workbook, (currentProject?.documentName || "Master_Question_Bank") + ".xlsx");
  
  if (currentProject && currentProject.status === 'Draft') {
    currentProject.status = 'Downloaded';
    isDirty = true;
    saveDraft(true).then(() => {
      loadProjectState(currentProject);
    });
  }
});

// --- Exports & Utils ---
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
    button.textContent = "Export Single Paper Excel";
    alert("Unable to create the Excel file.");
    return;
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(await response.blob());
  link.download = `${paper.sourceFile.replace(/\.docx$/i, "")}-questions.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
  button.disabled = false;
  button.textContent = "Export Single Paper Excel";
}

function resetPaperState() {
  paper = null; fileInput.value = ""; status.textContent = "";
  workspace.classList.add("hidden"); uploadPanel.classList.remove("hidden");
  setDirty();
  saveDraft();
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function escapeAttr(value = "") { return escapeHtml(value); }

// --- Dashboard Stats ---
window.updateDashboardStats = async function() {
  try {
    const keys = await localforage.keys();
    const projects = await Promise.all(keys.map(k => localforage.getItem(k)));
    
    const allAssessments = new Set();
    const allSubjects = new Set();
    let draftCount = 0;
    let downloadedCount = 0;
    
    projects.forEach(p => {
      if (p.configuration && p.configuration.assessments) {
        p.configuration.assessments.forEach(a => {
          allAssessments.add(a.assessmentId);
          allSubjects.add(a.subject);
        });
      }
      if (p.status === 'Draft') draftCount++;
      if (p.status === 'Downloaded') downloadedCount++;
    });
    
    document.getElementById("statSubjects").textContent = allSubjects.size;
    document.getElementById("statAssessments").textContent = allAssessments.size;
    document.getElementById("statFiles").textContent = projects.length;
    document.getElementById("statDrafts").textContent = draftCount;
    document.getElementById("statDownloaded").textContent = downloadedCount;
  } catch (e) {
    // silently fail
  }
}

window.updateDashboardStats();

} // end _bootstrapApp
