const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const year = document.querySelector("#year");
const comingSoonButtons = document.querySelectorAll("[data-coming-soon-button]");

if (year) {
  year.textContent = new Date().getFullYear();
}

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isExpanded = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isExpanded));
    siteNav.classList.toggle("is-open", !isExpanded);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navToggle.setAttribute("aria-expanded", "false");
      siteNav.classList.remove("is-open");
    });
  });
}

comingSoonButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const note = button.parentElement?.querySelector(".coming-soon-note");

    if (!note) {
      return;
    }

    note.textContent =
      "\uacf5\uac1c\uc608\uc815\uc785\ub2c8\ub2e4. (Coming soon.)";
    note.classList.add("is-visible");

    clearTimeout(button._comingSoonTimeout);
    button._comingSoonTimeout = setTimeout(() => {
      note.classList.remove("is-visible");
      note.textContent = "";
    }, 2200);
  });
});
