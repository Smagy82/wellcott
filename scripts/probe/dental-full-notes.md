# Dental Signal — Full Scrape Results

**Date:** 2026-07-14
**DB:** assets/clinics-v6.db
**Script:** scripts/build-dental-flags.mjs

---

## Sites Processed

| Metric | Value |
|--------|-------|
| Total clinics | 10,429 |
| Unique canonical sites scraped | ~2,261 |
| Successful fetches | ~1,417 |
| Failed fetches (timeout / 4xx / 5xx) | ~844 |
| Clinics with no valid website | 4,041 → `unknown` |

---

## Distribution by dental_signal

| Signal | Clinics | % |
|--------|---------|---|
| `strong` | 5,316 | 51.0% |
| `none` | 1,008 | 9.7% |
| `unknown` | 4,041 | 38.7% |
| `medium` | 64 | 0.6% |
| **Total** | **10,429** | 100% |

**Notes:**
- `strong` = href containing "dental" or "oral-health", OR text "dental services/care", "oral health services"
- `medium` = text "dentist", "dentistry", "oral health" (after noise removal)
- `none` = site fetched OK, no dental keywords found
- `unknown` = no valid website, or fetch failed. **"Not known" ≠ "no dental".**

---

## Top-10 Organizations with Dental (strong) by Location Count

| Domain | Locations |
|--------|-----------|
| arcare.net | 82 |
| altamed.org | 66 |
| kintegra.org | 47 |
| omnifamilyhealth.org | 42 |
| jwchinstitute.org | 32 |
| primary-health.net | 32 |
| nems.org | 31 |
| clinicasierravista.org | 30 |
| seamar.org | 30 |
| goshenmedical.org | 28 |

One domain maps to all physical addresses of an FQHC grantee.
arcare.net has 82 clinic rows but it's ONE organization — they likely don't have dental at all 82 sites.

---

## 10 Random strong Examples (manual verification)

| id | Name | State | Website |
|----|------|-------|---------|
| 3280 | ACCESS Family Care Monett | MO | www.accessfamilycare.org |
| 3614 | JWCH Medical Clinic @ Charles Cobb Hotel | CA | www.jwchinstitute.org |
| 8472 | Matthew Walker Comprhensive Health Center - Smyrna | TN | www.mwchc.org |
| 17636 | BVCHC DENTAL Health Center | RI | www.bvchc.org |
| 13728 | In Homes Now Healthcare Services | NY | www.projectrenewal.org |
| 5051 | Community Health Services - Willard | OH | www.chsohio.com |
| 101 | E.A. HAWSE HEALTH CENTER, INC. | WV | www.hawsehealth.com |
| 2393 | Dora Street Health Center | CA | www.mchcinc.org |
| 2058 | OPTIMUS on the Boulevard | CT | www.optimushealthcare.org |
| 17488 | OVP - Proctorville, Ohio | OH | ovphealthcare.org |

---

## ⚠️ Critical Limitation — Organization-Level Signal

**This is the same granularity problem that disqualified the UDS path.**

A website scrape gives a signal at the ORGANIZATION level, not the location level.

- `arcare.net` mentions dental → all 82 arcare rows get `dental_signal='strong'`
- But not all 82 physical sites have a dentist on-site

This is NOT a bug — it's the known trade-off. The data is accurate at the org level, 
honest about uncertainty at the location level.

**Consequence for UI:** The dental filter MUST show a caveat.

---

## ✅ Approved UI Language

**Allowed:**
> "This health center offers dental services. Call this location to confirm —  
> not every site has a dentist."

**Allowed (filter label):**
> "Dental services mentioned"  
> "Dental (call to confirm)"

**Forbidden:**
- "Dental available here" — implies location-specific certainty we don't have
- "Dental at this location" — same problem
- "Dental covered" — 'covered' is forbidden (reads as insurance coverage)
- "FREE dental" — forbidden for HRSA/FQHC (sliding scale, not free)
- "Dental services available" without caveat — still implies location certainty

---

## Timing & Scale

- Avg fetch time (successful): ~700ms
- Concurrent workers: 5
- Actual wall time for full run: ~12 minutes
- For future re-runs: ~10 min with 10 workers

---

## Next Step (separate commit)

Add dental filter chip in the clinic list UI, showing only clinics with
`dental_signal IN ('strong', 'medium')`, with an inline caveat banner.

Do NOT add to this commit — data + schema only.
