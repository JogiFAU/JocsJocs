import {progressBarHtml} from './learningProgress.js';
import {sessionDisplayName,sessionProgress,sessionAvailability} from '../quiz/sessionRecord.js';

const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function explanationHtml(welcome=false) {
  return `<section class="hero welcomeCard">
    <div class="sectionEyebrow">${welcome?'Dein Lernbegleiter':'Dein nächster Lernschritt'}</div>
    <h1>${welcome?'Willkommen bei JocsJocs 4.1':'Deine Abfragen'}</h1>
    <p class="guideLead">${welcome?'Prüfungsfragen gezielt üben, Zusammenhänge verstehen und wiederkehrende Altfragen entdecken.':'Eine kurze Lerneinheit oder eine ganze Klausur: Stelle dein Training zusammen und mache später genau dort weiter.'}</p>
    <div class="guideTiles">
      <div><h3>${welcome?'1 · Fach laden':'Neue Abfrage'}</h3><p>${welcome?'Wähle links dein Fach und klicke auf „Fach laden“. Danach erreichst du deine Abfragen und den Lernstand.':'Über den Button oben wählst du Klausuren, Themen und weitere Filter. Trainiere mit direktem Feedback oder im Prüfungsmodus.'}</p></div>
      <div><h3>${welcome?'2 · Training wählen':'High Impact'}</h3><p>${welcome?'Erstelle eine eigene Abfrage oder lasse High Impact eine kleine Auswahl aus wiederkehrenden Fragenfamilien berechnen.':'Der zweite Button oben berechnet eine möglichst kleine Referenzfragen-Auswahl für deine Zielquote in jeder gewählten Klausur.'}</p></div>
      <div><h3>${welcome?'3 · Dranbleiben':'Fortsetzen & wiederholen'}</h3><p>${welcome?'Deine Abfragen und Antworten bleiben in diesem Browser gespeichert. Pausiere jederzeit und wiederhole später gezielt Fehler.':'Unten findest du deine gespeicherten Abfragen. Setze offene fort, sieh abgeschlossene Ergebnisse an oder wiederhole nur falsche Antworten. Links kannst du stattdessen Fragen durchsuchen.'}</p></div>
    </div>
    <details class="guideDetails"><summary>KI-Hinweise und Altfragen nutzen</summary><p>In der Lösungsansicht öffnest du KI-Hinweise durch Darüberfahren, Klicken oder Tippen auf Antwortoptionen und Themenzuordnungen. Unter der Frage findest du die allgemeine Erklärung. Altfragen- und Verwandtschaftshinweise öffnen die zugehörigen Aufgaben. KI-generierte Einordnungen können Fehler enthalten; nutze sie als Lernhilfe.</p><p>Speicherstände liegen nur in diesem Browser. Sichere sie unter „Lokale Daten“, bevor du Browser oder Webadresse wechselst.</p></details>
  </section>`;
}

export function overviewHtml(sessions,questions) {
  const cards=sessions.map(session=>{
    const progress=sessionProgress(session);
    const availability=sessionAvailability(session,questions);
    const disabled=availability.missing || availability.changed || !progress.total ? 'disabled':'';
    const id=escape(session.id),name=escape(sessionDisplayName(session));
    return `<article class="queryRecord" data-query-mode="${session.quizConfig?.quizMode==='exam'?'exam':'practice'}">
      <h3>${name}</h3>
      <p class="small">${session.quizConfig?.highImpact?'High Impact · ':''}${session.quizConfig?.quizMode==='exam'?'Prüfungsmodus':'Übungsmodus'} · ${new Date(session.updatedAt || session.createdAt || 0).toLocaleString('de-DE')} · ${progress.finished?'Abgeschlossen':'Offen'}</p>
      ${progressBarHtml({...progress,wrong:progress.wrongIds.length},session.quizConfig?.quizMode==='exam')}
      <p>${progress.answered} / ${progress.total} Fragen beantwortet${progress.finished || session.quizConfig?.quizMode!=='exam'?' · '+progress.correct+' richtig · '+progress.wrongIds.length+' falsch':''}</p>
      ${availability.missing || availability.changed?`<p class="small">${availability.missing} Fragen fehlen, ${availability.changed} Fragen wurden geändert. Bitte den passenden Fachstand laden.</p>`:''}
      <div class="queryActions">
        <button class="btn" data-query-action="open" data-query-id="${id}" ${disabled}>${progress.finished?'Ergebnis ansehen':'Fortsetzen'}</button>
        ${progress.finished?`<button class="btn" data-query-action="wrong" data-query-id="${id}" ${disabled || (!progress.wrongIds.length?'disabled':'')}>Nur falsche wiederholen (${progress.wrongIds.length})</button>`:''}
        <button class="btn" data-query-action="restart" data-query-id="${id}" ${disabled}>Neu starten</button>
        <button class="btn danger" data-query-action="delete" data-query-id="${id}">Löschen</button>
      </div>
    </article>`;
  }).join('');
  return explanationHtml()+`<section class="hero queryArchive"><div class="sectionEyebrow">Dein Trainingsarchiv</div><h2>Gespeicherte Abfragen</h2>
    <p class="small">${sessions.length} Abfragen in diesem Fach · neueste zuerst</p>
    ${cards?`<div class="queryList" tabindex="0" aria-label="Gespeicherte Abfragen">${cards}</div>`:'<p>Noch keine Abfrage gespeichert. Erstelle deine erste Abfrage.</p>'}

  </section>`;
}
