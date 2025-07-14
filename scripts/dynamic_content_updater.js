function updateDynamicContent() {
    // Update page title
    document.title = `Season ${seasonNumber} -- Alchemy League`;

    // Update header h1
    const headerH1 = document.querySelector('header h1');
    if (headerH1) {
        headerH1.textContent = `ALCHEMY LEAGUE SEASON ${seasonNumber}`;
    }

    // Update banner image src
    const bannerImg = document.querySelector('[aria-label="Season Banner"] img');
    if (bannerImg) {
        bannerImg.src = `images/ALS${seasonNumber}_Banner.jpg`;
    }

    // Update all relevant links (reference-links and resource-link class in buttons-container)
    const links = document.querySelectorAll('.reference-links a, .resource-link');
    links.forEach(link => {
        if (link.classList.contains('resource-link')) {
            const sprint = link.dataset.sprint;
            const file = link.dataset.file;
            link.href = `https://raw.githubusercontent.com/Alchemy-AOE-Community/Alchemy-AOE-Community.github.io/main/ALS${seasonNumber}_Resources/${sprint}/${file}`;
            link.target = '_blank';
        } else if (link.href.includes('ALS')) {
            link.href = link.href.replace(/ALS\d+_Resources/g, `ALS${seasonNumber}_Resources`);
        }
    });
}