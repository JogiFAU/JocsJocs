# JocsJocs 4.1

Die Anzeige-App wird eigenständig in diesem Ordner entwickelt. Sie ist eine statische Anwendung ohne Build-Schritt, Backend oder Modellaufrufe. Der Analyzer verwendet sie lediglich als Vorlage für Testpakete.

## Einstieg und Ablauf

`START_ANZEIGE.bat` startet die App dauerhaft unter `http://127.0.0.1:8000/`. Im Radiologie-Testpaket startet `START_TEST_VIEWER.bat` den beigefügten Stand unter `http://127.0.0.1:8041/`. Python 3 ist zum lokalen HTTP-Start nötig. GitHub Pages benötigt keinen Python-Server. Nicht direkt über `file://` öffnen.

1. **Setup:** Links Fach wählen und laden, rechts Einführung einschließlich KI-Hinweisen.
2. **Übersicht:** Gespeicherte Abfragen mit Fortschritt, Fortsetzen, Ergebnisansicht, Wiederholung falscher Antworten, Neustart und Löschen. Die Liste ist scrollbar. Normale oder High-Impact-Abfragen über die festen Buttons im Kopfbereich anlegen. Links steht der Lernstand des Fachs und je Klausur; auf Mobilgeräten ist dieser zunächst eingeklappt.
3. **Konfiguration:** Filter und Einstellungen wählen, optional Namen eingeben und starten. Ohne Namen entsteht ein eindeutiger Name. Zur Übersicht kann zurückgekehrt werden.
4. **Abfrage und Ergebnis:** Antworten werden lokal gespeichert, auch noch nicht abgegebene Auswahlen. Pausieren erhält dieselbe Abfrage samt Reihenfolge. Wiederholungen sind neue Abfragen; das Original bleibt erhalten.
5. **Suche:** Unabhängiger Filter- und Suchmodus, zurück über „Abfragen“ oder „Zur Übersicht“.

## High Impact

Pro Berechnung entsteht genau ein Set. Einstellbar sind Zielquote, erwartete Fragenzahl und Klausurauswahl: **Alle**, **5 neueste Klausuren**, **Aus Abfragefilter**. Der Solver startet automatisch beim Öffnen des High-Impact-Konfigurators mit den Standardwerten 60 % und 30 Fragen. Änderungen an Parametern und Filtern lösen automatisch eine neue Berechnung aus. Veraltete Ergebnisse sind währenddessen nicht startbar. Abbrechen beendet den Worker.

Bei „Aus Abfragefilter“ werden die normalen Filter eingeblendet, einschließlich Zufallsauswahl und bisherigen falschen Antworten. Der Filter wird vor der Optimierung angewendet. Nur ausgewählte Fragen zählen zur Abdeckung und können Referenzfragen werden. Die globalen, transitiven Familienbeziehungen bleiben dabei erhalten. Der zuletzt berechnete Stand mit Parametern, Referenzen und Abdeckung wird in der Abfrage gespeichert. Beim Fortsetzen wird nicht neu gerechnet.

Die Zielquote gilt mindestens in **jeder** berücksichtigten Klausur und bezieht sich auf dokumentierte Fragen. Erwartete Fragenzahl und die Vollständigkeit der ursprünglichen Klausur beeinflussen die Auswahl bei gleicher Setgröße, niemals die Mindestquote. Auch bei Themenfiltern bleibt für diese Gewichtung die ursprüngliche Klausurvollständigkeit erhalten.

Identische und bestätigte Near-Repeat-Verbindungen bilden transitive Familien; verwandte Fragen bleiben getrennt. Identische doppelte Einträge derselben Klausur zählen einmal. Seminar-, Vorlesungs- und Übungssammlungen werden ausgeschlossen. Undatierte Klausuren sind bei „Alle“ enthalten, aber für „5 neueste“ nicht verwendbar. Weniger als fünf datierte Klausuren werden ausgewiesen. Pro Familie wird eine Referenz aus der neuesten passenden Klausur gewählt.

Die Quote setzt voraus, dass das Lernen einer Referenz alle Varianten ihrer Familie abdeckt. Fehlerhafte Gruppierungen können die Abdeckung überschätzen. Die Rechnung garantiert daher keine reale Prüfungsleistung. Vorhandene Paarurteile werden verwendet, keine neuen Modellurteile erzeugt.

## Speicherung und Kompatibilität

Eine Abfrage ist die zentrale Speichereinheit: Name, Fach, Konfiguration, High-Impact-Ergebnis, feste Frage- und Antwortreihenfolge, Antworten und Fortschritt. Alles bleibt in `localStorage` dieses Browsers. Unter „Lokale Daten“ gibt es weiterhin Backup-Export und -Import, aber keine zweite Abfragenliste. Eine externe Synchronisation ist nicht eingerichtet.

Browser-Speicher ist an **Browser und Webadresse einschließlich Port** gebunden. Deshalb verwenden die Starter feste Ports. Ein bereits laufender Server desselben App-Ordners wird wiederverwendet; bei einem fremden belegten Port erscheint ein Hinweis. Es werden keine fremden Server beendet. Für einen Wechsel der Adresse oder des Browsers vorher Backup exportieren und danach importieren.

