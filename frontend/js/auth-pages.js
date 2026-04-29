async function onLoginSubmit(event) {
  event.preventDefault();
  const button = document.getElementById("login-btn");
  setButtonLoading(button, true, "Signing In...");
  try {
    const payload = {
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value,
    };
    const data = await apiRequest("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setToken(data.token);
    showToast("Login successful", "success");
    window.location.href = getPostAuthRedirect();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

async function onRegisterSubmit(event) {
  event.preventDefault();
  const button = document.getElementById("register-btn");
  setButtonLoading(button, true, "Creating Account...");
  try {
    const payload = {
      username: document.getElementById("username").value.trim(),
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value,
    };
    const data = await apiRequest("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setToken(data.token);
    showToast("Account created successfully", "success");
    window.location.href = getPostAuthRedirect();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

async function initAuthPages() {
  const sessionValid = await validateSession();
  if (sessionValid) {
    window.location.href = "dashboard.html";
    return;
  }
  const page = document.body.dataset.page;
  if (page === "login") {
    document.getElementById("login-form").addEventListener("submit", onLoginSubmit);
  }
  if (page === "register") {
    document.getElementById("register-form").addEventListener("submit", onRegisterSubmit);
  }
}

initAuthPages();
