document.addEventListener("DOMContentLoaded", function() {
  const buttons = document.querySelectorAll(".tab-button");

  function activateTab(group, tabId) {
    // Deactivate only this group
    document.querySelectorAll(`.tab-button[data-group="${group}"]`)
      .forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(`.tab-pane[data-group="${group}"]`)
      .forEach(pane => pane.classList.remove("active"));

    // Activate clicked
    const btn = document.querySelector(`.tab-button[data-group="${group}"][data-tab="${tabId}"]`);
    const pane = document.querySelector(`.tab-pane[data-group="${group}"]#${tabId}`);
    if (btn && pane) {
      btn.classList.add("active");
      pane.classList.add("active");
    }
  }

  // Add event listeners
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      activateTab(btn.dataset.group, btn.dataset.tab);
    });
  });

  // Initialize each group
  const groups = [...new Set(Array.from(buttons).map(btn => btn.dataset.group))];
  groups.forEach(group => {
    const first = document.querySelector(`.tab-button[data-group="${group}"]`);
    if (first) activateTab(group, first.dataset.tab);
  });
});