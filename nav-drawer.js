document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector(".nav");
  const navSide = nav ? nav.querySelector(".nav_side") : null;

  if (!nav || !navSide) {
    return;
  }

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "nav_toggle";
  toggleBtn.type = "button";
  toggleBtn.setAttribute("aria-label", "Toggle menu");
  toggleBtn.setAttribute("aria-expanded", "false");
  toggleBtn.innerHTML = "<span></span><span></span><span></span>";

  const overlay = document.createElement("div");
  overlay.className = "nav_overlay";
  overlay.setAttribute("aria-hidden", "true");

  nav.insertBefore(toggleBtn, navSide);
  document.body.appendChild(overlay);

  // Light/dark theme toggle - persisted in localStorage, defaults to dark.
  const THEME_KEY = "omwi-theme";
  const themeToggle = document.createElement("button");
  themeToggle.type = "button";
  themeToggle.className = "theme_toggle";
  themeToggle.setAttribute("aria-label", "Toggle light/dark theme");

  const applyThemeIcon = (theme) => {
    themeToggle.textContent =
      theme === "light" ? "\u{1F319}" : "\u{2600}\uFE0F";
    themeToggle.setAttribute("aria-pressed", String(theme === "light"));
  };

  const getCurrentTheme = () =>
    document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark";

  applyThemeIcon(getCurrentTheme());
  navSide.appendChild(themeToggle);

  themeToggle.addEventListener("click", () => {
    const nextTheme = getCurrentTheme() === "light" ? "dark" : "light";
    if (nextTheme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch (error) {
      /* localStorage unavailable (e.g. private browsing) - theme just won't persist */
    }
    applyThemeIcon(nextTheme);
  });

  const setOpen = (isOpen) => {
    document.body.classList.toggle("drawer-open", isOpen);
    toggleBtn.setAttribute("aria-expanded", String(isOpen));
  };

  const closeDrawer = () => setOpen(false);
  const toggleDrawer = () => {
    const isOpen = document.body.classList.contains("drawer-open");
    setOpen(!isOpen);
  };

  toggleBtn.addEventListener("click", toggleDrawer);
  overlay.addEventListener("click", closeDrawer);

  navSide.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeDrawer);
  });

  const dropdowns = Array.from(navSide.querySelectorAll(".nav_dropdown"));

  const closeDropdown = (dropdown) => {
    dropdown.classList.remove("open");
    const toggle = dropdown.querySelector(".nav_dropdown_toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }
  };

  const closeAllDropdowns = () => dropdowns.forEach(closeDropdown);

  dropdowns.forEach((dropdown) => {
    const toggle = dropdown.querySelector(".nav_dropdown_toggle");
    if (!toggle) {
      return;
    }

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = dropdown.classList.contains("open");
      closeAllDropdowns();
      if (!isOpen) {
        dropdown.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });
  });

  document.addEventListener("click", (event) => {
    dropdowns.forEach((dropdown) => {
      if (!dropdown.contains(event.target)) {
        closeDropdown(dropdown);
      }
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDrawer();
      closeAllDropdowns();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 980) {
      closeDrawer();
    }
    closeAllDropdowns();
  });
});
