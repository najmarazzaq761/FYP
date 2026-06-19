// Automatically switch between local and production Hugging Face Spaces API URL based on environment
const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "")
  ? "http://127.0.0.1:5000/api"
  : "https://najmarazzaq-depression-api.hf.space/api";


const TOKEN_KEY = "depression_app_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getPostAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  if (!next) return "dashboard.html";
  if (next.includes("://") || next.startsWith("//")) return "dashboard.html";
  return next;
}

function redirectToLoginWithNext() {
  const next = `${window.location.pathname.split("/").pop()}${window.location.search}${window.location.hash}`;
  const encodedNext = encodeURIComponent(next || "dashboard.html");
  window.location.href = `login.html?next=${encodedNext}`;
}

async function validateSession() {
  const token = getToken();
  if (!token) return false;
  try {
    await apiRequest("/history", { method: "GET", headers: authHeader() });
    return true;
  } catch (error) {
    if (error.status === 401 || error.status === 422) {
      clearToken();
      return false;
    }
    return true;
  }
}

async function parseApiResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  const text = await res.text();
  return text ? { message: text } : {};
}

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body,
  });
  const data = await parseApiResponse(res);
  if (!res.ok) {
    const errorMessage = data.error || data.message || "Request failed";
    const err = new Error(errorMessage);
    err.status = res.status;
    throw err;
  }
  return data;
}
