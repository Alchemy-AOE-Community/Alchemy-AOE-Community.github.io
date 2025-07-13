function adjustSvgTextLengths() {
  const links = document.querySelectorAll('.pdf-link');
  links.forEach(link => {
    const texts = link.querySelectorAll('.hierarchy-text');
    const background = link.querySelector('.text-background');
    if (texts.length > 0 && background) {
      let nodeWidth;
      if (background.tagName === 'rect') {
        nodeWidth = parseFloat(background.getAttribute('width'));
      } else {
        const points = background.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
        const xs = points.map(p => p[0]);
        nodeWidth = Math.max(...xs) - Math.min(...xs);
      }
      let maxTextWidth = 0;
      texts.forEach(text => {
        const bbox = text.getBBox();
        maxTextWidth = Math.max(maxTextWidth, bbox.width);
      });
      if (maxTextWidth > nodeWidth - 0.5) { // padding
        texts.forEach(text => {
          text.setAttribute('textLength', nodeWidth - 0.5);
          text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
        });
      }
    }
  });
}