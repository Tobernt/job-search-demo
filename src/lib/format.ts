import type { ApplyType, EmployerType, EmploymentExtent, WorkMode } from "./types";

export function formatEmploymentExtent(extent?: EmploymentExtent) {
  return {
    full_time: "Heltid",
    part_time: "Deltid",
    mixed: "Heltid/deltid",
    unclear: "Omfattning oklar"
  }[extent ?? "unclear"];
}

export function formatWorkMode(mode: WorkMode) {
  return {
    remote: "Distans",
    hybrid: "Hybrid",
    onsite: "På plats",
    unclear: "Oklar"
  }[mode];
}

export function formatEmployerType(type: EmployerType) {
  return {
    direct_employer: "Arbetsgivare som annonsör",
    recruiter: "Rekryterare",
    staffing_agency: "Bemanningsföretag",
    unknown: "Okänd annonsör"
  }[type];
}

export function formatApplyType(value: ApplyType) {
  return {
    employer_site: "Arbetsgivarens sida",
    ats: "Externt rekryteringssystem",
    email: "E-post",
    via_af: "Platsbanken",
    recruiter: "Rekryterare",
    unknown: "Okänd"
  }[value] ?? "Okänd";
}
