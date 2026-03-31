// Centralized API client for the Express gateway.
// Frontend -> Node (Express) -> Flask
// Auth: JWT stored in sessionStorage, sent as Authorization: Bearer <token>

const BASE = "";
const TOKEN_KEY = "jwt_token";
const AUTH_KEY = "auth_user";

// ── Token (sessionStorage — cleared on tab/browser close) ────────────────────
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

function saveToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

function dropToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// ── Auth user info (sessionStorage) ──────────────────────────────────────────
export function getAuth() {
  try {
    return JSON.parse(sessionStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

export function setAuth(auth) {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  dropToken();
  sessionStorage.removeItem(AUTH_KEY);
}

// ── Local storage — only used for last prediction on results page ────────────
function lastPredKey() {
  const email = getAuth()?.email || "guest";
  return `last_prediction:${email}`;
}

export function saveLastPrediction(result) {
  localStorage.setItem(lastPredKey(), JSON.stringify(result));
}

export function loadLastPrediction() {
  try {
    return JSON.parse(localStorage.getItem(lastPredKey()) || "null");
  } catch {
    return null;
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function authHeaders(extra = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function postJson(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

async function getJson(path) {
  const res = await fetch(BASE + path, {
    headers: authHeaders({ "Content-Type": undefined }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

// ── Auth API ──────────────────────────────────────────────────────────────────
export async function register(email, password, role, name, organization) {
  const data = await postJson("/api/auth/register", { email, password, role, name, organization });
  saveToken(data.token);
  setAuth({ email: data.email, role: data.role });
  return data;
}

export async function login(email, password) {
  const data = await postJson("/api/auth/login", { email, password });
  // Store JWT in sessionStorage — cleared automatically when tab closes
  saveToken(data.token);
  setAuth({ email: data.email, role: data.role });
  return data;
}

export async function logout() {
  await postJson("/api/auth/logout", {}).catch(() => {});
  clearAuth();
}

export async function verifyAuth() {
  return getJson("/api/auth/verify");
}

// ── Patient API (medical role) ───────────────────────────────────────────────
export async function createPatient(data) {
  return postJson("/api/patients", data);
}

export async function getAllPatients(search = "") {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return getJson(`/api/patients${qs}`);
}

export async function getPatient(patientId) {
  return getJson(`/api/patients/${patientId}`);
}

export async function updatePatient(patientId, data) {
  const res = await fetch(`/api/patients/${patientId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error || `Request failed (${res.status})`);
  return d;
}

export async function deletePatient(patientId) {
  const res = await fetch(`/api/patients/${patientId}`, {
    method: "DELETE",
    headers: authHeaders({ "Content-Type": undefined }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error || `Request failed (${res.status})`);
  return d;
}

// ── Prediction API ────────────────────────────────────────────────────────────
export async function predict(smiles) {
  return postJson("/api/predict", { smiles });
}

export async function predictBatch(smiles_list, include_llm = false) {
  return postJson("/api/predict/batch", { smiles_list, include_llm });
}

export async function patientPredict(smiles, age, weight, patientId = null) {
  return postJson("/api/predict/patient", { smiles, age, weight, patientId });
}

export async function forensicPredict(smiles, caseId = null, caseTitle = "", caseDetails = "", incidentType = "", evidenceRef = "", collectionDate = "", officerName = "", labName = "", chainOfCustody = "") {
  return postJson("/api/predict/forensic", { smiles, caseId, caseTitle, caseDetails, incidentType, evidenceRef, collectionDate, officerName, labName, chainOfCustody });
}

export async function forensicPredictBatch(smiles_list, caseId = null, caseTitle = "", caseDetails = "", include_llm = false) {
  return postJson("/api/predict/forensic/batch", { smiles_list, caseId, caseTitle, caseDetails, include_llm });
}

export async function visualize(smiles) {
  return postJson("/api/visualize", { smiles });
}

export async function getHistory(mode) {
  const qs = mode ? `?mode=${encodeURIComponent(mode)}` : "";
  return getJson(`/api/history${qs}`);
}

// Legacy no-ops kept so any remaining import doesn't break
export function setToken(_t) {}
