Anzeige-App 3.9.8 mit Radiologie

ZIP entpacken und den gesamten Inhalt unverändert in das Web-Verzeichnis hochladen. index.html liegt direkt im ZIP-Hauptverzeichnis. Keine Manifest-Anpassung erforderlich. Das enthaltene Manifest registriert den aktuellen Radiologie-Gesamtdatensatz.

Lokaler Test: python -m http.server 8000 im entpackten Ordner, danach http://localhost:8000 öffnen. Fragebilder nutzen die bestehende JSZip-CDN-Einbindung. Annotationen und bestätigte Altfragengruppen sind enthalten; technische Analysefehler bleiben erhalten.
