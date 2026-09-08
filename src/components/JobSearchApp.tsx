"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  MapPin,
  Moon,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  X
} from "lucide-react";
import type { ApplyType, EmployerType, EmploymentExtent, Job, Seniority, WorkMode } from "@/lib/types";
import { getCanonicalTitleNote, getDisplayTitle } from "@/lib/job-title";
import { DEFAULT_SORT_MODE, formatEmploymentExtent, formatPostedWithin, formatWorkMode, getJobExplanations } from "@/lib/search";
import type { PostedWithin, SortMode } from "@/lib/search";
import type { GoogleAdPolicy } from "@/lib/ad-eligibility";
import { getInFeedAdLayoutKey } from "@/lib/adsense";
import type { SponsorAd } from "@/lib/sponsors";
import { DisplayAdSlot } from "@/components/DisplayAdSlot";
import { SponsorCard } from "@/components/SponsorCard";
import { formatCheckedAt, formatSwedishDate } from "@/lib/date-format";
import type { LandingLinkGroup } from "@/lib/seo-landings";
import {
  addId,
  emptyLocalJobState,
  JOB_STATE_STORAGE_KEY,
  LocalJobState,
  readLocalJobState,
  toggleId,
  writeLocalJobState
} from "@/lib/local-job-state";

type UtilityView = "results" | "saved" | "alerts" | "history" | "settings";
type MobileStep = "list" | "filters" | "preview";

interface SavedSearch {
  id: string;
  label: string;
  query: string;
  location: string;
  workMode: WorkMode | "all";
  employmentExtent: EmploymentExtent | "all";
  seniority?: Seniority | "all";
  titleCategory?: string;
  titleCategories?: string[];
  distanceRadius: number;
  postedWithin: PostedWithin;
  salaryOnly: boolean;
  createdAt: string;
}

const SAVED_SEARCHES_KEY = "jobsearchdemo.savedSearches.v1";
const LEGACY_SAVED_SEARCHES_KEYS = ["jobsearchdemo.savedSearches.v1"];
const THEME_KEY = "jobsearchdemo.theme.v1";
const LEGACY_THEME_KEYS = ["jobsearchdemo.theme.v1"];
const DISTANCE_OPTIONS = [1, 5, 10, 25, 50];
const TITLE_CATEGORY_OPTIONS = [
  "IT",
  "Vård",
  "Ekonomi",
  "Administration",
  "Service",
  "Utbildning",
  "Bygg",
  "Industri",
  "Transport",
  "Lager",
  "Restaurang",
  "Handel",
  "Juridik",
  "HR",
  "Marknad",
  "Projektledning",
  "Ledning",
  "Omsorg",
  "Apotek",
  "Djurvård",
  "Övrigt"
];
const JOBS_PER_PAGE = 100;
const SEARCH_DEBOUNCE_MS = 180;
const SEARCH_TIMEOUT_MS = 3000;
const JOB_ALERTS_URL = "/jobbaviseringar";
const emptyGoogleAdPolicy: GoogleAdPolicy = {
  googleAdsEligible: false,
  reason: "not_configured",
  slots: [],
  minimumVisibleJobs: Number.POSITIVE_INFINITY
};

interface PageGuide {
  title: string;
  sections: Array<{ title: string; text: string }>;
}

