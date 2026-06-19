// ═══════════════════════════════════════════════════════════
//  D-Mind Dashboard — Text + Video Prediction, Chat, History
// ═══════════════════════════════════════════════════════════

const TAB_KEYS = ["prediction", "chatbot", "history"];

const state = {
  // Video recording
  stream: null,
  mediaRecorder: null,
  chunks: [],
  recordedBlob: null,
  // Chart
  chart: null,
  // Current prediction sub-tab: "text" | "video"
  predSubtab: "text",
};

// ─── Auth helpers ──────────────────────────────────────────
async function requireAuth() {
  const isGuest = localStorage.getItem("guest_mode") === "true";
  if (isGuest) return true;
  const sessionValid = await validateSession();
  if (!sessionValid) {
    redirectToLoginWithNext();
    return false;
  }
  return true;
}

function getActiveTabFromHash() {
  const raw = (window.location.hash || "").replace("#", "");
  return TAB_KEYS.includes(raw) ? raw : "prediction";
}

// ─── Prediction result renderer ───────────────────────────
function setPredictionStatus(resultBoxId, payload, type = "default") {
  const target = document.getElementById(resultBoxId);
  if (!target) return;

  let label = "Update";
  let className = "status-default";
  let subMessage = "";
  let probText = "";

  if (typeof payload === "string") {
    subMessage = payload;
    label = type === "error" ? "Attention" : "Status";
    className = type === "error" ? "status-error" : "status-default";
  } else if (payload && payload.label) {
    label = payload.label;
    subMessage = "Analysis complete.";
    probText = ` • Prob: ${payload.probability.toFixed(2)}`;

    if (label === "Depressed" || label === "Depression") {
      className = "status-depressed";
    } else if (label === "Anxiety") {
      className = "status-anxiety";
    } else if (label === "Suicidal") {
      className = "status-suicidal";
    } else if (label === "Normal") {
      className = "status-normal";
    } else {
      className = "status-default";
    }
  }

  target.classList.remove(
    "status-default", "status-normal", "status-depressed",
    "status-error", "status-anxiety", "status-suicidal"
  );
  target.classList.add(className);
  target.innerHTML = `
    <p class="result-title">Prediction Result</p>
    <p class="result-main">${label}${probText}</p>
    <p class="result-sub">${subMessage}</p>
  `;
}

// ─── Prediction sub-tab switcher ──────────────────────────
function switchPredSubtab(subtab) {
  state.predSubtab = subtab;

  document.getElementById("subtab-text").classList.toggle("hidden", subtab !== "text");
  document.getElementById("subtab-video").classList.toggle("hidden", subtab !== "video");

  document.querySelectorAll(".pred-subtab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.subtab === subtab);
  });

  // Stop camera if switching away from video
  if (subtab === "text" && state.stream) {
    stopStream();
  }
}

