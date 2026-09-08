import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function transpileSource(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
}

const adsenseUrl = `data:text/javascript;base64,${Buffer.from(transpileSource("../src/lib/adsense.ts")).toString("base64")}`;
const slotSource = transpileSource("../src/lib/ad-policy-slots.ts")
  .replace("@/lib/adsense", adsenseUrl);
const slotUrl = `data:text/javascript;base64,${Buffer.from(slotSource).toString("base64")}`;
const { withManualAdSlotIds } = await import(slotUrl);

const eligiblePolicy = {
  googleAdsEligible: true,
  minimumVisibleJobs: 25,
  slots: ["results_top", "results_after_8", "results_after_24", "results_after_48", "results_bottom"],
  slotIds: {}
};

test("manual slot finalizer disables ads when manual flag is off", () => {
  process.env.NEXT_PUBLIC_ADSENSE_MANUAL_ADS = "false";
  process.env.NEXT_PUBLIC_ADSENSE_TOP_SLOT = "111";

  const policy = withManualAdSlotIds(eligiblePolicy);

  assert.equal(policy.googleAdsEligible, false);
  assert.equal(policy.reason, "manual_ads_disabled");
  assert.deepEqual(policy.slots, []);
});

test("manual slot finalizer uses display and in-feed fallback slots", () => {
  process.env.NEXT_PUBLIC_ADSENSE_MANUAL_ADS = "true";
  process.env.NEXT_PUBLIC_ADSENSE_TOP_SLOT = "111";
  process.env.NEXT_PUBLIC_ADSENSE_MID_SLOT = "";
  process.env.NEXT_PUBLIC_ADSENSE_IN_FEED_SLOT = "222";
  process.env.NEXT_PUBLIC_ADSENSE_AFTER_8_SLOT = "";
  process.env.NEXT_PUBLIC_ADSENSE_AFTER_24_SLOT = "";
  process.env.NEXT_PUBLIC_ADSENSE_AFTER_48_SLOT = "";
  process.env.NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT = "";

  const policy = withManualAdSlotIds(eligiblePolicy);

  assert.equal(policy.googleAdsEligible, true);
  assert.deepEqual(policy.slots, ["results_top", "results_after_8", "results_after_24", "results_after_48", "results_bottom"]);
  assert.deepEqual(policy.slotIds, {
    results_top: "111",
    results_after_8: "222",
    results_after_24: "222",
    results_after_48: "222",
    results_bottom: "111"
  });
});

test("manual slot finalizer uses placement-specific slots when configured", () => {
  process.env.NEXT_PUBLIC_ADSENSE_MANUAL_ADS = "true";
  process.env.NEXT_PUBLIC_ADSENSE_TOP_SLOT = "111";
  process.env.NEXT_PUBLIC_ADSENSE_IN_FEED_SLOT = "222";
  process.env.NEXT_PUBLIC_ADSENSE_AFTER_8_SLOT = "222";
  process.env.NEXT_PUBLIC_ADSENSE_AFTER_24_SLOT = "333";
  process.env.NEXT_PUBLIC_ADSENSE_AFTER_48_SLOT = "444";
  process.env.NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT = "555";

  const policy = withManualAdSlotIds(eligiblePolicy);

  assert.equal(policy.googleAdsEligible, true);
  assert.deepEqual(policy.slotIds, {
    results_top: "111",
    results_after_8: "222",
    results_after_24: "333",
    results_after_48: "444",
    results_bottom: "555"
  });
});

test("manual slot finalizer disables ads if no configured slot ids exist", () => {
  process.env.NEXT_PUBLIC_ADSENSE_MANUAL_ADS = "true";
  process.env.NEXT_PUBLIC_ADSENSE_TOP_SLOT = "";
  process.env.NEXT_PUBLIC_ADSENSE_MID_SLOT = "";
  process.env.NEXT_PUBLIC_ADSENSE_IN_FEED_SLOT = "";
  process.env.NEXT_PUBLIC_ADSENSE_AFTER_8_SLOT = "";
  process.env.NEXT_PUBLIC_ADSENSE_AFTER_24_SLOT = "";
  process.env.NEXT_PUBLIC_ADSENSE_AFTER_48_SLOT = "";
  process.env.NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT = "";

  const policy = withManualAdSlotIds(eligiblePolicy);

  assert.equal(policy.googleAdsEligible, false);
  assert.equal(policy.reason, "manual_ad_slots_missing");
  assert.deepEqual(policy.slots, []);
});
