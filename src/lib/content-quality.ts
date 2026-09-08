export const minimumIndexableListingJobs = 3;

export function isIndexableJobListing(count: number) {
  return count >= minimumIndexableListingJobs;
}