// ─── Main tab switcher ────────────────────────────────────
function switchTab(tab) {
  const selectedTab = TAB_KEYS.includes(tab) ? tab : "prediction";
  const map = {
    prediction: document.getElementById("prediction-section"),
    chatbot: document.getElementById("chatbot-section"),
    history: document.getElementById("history-section"),
  };
  Object.entries(map).forEach(([key, section]) => {
    section.classList.toggle("hidden", key !== selectedTab);
    if (key === selectedTab) {
      section.classList.remove("tab-enter");
      void section.offsetWidth;
      section.classList.add("tab-enter");
    }
  });

  document.querySelectorAll(".nav-link-btn").forEach((btn) => {
    if (btn.dataset.tab) {
      btn.classList.toggle("active", btn.dataset.tab === selectedTab);
    }
  });

  if (window.location.hash !== `#${selectedTab}`) {
    window.location.hash = selectedTab;
  }

  if (selectedTab === "history") {
    if (localStorage.getItem("guest_mode") === "true") {
      document.getElementById("history-list").innerHTML =
        "<p>History is only available for registered users. <a href='register.html'>Register</a> or <a href='login.html'>Login</a> to track your progress.</p>";
      if (state.chart) { state.chart.destroy(); state.chart = null; }
    } else {
      loadHistory();
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  TEXT PREDICTION
// ═══════════════════════════════════════════════════════════
async function analyzeText() {
  const textarea = document.getElementById("feelings-text");
  const button = document.getElementById("analyze-text-btn");
  const resultBox = document.getElementById("text-prediction-result");
  const textVal = textarea.value.trim();

  if (!textVal) {
    setPredictionStatus("text-prediction-result", "Please write down how you are feeling before analyzing.", "error");
    resultBox.classList.remove("hidden");
    return;
  }

  resultBox.classList.remove("hidden");
  setPredictionStatus("text-prediction-result", "Analyzing your text... Please wait.");
  setButtonLoading(button, true, "Analyzing...");

  try {
    const data = await apiRequest("/predict/text", {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ text: textVal }),
    });

    setPredictionStatus("text-prediction-result", { label: data.result, probability: data.probability }, "success");
    showToast("Text analysis complete", "success");

    if (localStorage.getItem("guest_mode") !== "true") {
      await loadHistory();
    }
  } catch (error) {
    if (error.status === 401 || error.status === 422) {
      clearToken(); redirectToLoginWithNext(); return;
    }
    setPredictionStatus("text-prediction-result", error.message, "error");
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

// ═══════════════════════════════════════════════════════════
//  VIDEO PREDICTION
// ═══════════════════════════════════════════════════════════
function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function stopStream() {
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
}

async function startCamera() {
  try {
    if (!state.stream) {
      state.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    }
    document.getElementById("webcam-preview").srcObject = state.stream;
    document.getElementById("webcam-container").classList.remove("hidden");
    document.getElementById("start-camera-btn").classList.add("hidden");
    document.getElementById("record-btn").classList.remove("hidden");
    setPredictionStatus("video-prediction-result", "Camera ready. Click Start Recording when ready.");
    document.getElementById("video-prediction-result").classList.remove("hidden");
  } catch (error) {
    setPredictionStatus(
      "video-prediction-result",
      error.name === "NotAllowedError"
        ? "Camera permission denied. Allow access in browser settings."
        : "Unable to access camera. Please check device and permissions.",
      "error"
    );
    document.getElementById("video-prediction-result").classList.remove("hidden");
  }
}

function startRecording() {
  if (!state.stream) return;
  const mimeType = getSupportedMimeType();
  if (!mimeType) return;

  state.chunks = [];
  state.recordedBlob = null;
  state.mediaRecorder = new MediaRecorder(state.stream, { mimeType });
  state.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) state.chunks.push(e.data); };
  state.mediaRecorder.onstop = () => {
    state.recordedBlob = new Blob(state.chunks, { type: mimeType });
    document.getElementById("webcam-container").classList.add("hidden");
    document.getElementById("file-status-bar").classList.remove("hidden");
    document.getElementById("selected-file-name").textContent = "recorded-video.webm";
    document.getElementById("selected-file-size").textContent =
      "Size: " + (state.recordedBlob.size / 1024 / 1024).toFixed(2) + " MB";
    document.getElementById("upload-video").value = "";
    setPredictionStatus("video-prediction-result", "Recording complete. Click Analyze Video.");
  };
  state.mediaRecorder.start();
  document.getElementById("record-btn").classList.add("hidden");
  document.getElementById("stop-btn").classList.remove("hidden");
  setPredictionStatus("video-prediction-result", "Recording in progress...");
  document.getElementById("video-prediction-result").classList.remove("hidden");
}

function stopRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  }
  document.getElementById("stop-btn").classList.add("hidden");
  document.getElementById("start-camera-btn").classList.remove("hidden");
}

