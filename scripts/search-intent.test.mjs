import assert from "node:assert/strict";
import test from "node:test";
import { buildSearchIntent, normalizeIntentText } from "../src/lib/search-intent.mjs";
import { canonicalizeTitle } from "./job-utils.mjs";

test("IT aliases resolve to the IT category", () => {
  for (const query of ["IT", "tech", "developer", "frontend", "data engineer", "BI"]) {
    const intent = buildSearchIntent(query);
    assert.equal(intent.hasIntent, true, query);
    assert.ok(intent.categories.includes("it"), query);
  }
});

test("UX and UI aliases require role-level matching inside IT", () => {
  for (const query of ["UX", "UI/UX", "product designer", "interaktionsdesigner"]) {
    const intent = buildSearchIntent(query);
    assert.equal(intent.hasIntent, true, query);
    assert.equal(intent.requireRoleMatch, true, query);
    assert.ok(intent.categories.includes("it"), query);
    assert.ok(intent.roleTerms.some((term) => ["ux", "ui", "product designer", "interaktionsdesigner"].includes(term)), query);
  }
});

test("common Swedish category aliases normalize without accents", () => {
  const examples = [
    ["vård", "vard"],
    ["ekonomi", "ekonomi"],
    ["lager", "lager"],
    ["bygg", "bygg"],
    ["restaurang", "restaurang"],
    ["juridik", "juridik"],
    ["marknadsföring", "marknadsforing"]
  ];

  for (const [query, category] of examples) {
    const intent = buildSearchIntent(query);
    assert.equal(intent.hasIntent, true, query);
    assert.ok(intent.categories.includes(category) || intent.roleTerms.includes(normalizeIntentText(query)), query);
  }
});

test("UX/UI titles classify as IT canonical roles", () => {
  const result = canonicalizeTitle({
    id: "ux-1",
    headline: "UX-designer",
    occupation: { label: "" },
    occupation_field: { label: "" },
    description: { text: "Vi söker en UX designer för digital produktutveckling." }
  });

  assert.equal(result.titleCategory, "IT");
  assert.equal(result.canonicalTitle, "UX/UI Designer");
});

test("business development titles are not classified as software developers", () => {
  const result = canonicalizeTitle({
    id: "business-dev-1",
    headline: "Affärsutvecklare",
    occupation: { label: "" },
    occupation_field: { label: "" },
    description: { text: "Strategi, partnerskap och marknad." }
  });

  assert.notEqual(result.canonicalTitle, "Systemutvecklare");
});
