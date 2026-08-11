function initDefinitions(season) {
  // Load the notes first, then the SVG
  Promise.all([
    fetch(`/resources/definition_notes.json`).then(r => r.json()).catch(() => ({})),
    fetch(`/resources/${season}/definitions.svg`).then(r => r.text())
  ]).then(([notes, svgText]) => {
      const container = document.getElementById("definitions-container");
      container.innerHTML = svgText;

      const svgRoot = container.querySelector("svg");
      if (!svgRoot) return;

      const SVG_NS = "http://www.w3.org/2000/svg";
      const XLINK_NS = "http://www.w3.org/1999/xlink";
      const placed = [];

      const style = document.createElementNS(SVG_NS, "style");
      style.textContent = `
        image, polygon, rect {
          transition: all 0.18s ease;
        }
      `;
      svgRoot.insertBefore(style, svgRoot.firstChild);

      let defs = svgRoot.querySelector("defs");
      if (!defs) {
        defs = document.createElementNS(SVG_NS, "defs");
        svgRoot.insertBefore(defs, svgRoot.firstChild);
      }

      // Helper to find the best tooltip text
      function getTooltipText(label) {
        if (!label) return label;

        let description = null;

        // 1. Exact match
        if (notes[label]) description = notes[label];

        // 2. Try without "CSRM-" prefix
        if (!description && label.startsWith("CSRM-")) {
          const without = label.substring(5);
          if (notes[without]) description = notes[without];
          else if (notes["CSRM"]) description = notes["CSRM"];
        }

        // 3. Try the prefix only (MTHD, STND, PSRM, GSRM, HDBK …)
        if (!description) {
          const prefix = label.split(/[-_]/)[0].toUpperCase();
          if (notes[prefix]) description = notes[prefix];
        }

        // Build the final tooltip: original name + description
        if (description) {
          return label + "\n" + description;
        }
        return label;
      }

      svgRoot.querySelectorAll("path[inkscape\\:label]").forEach(path => {
        const fullLabel = path.getAttribute("inkscape:label") || "";
        const isCSRM = fullLabel.startsWith("CSRM-") || fullLabel.includes("CSRM-");

        path.style.stroke = "none";
        path.style.fill = "none";

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
        title.textContent = getTooltipText(fullLabel);

        link.appendChild(img);
        link.appendChild(title);
        path.parentNode.appendChild(link);

        placed.push({
          path,
          img,
          link,
          label: fullLabel,
          isCSRM,
          originalBBox: null
        });
      });

      function repositionImages() {
        placed.forEach(item => {
          if (!item.originalBBox) {
            item.originalBBox = localBBox(item.path);
          }
        });

        const csrmNodes = placed.filter(p => p.isCSRM);
        if (csrmNodes.length === 0) {
          placed.forEach(item => positionOne(item, 1.0, "none"));
          return;
        }

        csrmNodes.sort((a, b) => a.originalBBox.y - b.originalBBox.y);
        const midY = (csrmNodes[0].originalBBox.y + csrmNodes[csrmNodes.length - 1].originalBBox.y) / 2;

        const upperRow = csrmNodes.filter(n => n.originalBBox.y < midY);
        const lowerRow = csrmNodes.filter(n => n.originalBBox.y >= midY);

        const scale = calculateMaxScale(upperRow, lowerRow);
        console.log("CSRM scale:", scale.toFixed(3));

        upperRow.forEach(item => positionOne(item, scale, "upper"));
        lowerRow.forEach(item => positionOne(item, scale, "lower"));
        placed.filter(p => !p.isCSRM).forEach(item => positionOne(item, 1.0, "none"));

        expandViewBoxForHover();
      }

      function expandViewBoxForHover() {
        let minY = Infinity;
        let maxH = 0;
        placed.forEach(item => {
          if (item.base) {
            if (item.base.y < minY) minY = item.base.y;
            if (item.base.h > maxH) maxH = item.base.h;
          }
        });

        if (!isFinite(minY)) return;

        const neededTopPad = maxH;
        const currentViewBox = svgRoot.getAttribute("viewBox") || "0 0 130 80";
        const parts = currentViewBox.split(/[\s,]+/).map(Number);
        let [vx, vy, vw, vh] = parts;

        const newVy = Math.min(vy, minY - neededTopPad);
        const extra = vy - newVy;
        const newVh = vh + extra;

        svgRoot.setAttribute("viewBox", `${vx} ${newVy} ${vw} ${newVh}`);
      }

      function calculateMaxScale(upperRow, lowerRow) {
        const MIN_GAP = 2.0;
        const VIEWBOX_WIDTH = 130;
        const LEFT_CLEARANCE = 11.5;

        let maxScale = 2.4;

        const all = [...upperRow, ...lowerRow];
        all.sort((a, b) => a.originalBBox.x - b.originalBBox.x);

        if (all.length) {
          const leftmost = all[0].originalBBox;
          const leftScale = (leftmost.x + leftmost.width / 2 - LEFT_CLEARANCE) / (leftmost.width / 2);
          if (leftScale > 0) maxScale = Math.min(maxScale, leftScale);

          const rightmost = all[all.length - 1].originalBBox;
          const rightScale = (VIEWBOX_WIDTH - (rightmost.x + rightmost.width / 2) - MIN_GAP) / (rightmost.width / 2);
          if (rightScale > 0) maxScale = Math.min(maxScale, rightScale);

          for (let i = 0; i < all.length - 1; i++) {
            const a = all[i].originalBBox;
            const b = all[i + 1].originalBBox;
            if (Math.abs(a.y - b.y) > 8) continue;

            const dist = (b.x + b.width / 2) - (a.x + a.width / 2);
            const needed = dist - MIN_GAP;
            if (needed <= 0) {
              maxScale = 1.0;
              break;
            }
            const s = needed / ((a.width + b.width) / 2);
            maxScale = Math.min(maxScale, s);
          }
        }

        if (upperRow.length && lowerRow.length) {
          const upperBottom = Math.max(...upperRow.map(n => n.originalBBox.y + n.originalBBox.height));
          const lowerTop = Math.min(...lowerRow.map(n => n.originalBBox.y));
          const gap = lowerTop - upperBottom;
          const h = upperRow[0].originalBBox.height;

          const available = gap - 0.3;
          if (available > 0.15) {
            const s = 1 + available / h;
            maxScale = Math.min(maxScale, s);
          }
        }

        return Math.max(1.35, maxScale);
      }

      function positionOne(item, scale, rowType) {
        const bbox = item.originalBBox;
        const newW = bbox.width * scale;
        const newH = bbox.height * scale;

        let imgX, imgY;

        if (rowType === "upper") {
          imgX = bbox.x + (bbox.width - newW) / 2;
          imgY = bbox.y;
        } else if (rowType === "lower") {
          imgX = bbox.x + (bbox.width - newW) / 2;
          imgY = bbox.y + bbox.height - newH;
        } else {
          imgX = bbox.x + (bbox.width - newW) / 2;
          imgY = bbox.y + (bbox.height - newH) / 2;
        }

        const pathTransform = item.path.getAttribute("transform") || "";
        if (pathTransform) {
          item.img.setAttribute("transform", pathTransform);
        } else {
          item.img.removeAttribute("transform");
        }

        item.img.setAttribute("x", String(imgX));
        item.img.setAttribute("y", String(imgY));
        item.img.setAttribute("width", String(newW));
        item.img.setAttribute("height", String(newH));

        item.base = { x: imgX, y: imgY, w: newW, h: newH, transform: pathTransform };

        const grow = () => {
          const b = item.base;
          const cx = b.x + b.w / 2;
          const cy = b.y + b.h / 2;
          const nw = b.w * 2;
          const nh = b.h * 2;
          const nx = cx - nw / 2;
          const ny = cy - nh / 2;

          item.img.setAttribute("x", String(nx));
          item.img.setAttribute("y", String(ny));
          item.img.setAttribute("width", String(nw));
          item.img.setAttribute("height", String(nh));

          if (item.isCSRM && item.border) {
            const hw = nw / 2, hh = nh / 2;
            const pts = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
            item.border.setAttribute("points", pts);
            const diamond = item.clipPath.querySelector("polygon");
            if (diamond) diamond.setAttribute("points", pts);
          }

          if (!item.isCSRM && item.border) {
            item.border.setAttribute("x", String(nx));
            item.border.setAttribute("y", String(ny));
            item.border.setAttribute("width", String(nw));
            item.border.setAttribute("height", String(nh));
          }

          if (!item.isCSRM && item.clipRect) {
            item.clipRect.setAttribute("x", String(nx));
            item.clipRect.setAttribute("y", String(ny));
            item.clipRect.setAttribute("width", String(nw));
            item.clipRect.setAttribute("height", String(nh));
          }
        };

        const shrink = () => {
          const b = item.base;
          item.img.setAttribute("x", String(b.x));
          item.img.setAttribute("y", String(b.y));
          item.img.setAttribute("width", String(b.w));
          item.img.setAttribute("height", String(b.h));

          if (item.isCSRM && item.border) {
            const cx = b.x + b.w / 2;
            const cy = b.y + b.h / 2;
            const hw = b.w / 2, hh = b.h / 2;
            const pts = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
            item.border.setAttribute("points", pts);
            const diamond = item.clipPath.querySelector("polygon");
            if (diamond) diamond.setAttribute("points", pts);
          }

          if (!item.isCSRM && item.border) {
            item.border.setAttribute("x", String(b.x));
            item.border.setAttribute("y", String(b.y));
            item.border.setAttribute("width", String(b.w));
            item.border.setAttribute("height", String(b.h));
          }

          if (!item.isCSRM && item.clipRect) {
            item.clipRect.setAttribute("x", String(b.x));
            item.clipRect.setAttribute("y", String(b.y));
            item.clipRect.setAttribute("width", String(b.w));
            item.clipRect.setAttribute("height", String(b.h));
          }
        };

        item.link.onmouseenter = null;
        item.link.onmouseleave = null;
        item.link.addEventListener("mouseenter", grow);
        item.link.addEventListener("mouseleave", shrink);

        const oldBorder = item.path.parentNode.querySelector(`#border-${item.path.id}`);
        if (oldBorder) oldBorder.remove();

        if (item.isCSRM) {
          const cx = imgX + newW / 2;
          const cy = imgY + newH / 2;
          const hw = newW / 2;
          const hh = newH / 2;

          const border = document.createElementNS(SVG_NS, "polygon");
          border.setAttribute("id", `border-${item.path.id}`);
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
          if (pathTransform) border.setAttribute("transform", pathTransform);
          item.path.parentNode.appendChild(border);
          item.border = border;

          const clipId = `clip-csrm-${item.path.id || Math.random().toString(36).slice(2)}`;
          let clipPath = document.getElementById(clipId);
          if (!clipPath) {
            clipPath = document.createElementNS(SVG_NS, "clipPath");
            clipPath.setAttribute("id", clipId);
            const diamond = document.createElementNS(SVG_NS, "polygon");
            diamond.setAttribute("points", [
              `${cx},${cy - hh}`,
              `${cx + hw},${cy}`,
              `${cx},${cy + hh}`,
              `${cx - hw},${cy}`
            ].join(" "));
            clipPath.appendChild(diamond);
            defs.appendChild(clipPath);
          }
          item.img.setAttribute("clip-path", `url(#${clipId})`);
          item.clipPath = clipPath;
        } else {
          const border = document.createElementNS(SVG_NS, "rect");
          border.setAttribute("id", `border-${item.path.id}`);
          border.setAttribute("x", String(imgX));
          border.setAttribute("y", String(imgY));
          border.setAttribute("width", String(newW));
          border.setAttribute("height", String(newH));
          border.setAttribute("fill", "none");
          border.setAttribute("stroke", "#000000");
          border.setAttribute("stroke-width", "0.5");
          if (pathTransform) border.setAttribute("transform", pathTransform);
          item.path.parentNode.appendChild(border);
          item.border = border;

          const clipId = `clip-${item.path.id || Math.random().toString(36).slice(2)}`;
          let clipPath = document.getElementById(clipId);
          if (!clipPath) {
            clipPath = document.createElementNS(SVG_NS, "clipPath");
            clipPath.setAttribute("id", clipId);
            const rect = document.createElementNS(SVG_NS, "rect");
            rect.setAttribute("x", String(imgX));
            rect.setAttribute("y", String(imgY));
            rect.setAttribute("width", String(newW));
            rect.setAttribute("height", String(newH));
            clipPath.appendChild(rect);
            defs.appendChild(clipPath);
            item.clipRect = rect;
          } else {
            item.clipRect = clipPath.querySelector("rect");
            if (item.clipRect) {
              item.clipRect.setAttribute("x", String(imgX));
              item.clipRect.setAttribute("y", String(imgY));
              item.clipRect.setAttribute("width", String(newW));
              item.clipRect.setAttribute("height", String(newH));
            }
          }
          item.img.setAttribute("clip-path", `url(#${clipId})`);
        }
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
        if (el.hasAttribute("x") && el.hasAttribute("y") &&
            el.hasAttribute("width") && el.hasAttribute("height")) {
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
    .catch(err => console.error("Error loading SVG or notes:", err));
}