function handleFileSelection(e) {
  const file = e.target.files[0];
  if (!file) return;
  state.recordedBlob = null;

  document.getElementById("webcam-container").classList.add("hidden");
  document.getElementById("start-camera-btn").classList.remove("hidden");
  document.getElementById("record-btn").classList.add("hidden");
  document.getElementById("stop-btn").classList.add("hidden");

  document.getElementById("file-status-bar").classList.remove("hidden");
  document.getElementById("selected-file-name").textContent = file.name;
  document.getElementById("selected-file-size").textContent =
    "Size: " + (file.size / 1024 / 1024).toFixed(2) + " MB";

  setPredictionStatus("video-prediction-result", "Video selected. Click Analyze Video.");
  document.getElementById("video-prediction-result").classList.remove("hidden");
}

async function sendVideoForPrediction(videoData, sourceType, filename) {
  const button = document.getElementById("analyze-video-btn");
  document.getElementById("video-prediction-result").classList.remove("hidden");
  setButtonLoading(button, true, "Analyzing...");

  try {
    const formData = new FormData();
    formData.append("video", videoData, filename);
    formData.append("source_type", sourceType);
    formData.append("gender", document.getElementById("gender-select").value);

    const data = await apiRequest("/predict/video", {
      method: "POST",
      headers: authHeader(),
      body: formData,
    });

    setPredictionStatus("video-prediction-result", { label: data.result, probability: data.probability }, "success");
    showToast("Video analysis complete", "success");

    if (localStorage.getItem("guest_mode") !== "true") {
      await loadHistory();
    }
  } catch (error) {
    if (error.status === 401 || error.status === 422) {
      clearToken(); redirectToLoginWithNext(); return;
    }
    setPredictionStatus("video-prediction-result", error.message, "error");
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

async function analyzeActiveVideo() {
  const input = document.getElementById("upload-video");
  if (input.files.length > 0) {
    await sendVideoForPrediction(input.files[0], "upload", input.files[0].name);
    return;
  }
  if (state.recordedBlob) {
    await sendVideoForPrediction(state.recordedBlob, "webcam", "recorded-video.webm");
    return;
  }
  setPredictionStatus("video-prediction-result", "No video selected to analyze.", "error");
  document.getElementById("video-prediction-result").classList.remove("hidden");
}

// ═══════════════════════════════════════════════════════════
//  CHATBOT
// ═══════════════════════════════════════════════════════════
function addChatMessage(content, sender) {
  const win = document.getElementById("chat-window");
  const message = document.createElement("div");
  message.className = `message ${sender}`;
  const htmlContent = typeof marked !== "undefined" ? marked.parse(content) : `<p>${content}</p>`;
  message.innerHTML = `
    <div class="msg-content">${htmlContent}</div>
    <span class="msg-time">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
  `;
  win.appendChild(message);
  win.scrollTop = win.scrollHeight;
}

function addTypingIndicator() {
  const win = document.getElementById("chat-window");
  const typing = document.createElement("div");
  typing.id = "typing-indicator";
  typing.className = "message bot typing";
  typing.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
  win.appendChild(typing);
  win.scrollTop = win.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById("typing-indicator");
  if (el) el.remove();
}

async function sendChatMessage() {
  const input = document.getElementById("chat-input");
  const button = document.getElementById("send-chat-btn");
  const text = input.value.trim();
  if (!text) return;

  addChatMessage(text, "user");
  input.value = "";
  setButtonLoading(button, true, "Sending...");
  addTypingIndicator();

  try {
    const data = await apiRequest("/chat", {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    removeTypingIndicator();
    addChatMessage(data.reply, "bot");
  } catch (error) {
    removeTypingIndicator();
    if (error.status === 401 || error.status === 422) {
      clearToken(); redirectToLoginWithNext(); return;
    }
    addChatMessage(error.message, "bot");
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

// ═══════════════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════════════
function drawChart(history) {
  const ctx = document.getElementById("history-chart");
  const labels = history.map((item) => new Date(item.created_at).toLocaleDateString());
  const values = history.map((item) => item.probability);

  const colorMap = {
    Normal:     "rgba(45, 226, 183, 0.7)",
    Anxiety:    "rgba(255, 180, 50, 0.7)",
    Depression: "rgba(255, 107, 154, 0.7)",
    Depressed:  "rgba(255, 107, 154, 0.7)",
    Suicidal:   "rgba(255, 30, 80, 0.7)",
  };
  const borderMap = {
    Normal:     "rgba(45, 226, 183, 1)",
    Anxiety:    "rgba(255, 180, 50, 1)",
    Depression: "rgba(255, 107, 154, 1)",
    Depressed:  "rgba(255, 107, 154, 1)",
    Suicidal:   "rgba(255, 30, 80, 1)",
  };

  const backgroundColors = history.map((i) => colorMap[i.result_label] || "rgba(115, 83, 186, 0.7)");
  const borderColors     = history.map((i) => borderMap[i.result_label] || "rgba(115, 83, 186, 1)");

  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Prediction Confidence Score",
        data: values,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, max: 1.0 } },
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const lbl = history[context.dataIndex].result_label;
              return `${lbl} (Prob: ${context.parsed.y.toFixed(2)})`;
            },
          },
        },
      },
    },
  });
}

