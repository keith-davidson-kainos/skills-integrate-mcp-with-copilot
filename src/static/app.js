document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const signupLockedMessage = document.getElementById("signup-locked-message");
  const messageDiv = document.getElementById("message");
  const userMenuButton = document.getElementById("user-menu-button");
  const authPanel = document.getElementById("auth-panel");
  const authStatus = document.getElementById("auth-status");
  const openLoginButton = document.getElementById("open-login-button");
  const logoutButton = document.getElementById("logout-button");
  const loginModal = document.getElementById("login-modal");
  const cancelLoginButton = document.getElementById("cancel-login-button");
  const loginForm = document.getElementById("login-form");
  const teacherUsernameInput = document.getElementById("teacher-username");
  const teacherPasswordInput = document.getElementById("teacher-password");

  const TOKEN_KEY = "teacherAuthToken";
  const USERNAME_KEY = "teacherUsername";
  let authToken = localStorage.getItem(TOKEN_KEY);
  let teacherUsername = localStorage.getItem(USERNAME_KEY);

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUi() {
    const isTeacher = Boolean(authToken && teacherUsername);

    if (isTeacher) {
      authStatus.textContent = `Teacher: ${teacherUsername}`;
      openLoginButton.classList.add("hidden");
      logoutButton.classList.remove("hidden");
      signupForm.classList.remove("hidden");
      signupLockedMessage.classList.add("hidden");
      signupContainer.classList.remove("locked");
    } else {
      authStatus.textContent = "Student mode";
      openLoginButton.classList.remove("hidden");
      logoutButton.classList.add("hidden");
      signupForm.classList.add("hidden");
      signupLockedMessage.classList.remove("hidden");
      signupContainer.classList.add("locked");
    }
  }

  async function verifySession() {
    if (!authToken) {
      teacherUsername = null;
      localStorage.removeItem(USERNAME_KEY);
      updateAuthUi();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Session expired");
      }

      const data = await response.json();
      teacherUsername = data.username;
      localStorage.setItem(USERNAME_KEY, teacherUsername);
    } catch (error) {
      authToken = null;
      teacherUsername = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USERNAME_KEY);
    }

    updateAuthUi();
    fetchActivities();
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li>
                        <span class="participant-email">${email}</span>
                        ${
                          authToken
                            ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                            : ""
                        }
                      </li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    if (!authToken) {
      showMessage("Only logged-in teachers can unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        if (response.status === 401) {
          authToken = null;
          teacherUsername = null;
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USERNAME_KEY);
          updateAuthUi();
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authToken) {
      showMessage("Only logged-in teachers can register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        if (response.status === 401) {
          authToken = null;
          teacherUsername = null;
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USERNAME_KEY);
          updateAuthUi();
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userMenuButton.addEventListener("click", () => {
    authPanel.classList.toggle("hidden");
  });

  openLoginButton.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    authPanel.classList.add("hidden");
    teacherUsernameInput.focus();
  });

  cancelLoginButton.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: teacherUsernameInput.value,
          password: teacherPasswordInput.value,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      authToken = result.token;
      teacherUsername = result.username;
      localStorage.setItem(TOKEN_KEY, authToken);
      localStorage.setItem(USERNAME_KEY, teacherUsername);

      // Immediately hide the modal before any other updates
      loginModal.classList.add("hidden");
      loginModal.style.display = "none";
      loginForm.reset();
      
      showMessage(`Logged in as ${teacherUsername}`, "success");
      updateAuthUi();
      fetchActivities();
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    if (!authToken) {
      return;
    }

    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }

    authToken = null;
    teacherUsername = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    authPanel.classList.add("hidden");
    showMessage("Logged out", "info");
    updateAuthUi();
    fetchActivities();
  });

  window.addEventListener("click", (event) => {
    if (
      !authPanel.classList.contains("hidden") &&
      !authPanel.contains(event.target) &&
      event.target !== userMenuButton
    ) {
      authPanel.classList.add("hidden");
    }

    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
      loginForm.reset();
    }
  });

  updateAuthUi();
  verifySession();
  fetchActivities();
});
