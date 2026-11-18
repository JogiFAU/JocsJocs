# Geprüfte Quellen im KI-Hinweis

Die Anzeige-App in dieser 3.9.7-Kopie zeigt unter der didaktischen Optionsbegründung im vorhandenen Hover-/Klickhinweis höchstens drei Quellen-Seiten. Unter der allgemeinen KI-Erklärung stehen höchstens sieben Seiten. Die Gesamterklärung im Vergleichsfenster verwendet dieselbe Liste. Vor der Lösungsfreigabe bleiben beide Quellenlisten zusammen mit den Erklärungen verborgen.

Die sichtbare Angabe besteht aus dem PDF-Dateinamen ohne abschließenden Zahlencode und der **PDF-Seitennummer**. Pfade werden nicht angezeigt, Unterstriche werden zu Leerzeichen. Gedruckte Foliennummern werden nicht als PDF-Seitennummer ausgegeben.

## Auswahl und Herkunft

`src/data/sourceReferences.js` verknüpft innerhalb derselben Frage:

* `answers[].analysis.optionId`, `evidenceStatus=source_cited`, Originalzitate und Claims;
* ausdrücklich zugelassene Quellen-/Optionsbeziehungen aus `analysis.diagnostics.sourceSelections` mit `admitted=true`, `relation=direct`, passender Option und `acceptedEvidenceIds`;
* die referenzierten Einträge in `analysis.evidence` und den Bildkatalog des jeweiligen Analyseexports.

Bloße Retrievaltreffer, Modellwissen, unvollständige/ungültige Bewertungen und abgelehnte oder ungewisse Quellenprüfungen erzeugen keine kompakten Quellenangaben. Originalzitate werden erneut gegen die mitgelieferte Originaltextebene geprüft. Bildzitate benötigen eine zugelassene Bildreferenz und einen fertigen visuellen Quelleneintrag. Ohne nachweisbare Prüfbezüge erscheint „Keine geprüften Quellen zugeordnet.“; es werden keine Bezüge aus Dateinamen oder bloßer thematischer Ähnlichkeit geraten. Das gilt auch für ältere Dateien ohne entsprechende Prüfdaten. Die ausführliche vorhandene Quellenansicht bleibt ein Archiv mit ihren bisherigen Statushinweisen; sie ist von dieser kompakten Auswahl getrennt.

Die Priorisierung verwendet die tatsächliche Zitierung: Schlussbewertung vor Claims vor übrigen Bewertungszitaten, identische Zitate einmalig. Die Gesamtliste aggregiert die Nutzung über Optionen. Gleichstand wird deterministisch aufgelöst. Das ist eine transparente Priorisierung bereits geprüfter Belege, keine zusätzliche fachliche Modellbewertung. Sie wird unabhängig vom zuvor schlechter ausgefallenen Retrievalranking berechnet. Höchstzahlen sind Grenzen, keine Auffüllpflicht.

Mehrere Belegpakete derselben Dokument-/Seitenidentität werden zusammengefasst. Verschiedene PDFs mit gleichem sichtbaren Namen bleiben getrennt. Quellen werden niemals über verschiedene Fragen oder Dataset-Dateien hinweg zusammengewürfelt.

## Testweiser Quellenviewer

`aiOptionSources` und `aiQuestionSources` enthalten neben der lesbaren Angabe den vollständigen Originalpfad, Dokument-/PDF-Seitenidentität, Dataset-URL, Wissenssnapshot und Lauf-ID. Unter `addresses` bleiben `evidenceId`, `pageId`, `unitId`, Original-/Anreicherungsrevision, Manifest, Abrufansicht und vorhandene portable Bildreferenzen erhalten. Die Bild-URLs werden relativ zur zugehörigen Dataset-Datei aufgelöst. Ein späterer Viewer kann damit an Originalressourcen oder den versionierten Katalog angebunden werden. Für 3.9.6-Exporte ohne Inhaltseinheiten bleiben die vorhandenen Dokument-/Seiten-/Bildbezüge nutzbar; fehlende 3.9.7-Adressen werden nicht erfunden.

