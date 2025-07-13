function adjustBottomRowHeight() {
  const bottomRow = document.querySelector('.bottom-row');
  const tabs = document.querySelector('.tabs');
  const content1 = document.getElementById('sprint1');
  const content2 = document.getElementById('sprint2');
  if (bottomRow && tabs && content1 && content2) {
    const maxContentHeight = Math.max(content1.offsetHeight, content2.offsetHeight);
    const totalHeight = tabs.offsetHeight + maxContentHeight + 20;
    bottomRow.style.height = `${totalHeight}px`;
  }
}

function adjustDefinitionsHeight() {
  const definitions = document.querySelector('.nav-group.definitions');
  const reference = document.querySelector('.nav-group.reference-links');
  const box1 = document.querySelector('.nav-group.box1');
  if (definitions && reference && box1) {
    const defHeight = definitions.offsetHeight;
    const refHeight = reference.offsetHeight;
    const padding = 20; // bit of padding
    const targetHeight = defHeight - refHeight - padding;
    box1.style.height = `${targetHeight}px`;
  }
}