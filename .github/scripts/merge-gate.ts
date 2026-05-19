const allowedResults = new Set(["success", "skipped"]);
const needsJson = process.env.NEEDS_JSON;

if (needsJson === undefined || needsJson.length === 0) {
  console.error("NEEDS_JSON is required.");
  process.exit(1);
}

let needs: Record<string, { result?: string }>;
try {
  needs = JSON.parse(needsJson);
} catch (error) {
  const snippet =
    needsJson.length > 200 ? `${needsJson.slice(0, 200)}...` : needsJson;
  console.error(
    `NEEDS_JSON is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
  );
  console.error(`NEEDS_JSON snippet: ${snippet}`);
  process.exit(1);
}

const failedJobs = Object.entries(needs).filter(
  ([, job]) => !allowedResults.has(job.result ?? "missing"),
);
const skippedJobs = Object.entries(needs)
  .filter(([, job]) => job.result === "skipped")
  .map(([name]) => name);

if (failedJobs.length > 0) {
  console.error("One or more required CI jobs failed or were cancelled:");
  for (const [name, job] of failedJobs) {
    console.error(`- ${name}: ${job.result ?? "missing"}`);
  }
  process.exit(1);
}

if (skippedJobs.length > 0) {
  console.log(`Skipped jobs: ${skippedJobs.join(", ")}`);
}

console.log("All required CI jobs succeeded or were intentionally skipped.");
