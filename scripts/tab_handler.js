function initializeTabs(defaultTab = 'sprint1') {
  const activeTab = localStorage.getItem('activeTab') || defaultTab;

  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  const activeButton = document.querySelector(`.tab-button[data-tab="${activeTab}"]`);
  if (activeButton) activeButton.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  const activeContent = document.querySelector(`#${activeTab}`);
  if (activeContent) activeContent.classList.add('active');

  resizeButtons();

  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      document.querySelector(`#${button.dataset.tab}`).classList.add('active');
      localStorage.setItem('activeTab', button.dataset.tab);
      resizeButtons();
      adjustBottomRowHeight();
    });
  });
}