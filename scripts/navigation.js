function addNavigationArrows() {
    const headerContent = document.querySelector('.header-content');
    const prevSeason = seasonNumber - 1;
    const nextSeason = seasonNumber + 1;
    const prevUrl = `ALS${prevSeason}.html`;
    const nextUrl = `ALS${nextSeason}.html`;

    // Check for previous season
    fetch(prevUrl, { method: 'HEAD' })
        .then(response => {
            if (response.ok) {
                const backArrow = document.createElement('a');
                backArrow.href = prevUrl;
                backArrow.classList.add('navigation-arrow');
                const img = document.createElement('img');
                img.src = 'images/Left_Arrow.jpg';
                img.alt = 'Previous Season';
                backArrow.appendChild(img);
                headerContent.insertBefore(backArrow, headerContent.firstChild); // Insert left of h1
            }
        })
        .catch(() => { /* Silent fail if not found */ });

    // Check for next season
    fetch(nextUrl, { method: 'HEAD' })
        .then(response => {
            if (response.ok) {
                const forwardArrow = document.createElement('a');
                forwardArrow.href = nextUrl;
                forwardArrow.classList.add('navigation-arrow');
                const img = document.createElement('img');
                img.src = 'images/Right_Arrow.jpg';
                img.alt = 'Next Season';
                forwardArrow.appendChild(img);
                headerContent.appendChild(forwardArrow); // Insert right of h1
            }
        })
        .catch(() => { /* Silent fail if not found */ });
}

window.addEventListener('load', addNavigationArrows);