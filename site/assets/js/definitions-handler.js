function initDefinitions(season) {
  fetch(`/resources/${season}/definitions.svg`)
    .then(res => res.text())
    .then(svgText => {
      const container = document.getElementById("definitions-container");
      container.innerHTML = svgText;

      const svgRoot = container.querySelector("svg");
      if (!svgRoot) return;

      const SVG_NS = "http://www.w3.org/2000/svg";
      const XLINK_NS = "http://www.w3.org/1999/xlink";
      const placed = [];

      let defs = svgRoot.querySelector("defs");
      if (!defs) {
        defs = document.createElementNS(SVG_NS, "defs");
        svgRoot.insertBefore(defs, svgRoot.firstChild);
      }

      svgRoot.querySelectorAll("path[inkscape\\:label]").forEach(path => {
        const fullLabel = path.getAttribute("inkscape:label") || "";
        const isCSRM = fullLabel.startsWith("CSRM-") || fullLabel.includes("CSRM-");

        // Hide the original rectangular stroke for CSRM nodes
        if (isCSRM) {
          path.style.stroke = "none";
        }

        const link = document.createElementNS(SVG_NS, "a");
        link.setAttributeNS(XLINK_NS, "href", getImageLink(fullLabel));
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");

        const img = document.createElementNS(SVG_NS, "image");
        const imgPath = getImagePath(fullLabel, season);

        img.setAttributeNS(XLINK_NS, "href", imgPath);
        img.setAttribute("href", imgPath);
        img.setAttribute("preserveAspectRatio", "xMidYMid meet");

        img.addEventListener("error", () => {
          const fallback = "/assets/images/Question_Mark.jpg";
          img.setAttributeNS(XLINK_NS, "href", fallback);
          img.setAttribute("href", fallback);
          requestAnimationFrame(() => repositionImages());
        }, { once: true });

        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = fullLabel;

        link.appendChild(img);
        link.appendChild(title);
        path.parentNode.appendChild(link);

        placed.push({ path, img, link, label: fullLabel, isCSRM });
      });

      function repositionImages() {
        placed.forEach(item => {
          try {
            const bbox = localBBox(item.path);

            // Fill completely
            const scale = 1.0;
            const imgW = bbox.width * scale;
            const imgH = bbox.height * scale;
            const imgX = bbox.x + (bbox.width - imgW) / 2;
            const imgY = bbox.y + (bbox.height - imgH) / 2;

            item.img.setAttribute("x", String(imgX));
            item.img.setAttribute("y", String(imgY));
            item.img.setAttribute("width", String(imgW));
            item.img.setAttribute("height", String(imgH));

            // Preserve translation if present
            const pathTransform = item.path.getAttribute("transform") || "";
            const translateMatch = pathTransform.match(/translate\s*\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/);
            if (translateMatch) {
              item.img.setAttribute("transform", `translate(${translateMatch[1]},${translateMatch[2]})`);
            } else {
              item.img.removeAttribute("transform");
            }

            const cx = bbox.x + bbox.width / 2;
            const cy = bbox.y + bbox.height / 2;
            const hw = bbox.width / 2;
            const hh = bbox.height / 2;

            // ----- Clip + border for CSRM (diamond) -----
            const clipId = `clip-${item.path.id || Math.random().toString(36).slice(2)}`;
            let clipPath = document.getElementById(clipId);

            if (!clipPath) {
              clipPath = document.createElementNS(SVG_NS, "clipPath");
              clipPath.setAttribute("id", clipId);

              if (item.isCSRM) {
                // Diamond clip
                const diamond = document.createElementNS(SVG_NS, "polygon");
                diamond.setAttribute("points", [
                  `${cx},${cy - hh}`,
                  `${cx + hw},${cy}`,
                  `${cx},${cy + hh}`,
                  `${cx - hw},${cy}`
                ].join(" "));
                clipPath.appendChild(diamond);

                // Also draw a visible diamond border
                const border = document.createElementNS(SVG_NS, "polygon");
                border.setAttribute("points", [
                  `${cx},${cy - hh}`,
                  `${cx + hw},${cy}`,
                  `${cx},${cy + hh}`,
                  `${cx - hw},${cy}`
                ].join(" "));
                border.setAttribute("fill", "none");
                border.setAttribute("stroke", "#000000");
                border.setAttribute("stroke-width", "0.5");
                border.setAttribute("stroke-linejoin", "round");
                item.path.parentNode.appendChild(border);
              } else {
                // Stock nodes keep original shape
                const pathClone = item.path.cloneNode(true);
                pathClone.removeAttribute("transform");
                clipPath.appendChild(pathClone);
              }

              defs.appendChild(clipPath);
            }

            item.img.setAttribute("clip-path", `url(#${clipId})`);
          } catch (err) {
            console.warn("repositionImages error:", err);
          }
        });
      }

      function getImagePath(fullLabel, season) {
        if (fullLabel.startsWith("CSRM-") || fullLabel.includes("CSRM-")) {
          const core = fullLabel.replace(/^CSRM-?/i, "");
          const normalized = core.replace(/-/g, "_");
          return `/resources/${season}/CSRM_thumbnails/${normalized}.png`;
        }

        const prefix = fullLabel.split(/[-_]/)[0].toUpperCase();
        const stockMap = {
          HDBK: "/assets/images/spec_type/Handbook.jpg",
          GSRM: "/assets/images/spec_type/General_Spec.jpg",
          MTHD: "/assets/images/spec_type/Method.jpg",
          PSRM: "/assets/images/spec_type/Procurement_Spec.jpg",
          STND: "/assets/images/spec_type/Standard.jpg"
        };
        return stockMap[prefix] || "/assets/images/Question_Mark.jpg";
      }

      function getImageLink(label) {
        return `/RedirectLatest.html?file=CHEM-${label}`;
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
        }
        return el.getBBox();
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
        setTimeout(repositionImages, 300);
        window.addEventListener("resize", debounce(repositionImages, 120));
      });

      window.repositionDefinitions = repositionImages;
    })
    .catch(err => console.error("Error loading SVG:", err));
}