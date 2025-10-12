function initDefinitions(season) {
  fetch(`/resources/${season}/definitions-hierarchy.svg`)
    .then(res => res.text())
    .then(async svgText => {
      const container = document.getElementById("definitions-container");
      container.innerHTML = svgText;

      const svgRoot = container.querySelector("svg");
      if (!svgRoot) return;

      const SVG_NS = "http://www.w3.org/2000/svg";
      const XLINK_NS = "http://www.w3.org/1999/xlink";
      const placed = [];

      const mapImages = await getMapImages(season);

      svgRoot.querySelectorAll("path[inkscape\\:label]").forEach(path => {
        const fullLabel = path.getAttribute("inkscape:label") || "";
        const prefix = fullLabel.split("-")[0] || fullLabel;

        // compute local bbox immediately (local coords)
        const bbox = localBBox(path);

        // choose how big and where inside the rect the icon should go
        const localImgX = bbox.x + bbox.width / 4;
        const localImgY = bbox.y + bbox.height / 4;
        const localImgW = bbox.width / 2;
        const localImgH = bbox.height / 2;

        // create anchor + image + title
        const link = document.createElementNS(SVG_NS, "a");
        link.setAttributeNS(XLINK_NS, "href", getImageLink(fullLabel));

        const img = document.createElementNS(SVG_NS, "image");
        // set local coordinates (these are in the same coordinate system as the path)
        img.setAttribute("x", String(localImgX));
        img.setAttribute("y", String(localImgY));
        img.setAttribute("width", String(localImgW));
        img.setAttribute("height", String(localImgH));
        img.setAttributeNS(XLINK_NS, "href", getImagePath(prefix, season, fullLabel));
        img.setAttribute("href", getImagePath(prefix, season, fullLabel));
        img.setAttribute("preserveAspectRatio", "xMidYMid meet");

        // copy the path's transform (if any) to the image so element-level transforms match
        // (we do NOT remove the transform from the path)
        if (path.hasAttribute("transform")) {
          img.setAttribute("transform", path.getAttribute("transform"));
        }

        // add tooltip
        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = fullLabel;

        link.appendChild(img);
        link.appendChild(title);

        // append the link (image) as a sibling after the path so it inherits ancestor transforms
        // and sits above the path visually. If you'd like it behind, insertBefore.
        const parent = path.parentNode;
        parent.appendChild(link);

        // remember so we can reposition if needed
        placed.push({ path, img, link });
      });

      // reposition function (recomputes local bbox and updates image x/y/size)
      function repositionImages() {
        placed.forEach(item => {
          try {
            const bbox = localBBox(item.path);
            const scale = 0.95;

            const imgW = bbox.width * scale;
            const imgH = bbox.height * scale;
            const imgX = bbox.x + (bbox.width - imgW) / 2;
            const imgY = bbox.y + (bbox.height - imgH) / 2;

            item.img.setAttribute("x", String(imgX));
            item.img.setAttribute("y", String(imgY));
            item.img.setAttribute("width", String(imgW));
            item.img.setAttribute("height", String(imgH));

            // If path has an element-level transform that changed, re-copy it:
            if (item.path.hasAttribute("transform")) {
              item.img.setAttribute("transform", item.path.getAttribute("transform"));
            }
          } catch (err) {
            // getBBox can throw if SVG not rendered yet — ignore harmlessly
            console.warn("repositionImages error:", err);
          }
        });
      }

      function getImagePath(label, season, fullLabel) {
        if (label !== 'CSRM') {
          return `/resources/icons/${label}.jpg`;
        }

        if (label === 'CSRM') {
          return getImageMapByNumber(mapImages, fullLabel);
        }

        return label;
      }

      function getImageLink(label, season) {
        return 'https://Alchemy-AOE-Community.github.io/RedirectLatest.html?file=CHEM-' + label;
      }

      function getImageMapByNumber(obj, code) {
        const match = code.match(/(\d+)$/);
        if (!match) return '/assets/images/Question_Mark.jpg';

        const number = match[1].padStart(2, "0");
        const key = Object.keys(obj).find(k => k.includes(`_${number}_`));

        // Return the value (or undefined if not found)
        return key ? obj[key] : '/assets/images/Question_Mark.jpg';
      }

      async function getMapImages(season) {
        const base = 'https://raw.githubusercontent.com/Alchemy-AOE-Community/CHEM-Competition-Map-Packs/refs/heads/main/';
        const url = `${base}${season}.md`;
        const currentSeasonUrl = `${base}ALCS.md`;

        // Step 1: Try to fetch the markdown file
        let response = await fetch(url);
        if (!response.ok) {
          console.warn(`Season "${season}" not found, falling back to ALCS.md`);
          response = await fetch(currentSeasonUrl);
          if (!response.ok) throw new Error('Could not load current season markdown.');
        }

        const markdown = await response.text();

        // Step 2: Extract all links (e.g., https://github.com/.../folder/file.rms)
        const linkRegex = /\bhttps?:\/\/[^\s)]+/g;
        const links = markdown.match(linkRegex) || [];

        // Step 3: Build the map name → image URL dictionary
        const mapEntries = links.map(link => {
          const parts = link.split('/');
          const mapName = parts[parts.length - 1].replace(/\.[^/.]+$/, ''); // remove .rms or other extension
          const folderUrl = link; // .substring(0, link.lastIndexOf('/'));
          const imageUrl = `${folderUrl}/${mapName}.png`
          .replace('https://github.com/', 'https://raw.githubusercontent.com/')
          .replace('/tree/', '/refs/heads/');

          return { [mapName] : imageUrl };
        });

        // Step 4: Convert to JSON object
        return Object.assign({}, ...mapEntries);
      }

      function localBBox(el) {
        if (
          el.hasAttribute("x") &&
          el.hasAttribute("y") &&
          el.hasAttribute("width") &&
          el.hasAttribute("height")
        ) {
          return {
            x: parseFloat(el.getAttribute("x")),
            y: parseFloat(el.getAttribute("y")),
            width: parseFloat(el.getAttribute("width")),
            height: parseFloat(el.getAttribute("height"))
          };
        } else {
          const b = el.getBBox();
          return { x: b.x, y: b.y, width: b.width, height: b.height };
        }
      }

      // helper debounce
      function debounce(fn, wait = 120) {
        let t = null;
        return (...args) => {
          clearTimeout(t);
          t = setTimeout(() => fn(...args), wait);
        };
      }

      // ensure we compute after layout — run once on next frame, and wire up resize
      requestAnimationFrame(() => {
        repositionImages();
        window.addEventListener("resize", debounce(repositionImages, 120));
      });

      // expose for debugging / manual re-render
      // e.g. call window.repositionDefinitions() from console or after dynamic changes
      window.repositionDefinitions = repositionImages;
    })
    .catch(err => console.error("Error loading SVG:", err));
}