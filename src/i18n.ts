const de: Record<string, string> = {
  "Image review": "Bildprüfung",
  "Review images": "Bilder prüfen",
  "Zoom in, mark what needs changing, and send clear feedback to the task.":
    "Zoome ins Bild, markiere Änderungsstellen und sende dein Feedback an die Aufgabe.",
  "Select a task": "Aufgabe auswählen",
  "Search tasks": "Aufgaben suchen",
  "Recent tasks": "Zuletzt bearbeitete Aufgaben",
  "Loading…": "Wird geladen…",
  "No matching tasks.": "Keine passenden Aufgaben.",
  "Task images": "Aufgabenbilder",
  "No image attachments in this task. You can open a local image instead.":
    "Diese Aufgabe hat keine Bildanhänge. Du kannst ein lokales Bild öffnen.",
  "Open local image": "Lokales Bild öffnen",
  "Change task": "Aufgabe wechseln",
  "Refresh images": "Bilder aktualisieren",
  "Choose an image to start.": "Wähle ein Bild aus.",
  Pan: "Verschieben",
  Pen: "Stift",
  Arrow: "Pfeil",
  Rectangle: "Rechteck",
  "Numbered pin": "Nummerierter Punkt",
  "Drawing tools": "Zeichenwerkzeuge",
  Color: "Farbe",
  Red: "Rot",
  Orange: "Orange",
  Blue: "Blau",
  Green: "Grün",
  Purple: "Violett",
  "Stroke width": "Strichstärke",
  Undo: "Rückgängig",
  Redo: "Wiederholen",
  "Clear marks": "Markierungen löschen",
  "Zoom out": "Verkleinern",
  "Zoom in": "Vergrößern",
  Fit: "Einpassen",
  "Actual size": "Originalgröße",
  "Show original": "Original anzeigen",
  "Download PNG": "PNG herunterladen",
  "Download review data": "Prüfdaten herunterladen",
  Feedback: "Änderungswunsch",
  "Describe the requested changes": "Beschreibe die gewünschten Änderungen",
  "What should change?": "Was soll geändert werden?",
  "Mark notes": "Notizen zu Markierungen",
  "Add a note for this mark": "Notiz zu dieser Markierung ergänzen",
  "Remove mark": "Markierung entfernen",
  "Send feedback to task": "Änderungswunsch an Aufgabe senden",
  "Retry sending": "Erneut senden",
  "Sending…": "Wird gesendet…",
  "Feedback saved to the task.": "Änderungswunsch in der Aufgabe gespeichert.",
  "Open task": "Aufgabe öffnen",
  "The original stays unchanged. An annotated PNG and your notes will be attached to this task. The assigned agent may receive Paperclip's usual comment notification.":
    "Das Original bleibt erhalten. Eine markierte PNG-Kopie und deine Notizen werden an diese Aufgabe angehängt. Die zuständige Agentin kann die übliche Paperclip-Kommentarbenachrichtigung erhalten.",
  "Drafts stay in this page until sent or downloaded.":
    "Entwürfe bleiben bis zum Senden oder Herunterladen auf dieser Seite.",
  "Discard unsent feedback and switch?":
    "Nicht gesendeten Änderungswunsch verwerfen und wechseln?",
  "Clear all marks?": "Alle Markierungen löschen?",
  "Discard this draft": "Diesen Entwurf verwerfen",
  "Sending may already have saved the image. Retry with this draft to safely finish the comment.":
    "Das Bild kann bereits gespeichert sein. Wiederhole das Senden mit diesem Entwurf, um den Kommentar sicher abzuschließen.",
  "Select your organization.": "Wähle deine Organisation aus.",
  "Choose a task to attach feedback, or open a local image to annotate and download.":
    "Wähle eine Aufgabe für deinen Änderungswunsch oder öffne ein lokales Bild zum Markieren und Herunterladen.",
  "Use the wheel to zoom. Drag with Pan to move; touch supports two-finger zoom. Shortcuts: V pan, P pen, A arrow, R rectangle, N pin, +/− zoom, F fit, Ctrl/Cmd+Z undo.":
    "Mausrad zum Zoomen, mit Verschieben ziehen; auf Touchgeräten mit zwei Fingern zoomen. Tastenkürzel: V verschieben, P Stift, A Pfeil, R Rechteck, N Punkt, +/− Zoom, F einpassen, Strg/Cmd+Z rückgängig.",
  "Images must be 20 MB or smaller.":
    "Bilder dürfen höchstens 20 MB groß sein.",
  "Use a PNG, JPEG, WebP, GIF, or BMP image.":
    "Verwende ein PNG-, JPEG-, WebP-, GIF- oder BMP-Bild.",
  "This image is too large to edit (maximum 24 megapixels and 16384 pixels per side).":
    "Dieses Bild ist zu groß (höchstens 24 Megapixel und 16384 Pixel pro Seite).",
  "Unable to decode this image.": "Dieses Bild konnte nicht geladen werden.",
  "Canvas is unavailable.": "Die Zeichenfläche ist nicht verfügbar.",
  "PNG export failed.": "PNG-Export fehlgeschlagen.",
  "Add a description before sending.":
    "Ergänze vor dem Senden eine Beschreibung.",
  "The exported PNG is larger than 20 MB. Download it instead.":
    "Die exportierte PNG-Datei ist größer als 20 MB. Lade sie stattdessen herunter.",
  "Image canvas": "Bild-Zeichenfläche",
  "Image controls": "Bildsteuerung",
  "Choose another image": "Anderes Bild wählen",
  Source: "Quelle",
  "Local image": "Lokales Bild",
  "Unsaved draft": "Nicht gesendeter Entwurf",
  Saved: "Gespeichert",
  "Showing original": "Original wird angezeigt",
  "No marks yet.": "Noch keine Markierungen.",
  "Review limit reached (200 marks).": "Limit von 200 Markierungen erreicht.",
  "Animated images are exported as a still frame.":
    "Animierte Bilder werden als Einzelbild exportiert.",
  "Image feedback": "Bildkorrektur",
  Retry: "Erneut versuchen",
  Download: "Herunterladen",
};
export function locale(value?: string | null) {
  return /^de(?:-|$)/i.test(value ?? "") ? "de" : "en";
}
export function translate(language: string, text: string) {
  return language === "de" ? (de[text] ?? text) : text;
}
