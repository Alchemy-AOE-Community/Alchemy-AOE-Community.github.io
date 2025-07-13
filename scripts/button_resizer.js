function resizeButtons() {
  const containers = document.querySelectorAll('.buttons-container, .reference-links');
  containers.forEach(container => {
    const buttons = container.querySelectorAll('a');
    let maxWidth = 0;
    let maxHeight = 0;
    let isReference = container.classList.contains('reference-links');
    if (isReference) {
      buttons.forEach(button => {
        button.style.whiteSpace = 'nowrap';
      });
    }
    buttons.forEach(button => {
      button.style.width = 'auto';
      button.style.height = 'auto';
      const width = button.offsetWidth;
      if (width > maxWidth) maxWidth = width;
    });
    let finalWidth = maxWidth;
    if (isReference) {
      finalWidth = maxWidth / 2;
      buttons.forEach(button => {
        button.style.whiteSpace = 'normal';
        button.style.width = `${finalWidth}px`;
      });
      buttons.forEach(button => {
        const height = button.offsetHeight;
        if (height > maxHeight) maxHeight = height;
      });
      buttons.forEach(button => {
        button.style.height = `${maxHeight}px`;
      });
    } else {
      buttons.forEach(button => {
        button.style.width = `${finalWidth}px`;
      });
    }
  });
}