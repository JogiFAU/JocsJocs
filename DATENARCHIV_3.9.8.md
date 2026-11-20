# Anzeige-App 3.9.8 – Datenarchiv

Diese Version gehört zum Analyzer 3.9.8 und liest dessen Schema-2-Exporte einschließlich Antwortbewertungen, Gesamterklärungen, Quellenverweisen und bestätigten Altfragengruppen. Alte Datensätze bleiben unterstützt.

## Datensatz hinzufügen

1. Anzeige-App_3.9.8.zip separat entpacken.
2. Das kopierfertige Datenpaket entpacken. Seinen gesamten Ordner analyzer-<Lauf-ID> unverändert nach datasets/ kopieren.
3. Im Datensatzordner manifest-entry.example.json öffnen. Das enthaltene Objekt manuell in die datasets-Liste von datasets/manifest.json einfügen. Vorhandene Einträge behalten, Kommas zwischen Objekten setzen und keine ID doppelt verwenden. Die Pfade sind bereits fertig; sie gelten relativ zum App-Verzeichnis.
4. START_TEST_VIEWER.bat starten. Im Browser den Datensatz auswählen und laden. Bei bereits laufender App Seite neu laden. Strg+C beendet den lokalen Server.

Die leere Ausgangsdatei lautet {"datasets": []}. Jeder Datensatzordner enthält data.annotated.json, vorhandenes question-images.zip, den Quellenordner, EXPORT_INFO.json und die Manifest-Vorlage. Alle Dateien im Ordner zusammenlassen. Die App sucht Ordner nicht automatisch: Das manuelle Registrieren ist der Kontrollschritt und funktioniert auch auf statischem Hosting.

Für den Quellordner statt des ZIP: python -m http.server 8000 aus diesem Verzeichnis starten und http://localhost:8000 öffnen. Nicht file:// verwenden. Die bestehende JSZip-CDN-Abhängigkeit bleibt für Fragebilder erforderlich.

Bereits heruntergeladenes startbares Testpaket: Testanzeige/datasets/export kann vollständig nach datasets/ kopiert werden; den Eintrag aus Testanzeige/datasets/manifest.json übernehmen. Für mehrere Exporte besser die neuen eindeutigen analyzer-Ordner verwenden. Ein altes flaches Quellenpaket besitzt noch keine fertigen Archivpfade; dafür den neuen kopierfertigen Export in Analyzer-Schritt 5 verwenden.

## Datenzuordnung und Prüfung

Optionsbewertungen: questions[].answers[].analysis. Gesamterklärung: questions[].analysis.solution.explanation. Gruppenregister: annotation.relationships.taskGroups/objectiveGroups. Mitgliedschaften: questions[].analysis.relationships. Quellenbilder werden relativ zur Datensatz-JSON aufgelöst. Technische Fehler und unbestätigte Bewertungen bleiben erhalten; offene Retrievalkandidaten erscheinen nicht als bestätigte Gruppen.

Geprüft am 18.11.2026: 37 JavaScript-Tests, vier Exporttests, vier Analyzer-UI-Tests. Tatsächlicher Archivimport im Browser: 533 Fragen, Fragebilder-ZIP geladen, Options- und Gesamterklärungen angezeigt. Paket enthält unveränderte Frageannotation; keine Modellarbeit. Der Lauf enthält 168 technische Fragefehler und sechs bestätigte Gruppen, unverändert aus der Nachbereitung.
