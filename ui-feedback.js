(() => {
  const state = {
    loadingCount: 0,
    overlay: null,
    loadingText: null,
    toastStack: null,
  };

  const ensureUi = () => {
    if (!state.overlay) {
      const overlay = document.createElement("div");
      overlay.className = "ui-loading-overlay";
      overlay.innerHTML = `
                <div class="ui-loading-card" role="status" aria-live="polite">
                    <div class="ui-loading-spinner"></div>
                    <div class="ui-loading-text">Please wait...</div>
                </div>
            `;
      document.body.appendChild(overlay);
      state.overlay = overlay;
      state.loadingText = overlay.querySelector(".ui-loading-text");
    }

    if (!state.toastStack) {
      const toastStack = document.createElement("div");
      toastStack.className = "ui-toast-stack";
      document.body.appendChild(toastStack);
      state.toastStack = toastStack;
    }
  };

  const showLoading = (message = "Please wait...") => {
    ensureUi();
    state.loadingCount += 1;
    state.loadingText.textContent = message;
    state.overlay.classList.add("visible");
  };

  const hideLoading = () => {
    if (!state.overlay) {
      return;
    }

    state.loadingCount = Math.max(0, state.loadingCount - 1);
    if (state.loadingCount === 0) {
      state.overlay.classList.remove("visible");
    }
  };

  const showToast = (message, type = "success") => {
    ensureUi();
    const toast = document.createElement("div");
    toast.className = `ui-toast ${type}`;
    toast.innerHTML = `
            <div class="ui-toast-icon">${type === "success" ? "✓" : "!"}</div>
            <div class="ui-toast-message">${message}</div>
        `;

    state.toastStack.appendChild(toast);
    window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-6px)";
      window.setTimeout(() => toast.remove(), 180);
    }, 2800);
  };

  window.AppFeedback = {
    showLoading,
    hideLoading,
    showSuccess(message) {
      showToast(message, "success");
    },
    showError(message) {
      showToast(message, "error");
    },
  };
})();
