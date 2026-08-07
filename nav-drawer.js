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
