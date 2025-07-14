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
        const padding = 20;
        const viewportHeight = window.innerHeight;
        const minTarget = Math.max(200, viewportHeight * 0.35); // Increased to 35% for better gap on 1080px
        const targetHeight = Math.max(minTarget, defHeight - refHeight - padding);
        box1.style.height = `${targetHeight}px`;
    }
}

// Debounce for resize
function debounce(func, delay) {
    let timeout;
    return function() {
        clearTimeout(timeout);
        timeout = setTimeout(func, delay);
    };
}

const debouncedAdjust = debounce(adjustDefinitionsHeight, 250);
window.addEventListener('resize', debouncedAdjust);
window.addEventListener('load', adjustDefinitionsHeight); // Run after full load (images/SVG)