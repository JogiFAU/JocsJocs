import { hash32 } from "../utils.js";

const verbs = ["schrieb", "merkte an", "sinnierte", "gab zum Besten", "ließ verlauten"];

export function renderComments(question) {
  const comments = question.docsDocsComments;
  if (!comments?.length) return null;

  const details = document.createElement("details");
  details.className = "commentThread";
  const summary = document.createElement("summary");
  const title = document.createElement("span");
  title.textContent = "DocsDocs-Kommentare";
  const count = document.createElement("span");
  count.className = "commentThread__count";
  count.textContent = String(comments.length);
  summary.append(count, title);
  details.appendChild(summary);

  const list = document.createElement("ol");
  list.setAttribute("role", "list");
  comments.forEach(({ author, text }, index) => {
    const item = document.createElement("li");
    const heading = document.createElement("div");
    heading.className = "commentThread__byline";
    const name = document.createElement("strong");
    name.textContent = author || "Unbekannt";
    const verb = verbs[hash32(`${question.id}:${index}`) % verbs.length];
    heading.append(name, ` ${verb}:`);
    const body = document.createElement("p");
    body.textContent = text;
    item.append(heading, body);
    list.appendChild(item);
  });
  details.appendChild(list);
  return details;
}