export function JobSearchApp({
  jobs,
  initialTotal = jobs.length,
  initialQuery = "",
  initialLocation = "",
  initialWorkMode = "all",
  initialEmploymentExtent = "all",
  landingLinkGroups = [],
  pageIntro,
  pageGuide,
  adPolicy = emptyGoogleAdPolicy,
  sponsors = {}
}: {
  jobs: Job[];
  initialTotal?: number;
  initialQuery?: string;
  initialLocation?: string;
  initialWorkMode?: WorkMode | "all";
  initialEmploymentExtent?: EmploymentExtent | "all";
  landingLinkGroups?: LandingLinkGroup[];
  pageIntro?: { title: string; text: string };
  pageGuide?: PageGuide;
  adPolicy?: GoogleAdPolicy;
  sponsors?: {
    topSearch?: SponsorAd;
    emptyState?: SponsorAd;
  };
}) {
  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation);
  const [submittedLocation, setSubmittedLocation] = useState(initialLocation.trim());
  const [distanceRadius, setDistanceRadius] = useState(5);
  const [workMode, setWorkMode] = useState<WorkMode | "all">(initialWorkMode);
  const [employmentExtent, setEmploymentExtent] = useState<EmploymentExtent | "all">(initialEmploymentExtent);
  const [seniority, setSeniority] = useState<Seniority | "all">("all");
  const [titleCategories, setTitleCategories] = useState<string[]>([]);
  const [postedWithin, setPostedWithin] = useState<PostedWithin>("all");
  const [employerType, setEmployerType] = useState<EmployerType | "all">("all");
  const [includeSales, setIncludeSales] = useState(false);
  const [includeIntermediaries, setIncludeIntermediaries] = useState(false);
  const [salaryOnly, setSalaryOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>(DEFAULT_SORT_MODE);
  const [hideApplied, setHideApplied] = useState(false);
  const [hideHidden, setHideHidden] = useState(true);
  const [jobState, setJobState] = useState<LocalJobState>(emptyLocalJobState);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [hydratedLocalState, setHydratedLocalState] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [utilityView, setUtilityView] = useState<UtilityView>("results");
  const [mobileStep, setMobileStep] = useState<MobileStep>("list");
  const [desktopFilterDockOpen, setDesktopFilterDockOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [serverJobs, setServerJobs] = useState(jobs);
  const [totalJobs, setTotalJobs] = useState(initialTotal);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedId, setSelectedId] = useState(jobs[0]?.id ?? "");
  const latestSearchId = useRef(0);
  const lastFilterKey = useRef("");
  const loadedRequestKey = useRef(buildSearchRequestKey({
    query: initialQuery,
    location: initialLocation,
    workMode: initialWorkMode,
    employmentExtent: initialEmploymentExtent,
    seniority: "all",
    titleCategories: [],
    distanceRadius: initialLocation.trim() ? 5 : 0,
    postedWithin: "all",
    employerType: "all",
    includeSales: false,
    includeIntermediaries: false,
    salaryOnly: false,
    sortMode: DEFAULT_SORT_MODE,
    page: 1
  }));

  useEffect(() => {
    setServerJobs(jobs);
    setTotalJobs(initialTotal);
    setSelectedId(jobs[0]?.id ?? "");
    setPage(1);
    loadedRequestKey.current = buildSearchRequestKey({
      query: initialQuery,
      location: initialLocation,
      workMode: initialWorkMode,
      employmentExtent: initialEmploymentExtent,
      seniority: "all",
      titleCategories: [],
      distanceRadius: initialLocation.trim() ? 5 : 0,
      postedWithin: "all",
      employerType: "all",
      includeSales: false,
      includeIntermediaries: false,
      salaryOnly: false,
      sortMode: DEFAULT_SORT_MODE,
      page: 1
    });
    setTitleCategories([]);
    setSortMode(DEFAULT_SORT_MODE);
    setSubmittedLocation(initialLocation.trim());
  }, [jobs, initialTotal, initialQuery, initialLocation, initialWorkMode, initialEmploymentExtent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth > 900) {
      setDesktopFilterDockOpen(true);
      setMobileStep("filters");
    }
  }, []);

  const locationKey = location.trim();
  const hasLocationFilter = Boolean(locationKey) && locationKey === submittedLocation;
  const showDistanceFilter = Boolean(locationKey);
  const activeDistanceRadius = hasLocationFilter ? distanceRadius : 0;

  useEffect(() => {
    const filterKey = buildSearchFilterKey({
      query,
      location,
      workMode,
      employmentExtent,
      seniority,
      titleCategories,
      distanceRadius: activeDistanceRadius,
      postedWithin,
      employerType,
      includeSales,
      includeIntermediaries,
      salaryOnly,
      sortMode
    });
    if (!lastFilterKey.current) {
      lastFilterKey.current = filterKey;
      return;
    }
    if (filterKey !== lastFilterKey.current) {
      lastFilterKey.current = filterKey;
      if (page !== 1) setPage(1);
    }
  }, [query, location, workMode, employmentExtent, seniority, titleCategories, activeDistanceRadius, postedWithin, employerType, includeSales, includeIntermediaries, salaryOnly, sortMode, page]);

  useEffect(() => {
    setJobState(readLocalJobState());
    setSavedSearches(readSavedSearches());
    setDarkMode(readDarkModePreference());
    setHydratedLocalState(true);

    function handleStorage(event: StorageEvent) {
      if (event.key === JOB_STATE_STORAGE_KEY) setJobState(readLocalJobState());
      if (event.key === SAVED_SEARCHES_KEY || LEGACY_SAVED_SEARCHES_KEYS.includes(event.key ?? "")) setSavedSearches(readSavedSearches());
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (hydratedLocalState) writeLocalJobState(jobState);
  }, [hydratedLocalState, jobState]);

  useEffect(() => {
    if (hydratedLocalState && typeof window !== "undefined") {
      safeSetLocalStorage(SAVED_SEARCHES_KEY, JSON.stringify(savedSearches));
    }
  }, [hydratedLocalState, savedSearches]);

  useEffect(() => {
    if (mobileStep === "list" || typeof window === "undefined") return;
    if (window.innerWidth <= 900) window.scrollTo({ top: 0, behavior: "auto" });
  }, [mobileStep]);

  useEffect(() => {
    if (!hydratedLocalState || typeof document === "undefined") return;

    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    safeSetLocalStorage(THEME_KEY, darkMode ? "dark" : "light");
  }, [darkMode, hydratedLocalState]);

  useEffect(() => {
    if (!locationKey && submittedLocation) setSubmittedLocation("");
  }, [locationKey, submittedLocation]);

  useEffect(() => {
    const requestKey = buildSearchRequestKey({
      query,
      location,
      workMode,
      employmentExtent,
      seniority,
      titleCategories,
      distanceRadius: activeDistanceRadius,
      postedWithin,
      employerType,
      includeSales,
      includeIntermediaries,
      salaryOnly,
      sortMode,
      page
    });
    if (requestKey === loadedRequestKey.current) return;

    const controller = new AbortController();
    const searchId = latestSearchId.current + 1;
    latestSearchId.current = searchId;
    const timeout = window.setTimeout(async () => {
      setLoadingJobs(true);
      const requestTimeout = window.setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
      const params = new URLSearchParams({
        q: query,
        location,
        workMode,
        employmentExtent,
        seniority,
        titleCategories: titleCategories.join(","),
        distanceRadius: String(activeDistanceRadius),
        postedWithin,
        employerType,
        includeSales: String(includeSales),
        includeIntermediaries: String(includeIntermediaries),
        salaryOnly: String(salaryOnly),
        sort: sortMode,
        page: String(page),
        limit: String(JOBS_PER_PAGE)
      });

      try {
        const response = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Search failed with ${response.status}`);
        const payload = await response.json() as { jobs: Job[]; total: number };
        if (searchId !== latestSearchId.current) return;
        setServerJobs(payload.jobs);
        setTotalJobs(payload.total);
        loadedRequestKey.current = requestKey;
        setSelectedId((current) => payload.jobs.some((job) => job.id === current) ? current : payload.jobs[0]?.id ?? "");
      } catch (error) {
        void error;
      } finally {
        window.clearTimeout(requestTimeout);
        if (searchId === latestSearchId.current) setLoadingJobs(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, location, workMode, employmentExtent, seniority, titleCategories, activeDistanceRadius, postedWithin, employerType, includeSales, includeIntermediaries, salaryOnly, sortMode, page]);

  const filtered = useMemo(() => (
    serverJobs.filter((job) => {
      if (hideApplied && jobState.applied.includes(job.id)) return false;
      if (hideHidden && jobState.hidden.includes(job.id)) return false;
      return true;
    })
  ), [
    serverJobs,
    hideApplied,
    hideHidden,
    jobState.applied,
    jobState.hidden
  ]);

  const selected = filtered.find((job) => job.id === selectedId) ?? filtered[0];
  const totalPages = Math.max(1, Math.ceil(totalJobs / JOBS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visibleJobs = filtered;
  const suppressedCounts = useMemo(() => ({
    sales: serverJobs.filter((job) => job.salesNoise).length,
    intermediaries: serverJobs.filter((job) => ["recruiter", "staffing_agency"].includes(job.employerType)).length,
    failedLinks: serverJobs.filter((job) => job.applyLinkStatus === "failed").length
  }), [serverJobs]);
  const activeFilterCount = [
    workMode !== "all",
    employmentExtent !== "all",
    seniority !== "all",
    titleCategories.length > 0,
    postedWithin !== "all",
    employerType !== "all",
    includeSales,
    includeIntermediaries,
    salaryOnly,
    hideApplied,
    !hideHidden,
    hasLocationFilter && distanceRadius !== 5
  ].filter(Boolean).length;
  const historyJobs = useMemo(() => {
    const ids = new Set([...jobState.applied, ...jobState.saved, ...jobState.viewed, ...jobState.hidden, ...jobState.reported]);
    return serverJobs.filter((job) => ids.has(job.id)).slice(0, 12);
  }, [serverJobs, jobState.applied, jobState.saved, jobState.viewed, jobState.hidden, jobState.reported]);
  const savedJobs = useMemo(() => {
    const ids = new Set(jobState.saved);
    return serverJobs.filter((job) => ids.has(job.id)).slice(0, JOBS_PER_PAGE);
  }, [serverJobs, jobState.saved]);

  useEffect(() => {
    setPage(1);
  }, [query, location, workMode, employmentExtent, seniority, titleCategories, distanceRadius, postedWithin, employerType, includeSales, includeIntermediaries, salaryOnly, sortMode, hideApplied, hideHidden]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function updateJobState(updater: (state: LocalJobState) => LocalJobState) {
    setJobState((current) => updater(current));
  }

  function toggleSaved(jobId: string) {
    updateJobState((state) => ({ ...state, saved: toggleId(state.saved, jobId) }));
  }

  function toggleHidden(jobId: string) {
    updateJobState((state) => ({ ...state, hidden: toggleId(state.hidden, jobId) }));
  }

  function markViewed(jobId: string) {
    updateJobState((state) => ({ ...state, viewed: addId(state.viewed, jobId) }));
  }

  function markApplied(jobId: string) {
    updateJobState((state) => ({
      ...state,
      applied: addId(state.applied, jobId),
      viewed: addId(state.viewed, jobId)
    }));
  }

  function markReported(jobId: string) {
    updateJobState((state) => ({ ...state, reported: addId(state.reported, jobId) }));
  }

  async function reportJob(jobId: string) {
    markReported(jobId);
    await fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId, reportType: "user_reported_from_preview", reportText: "Rapporterad från förhandsvisningen." })
    }).catch(() => undefined);
  }

  function resetFilters() {
    setQuery("");
    setLocation("");
    setSubmittedLocation("");
    setDistanceRadius(5);
    setWorkMode("all");
    setEmploymentExtent("all");
    setSeniority("all");
    setTitleCategories([]);
    setPostedWithin("all");
    setEmployerType("all");
    setIncludeSales(false);
    setIncludeIntermediaries(false);
    setSalaryOnly(false);
    setSortMode(DEFAULT_SORT_MODE);
    setHideApplied(false);
    setHideHidden(true);
  }

  function saveCurrentSearch(targetView: UtilityView = "saved") {
    const label = buildSavedSearchLabel({
      query,
      location,
      workMode,
      employmentExtent,
      seniority,
      titleCategories,
      distanceRadius: hasLocationFilter ? distanceRadius : 0,
      postedWithin,
      salaryOnly
    });
    const nextSearch: SavedSearch = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      query,
      location,
      workMode,
      employmentExtent,
      seniority,
      titleCategories,
      distanceRadius,
      postedWithin,
      salaryOnly,
      createdAt: new Date().toISOString()
    };

    setSavedSearches((current) => [nextSearch, ...current.filter((item) => item.label !== label)].slice(0, 12));
    setUtilityView(targetView);
    setMobileStep("list");
  }

  function applySavedSearch(search: SavedSearch) {
    setQuery(search.query);
    setLocation(search.location);
    setSubmittedLocation(search.location.trim());
    setWorkMode(search.workMode);
    setEmploymentExtent(search.employmentExtent);
    setSeniority(search.seniority ?? "all");
    setTitleCategories(normalizeSavedTitleCategories(search));
    setDistanceRadius(search.distanceRadius ?? 5);
    setPostedWithin(search.postedWithin ?? "all");
    setSalaryOnly(search.salaryOnly);
    setUtilityView("results");
    setMobileStep("list");
  }

  function clearLocalState() {
    setJobState(emptyLocalJobState);
  }

  function toggleTitleCategory(category: string) {
    setTitleCategories((current) => (
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    ));
  }

  function selectJobFromUtility(jobId: string) {
    setSelectedId(jobId);
    markViewed(jobId);
    if (jobState.hidden.includes(jobId)) setHideHidden(false);
    setUtilityView("results");
    setMobileStep("preview");
  }

  function closePreview() {
    if (typeof window !== "undefined" && window.innerWidth > 900) {
      setMobileStep(desktopFilterDockOpen ? "filters" : "list");
      return;
    }
    setMobileStep("list");
  }

  function toggleFilterDock() {
    if (typeof window !== "undefined" && window.innerWidth > 900) {
      const nextOpen = !desktopFilterDockOpen;
      setDesktopFilterDockOpen(nextOpen);
      if (mobileStep !== "preview") setMobileStep(nextOpen ? "filters" : "list");
      return;
    }
    setMobileStep((step) => (step === "filters" ? "list" : "filters"));
  }

  function closeFilterDock() {
    setDesktopFilterDockOpen(false);
    setMobileStep("list");
  }

  function showUtilityView(view: UtilityView) {
    setUtilityView(view);
    setMobileStep("list");
  }

  function showSearchResults() {
    setSubmittedLocation(location.trim());
    setUtilityView("results");
    setMobileStep("list");
  }

  const filterDockVisible = mobileStep === "filters" || (mobileStep === "preview" && desktopFilterDockOpen);
  const googleAdsVisible = adPolicy.googleAdsEligible
    && utilityView === "results"
    && totalJobs >= adPolicy.minimumVisibleJobs
    && visibleJobs.length >= adPolicy.minimumVisibleJobs;
  const topGoogleAdSlot = googleAdsVisible && adPolicy.slots.includes("results_top")
    ? adPolicy.slotIds?.results_top ?? ""
    : "";
  const googleAdSlotIds = {
    after8: googleAdsVisible && visibleJobs.length >= 9 && adPolicy.slots.includes("results_after_8")
      ? adPolicy.slotIds?.results_after_8 ?? ""
      : "",
    after24: googleAdsVisible && visibleJobs.length >= 25 && adPolicy.slots.includes("results_after_24")
      ? adPolicy.slotIds?.results_after_24 ?? ""
      : "",
    after48: googleAdsVisible && visibleJobs.length >= 49 && adPolicy.slots.includes("results_after_48")
      ? adPolicy.slotIds?.results_after_48 ?? ""
      : "",
    bottom: googleAdsVisible && visibleJobs.length >= 100 && adPolicy.slots.includes("results_bottom")
      ? adPolicy.slotIds?.results_bottom ?? ""
      : ""
  };
  const inFeedAdLayoutKey = getInFeedAdLayoutKey();

  return (
    <main className="app-shell" data-mobile-step={mobileStep} data-desktop-filter-open={desktopFilterDockOpen ? "true" : "false"}>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Job Search Demo">
          <span className="brand-mark">
            <img src="/icon.svg" alt="" />
          </span>
          <strong>Job Search Demo</strong>
        </Link>
        <nav className="topnav" aria-label="Huvudmeny">
          <Link href="/distansjobb">Distansjobb</Link>
          <TopNavButton active={utilityView === "saved"} onClick={() => showUtilityView("saved")}>Sparade sökningar</TopNavButton>
          <TopNavButton active={utilityView === "alerts"} onClick={() => showUtilityView("alerts")}>Bevakningar</TopNavButton>
          <TopNavButton active={utilityView === "history"} onClick={() => showUtilityView("history")}>Historik</TopNavButton>
          <TopNavButton active={utilityView === "settings"} onClick={() => showUtilityView("settings")}>Inställningar</TopNavButton>
        </nav>
        <button
          className="icon-button"
          type="button"
          aria-label={darkMode ? "Ljust läge" : "Mörkt läge"}
          aria-pressed={darkMode}
          title={darkMode ? "Ljust läge" : "Mörkt läge"}
          onClick={() => setDarkMode((current) => !current)}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <section className={`search-strip ${showDistanceFilter ? "" : "no-radius"}`} aria-label="Primär sökning">
        <AutocompleteInput
          icon={<Search size={20} />}
          label="Sök yrke eller roll"
          placeholder="ex. utvecklare, sjuksköterska, ekonomi"
          type="title"
          value={query}
          onChange={setQuery}
        />
        <AutocompleteInput
          icon={<MapPin size={20} />}
          label="Sök ort eller region"
          placeholder="ex. Stockholm, Göteborg eller kommun"
          type="location"
          value={location}
          onChange={setLocation}
        />
        {showDistanceFilter ? (
          <label className="select-shell distance-select">
            <span className="sr-only">Sökradie</span>
            <select value={distanceRadius} onChange={(event) => setDistanceRadius(Number(event.target.value))}>
              {DISTANCE_OPTIONS.map((value) => (
                <option key={value} value={value}>Inom {value} mil</option>
              ))}
            </select>
          </label>
        ) : null}
        <button className="search-button" type="button" onClick={showSearchResults}>
          Sök jobb
        </button>
        <button className="save-search" type="button" onClick={() => saveCurrentSearch("saved")}><Bookmark size={18} /> Spara sökning</button>
      </section>

      {pageIntro ? (
        <section className="page-intro">
          <h1>{pageIntro.title}</h1>
          <p>{pageIntro.text}</p>
          <p className="page-intro-note">
            Job Search Demo är en oberoende söktjänst för publika jobbannonser.
            Ansökningar hanteras av respektive arbetsgivare, rekryterare eller annonsör.
          </p>
          {landingLinkGroups.length ? (
            <nav className="landing-link-groups" aria-label="Relaterade jobbsökningar">
              {landingLinkGroups.map((group) => (
                <section key={group.title}>
                  <h2>{group.title}</h2>
                  <div>
                    {group.links.map((link) => (
                      <Link href={link.href} key={link.href}>
                        <span>{link.label}</span>
                        <small>{link.description}</small>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </nav>
          ) : null}
        </section>
      ) : null}

      <SponsorCard sponsor={sponsors.topSearch} placement="top_search" variant="resource" />
      {topGoogleAdSlot ? <DisplayAdSlot slot={topGoogleAdSlot} label="ANNONS" /> : null}

      <section className="workspace">
        <aside className="filter-rail" aria-label="Filter">
          <div className="filter-head">
            <h2>Filter</h2>
            <div>
              <button type="button" onClick={resetFilters}>Rensa alla</button>
              <button className="mobile-done-button" type="button" onClick={closeFilterDock}>Visa jobb</button>
            </div>
          </div>

          <FilterSection title="Sökning">
            <AutocompleteInput
              icon={<Search size={18} />}
              label="Sök yrke eller roll"
              placeholder="Yrke, roll eller nyckelord"
              type="title"
              value={query}
              onChange={setQuery}
            />
            <AutocompleteInput
              icon={<MapPin size={18} />}
              label="Sök ort eller region"
              placeholder="Ort, kommun eller region"
              type="location"
              value={location}
              onChange={setLocation}
            />
            {showDistanceFilter ? (
              <label className="select-shell distance-select">
                <span className="sr-only">Sökradie</span>
                <select value={distanceRadius} onChange={(event) => setDistanceRadius(Number(event.target.value))}>
                  {DISTANCE_OPTIONS.map((value) => (
                    <option key={value} value={value}>Inom {value} mil</option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="category-filter-group" aria-label="Yrkesområden">
              <div className="filter-section-head">
                <h3>Yrkesområden</h3>
                {titleCategories.length ? (
                  <button type="button" onClick={() => setTitleCategories([])}>Rensa</button>
                ) : null}
              </div>
              <div className="category-options">
                {TITLE_CATEGORY_OPTIONS.map((value) => (
                  <CheckOption
                    key={value}
                    label={value}
                    checked={titleCategories.includes(value)}
                    onChange={() => toggleTitleCategory(value)}
                  />
                ))}
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Arbetsform">
            <ChoiceOption name="workMode" label="Alla arbetsformer" checked={workMode === "all"} onChange={() => setWorkMode("all")} />
            <ChoiceOption name="workMode" label="Hybrid" checked={workMode === "hybrid"} onChange={() => setWorkMode("hybrid")} />
            <ChoiceOption name="workMode" label="Distans" checked={workMode === "remote"} onChange={() => setWorkMode("remote")} />
            <ChoiceOption name="workMode" label="På plats" checked={workMode === "onsite"} onChange={() => setWorkMode("onsite")} />
            <ChoiceOption name="workMode" label="Oklar" checked={workMode === "unclear"} onChange={() => setWorkMode("unclear")} />
          </FilterSection>

          <FilterSection title="Omfattning">
            <ChoiceOption name="employmentExtent" label="Alla omfattningar" checked={employmentExtent === "all"} onChange={() => setEmploymentExtent("all")} />
            <ChoiceOption name="employmentExtent" label="Heltid" checked={employmentExtent === "full_time"} onChange={() => setEmploymentExtent("full_time")} />
            <ChoiceOption name="employmentExtent" label="Deltid" checked={employmentExtent === "part_time"} onChange={() => setEmploymentExtent("part_time")} />
            <ChoiceOption name="employmentExtent" label="Heltid/deltid" checked={employmentExtent === "mixed"} onChange={() => setEmploymentExtent("mixed")} />
          </FilterSection>

          <FilterSection title="Erfarenhetsnivå">
            <ChoiceOption name="seniority" label="Alla nivåer" checked={seniority === "all"} onChange={() => setSeniority("all")} />
            <ChoiceOption name="seniority" label="Junior" checked={seniority === "junior"} onChange={() => setSeniority("junior")} />
            <ChoiceOption name="seniority" label="Medior" checked={seniority === "medior"} onChange={() => setSeniority("medior")} />
            <ChoiceOption name="seniority" label="Senior" checked={seniority === "senior"} onChange={() => setSeniority("senior")} />
            <ChoiceOption name="seniority" label="Lead/chef" checked={seniority === "lead"} onChange={() => setSeniority("lead")} />
            <ChoiceOption name="seniority" label="Oklar nivå" checked={seniority === "unclear"} onChange={() => setSeniority("unclear")} />
          </FilterSection>

          <FilterSection title="Publicerad">
            <ChoiceOption name="postedWithin" label="Alla" checked={postedWithin === "all"} onChange={() => setPostedWithin("all")} />
            <ChoiceOption name="postedWithin" label="Idag" checked={postedWithin === "today"} onChange={() => setPostedWithin("today")} />
            <ChoiceOption name="postedWithin" label="Senaste veckan" checked={postedWithin === "week"} onChange={() => setPostedWithin("week")} />
            <ChoiceOption name="postedWithin" label="Denna månad" checked={postedWithin === "month"} onChange={() => setPostedWithin("month")} />
          </FilterSection>

          <FilterSection title="Snabba val">
            <CheckOption label="Bara annonser med lön" checked={salaryOnly} onChange={(checked) => setSalaryOnly(checked)} />
            <CheckOption label="Dölj jobb jag sökt" checked={hideApplied} onChange={(checked) => setHideApplied(checked)} />
            <CheckOption label="Dölj bortvalda jobb" checked={hideHidden} onChange={(checked) => setHideHidden(checked)} />
          </FilterSection>

          <div className="filter-toggle">
            <span>Dölj försäljningsjobb</span>
            <button className={includeSales ? "switch off" : "switch"} type="button" onClick={() => setIncludeSales(!includeSales)} aria-pressed={!includeSales}>
              <span />
            </button>
          </div>

          <details className="advanced-filter">
            <summary>Fler filter</summary>
            <div className="advanced-filter-body">
              {location ? (
                <button className="selected-token" type="button" onClick={() => setLocation("")}>
                  {location} <X size={15} />
                </button>
              ) : null}
              <ChoiceOption name="employerType" label="Alla annonsörer" checked={employerType === "all"} onChange={() => setEmployerType("all")} />
              <ChoiceOption name="employerType" label="Arbetsgivare som annonsör" checked={employerType === "direct_employer"} onChange={() => setEmployerType("direct_employer")} />
              <CheckOption label="Visa rekryterare och bemanning" checked={includeIntermediaries} onChange={(checked) => setIncludeIntermediaries(checked)} />
            </div>
          </details>

          <button className="watch-button" type="button" onClick={() => saveCurrentSearch("alerts")}>
            <Bell size={17} /> Bevaka dessa filter
          </button>

          <div className="filter-footer">
            <button className="mobile-done-button primary-filter-action" type="button" onClick={closeFilterDock}>Visa jobb</button>
          </div>
        </aside>

        {utilityView === "results" ? (
          <section className="results-pane" id="results">
            <div className="results-header">
              <div>
                <h2>{totalJobs.toLocaleString("sv-SE")} jobb hittade</h2>
                <p>
                  {loadingJobs ? "Uppdaterar resultat..." : `Visar ${visibleJobs.length ? `${(currentPage - 1) * JOBS_PER_PAGE + 1}-${(currentPage - 1) * JOBS_PER_PAGE + visibleJobs.length}` : "0"} av ${totalJobs.toLocaleString("sv-SE")}.`}
                </p>
              </div>
              <div className="results-header-actions">
                <button
                  className="mobile-filter-button"
                  type="button"
                  aria-label={filterDockVisible ? "Dölj filter" : activeFilterCount ? `Visa filter, ${activeFilterCount} aktiva` : "Visa filter"}
                  onClick={toggleFilterDock}
                >
                  <SlidersHorizontal size={17} />
                  <span>{filterDockVisible ? "Dölj filter" : "Filter"}</span>
                  {activeFilterCount ? <strong>{activeFilterCount}</strong> : null}
                </button>
                <label className="sort-select">
                  <span>Sortera</span>
                  <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                    <option value="newest">Nyast först</option>
                    <option value="best">Bäst matchning</option>
                    <option value="deadline">Ansök senast</option>
                  </select>
                  <ChevronDown size={16} />
                </label>
              </div>
            </div>

            <div className="explain-strip">
              {!includeSales && suppressedCounts.sales ? <span>{suppressedCounts.sales} säljobb döljs som standard</span> : null}
              {!includeIntermediaries && suppressedCounts.intermediaries ? <span>{suppressedCounts.intermediaries} rekryterare/bemanning döljs</span> : null}
              {suppressedCounts.failedLinks ? <span>{suppressedCounts.failedLinks} länkar behöver kontrolleras</span> : null}
            </div>

            <div className="job-list">
              {visibleJobs.length ? (
                visibleJobs.map((job, index) => (
                  <Fragment key={job.id}>
                    <JobRow
                      job={job}
                      selected={selected?.id === job.id}
                      state={jobState}
                      onSelect={() => {
                        setSelectedId(job.id);
                        markViewed(job.id);
                        setMobileStep("preview");
                      }}
                      onSave={() => toggleSaved(job.id)}
                      onHide={() => toggleHidden(job.id)}
                      onApplied={() => markApplied(job.id)}
                    />
                    {googleAdSlotIds.after8 && index === 7 ? <DisplayAdSlot slot={googleAdSlotIds.after8} label="ANNONS" compact format="fluid" layoutKey={inFeedAdLayoutKey} /> : null}
                    {googleAdSlotIds.after24 && index === 23 ? <DisplayAdSlot slot={googleAdSlotIds.after24} label="ANNONS" compact format="fluid" layoutKey={inFeedAdLayoutKey} /> : null}
                    {googleAdSlotIds.after48 && index === 47 ? <DisplayAdSlot slot={googleAdSlotIds.after48} label="ANNONS" compact format="fluid" layoutKey={inFeedAdLayoutKey} /> : null}
                  </Fragment>
                ))
              ) : (
                <div className="empty-state">
                  <Search size={24} />
                  <h3>Inga träffar just nu med de här filtren</h3>
                  <p>Rensa filter eller spara sökningen som bevakning.</p>
                  <SponsorCard sponsor={sponsors.emptyState} placement="empty_state" />
                </div>
              )}
            </div>
            {totalJobs ? (
              <nav className="pagination" aria-label="Jobbsidor">
                <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Föregående</button>
                <span>Sida {currentPage} av {totalPages}</span>
                <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Nästa</button>
              </nav>
            ) : null}
            {googleAdSlotIds.bottom ? <DisplayAdSlot slot={googleAdSlotIds.bottom} label="ANNONS" /> : null}
          </section>
        ) : (
          <UtilityPanel
            view={utilityView}
            historyJobs={historyJobs}
            savedJobs={savedJobs}
            savedSearches={savedSearches}
            state={jobState}
            onClose={() => {
              setUtilityView("results");
              setMobileStep("list");
            }}
            onApplySearch={applySavedSearch}
            onDeleteSearch={(id) => setSavedSearches((current) => current.filter((item) => item.id !== id))}
            onSaveCurrentSearch={(targetView) => saveCurrentSearch(targetView)}
            onClearState={clearLocalState}
            onClearSearches={() => setSavedSearches([])}
            onSelectJob={selectJobFromUtility}
          />
        )}

        <aside className="preview-pane" aria-label="Förhandsvisning">
          {selected ? (
            <JobPreview
              job={selected}
              state={jobState}
              onSave={() => toggleSaved(selected.id)}
              onHide={() => toggleHidden(selected.id)}
              onApplied={() => markApplied(selected.id)}
              onReported={() => reportJob(selected.id)}
              onClose={closePreview}
            />
          ) : <NoSelection />}
        </aside>
      </section>
      {pageGuide ? (
        <section className="publisher-guide" aria-labelledby="publisher-guide-title">
          <h2 id="publisher-guide-title">{pageGuide.title}</h2>
          <div>
            {pageGuide.sections.map((section) => (
              <article key={section.title}>
                <h3>{section.title}</h3>
                <p>{section.text}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function JobRow({
  job,
  selected,
  state,
  onSelect,
  onSave,
  onHide,
  onApplied
}: {
  job: Job;
  selected: boolean;
  state: LocalJobState;
  onSelect: () => void;
  onSave: () => void;
  onHide: () => void;
  onApplied: () => void;
}) {
  const saved = state.saved.includes(job.id);
  const hidden = state.hidden.includes(job.id);
  const sourceTitle = getCanonicalTitleNote(job);

  return (
    <article
      className={`job-row ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <LogoTile job={job} />
      <span className="row-main">
        <span className="state-line">
          {state.applied.includes(job.id) ? <StatusPill>Ansökt</StatusPill> : null}
          {saved ? <StatusPill>Sparad</StatusPill> : null}
          {job.employerVerified ? <StatusPill>Arbetsgivarsignal</StatusPill> : null}
        </span>
        <strong>{getDisplayTitle(job)}</strong>
        {sourceTitle ? <em>Källrubrik: {sourceTitle}</em> : null}
        <span>{job.employerName}</span>
        <span>{job.municipality}</span>
        <span className="skill-line">
          {(job.mustHaveSummary.length ? job.mustHaveSummary : job.languageLabels).slice(0, 3).map((item) => (
            <Pill key={item}>{item}</Pill>
          ))}
        </span>
      </span>
      <span className="row-middle">
        <Pill tone={job.workMode === "remote" || job.workMode === "hybrid" ? "green" : "gray"}>
          {formatWorkMode(job.workMode)}
        </Pill>
        <Pill tone={job.seniority === "unclear" ? "gray" : "blue"}>
          {formatSeniority(job.seniority)}
        </Pill>
        <span>{job.salaryText}</span>
        <Pill tone="blue">{job.employmentTypeText ?? formatEmploymentExtent(job.employmentExtent)}</Pill>
      </span>
      <span className="row-deadline">
        <span>Publicerad</span>
        <strong>{formatSwedishDate(job.publicationDate)}</strong>
        <span>Ansök senast</span>
        <strong>{formatSwedishDate(job.applicationDeadline)}</strong>
        <span>Länk kollad</span>
        <strong>{formatCheckedAt(job.applyLinkCheckedAt ?? job.lastCheckedAt)}</strong>
      </span>
      <span className="row-actions">
        <InlineAction
          label={saved ? "Ta bort sparad" : "Spara"}
          onClick={(event) => {
            event.stopPropagation();
            onSave();
          }}
        >
          {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        </InlineAction>
        <InlineAction
          label={hidden ? "Visa igen" : "Dölj"}
          onClick={(event) => {
            event.stopPropagation();
            onHide();
          }}
        >
          {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
        </InlineAction>
        <a
          className="inline-action apply-inline-action"
          href={`/apply/${job.id}`}
          target="_blank"
          rel="nofollow noopener noreferrer"
          aria-label="Ansök"
          title="Ansök"
          onClick={(event) => {
            event.stopPropagation();
            onApplied();
          }}
        >
          <ExternalLink size={15} />
          <span>Ansök</span>
        </a>
      </span>
      <ChevronRight className="row-arrow" size={22} />
    </article>
  );
}

function UtilityPanel({
  view,
  historyJobs,
  savedJobs,
  savedSearches,
  state,
  onClose,
  onApplySearch,
  onDeleteSearch,
  onSaveCurrentSearch,
  onClearState,
  onClearSearches,
  onSelectJob
}: {
  view: Exclude<UtilityView, "results">;
  historyJobs: Job[];
  savedJobs: Job[];
  savedSearches: SavedSearch[];
  state: LocalJobState;
  onClose: () => void;
  onApplySearch: (search: SavedSearch) => void;
  onDeleteSearch: (id: string) => void;
  onSaveCurrentSearch: (targetView: UtilityView) => void;
  onClearState: () => void;
  onClearSearches: () => void;
  onSelectJob: (jobId: string) => void;
}) {
  const titles = {
    saved: "Sparade sökningar",
    alerts: "Bevakningar",
    history: "Historik",
    settings: "Inställningar"
  };

  return (
    <section className="utility-panel" id={view}>
      <header>
        <div>
          <h2>{titles[view]}</h2>
          <p>{view === "settings" ? "Hantera sparade val och tidigare jobb." : "Snabb åtkomst till dina sparade vyer."}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Stäng panel"><X size={20} /></button>
      </header>

      {view === "saved" || view === "alerts" ? (
        <div className="saved-search-list">
          <button className="create-alert-button" type="button" onClick={() => onSaveCurrentSearch(view)}>
            <Bell size={17} /> {view === "alerts" ? "Spara som bevakning" : "Spara nuvarande sökning"}
          </button>
          {view === "alerts" ? (
            <Link className="external-alert-link" href={JOB_ALERTS_URL}>
              E-postaviseringar pausade <Bell size={15} />
            </Link>
          ) : null}
          <section className="utility-section">
            <h3>{view === "alerts" ? "Bevakade filter" : "Sparade sökningar"}</h3>
            {savedSearches.length ? savedSearches.map((search) => (
              <article className="saved-search-card" key={search.id}>
                <div>
                  <strong>{search.label}</strong>
                  <span>Sparad {formatSwedishDate(search.createdAt)}</span>
                </div>
                <button type="button" onClick={() => onApplySearch(search)}>Öppna</button>
                <button type="button" onClick={() => onDeleteSearch(search.id)} aria-label="Ta bort sökning"><Trash2 size={16} /></button>
              </article>
            )) : (
              <p className="panel-empty">{view === "alerts" ? "Inga bevakningar ännu." : "Inga sparade sökningar ännu."}</p>
            )}
          </section>
          {view === "saved" ? (
            <section className="utility-section">
              <h3>Sparade jobb</h3>
              <div className="history-list">
                {savedJobs.length ? savedJobs.map((job) => (
                  <button className="history-job" type="button" key={job.id} onClick={() => onSelectJob(job.id)}>
                    <strong>{getDisplayTitle(job)}</strong>
                    <span>{job.employerName} · {job.municipality}</span>
                  </button>
                )) : <p className="panel-empty">Inga sparade jobb ännu.</p>}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {view === "history" ? (
        <div className="history-panel">
          <div className="history-stats">
            <Metric label="Visade" value={state.viewed.length} />
            <Metric label="Sparade" value={state.saved.length} />
            <Metric label="Sökta" value={state.applied.length} />
            <Metric label="Dolda" value={state.hidden.length} />
            <Metric label="Rapporterade" value={state.reported.length} />
          </div>
          <div className="history-list">
            {historyJobs.length ? historyJobs.map((job) => (
              <button className="history-job" type="button" key={job.id} onClick={() => onSelectJob(job.id)}>
                <strong>{getDisplayTitle(job)}</strong>
                <span>{job.employerName} · {job.municipality}</span>
                <span className="state-line">
                  {state.applied.includes(job.id) ? <StatusPill>Ansökt</StatusPill> : null}
                  {state.saved.includes(job.id) ? <StatusPill>Sparad</StatusPill> : null}
                  {state.hidden.includes(job.id) ? <StatusPill>Dold</StatusPill> : null}
                  {state.reported.includes(job.id) ? <StatusPill>Rapporterad</StatusPill> : null}
                </span>
              </button>
            )) : <p className="panel-empty">Du har ingen historik ännu.</p>}
          </div>
        </div>
      ) : null}

      {view === "settings" ? (
        <div className="settings-panel">
          <article>
            <strong>Dina sparade val</strong>
            <p>Rensa sparade jobb, ansökta jobb, dolda jobb och rapporter när du vill.</p>
          </article>
          <div className="settings-actions">
            <button type="button" onClick={onClearState}>Rensa jobbhistorik</button>
            <button type="button" onClick={onClearSearches}>Rensa sparade sökningar</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function JobPreview({
  job,
  state,
  onSave,
  onHide,
  onApplied,
  onReported,
  onClose
}: {
  job: Job;
  state: LocalJobState;
  onSave: () => void;
  onHide: () => void;
  onApplied: () => void;
  onReported: () => void;
  onClose: () => void;
}) {
  const saved = state.saved.includes(job.id);
  const applied = state.applied.includes(job.id);
  const hidden = state.hidden.includes(job.id);
  const reported = state.reported.includes(job.id);
  const mapQuery = getMapQuery(job);
  const explanations = getJobExplanations(job);
  const trustWarnings = getTrustWarnings(job);
  const sourceTitle = getCanonicalTitleNote(job);
  const [activeTab, setActiveTab] = useState<"overview" | "role" | "employer">("overview");

  return (
    <div className="preview-inner">
      <button className="close-preview" type="button" aria-label="Stäng förhandsvisning" onClick={onClose}><X size={22} /></button>
      <div className="preview-heading">
        <LogoTile job={job} />
        <div>
          <h2>{getDisplayTitle(job)}</h2>
          {sourceTitle ? <em>Källrubrik: {sourceTitle}</em> : null}
          <p>{job.employerName}</p>
        </div>
      </div>

      <div className="preview-meta">
        <span><MapPin size={16} /> {job.municipality}</span>
        <Pill tone={job.workMode === "hybrid" || job.workMode === "remote" ? "green" : "gray"}>{formatWorkMode(job.workMode)}</Pill>
        <Pill tone={job.seniority === "unclear" ? "gray" : "blue"}>{formatSeniority(job.seniority)}</Pill>
        <span>{job.salaryText}</span>
      </div>

      <div className="preview-dates">
        <span>Ansök senast {formatSwedishDate(job.applicationDeadline)}</span>
        <span>Publicerad {formatSwedishDate(job.publicationDate)}</span>
        <span>Först sedd {formatSwedishDate(job.firstSeenAt)}</span>
        <span>Länk kollad {formatCheckedAt(job.applyLinkCheckedAt ?? job.lastCheckedAt)}</span>
        {job.duplicateCount ? <span>Samlad från {job.duplicateCount + 1} liknande annonser</span> : null}
      </div>

      <div className="local-state-bar">
        {applied ? <StatusPill>Markerad som sökt</StatusPill> : null}
        {saved ? <StatusPill>Sparad</StatusPill> : null}
        {hidden ? <StatusPill>Bortvald</StatusPill> : null}
        {reported ? <StatusPill>Rapporterad</StatusPill> : null}
        {job.employerVerified ? <StatusPill>Arbetsgivarsignal</StatusPill> : null}
        {!applied && !saved && !hidden && !reported ? <span>Ingen status ännu.</span> : null}
      </div>

      <div className={`preview-main-grid ${mapQuery ? "" : "no-map"}`}>
        {mapQuery ? <MapPreview query={mapQuery} label={job.workplaceAddress || `${job.municipality}, Sverige`} /> : null}

        <div className="preview-detail-panel">
      <nav className="preview-tabs" aria-label="Jobbdetaljer" role="tablist">
        <button aria-selected={activeTab === "overview"} className={activeTab === "overview" ? "active" : ""} role="tab" type="button" onClick={() => setActiveTab("overview")}>Översikt</button>
        <button aria-selected={activeTab === "role"} className={activeTab === "role" ? "active" : ""} role="tab" type="button" onClick={() => setActiveTab("role")}>Om tjänsten</button>
        <button aria-selected={activeTab === "employer"} className={activeTab === "employer" ? "active" : ""} role="tab" type="button" onClick={() => setActiveTab("employer")}>Om arbetsgivaren</button>
      </nav>

      <div className="preview-content" role="tabpanel">
        {activeTab === "overview" ? (
          <>
            <Section title="Snabb fakta">
              <FactList
                items={[
                  ["Erfarenhet", formatSeniority(job.seniority)],
                  ["Arbetsform", formatWorkMode(job.workMode)],
                  ["Omfattning", job.employmentTypeText ?? formatEmploymentExtent(job.employmentExtent)],
                  ["Lön", job.salaryText || "Lön ej angiven"],
                  ["Språk", job.languageLabels.join(", ") || "Ej angivet"],
                  ["Ansökan via", formatApplyType(job.applyType)]
                ]}
              />
            </Section>
            <Section title="Vad du faktiskt gör">
              <p>{job.plainSummary}</p>
            </Section>
            <Section title="Varför visas detta?">
              <BulletItems items={explanations} fallback="Inga särskilda anmärkningar." />
            </Section>
          </>
        ) : null}
        {activeTab === "role" ? (
          <>
            <Section title="Krav">
              <BulletItems items={job.mustHaveSummary.length ? job.mustHaveSummary : job.languageLabels} fallback="Inga tydliga krav hittades i annonsen." />
            </Section>
            <Section title="Meriterande">
              <BulletItems items={job.niceToHaveSummary} fallback="Inga meriterande krav hittades i annonsen." />
            </Section>
            <Section title="Språk och senioritet">
              <FactList items={[["Språk", job.languageLabels.join(", ") || "Ej angivet"], ["Erfarenhet", formatSeniority(job.seniority)]]} />
            </Section>
            <Section title="Arbetsplats och pendling">
              <p>{getCommuteSummary(job)}</p>
            </Section>
          </>
        ) : null}
        {activeTab === "employer" ? (
          <>
            <Section title="Arbetsgivare">
              <FactList
                items={[
                  ["Namn", job.employerName],
                  ["Annonsörstyp", formatEmployerTypeLabel(job.employerType)],
                  ["Annonsörssignal", job.employerVerified ? formatEmployerSignalReason(job.employerVerificationReason) : "Ingen tydlig automatisk signal."],
                  ["Ansökningsdomän", job.applyDomain || "Okänd"],
                  ["Länkstatus", formatApplyLinkStatus(job.applyLinkStatus)]
                ]}
              />
            </Section>
            <Section title="Trygghetskontroll">
              <BulletItems items={trustWarnings} fallback="Inga uppenbara risksignaler hittades i annonskortet." />
            </Section>
          </>
        ) : null}
          </div>
        </div>
      </div>

      <a className="apply-green" href={`/apply/${job.id}`} rel="nofollow" onClick={onApplied}>
        <ExternalLink size={18} /> Gå till ansökningssidan
      </a>
      <div className="preview-local-actions">
        <button type="button" onClick={onSave}><Bookmark size={16} /> {saved ? "Sparad" : "Spara"}</button>
        <button type="button" onClick={onApplied}><ShieldCheck size={16} /> {applied ? "Sökt" : "Markera sökt"}</button>
        <button type="button" onClick={onHide}>{hidden ? <Eye size={16} /> : <EyeOff size={16} />} {hidden ? "Visa igen" : "Dölj"}</button>
      </div>
      <button className="report-link" type="button" onClick={onReported}>
        <Flag size={17} />
        {reported ? "Rapporterad" : "Rapportera ett problem med denna annons"}
      </button>
    </div>
  );
}

function MapPreview({ query, label }: { query: string; label: string }) {
  return <section className="map-preview" aria-label="Arbetsplats"><strong>Arbetsplats</strong><p>{label || query}</p></section>;
}

function AutocompleteInput({
  icon,
  label,
  onChange,
  placeholder,
  type,
  value
}: {
  icon: ReactNode;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type: "title" | "location";
  value: string;
}) {
  const inputId = useId();
  const listboxId = `${inputId}-suggestions`;
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const trimmedValue = value.trim();

  useEffect(() => {
    if (!open || trimmedValue.length < 1) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ type, q: trimmedValue, limit: "8" });
        const response = await fetch(`/api/suggestions?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json() as { suggestions?: string[] };
        const nextSuggestions = (payload.suggestions ?? [])
          .filter((suggestion) => suggestion && suggestion.toLowerCase() !== trimmedValue.toLowerCase())
          .slice(0, 8);
        setSuggestions(nextSuggestions);
        setActiveIndex(nextSuggestions.length ? 0 : -1);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSuggestions([]);
      }
    }, 120);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, trimmedValue, type]);

  function selectSuggestion(suggestion: string) {
    onChange(suggestion);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="autocomplete-shell">
      <div className="input-shell">
        {icon}
        <label className="sr-only" htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open && suggestions.length > 0}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete="off"
        />
      </div>
      {open && suggestions.length ? (
        <div className="autocomplete-list" id={listboxId} role="listbox" aria-label={`${label} förslag`}>
          {suggestions.map((suggestion, index) => (
            <button
              className={index === activeIndex ? "active" : ""}
              id={`${listboxId}-${index}`}
              key={suggestion}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="filter-section">
      <div className="filter-section-head">
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ChoiceOption({ name, label, checked, onChange }: { name: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="checkbox-option">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="checkbox-option">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function TopNavButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button className={active ? "active" : ""} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function LogoTile({ job }: { job: Job }) {
  return (
    <span className="logo-tile">
      {job.logoUrl ? <img src={job.logoUrl} alt="" /> : <span>{job.employerName.slice(0, 2).toUpperCase()}</span>}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="preview-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function FactList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="preview-fact-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || "Ej angivet"}</dd>
        </div>
      ))}
    </dl>
  );
}

function BulletItems({ items, fallback }: { items: string[]; fallback: string }) {
  if (!items.length) return <p>{fallback}</p>;
  return (
    <ul>
      {items.slice(0, 4).map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="metric">
      <strong>{value.toLocaleString("sv-SE")}</strong>
      <small>{label}</small>
    </span>
  );
}

function NoSelection() {
  return (
    <div className="empty-state">
      <ShieldCheck size={26} />
      <h3>Inga jobb att visa</h3>
      <p>Ändra sökningen eller prova igen om en stund.</p>
    </div>
  );
}

function InlineAction({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: (event: MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button className="inline-action" type="button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return <span className="status-pill">{children}</span>;
}

function Pill({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "blue" | "green" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function formatSeniority(value: Job["seniority"]) {
  return {
    junior: "Junior",
    medior: "Medior",
    senior: "Senior",
    lead: "Lead/chef",
    unclear: "Erfarenhet oklar"
  }[value] ?? "Erfarenhet oklar";
}

function formatApplyType(value: ApplyType) {
  return {
    employer_site: "Arbetsgivarens sida",
    ats: "Externt rekryteringssystem",
    email: "E-post",
    via_af: "Platsbanken",
    recruiter: "Rekryterare",
    unknown: "Okänd"
  }[value] ?? "Okänd";
}

function formatEmployerTypeLabel(value: EmployerType) {
  return {
    direct_employer: "Arbetsgivare som annonsör",
    recruiter: "Rekryterare",
    staffing_agency: "Bemanningsföretag",
    unknown: "Okänd annonsör"
  }[value] ?? "Okänd annonsör";
}

function formatEmployerSignalReason(value?: string) {
  if (!value) return "Automatisk arbetsgivarsignal finns.";
  const oldVerified = "veri" + "fierad";
  return value
    .replaceAll("Direkt arbetsgivare", "Arbetsgivare som annonsör")
    .replaceAll("direkt arbetsgivare", "arbetsgivare som annonsör")
    .replaceAll("Veri" + "fierad signal finns.", "Automatisk arbetsgivarsignal finns.")
    .replaceAll(oldVerified, "granskad");
}

function formatApplyLinkStatus(value: Job["applyLinkStatus"]) {
  return {
    unchecked: "Inte kontrollerad ännu",
    ok: "Kontrollerad",
    failed: "Behöver kontrolleras"
  }[value] ?? "Inte kontrollerad ännu";
}

function getCommuteSummary(job: Job) {
  if (job.workMode === "remote") return "Annonsen är klassad som distans. Kontrollera ändå arbetsgivarens krav innan du ansöker.";
  if (job.workMode === "hybrid") return `Hybridroll. Räkna med kontorsdagar i eller nära ${job.municipality || "angiven ort"}.`;
  if (job.workplaceAddress) return `Arbetsplatsen anges som ${job.workplaceAddress}.`;
  if (job.municipality) return `Annonsen anger ${job.municipality}, men saknar exakt adress i källdatan.`;
  return "Exakt arbetsplats saknas i källdatan.";
}

function getTrustWarnings(job: Job) {
  const text = `${job.title} ${job.plainSummary} ${job.salaryText}`.toLowerCase();
  const warnings: string[] = [];

  if (job.applyLinkStatus === "failed") warnings.push("Ansökningslänken svarade inte vid senaste kontrollen.");
  if (!job.applyDomain) warnings.push("Ansökningsdomän saknas eller kunde inte läsas.");
  if (!job.employerVerified) warnings.push("Ingen tydlig automatisk arbetsgivarsignal hittades.");
  if (/snabba pengar|enkla pengar|hemifrån utan erfarenhet|crypto|krypto|whatsapp|telegram/i.test(text)) {
    warnings.push("Texten matchar enkla scam-mönster och bör kontrolleras extra noga.");
  }
  if (/lön ej angiven|lon ej angiven/i.test(job.salaryText)) warnings.push("Lön saknas i källannonsen.");
  if (job.workModeWarning) warnings.push(job.workModeWarning);

  return warnings.slice(0, 5);
}

function readSavedSearches(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = safeGetLocalStorage(SAVED_SEARCHES_KEY) ?? readFirstStorageValue(LEGACY_SAVED_SEARCHES_KEYS);
    const parsed = JSON.parse(raw ?? "[]");
    const savedSearches = Array.isArray(parsed) ? parsed.filter(isSavedSearch) : [];
    if (!safeGetLocalStorage(SAVED_SEARCHES_KEY) && raw) {
      safeSetLocalStorage(SAVED_SEARCHES_KEY, JSON.stringify(savedSearches));
    }
    return savedSearches;
  } catch {
    return [];
  }
}

function readDarkModePreference() {
  if (typeof window === "undefined") return false;
  const saved = safeGetLocalStorage(THEME_KEY) ?? readFirstStorageValue(LEGACY_THEME_KEYS);
  if (saved === "dark" || saved === "light") safeSetLocalStorage(THEME_KEY, saved);
  if (saved === "dark") return true;
  if (saved === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function readFirstStorageValue(keys: string[]) {
  for (const key of keys) {
    const value = safeGetLocalStorage(key);
    if (value) return value;
  }
  return null;
}

function safeGetLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private, restricted, or full mobile browsers.
  }
}

function isSavedSearch(value: unknown): value is SavedSearch {
  return Boolean(value && typeof value === "object" && "id" in value && "label" in value);
}

function buildSavedSearchLabel(search: Pick<SavedSearch, "query" | "location" | "workMode" | "employmentExtent" | "seniority" | "titleCategory" | "titleCategories" | "distanceRadius" | "postedWithin" | "salaryOnly">) {
  const categories = normalizeSavedTitleCategories(search);
  const parts = [
    search.query || "Alla jobb",
    search.location ? [search.location, search.distanceRadius > 0 ? `${search.distanceRadius} mil` : ""].filter(Boolean).join(", ") : "",
    categories.length ? categories.join(", ") : "",
    search.workMode !== "all" ? formatWorkMode(search.workMode) : "",
    search.employmentExtent !== "all" ? formatEmploymentExtent(search.employmentExtent) : "",
    search.seniority && search.seniority !== "all" ? formatSeniority(search.seniority) : "",
    search.postedWithin !== "all" ? formatPostedWithin(search.postedWithin) : "",
    search.salaryOnly ? "med lön" : ""
  ].filter(Boolean);

  return parts.join(" · ");
}

function buildSearchFilterKey(input: {
  query: string;
  location: string;
  workMode: WorkMode | "all";
  employmentExtent: EmploymentExtent | "all";
  seniority: Seniority | "all";
  titleCategories: string[];
  distanceRadius: number;
  postedWithin: PostedWithin;
  employerType: EmployerType | "all";
  includeSales: boolean;
  includeIntermediaries: boolean;
  salaryOnly: boolean;
  sortMode: SortMode;
}) {
  return [
    input.query,
    input.location,
    input.workMode,
    input.employmentExtent,
    input.seniority,
    input.titleCategories.join(","),
    input.distanceRadius,
    input.postedWithin,
    input.employerType,
    input.includeSales,
    input.includeIntermediaries,
    input.salaryOnly,
    input.sortMode
  ].join("|");
}

function buildSearchRequestKey(input: {
  query: string;
  location: string;
  workMode: WorkMode | "all";
  employmentExtent: EmploymentExtent | "all";
  seniority: Seniority | "all";
  titleCategories: string[];
  distanceRadius: number;
  postedWithin: PostedWithin;
  employerType: EmployerType | "all";
  includeSales: boolean;
  includeIntermediaries: boolean;
  salaryOnly: boolean;
  sortMode: SortMode;
  page: number;
}) {
  return JSON.stringify(input);
}

function normalizeSavedTitleCategories(search: Pick<SavedSearch, "titleCategory" | "titleCategories">) {
  return Array.from(new Set([
    ...(Array.isArray(search.titleCategories) ? search.titleCategories : []),
    search.titleCategory
  ]
    .flatMap((value) => String(value ?? "").split(","))
    .map((value) => value.trim())
    .filter((value) => value && value !== "all" && TITLE_CATEGORY_OPTIONS.includes(value))));
}

function getMapQuery(job: Job) {
  if (job.workplaceAddress) return job.workplaceAddress;
  if (!job.municipality || job.municipality === "Okänd ort") return "";
  return [job.workplaceName, job.employerName, job.municipality, job.region, "Sverige"].filter(Boolean).join(", ");
}