function renderHistoryList(history) {
  const list = document.getElementById("history-list");
  if (!history.length) { list.textContent = "No predictions available yet."; return; }
  list.innerHTML = history
    .map((item) =>
      `${new Date(item.created_at).toLocaleString()} — <strong>${item.result_label}</strong> (Prob: ${item.probability.toFixed(2)}) <em style="color:var(--muted);font-size:0.82rem;">[${item.source_type}]</em>`
    )
    .join("<br>");
}

async function loadHistory() {
  if (localStorage.getItem("guest_mode") === "true") return;
  try {
    const data = await apiRequest("/history", { method: "GET", headers: authHeader() });
    drawChart(data.history || []);
    renderHistoryList(data.history || []);
  } catch (error) {
    if (error.status === 401 || error.status === 422) {
      clearToken(); redirectToLoginWithNext(); return;
    }
    document.getElementById("history-list").textContent = error.message;
  }
}

// ═══════════════════════════════════════════════════════════
//  EVENT BINDINGS
// ═══════════════════════════════════════════════════════════
function bindDashboardEvents() {
  // Main nav tabs
  document.querySelectorAll(".nav-link-btn").forEach((btn) => {
    if (btn.dataset.tab) btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  window.addEventListener("hashchange", () => switchTab(getActiveTabFromHash()));

  document.getElementById("logout-btn").addEventListener("click", () => {
    clearToken();
    localStorage.removeItem("guest_mode");
    stopStream();
    window.location.href = "login.html";
  });

  // Prediction sub-tabs
  document.getElementById("subtab-text-btn").addEventListener("click", () => switchPredSubtab("text"));
  document.getElementById("subtab-video-btn").addEventListener("click", () => switchPredSubtab("video"));

  // Text prediction
  document.getElementById("analyze-text-btn").addEventListener("click", analyzeText);
  const textarea = document.getElementById("feelings-text");
  const charCounter = document.getElementById("char-counter");
  if (textarea && charCounter) {
    textarea.addEventListener("input", () => {
      charCounter.textContent = `${textarea.value.length} characters`;
    });
  }

  // Video prediction
  document.getElementById("start-camera-btn").addEventListener("click", startCamera);
  document.getElementById("record-btn").addEventListener("click", startRecording);
  document.getElementById("stop-btn").addEventListener("click", stopRecording);
  document.getElementById("trigger-upload-btn").addEventListener("click", () =>
    document.getElementById("upload-video").click()
  );
  document.getElementById("upload-video").addEventListener("change", handleFileSelection);
  document.getElementById("analyze-video-btn").addEventListener("click", analyzeActiveVideo);

  // Chat
  document.getElementById("send-chat-btn").addEventListener("click", sendChatMessage);
  document.getElementById("chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });

  switchTab(getActiveTabFromHash());
}

// ─── Boot ─────────────────────────────────────────────────
async function initDashboard() {
  const allowed = await requireAuth();
  if (!allowed) return;
  renderNavbar("prediction");
  bindDashboardEvents();
  if (localStorage.getItem("guest_mode") !== "true") {
    loadHistory();
  }
}

initDashboard();
