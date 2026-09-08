export type WorkMode = "remote" | "hybrid" | "onsite" | "unclear";

export type EmployerType =
  | "direct_employer"
  | "recruiter"
  | "staffing_agency"
  | "unknown";

export type ApplyType = "employer_site" | "ats" | "email" | "via_af" | "recruiter" | "unknown";

export type JobStatus = "live" | "expired" | "removed" | "hidden_review";

export type EmploymentExtent = "full_time" | "part_time" | "mixed" | "unclear";

export type Seniority = "junior" | "medior" | "senior" | "lead" | "unclear";

export interface Job {
  id: string;
  source: string;
  sourceAdId: string;
  sourceUrl: string;
  logoUrl?: string;
  title: string;
  titleNormalized: string;
  titleCanonical: string;
  titleCategory: string;
  employerName: string;
  employerOrganizationNumber?: string;
  workplaceName?: string;
  workplaceAddress?: string;
  municipality: string;
  region: string;
  country: string;
  publicationDate?: string;
  applicationDeadline?: string;
  status: JobStatus;
  employerType: EmployerType;
  employmentExtent: EmploymentExtent;
  employmentTypeText: string;
  scopeMin?: number;
  scopeMax?: number;
  salesNoise: boolean;
  workMode: WorkMode;
  workModeConfidence: number;
  workModeWarning?: string;
  seniority: Seniority;
  salaryText: string;
  languageLabels: string[];
  mustHaveSummary: string[];
  niceToHaveSummary: string[];
  plainSummary: string;
  descriptionText: string;
  applyUrl: string;
  applyDomain: string;
  applyType: ApplyType;
  applyLinkStatus: "unchecked" | "ok" | "failed";
  applyLinkCheckedAt?: string;
  employerVerified?: boolean;
  employerVerificationReason?: string;
  trustScore?: number;
  canonicalFingerprint?: string;
  duplicateCount?: number;
  duplicateJobIds?: string[];
  lastCheckedAt: string;
  firstSeenAt: string;
  updatedAt: string;
  classificationVersion: string;
}

export interface JobDatabase {
  jobs: Job[];
  updatedAt: string;
}

export interface JobTechAd {
  id: string | number;
  webpage_url?: string;
  headline?: string;
  logo_url?: string;
  application_deadline?: string;
  publication_date?: string;
  timestamp?: string;
  removed?: boolean;
  removed_date?: string;
  employer?: {
    name?: string;
    workplace?: string;
    organization_number?: string;
  };
  workplace_address?: {
    street_address?: string;
    postcode?: string;
    city?: string;
    municipality?: string;
    region?: string;
    country?: string;
    country_code?: string | number;
  };
  description?: {
    text?: string;
    text_formatted?: string;
  };
  salary_description?: string;
  application_details?: {
    url?: string;
    email?: string;
  };
  must_have?: JobTechRequirementBlock;
  nice_to_have?: JobTechRequirementBlock;
  occupation?: { label?: string };
  occupation_field?: { label?: string };
  duration?: { label?: string };
  employment_type?: { label?: string };
  working_hours_type?: { label?: string };
  scope_of_work?: { min?: number; max?: number };
}

interface JobTechRequirementBlock {
  skills?: Array<{ label?: string }>;
  languages?: Array<{ label?: string }>;
  work_experiences?: Array<{ label?: string }>;
  education?: Array<{ label?: string }>;
  drivers_license?: Array<{ label?: string }>;
}

export interface SyncState {
  jobstreamLastSuccessAt?: string;
  reportQualityLastProcessedAt?: string;
  reportQualityLastRunAt?: string;
  reportQualityActions?: number;
  lastWorkerHeartbeatAt?: string;
  lastWorkerError?: string;
  lastSyncError?: string;
  jobstreamLastAttemptAt?: string;
  jobstreamLastFinishedAt?: string;
  jobstreamLastFailedAt?: string;
  jobstreamInProgressSince?: string | null;
  lastMaintenanceRunAt?: string;
  lastMaintenanceFailedAt?: string;
  lastMaintenanceError?: string;
  lastOpsDigestAt?: string;
  lastOpsDigestOk?: boolean;
  lastOpsCriticalCount?: number;
  lastOpsAlertAt?: string;
  lastOpsAlertKey?: string;
}
