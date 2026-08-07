function initDefinitions(season) {
  fetch(`/resources/${season}/definitions.svg`)
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

        const bbox = localBBox(path);

        const localImgX = bbox.x + bbox.width / 4;
        const localImgY = bbox.y + bbox.height / 4;
        const localImgW = bbox.width / 2;
        const localImgH = bbox.height / 2;

        const link = document.createElementNS(SVG_NS, "a");
        link.setAttributeNS(XLINK_NS, "href", getImageLink(fullLabel));
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");

        const img = document.createElementNS(SVG_NS, "image");
        const imgPath = await getImagePath(prefix, season, fullLabel);

        img.setAttribute("x", String(localImgX));
        img.setAttribute("y", String(localImgY));
        img.setAttribute("width", String(localImgW));
        img.setAttribute("height", String(localImgH));
        img.setAttributeNS(XLINK_NS, "href", imgPath);
        img.setAttribute("href", imgPath);

        img.addEventListener("error", () => {
          const fallback = '/assets/images/Question_Mark.jpg';
          img.setAttributeNS(XLINK_NS, "href", fallback);
          img.setAttribute("href", fallback);
        }, { once: true });

        img.setAttribute("preserveAspectRatio", "xMidYMid meet");

        if (path.hasAttribute("transform")) {
          img.setAttribute("transform", path.getAttribute("transform"));
        }

        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = fullLabel;

        link.appendChild(img);
        link.appendChild(title);

        const parent = path.parentNode;
        parent.appendChild(link);

        placed.push({ path, img, link });
      });

      function repositionImages() {
        placed.forEach(item => {
          try {
            const bbox = localBBox(item.path);
            const scale = 0.95;

            const imgW = bbox.width * scale;
            const imgH = bbox.height * scale;
            const imgX = bbox.x + (bbox.width - imgW) / 2;
            const imgY = bbox.y + (bbox.height - imgH) / 2;

            item.img.setAttribute("x", imgX);
            item.img.setAttribute("y", imgY);
            item.img.setAttribute("width", imgW);
            item.img.setAttribute("height", imgH);

            const transform = item.path.getAttribute("transform");
            if (transform && transform.startsWith("matrix")) {
              const values = transform
                .match(/matrix\(([^)]+)\)/)[1]
                .split(/[ ,]+/)
                .map(Number);

              const [a, b] = values;
              const angle = Math.atan2(b, a) * (180 / Math.PI);

              const cx = imgX + imgW / 2;
              const cy = imgY + imgH / 2;

              item.img.setAttribute(
                "transform",
                `${transform} rotate(${-angle} ${cx} ${cy})`
              );

              if (item.path.hasAttribute("transform")) {
                item.img.setAttribute("transform", item.path.getAttribute("transform"));
              }
            }

            const clipId = `clip-${item.path.id}`;
            if (!document.getElementById(clipId)) {
              const clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
              clipPath.setAttribute("id", clipId);

              const pathClone = item.path.cloneNode(true);
              clipPath.appendChild(pathClone);

              item.path.ownerSVGElement.querySelector("defs").appendChild(clipPath);
            }

          } catch (err) {
            console.warn("repositionImages error:", err);
          }
        });
      }

      // ⭐ UPDATED: Local thumbnail loader using fullLabel
      async function getImagePath(label, season, fullLabel) {
        if (label !== 'CSRM') {
          return `/resources/icons/${label}.jpg`;
        }
        return await getImageMapByNumber(season, fullLabel);
      }

      // ⭐ UPDATED: Prefix + number → PRE-YY.png with existence check
      async function getImageMapByNumber(season, fullLabel) {
        const match = fullLabel.match(/(\d+)$/);
        if (!match) return '/assets/images/Question_Mark.jpg';

        const number = match[1].padStart(2, "0");
        const prefix = fullLabel.split('-')[0];

        const path = `/resources/${season}/CSRM_thumbnails/${prefix}-${number}.png`;

        try {
          const res = await fetch(path, { method: 'HEAD' });
          if (res.ok) return path;
        } catch (err) {
          console.warn(`Thumbnail missing: ${path}`);
        }

        return '/assets/images/Question_Mark.jpg';
      }

      function getImageLink(label, season) {
        return '/RedirectLatest.html?file=CHEM-' + label;
      }

      async function getMapImages(season) {
        return {}; // no longer used for thumbnails
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

      function debounce(fn, wait = 120) {
        let t = null;
        return (...args) => {
          clearTimeout(t);
          t = setTimeout(() => fn(...args), wait);
        };
      }

      requestAnimationFrame(() => {
        repositionImages();
        window.addEventListener("resize", debounce(repositionImages, 120));
      });

      window.repositionDefinitions = repositionImages;
    })
    .catch(err => console.error("Error loading SVG:", err));
}
