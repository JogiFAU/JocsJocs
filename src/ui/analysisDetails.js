// Lazy, lossless clinical detail view. Presentation text is derived from structured annotations.
import { renderAiMarkdown } from "./markdown.js";

const labels = {
  analysisMode:'Bewertungsmodus',selectionIntent:'Auswahlauftrag im Original',cue:'Wörtlicher Auswahlhinweis',
  selectionAudit:'Unabhängige Prüfung der Auswahlrichtung',questionFit:'Passung zur Originalfrage',
  fitReason:'Begründung der Fragepassung',selectionCheck:'Abgleich von Fachurteil und Fragepassung',
  reportedFit:'Passung aus Einzelbewertung',auditedFit:'Unabhängig geprüfte Passung',expectedFit:'Regelbasiert erwartete Passung',
  taskFrame:'Fachlicher Aufgabenrahmen',factualTask:'Fachliche Prüfaufgabe',caseConditions:'Fallbedingungen',
  selectionMode:'Art des Auswahlauftrags',protocolIssues:'Unsicherheiten des Gedächtnisprotokolls',
  hypotheticalReadings:'Hypothetische Lesarten · keine Originalkorrektur',statementAssessment:'Verständnis der Originaloption',
  evaluatedStatement:'Tatsächlich geprüfte Aussage',alternativeReadings:'Alternative Lesarten',assumptions:'Zusätzliche Annahmen',
  questionReview:'Gemeinsame Konsistenzprüfung und Gesamteinordnung',relativeComparison:'Vorläufiger Bestantwortvergleich',
  preferredOptionIds:'Vorgeschlagene Optionen · keine bestätigte Auswahl',claimRefs:'Referenzen auf geprüfte Teilbehauptungen',
  sourceSelections:"Relevanzprüfung der Quellen",assessments:"Bewertete Quellenkandidaten",admitted:"Als Beleg zugelassen",
  acceptedEvidenceIds:"Zugelassene Belege",stage:"Verarbeitungsschritt",
  optionId:"Antwort-ID",text:"Aussage",followupQueries:"Suchanfragen für fehlende Belege",citationIssues:"Probleme mit Quellenbezügen",
  retrievedEvidenceIds:"Gefundene Belege",providedPageImages:"Tatsächlich bereitgestellte Quellenbilder",
  status:"Bearbeitungsstatus",originalAnswerKey:"Lösungsschlüssel der Eingabe",optionIds:"Antwort-IDs",
  interpretation:"Prüfungsauftrag",questionType:"Fragentyp",polarity:"Polarität",objective:"Geprüfter Lerninhalt",
  entities:"Fachbegriffe und Entitäten",conditions:"Bedingungen",missingInformation:"Fehlende Angaben",
  quality:"Qualitätsprüfung",inputIssues:"Eingabeprobleme",evidenceIssues:"Belegprobleme",conflicts:"Widersprüche",
  unresolvedOptions:"Offene Antwortoptionen",topicMapping:"Themenzuordnung",primaryTopic:"Hauptthema",secondaryTopics:"Weitere Themen",
  learningObjective:"Abstrahiertes Lernziel",subject:"Gegenstand",operation:"Prüfoperation",knowledgeRequired:"Benötigtes Wissen",
  decisiveConditions:"Entscheidende Bedingungen",uncertainties:"Unsicherheiten",reason:"Begründung",explanation:"Erklärung",
  concept:"Fachliche Einordnung",judgment:"Sachliche Bewertung",decision:"Auswahlentscheidung",claims:"Einzelbehauptungen",
  knowledgeBasis:"Wissensgrundlage",evidenceStatus:"Belegstatus",sourceAssessment:"Prüfung ausschließlich gegen die Wissensbasis",
  finalAssessment:"Bewertung in der integrierten Gesamtlösung",truth:"Sachliche Wahrheit",qualityIssues:"Formulierungsprobleme",
  missingEvidence:"Fehlende Belege",citations:"Quellenbezüge",quote:"Zitierte Stelle",layer:"Quellenebene",evidenceId:"Beleg-ID",
  solution:"Gesamtlösung",selectedOptionIds:"KI-Auswahlvorschlag (Antwort-IDs)",answerText:"Antworttext",
  evidenceCritic:"Kritische Quellenprüfung",verdict:"Prüfergebnis",questionAnswered:"Prüfungsauftrag beantwortet",
  secondOpinion:"Medizinische Zweitprüfung",preliminaryGate:"Zusätzliche Qualitätsprüfung",
  questionVisualProfiles:"Fragebilder: Inhalt und Suchbegriffe",questionImageLinks:"Abgleich mit Quellenbildern",
  relation:"Beziehung",similarities:"Gemeinsamkeiten",differences:"Unterschiede",searchTerms:"Suchbegriffe",observations:"Beobachtungen",
  labels:"Lesbare Beschriftungen",qwen:"Qwen-Bildbeschreibung",medgemma:"MedGemma-Bildanalyse",medicalRequired:"Medizinische Analyse erforderlich",
  visualRetrievalStatus:"Status der Bildsuche",visualRetrievalWarnings:"Probleme bei der Bildsuche",imageContext:"Bildkontext",
  diagnostics:"Bearbeitungsprobleme und ausgelassener Kontext",contextOmissions:"Wegen Kontextgrenze ausgelassene Belege",
  originalComparison:"Vergleich mit dem Eingabeschlüssel",sourceText:"Extrahierter Originaltext",ocrText:"OCR-Text",
  metadata:"Quellenstand und Dokumentrolle",sourcePaths:"Quelldateien",pdfPage:"PDF-Seite",visualAsset:"Analyse des Bildbereichs",
  sourceMedia:"Darstellbare Quellenbilder",previousAnnotations:"Frühere Annotationen der Eingabedatei",
  objectiveGroups:"Bestätigte Lernzielgruppen",taskGroups:"Engere Aufgabenfamilien",relations:"Geprüfte Fragepaare",
  members:"Gruppenmitglieder (Vorkommens-IDs)",knownExamCount:"Bekannte Prüfungen",years:"Bekannte Jahre",
  changedConditions:"Geänderte Bedingungen",changedOptions:"Geänderte Antwortoptionen",inversePolarity:"Umgekehrte Fragestellung",
  sharedObjective:"Gemeinsamer konkreter Lerninhalt",objectiveVerified:"Lernziel anhand der Originale bestätigt"
};
const values = {true:"richtig",false:"falsch",undetermined:"nicht zuverlässig beurteilbar",partly_true:"teilweise richtig",conditional:"von Bedingungen abhängig",
  analyzed:"analysiert",not_applicable:"nicht erforderlich",completed:"abgeschlossen",provided:"in der Eingabe vorhanden",missing:"fehlt",invalid:"ungültig",
  select:"auswählen",reject:"nicht auswählen",knowledgebase:"Wissensbasis",model_knowledge_supplement:"ergänzendes Modellwissen, nicht quellenbestätigt",
  supported:"quellengestützt geprüft",partial:"offene Punkte",conflict:"Widerspruch",technical_error:"technischer Fehler",not_processed:"noch nicht verarbeitet",
  pending:"ausstehend",source_cited:"Quellenbezüge geprüft",model_knowledge_unverified:"Modellwissen, nicht quellenbestätigt",invalid_citations:"ungültige Quellenbezüge",
  same_image:"dieselbe Abbildung",same_visual_content:"derselbe konkrete Bildinhalt",related_concept:"verwandte Darstellung",
  same_learning_objective:"derselbe konkrete Lerninhalt",exact_duplicate:"identische Aufgabe",equivalent_task:"äquivalente Aufgabe",related_topic:"nur verwandtes Thema",
  medical_pending:"medizinische Bildanalyse noch offen",uncertain:"unsicher",agrees:"stimmt überein",differs:"weicht ab",not_comparable:"nicht vergleichbar"};

