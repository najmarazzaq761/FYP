const TAB_KEYS = ["prediction", "chatbot", "history"];

const state = {
  stream: null,
  mediaRecorder: null,
  chunks: [],
  recordedBlob: null,
  chart: null,
};

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

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function setPredictionStatus(payload, type = "default") {
  const target = document.getElementById("prediction-result");
  
  let label = "Update";
  let className = "status-default";
  let subMessage = "";
  let probText = "";

  if (typeof payload === "string") {
    subMessage = payload;
    const lower = payload.toLowerCase();
    if (type === "error") {
      label = "Attention";
      className = "status-error";
    } else {
      label = "Status";
      className = "status-default";
    }
  } else if (payload && payload.label) {
    label = payload.label;
    subMessage = "Analysis complete.";
    probText = ` • Prob: ${payload.probability.toFixed(2)}`;
    
    if (label === "Depressed") {
      className = "status-depressed";
    } else if (label === "Mild Depression") {
      className = "status-error"; // using error style to represent caution/mild
    } else {
      className = "status-normal";
    }
  }

  target.classList.remove("status-default", "status-normal", "status-depressed", "status-error");
  target.classList.add(className);
  target.innerHTML = `
    <p class="result-title">Prediction Result</p>
    <p class="result-main">${label}${probText}</p>
    <p class="result-sub">${subMessage}</p>
  `;
}

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
      document.getElementById("history-list").innerHTML = "<p>History feature is only available for registered users. <a href='register.html'>Register</a> or <a href='login.html'>Login</a> to track your progress.</p>";
      if (state.chart) {
        state.chart.destroy();
        state.chart = null;
      }
    } else {
      loadHistory();
    }
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
    setPredictionStatus("Camera ready. Click Start Recording when ready.");
  } catch (error) {
    setPredictionStatus(
      error.name === "NotAllowedError"
        ? "Camera permission denied. Allow access in browser settings."
        : "Unable to access camera. Please check device and permissions.",
      "error"
    );
  }
}

function startRecording() {
  if (!state.stream) return;
  const mimeType = getSupportedMimeType();
  if (!mimeType) return;

  state.chunks = [];
  state.recordedBlob = null;
  state.mediaRecorder = new MediaRecorder(state.stream, { mimeType });
  state.mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) state.chunks.push(event.data);
  };
  state.mediaRecorder.onstop = () => {
    state.recordedBlob = new Blob(state.chunks, { type: mimeType });
    document.getElementById("webcam-container").classList.add("hidden");
    
    // Show File Status Bar
    document.getElementById("file-status-bar").classList.remove("hidden");
    document.getElementById("selected-file-name").textContent = "recorded-video.webm";
    document.getElementById("selected-file-size").textContent = "Size: " + (state.recordedBlob.size / 1024 / 1024).toFixed(2) + " MB";
    
    // Ensure upload file is cleared
    document.getElementById("upload-video").value = "";
    
    setPredictionStatus("Recording complete. Click Analyze Video.");
  };
  state.mediaRecorder.start();
  document.getElementById("record-btn").classList.add("hidden");
  document.getElementById("stop-btn").classList.remove("hidden");
  setPredictionStatus("Recording in progress...");
}

function stopRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  }
  document.getElementById("stop-btn").classList.add("hidden");
  document.getElementById("start-camera-btn").classList.remove("hidden");
}

