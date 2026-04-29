function ensureToastWrap() {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  return wrap;
}

function showToast(message, type = "success") {
  const wrap = ensureToastWrap();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  wrap.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3000);
}

function setButtonLoading(button, isLoading, loadingText = "Please wait...") {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    return;
  }
  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

function renderNavbar(activeTab = "prediction") {
  const root = document.getElementById("navbar-root");
  if (!root) return;
  root.innerHTML = `
    <div class="top-navbar-container">
      <div class="navbar-brand" id="nav-brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
          <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
          <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
          <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
          <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
          <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
          <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
          <path d="M6 18a4 4 0 0 1-1.967-.516"/>
          <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
        </svg>
        <span>D-Mind</span>
      </div>
      <div class="nav-links">
        <button class="nav-link-btn" id="nav-dashboard">Dashboard</button>
        <button class="nav-link-btn ${activeTab === "prediction" ? "active" : ""}" data-tab="prediction">Prediction</button>
        <button class="nav-link-btn ${activeTab === "chatbot" ? "active" : ""}" data-tab="chatbot">Chatbot</button>
        <button class="nav-link-btn ${activeTab === "history" ? "active" : ""}" data-tab="history">History</button>
      </div>
      <div class="profile-dropdown">
        <button class="profile-icon-btn" id="profile-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </button>
        <div class="dropdown-menu hidden" id="profile-menu">
          <button class="nav-logout" id="logout-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Logout
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("nav-dashboard").addEventListener("click", () => {
    window.location.href = "index.html";
  });

  const navBrand = document.getElementById("nav-brand");
  if (navBrand) {
    navBrand.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  const profileIcon = document.getElementById("profile-icon");
  const profileMenu = document.getElementById("profile-menu");
  if (profileIcon && profileMenu) {
    profileIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (!profileIcon.contains(e.target) && !profileMenu.contains(e.target)) {
        profileMenu.classList.add("hidden");
      }
    });
  }
}