function appendValue(parent,key,value) {
  const label = Object.hasOwn(labels,key) ? labels[key] : key;
  if (value !== null && typeof value === "object") {
    const details=document.createElement("details");
    const title=document.createElement("summary");
    title.textContent=label+(Array.isArray(value) ? ` (${value.length})` : "");
    details.appendChild(title);
    let loaded=false;
    details.addEventListener("toggle",()=>{
      if (!details.open || loaded) return;
      loaded=true;
      const entries=Object.entries(value);
      if (!entries.length) {const empty=document.createElement("p");empty.textContent="Keine Einträge.";details.appendChild(empty);}
      for (const [name,child] of entries) appendValue(details,Array.isArray(value) ? String(Number(name)+1) : name,child);
    });
    parent.appendChild(details);
  } else {
    const row=document.createElement("div");row.className="analysisDetails__field";
    const heading=document.createElement("strong");heading.textContent=label+": ";row.appendChild(heading);
    const body=document.createElement("div");body.className="aiMarkdown";
    const rendered=value == null ? "Noch nicht verfügbar." : typeof value === "boolean" ? (value ? "ja" : "nein") : Object.hasOwn(values,value) ? values[value] : String(value);
    body.innerHTML=renderAiMarkdown(rendered);row.appendChild(body);parent.appendChild(row);
  }
}

export function renderAnalysisDetails(question) {
  if (!question.analysis) return null;
  const root=document.createElement("details");root.className="analysisDetails";
  const title=document.createElement("summary");title.textContent="Fachliche Analyse im Detail";root.appendChild(title);
  let loaded=false;
  root.addEventListener("toggle",()=>{
    if (!root.open || loaded) return;
    loaded=true;
    for (const key of ["status","originalAnswerKey","interpretation","topicMapping","learningObjective","quality","solution","evidenceCritic","secondOpinion"])
      appendValue(root,key,question.analysis[key]);
    question.optionAnalyses.forEach((review,index)=>appendValue(root,`Option ${index+1}: ${question.answers[index]?.text || ""}`,review));
    for (const key of ["questionVisualProfiles","questionImageLinks","visualRetrievalStatus","visualRetrievalWarnings","originalComparison","diagnostics"])
      appendValue(root,key,question.analysis[key]);
    appendValue(root,"Altfragen und Lernzielbezüge",question.relationshipDetails);
    appendValue(root,"Originaltexte und Quellenanalysen",question.analysis.evidence);
    appendValue(root,"Originale Eingabeangaben",question.originalFields);
    if (question.provenance) appendValue(root,"Historie der Eingabe",question.provenance);
    else if (question.datasetAnnotation.inputContexts?.length) appendValue(root,"Historischer Datensatzkontext",question.datasetAnnotation.inputContexts);
    appendValue(root,"Verwendeter Wissens- und Modellstand",{knowledgeSnapshot:question.datasetAnnotation.knowledgeSnapshot,models:question.datasetAnnotation.models});
  });
  return root;
}
