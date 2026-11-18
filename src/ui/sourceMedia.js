// Sources use ordinary relative image files; no ZIP library or PDF renderer needed.
export function sourcesVisible({ view, showSolutions, submitted, quizMode }) {
  return Boolean((showSolutions && (view === "search" || view === "review" || submitted)) ||
    (view === "quiz" && quizMode === "practice" && submitted));
}

export function renderSourceMedia(sources) {
  if (!sources?.length) return null;
  const root = document.createElement("details");
  root.className = "sourceMedia";
  const summary = document.createElement("summary");
  summary.textContent = `Quellen ansehen – Folien und Bildausschnitte (${sources.length})`;
  root.appendChild(summary);
  let loaded = false;
  root.addEventListener("toggle", () => {
    if (!root.open || loaded) return;
    loaded = true;
    const note = document.createElement("p");
    note.className = "small";
    note.textContent = "Originale Quellenansichten zur Annotation. Ein Suchtreffer allein bestätigt keine Antwort; KI-Beschreibungen können unsicher sein.";
    root.appendChild(note);
    for (const source of sources) {
      const card = document.createElement("section");
      card.className = "sourceMedia__card";
      const title = document.createElement("h4");
      title.textContent = `${source.sourcePaths.join(", ") || source.title || "Quelle"} · PDF-Seite ${source.pdfPage || "unbekannt"}`;
      card.appendChild(title);
      const usage = document.createElement("p");
      usage.className = "small";
      usage.textContent = (source.usage === "cited" ? "In der Annotation zitiert" : source.usage === "image_match" ? "Passender Bildvergleich" : "Zusätzlicher Suchtreffer") +
        (source.optionNumbers.length ? ` · Optionen ${source.optionNumbers.join(", ")}` : "");
      card.appendChild(usage);
      if (source.status !== "ready" || (source.visualStatus && source.visualStatus !== "ready")) {
        const warning = document.createElement("p");
        warning.className = "small";
        warning.textContent = "Quellenbilder oder Bildanalyse sind unvollständig bzw. unsicher. Die fachliche Bewertung bleibt prüfbedürftig.";
        card.appendChild(warning);
      }
      const addImage = (url, label, parent) => {
        const link = document.createElement("a");
        link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.title = `${label} in voller Größe öffnen`;
        const image = document.createElement("img");
        image.src = url; image.loading = "lazy"; image.alt = `${label}: ${title.textContent}`;
        image.addEventListener("error", () => {
          image.remove();
          const missing = document.createElement("p");
          missing.className = "small";
          missing.textContent = `${label} konnte nicht geladen werden. Den .sources-Ordner zusammen mit der JSON bereitstellen.`;
          link.replaceWith(missing);
        }, { once: true });
        link.appendChild(image); parent.appendChild(link);
      };
      if (source.regionUrl) {
        const label = document.createElement("p");label.textContent = "Bild- oder Tabellenausschnitt";card.appendChild(label);
        addImage(source.regionUrl, "Quellenausschnitt", card);
      }
      if (source.pageUrl) {
        if (source.regionUrl) {
          const page = document.createElement("details");
          const label = document.createElement("summary");label.textContent = "Vollständige Folie / Seite anzeigen";
          page.appendChild(label);
          let pageLoaded = false;
          page.addEventListener("toggle", () => {
            if (page.open && !pageLoaded) { pageLoaded = true; addImage(source.pageUrl, "Vollständige Quellenseite", page); }
          });
          card.appendChild(page);
        } else addImage(source.pageUrl, "Vollständige Quellenseite", card);
      }
      if (!source.pageUrl && !source.regionUrl) {
        const missing = document.createElement("p");
        missing.textContent = "Für diese Fundstelle wurde kein darstellbares Quellenbild mitgeliefert.";
        card.appendChild(missing);
      }
      const quotes = [...new Set(source.citations.filter(c => ["source", "native", "ocr"].includes(c.layer)).map(c => c.quote).filter(Boolean))];
      for (const quote of quotes) {
        const block = document.createElement("blockquote");block.textContent = quote;card.appendChild(block);
      }
      root.appendChild(card);
    }
  });
  return root;
}