Ein Klick auf eine kompakte Quellenangabe öffnet jetzt `source-viewer.html` in einem eigenen Browserfenster. Links stehen die geprüften Quellen der angeklickten Liste (maximal drei bzw. sieben), rechts die vollständige ausgewählte PDF-Seite als exportiertes Bild. Weitere vorhandene Bild-/Textausschnitte und wörtliche Originalzitate stehen darunter. Die Anzeige bietet Seitenbreite sowie Vergrößerung. Die Quellenadresse ist separat aufklappbar.

Seite −/+ ist nur aktiv, wenn die unmittelbar folgende/vorherige PDF-Seite desselben Dokuments als vollständiges Seitenbild im selben Dataset exportiert ist. Die Navigationsliste wird einmal je Dataset indiziert. Nicht mitgelieferte Seiten werden nicht aus Dateinamen erraten. Eine beim Blättern angezeigte Kontextseite wird ausdrücklich von der zitierten Fundstelle unterschieden; „Zur zitierten Seite“ führt zurück. Ein Klick links auf eine andere Quelle springt zu deren ursprünglicher Fundstelle.

Die Original-PDFs selbst gehören bisher nicht zum portablen Export. Deshalb ist dies zunächst ein Quellen-Seitenviewer und kein vollständiger PDF-Renderer: kein freies Blättern durch nicht mitgelieferte Vorlesungsseiten, keine Textauswahl im Seitenbild. Vorhandene Originalausschnitte sind sinnvoll nutzbar. Exakte Texthervorhebungen direkt auf der Seite werden ohne verlässliche Textkoordinaten nicht geraten. Für vollständige PDF-Navigation müsste später eine explizite, portable PDF-Dateireferenz mitgeliefert werden.

Das Quellenfenster übernimmt die Auswahl über einen zufälligen lokalen Übergabeschlüssel (eine Stunde gültig), unabhängig von einem geöffneten Elternfenster. Quellen-URLs sind auf HTTP(S) am selben Ursprung beschränkt. Bei blockiertem Pop-up erscheint ein Link zum neuen Tab; bei fehlendem Bild oder abgelaufener Übergabe eine Fehlermeldung. Die App und der Viewer müssen wie bisher über einen lokalen Webserver oder reguläres Hosting laufen. Die `.sources`-Dateien aus dem Export müssen neben der Analysedatei verfügbar sein; die lokale SQLite-Datei wird nicht direkt im Browser gelesen.

## Nachweise

34 Node-Tests bestanden, darunter Quellenzulassung, Optionsbindung, Obergrenzen, Priorisierung, Seitendeduplizierung, historische Adressen, relative Bildpfade, falsche Anker, Bildstatus, HTML-Escaping, dokumentgebundene Nachbarseiten und ausgeschlossene fremde/unsichere URLs. Der Python-Workflowtest prüft zusätzlich den tatsächlichen Analyseexport durch den JavaScript-Loader. Protokolle: `setup-logs/viewer-397-window.log` und `setup-logs/workflow-viewer-397.log` im Versionsordner.

Viewer-Browserprüfung: synthetische Seiten 32–34, vollständiges Seitenbild plus Ausschnitt/Originalzitat, Seite +, Kontextkennzeichnung und Sprung über die Quellenliste. Keine Konsolenfehler. Der eingebettete Testbrowser stellte das angeforderte Pop-up nicht als steuerbaren Tab bereit; die Viewer-Darstellung und Navigation wurden zusätzlich in einem eigenen Test-Tab mit derselben Übergabe geprüft. Ein normales externes Browserfenster bleibt beim ersten Nutzertest zu bestätigen. Prüfbild: `setup-logs/source-viewer-397.jpg`.

Die Browserprüfung lief über einen separaten lokalen Server mit einem ausschließlich synthetischen Analyseexport: Laden, Fragensuche, Lösungsfreigabe und geöffneter Optionshinweis einschließlich Quellen unter der Gesamterklärung. Keine Browser-Konsolenfehler. Prüfbild: `setup-logs/viewer-sources-397.jpg`. Kein Produktivlauf, keine neuen Modellaufrufe, keine Änderungen an älteren Versionen oder Nutzeroriginalen.