async function sendVideoForPrediction(videoData, sourceType, filename) {
  const button = document.getElementById("analyze-video-btn");
  document.getElementById("prediction-result").classList.remove("hidden");
  setButtonLoading(button, true, "Analyzing...");
  try {
    const formData = new FormData();
    formData.append("video", videoData, filename);
    formData.append("source_type", sourceType);
    const data = await apiRequest("/predict", {
      method: "POST",
      headers: authHeader(),
      body: formData,
    });
    setPredictionStatus({ label: data.result, probability: data.probability }, "success");
    showToast("Prediction complete", "success");
    await loadHistory();
  } catch (error) {
    if (error.status === 401 || error.status === 422) {
      clearToken();
      redirectToLoginWithNext();
      return;
    }
    setPredictionStatus(error.message, "error");
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}


function handleFileSelection(e) {
  const file = e.target.files[0];
  if (!file) return;
  state.recordedBlob = null; // Clear any recorded blob
  
  // Hide webcam if open
  document.getElementById("webcam-container").classList.add("hidden");
  document.getElementById("start-camera-btn").classList.remove("hidden");
  document.getElementById("record-btn").classList.add("hidden");
  document.getElementById("stop-btn").classList.add("hidden");
  
  // Show File Status Bar
  document.getElementById("file-status-bar").classList.remove("hidden");
  document.getElementById("selected-file-name").textContent = file.name;
  document.getElementById("selected-file-size").textContent = "Size: " + (file.size / 1024 / 1024).toFixed(2) + " MB";
  
  setPredictionStatus("Video selected. Click Analyze Video.");
}

async function analyzeActiveVideo() {
  const input = document.getElementById("upload-video");
  if (input.files.length > 0) {
    const file = input.files[0];
    await sendVideoForPrediction(file, "upload", file.name);
    return;
  }
  if (state.recordedBlob) {
    await sendVideoForPrediction(state.recordedBlob, "webcam", "recorded-video.webm");
    return;
  }
  setPredictionStatus("No video selected to analyze.", "error");
}


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
  const typing = document.getElementById("typing-indicator");
  if (typing) typing.remove();
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
      clearToken();
      redirectToLoginWithNext();
      return;
    }
    addChatMessage(error.message, "bot");
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

function drawChart(history) {
  const ctx = document.getElementById("history-chart");
  const labels = history.map((item) => new Date(item.created_at).toLocaleDateString());
  const values = history.map((item) => item.probability);
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Depression Probability",
          data: values,
          backgroundColor: "rgba(115, 83, 186, 0.7)",
          borderColor: "rgba(115, 83, 186, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, max: 1.0 },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const dataIndex = context.dataIndex;
              const lbl = history[dataIndex].result_label;
              return `${lbl} (Prob: ${context.parsed.y.toFixed(2)})`;
            }
          }
        }
      }
    },
  });
}

function renderHistoryList(history) {
  const list = document.getElementById("history-list");
  if (!history.length) {
    list.textContent = "No predictions available yet.";
    return;
  }
  list.innerHTML = history
    .map((item) => `${new Date(item.created_at).toLocaleString()} - ${item.result_label} (Prob: ${item.probability.toFixed(2)})`)
    .join("<br>");
}

async function loadHistory() {
  if (localStorage.getItem("guest_mode") === "true") return;
  try {
    const data = await apiRequest("/history", {
      method: "GET",
      headers: authHeader(),
    });
    drawChart(data.history || []);
    renderHistoryList(data.history || []);
  } catch (error) {
    if (error.status === 401 || error.status === 422) {
      clearToken();
      redirectToLoginWithNext();
      return;
    }
    document.getElementById("history-list").textContent = error.message;
  }
}

function bindDashboardEvents() {
  document.querySelectorAll(".nav-link-btn").forEach((btn) => {
    if (btn.dataset.tab) {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    }
  });

  window.addEventListener("hashchange", () => {
    switchTab(getActiveTabFromHash());
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    clearToken();
    localStorage.removeItem("guest_mode");
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
      state.stream = null;
    }
    window.location.href = "login.html";
  });

  document.getElementById("start-camera-btn").addEventListener("click", startCamera);
  document.getElementById("record-btn").addEventListener("click", startRecording);
  document.getElementById("stop-btn").addEventListener("click", stopRecording);
  document.getElementById("send-chat-btn").addEventListener("click", sendChatMessage);
  
  document.getElementById("trigger-upload-btn").addEventListener("click", () => document.getElementById("upload-video").click());
  document.getElementById("upload-video").addEventListener("change", handleFileSelection);
  document.getElementById("analyze-video-btn").addEventListener("click", analyzeActiveVideo);

  switchTab(getActiveTabFromHash());
}

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