Die Fachkennung ergibt sich bevorzugt aus `storageKey` im Manifest, sonst aus `meta.subject`, sonst aus der Manifest-ID. Dadurch überstehen Abfragen wechselnde Analyzer-Run-IDs. Bei mehreren getrennten Datensätzen desselben Fachnamens im Manifest sollten eindeutige `storageKey`-Werte gesetzt werden. Passende ältere Abfragen werden kopiert, alte Speicherschlüssel bleiben erhalten. Fehlen Fragen oder wurden Text, Optionen oder Original-Lösung verändert, wird das Fortsetzen neuer Abfragen gesperrt und der passende Fachstand angefordert. Alte Abfragen ohne Signaturen bleiben lesbar.

## Lokaler Solver, Bilder und Tests

HiGHS 1.15.4 läuft als lokales WebAssembly-Modul im Worker. Pro Set gelten 15 Sekunden Solverzeit. Die primäre Zielfunktion minimiert die Familienzahl; eine kleine Zusatzbewertung der Abdeckung bricht Gleichstände, ohne eine zusätzliche Familie zu rechtfertigen. Bei Zeitlimit wird eine geprüfte zulässige Auswahl angeboten und als nicht nachweislich minimal gekennzeichnet. Falls nötig dient eine deterministische zulässige Auswahl als Rückfall. JSZip 3.10.1 ist ebenfalls lokal beigefügt, damit Bildarchive ohne CDN geladen werden. Lizenzen und Provenienz stehen unter `assets/vendor/`.

Tests: `node --test Anzeige-App/tests/*.test.mjs` vom Projektordner. Der reale HTTP-/Edge-Test einschließlich Solver, Reload, Speicherung, Suche, Bildern und mobiler Darstellung liegt unter `High_Impact_Labor/Browser_Solver_Probe/browser_test_41.mjs`; `run_browser_test.py` führt ihn mit dem erzeugten Radiologie-Testpaket in einem isolierten Profil aus.

## Datenvertrag und Code

Der Datenaustausch mit dem Analyzer bleibt bei Schema 2.0. Vorhandene Annotationen, Original-Lösungen, Bildarchive und Altfragenbeziehungen werden weiter eingelesen. Archivstruktur: [DATENARCHIV_3.9.8.md](DATENARCHIV_3.9.8.md). Die Versionsnummer 4.1 bezeichnet die Anwendung, keine neue Dataset-Schemaversion.

- `index.html`, `assets/styles.css`: UI und responsive Darstellung.
- `src/ui/overview.js`, `guides.js`, `learningProgress.js`: Einführung, ansichtsspezifische Bedienhilfe, gespeicherte Abfragen und Lernstand.
- `src/ui/events.js`, `src/ui/render.js`: Ablauf, Filter, Fragenansicht und Ergebnisdarstellung.
- `src/quiz/session.js`, `sessionRecord.js`: Speichern, Fortsetzen, Quellenstand-Prüfung, Namen und Fortschritt.
- `src/data/storage.js`: Browser-Speicher, Fachkennungen, Migration und Backups. Gelöschte migrierte Abfragen bleiben beim erneuten Laden gelöscht; die historischen Speicherschlüssel werden erhalten.
- `src/study/coverage.js`, `solver.worker.js`, `ui.js`: Familien, Abdeckungsmodell, Ein-Set-Optimierung und Live-Aktualisierung.
- `start_viewer.py`: fester lokaler Start und Port-Eigentumsprüfung.

Die bisherige App samt Dokumentation ist unter `Archiv/Versionen/Anzeige-App_4.0` gesichert. Rohdaten und abgeschlossene Analyzer-Läufe werden von dieser UI-Überarbeitung nicht verändert.

## UI-Überarbeitung nach INSTRUCTIONS.txt

Feste Abfrageaktionen im Header, einheitliche Karten und Aktionsbuttons. Offene Prüfungsabfragen zeigen blaue Fortschrittsbalken ohne vorzeitige Bewertung; Übungsabfragen zeigen grün/rot. Im Trainingsarchiv bleiben Prüfungsbalken auch nach Abschluss blau. Der Lernstand je Frage verwendet die neueste abgegebene Antwort über gespeicherte Abfragen hinweg; offene Prüfungsantworten zählen dabei nur neutral. Setup, Übersicht, normale Konfiguration, High Impact, Suche, aktive Abfrage und Ergebnis haben jeweils passende Bedienhinweise.
## Alternative Themenanzeige

Für Datensätze mit Schema 2.0 kann neben der Fragen-JSON eine optionale Datei
`topic-tree_display.json` liegen. Sie enthält `superTopics`, eine Liste mit
`name` und `subtopics` (Liste von Namen) pro Hauptthema. Die Positionen
entsprechen den vorhandenen Topic-IDs, jeweils ab 1. Das erste Unterthema
des zweiten Hauptthemas überschreibt beispielsweise die Namen für `2:1`.
Die Reihenfolge muss daher dem Originalkatalog entsprechen. Ohne Datei oder
passenden Eintrag zeigt die App die ursprünglichen Themennamen.

