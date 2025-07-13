function logCsrmImageErrors() {
  const csrmImages = document.querySelectorAll('.hierarchy-svg image');
  csrmImages.forEach((img, index) => {
    img.addEventListener('error', () => {
      console.error(`Failed to load image for CSRM node ${index + 1}: ${img.getAttribute('href')}`);
    });
    img.addEventListener('load', () => {
      console.log(`Successfully loaded image for CSRM node ${index + 1}: ${img.getAttribute('href')}`);
    });
  });
}