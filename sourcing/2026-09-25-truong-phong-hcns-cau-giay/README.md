# Sourcing: Trưởng phòng Hành chính Nhân sự, Cầu Giấy (Hà Nội)

Checked on: 25/09/2026. Tools: Apify `apify/google-search-scraper` (25 queries × 3 pages, `countryCode=vn`) and `apify/rag-web-browser` (opens public LinkedIn posts). No sign-ins, no CAPTCHA or authwall bypassing, no guessed emails.

## Files
- `candidates.json`: main results (confirmed/probable only), sorted by descending `fit_score`.
- `watchlist_unverified.json`: people who fit the profile well (HR Manager/Head, Hà Nội, many in real estate) but have **no public job-seeking signal**. Not counted in the main results.
- `stats.json`: statistics and Apify run/dataset IDs.

## Statistics
| Metric | Value |
|---|---|
| Unique URLs checked on Google (Apify) | 457 (260 LinkedIn profiles, 100 LinkedIn posts, 2 Facebook, 95 job boards/other) |
| Pages opened for verification (RAG Web Browser) | 31 |
| Valid candidates (main results) | **2** |
| Confirmed Open to Work | 0 |
| Probable Open to Work | 2 |
| With real estate experience (main results) | 0 (no data) |
| With a public email | 0 |
| With a public phone | 0 |
| Unverified watchlist | 12 (10 with real estate/construction/property experience) |

## Main results
| ID | Name | Title | Location | OTW | Score |
|---|---|---|---|---|---|
| LT-HCNS-001 | Oanh Nguyen | HR & Admin Manager, Dinosys Corp | Hà Nội | probable: "available to start work at short notice" (undated) | 40 |
| LT-HCNS-002 | Truong Vu | CHRO / HR Director | Hanoi Capital Region | probable: "Looking for opportunities" (undated) | 38 |

The scores are low because the Google snippet has no data on recruitment, real estate or JD/KPI systems. Those criteria are scored 0 as **"no data"**, not as "no experience".

## Why there are so few results
1. The "Open to Work" frame on LinkedIn is **not public** without signing in, so it can't be checked legally with a scraper.
2. Most "#opentowork" posts found fall into one of these groups:
   - older than 12 months (2021–2024), e.g. Phan Hà (2022, looking for an HR Leader role in Cầu Giấy; has since changed jobs), Hoang Dieu Linh Le (2023, HCM);
   - job ads from recruiters/headhunters using the #opentowork hashtag (Van Vu/Reeracoen, Nguyen Dung (Tony), Khoa Nguyen...);
   - anonymous candidates (codes such as #mc101pd, "một người chị HR Manager") with no real name, so they fail the identity requirement;
   - specialist-level roles (e.g. Ngọc Dương, ~2 years of recruitment experience), excluded because there's no management evidence.
3. The Apify account ran out of monthly credit ($0.27 left) after the first run, so the second round (25 queries with a 1-year date filter) and verification of individual profiles could not run.

## Next steps
- Top up Apify credit, then run the second round with `quickDateRange: "y1"`, for example: `site:linkedin.com/posts opentowork "HR Manager" Hanoi`, `site:linkedin.com/posts "open to work" "HRM" Hà Nội`, `site:linkedin.com/in "Open to work" "Trưởng phòng" "nhân sự"`, `site:linkedin.com/posts opentowork "bất động sản" "nhân sự"`.
- For the 12 people in `watchlist_unverified.json` (Nguyen Quan at T&T Homes, Trịnh Lộc at Dat Phuong, Trần Lê Phương at Đầu tư & Xây dựng số 1 Hà Nội...), check through LinkedIn Recruiter/InMail. Only the platform can show the Open to Work status that recruiters see.
- Post the JD in HR groups on Facebook/LinkedIn to get candidates who are actively looking.
