# Sourcing: Giám đốc điều hành (CEO / GM / MD / COO) – FMCG & F&B, TP.HCM

Checked on: 08/10/2026. Tool: Apify `harvestapi/linkedin-profile-search` in Full mode (no email search), run 6 times with `locations=["Ho Chi Minh City"]`. Search angles:
- current/past titles CEO/GM/MD/COO/Country Manager/Giám đốc điều hành combined with FMCG/F&B keywords;
- seniority Director/VP/CXO/Owner combined with "open to work"/"looking for"/"seeking".

No emails or phones were collected, and nothing was guessed.

## Files
- `candidates.json`: 6 main candidates (4 with `openToWork=true`, 2 with a headline signal).
- `watchlist_unverified.json`: 17 FMCG/F&B executives in HCM without an OTW signal. Several are between roles or working as advisors, so they are worth approaching.
- `excluded_examples.json`: 12 people excluded (open to work, but wrong industry or role).
- `ung-vien-giam-doc-dieu-hanh-fmcg-fnb-hcm.xlsx`: tracker with contact and job-status columns.

## Main results
| ID | Name | Title | OTW | Score |
|---|---|---|---|---|
| GDDH-001 | Khoa Nguyen | F&B Operations Director, NovaDreams | confirmed | 72 |
| GDDH-002 | Thang Nguyen | General Manager (Senior GM F&B), F.C.C CO | confirmed | 70 |
| GDDH-003 | nhat nguyen the duc | CCO Delice Food | probable (headline) | 68 |
| GDDH-004 | UYEN TRỊNH | ex Director of Operations, Sargon | confirmed | 64 |
| GDDH-005 | Sandeep Gavali | R&D Director, Nissin Foods VN | probable ("Open to Director+ Roles in FMCG") | 58 |
| GDDH-006 | Quinn Thái | ex GM & Co-founder, Snuffbox | confirmed | 50 |

## Notes
In the first query (2,102 FMCG/F&B executives in HCM), none of the 24 profiles opened had `openToWork` turned on. Executive-level candidates rarely show the badge publicly, so the watchlist matters here. Priority: Oanh Nguyen (ex-CEO dan-d pak foods, independent advisor since 06/2024), Thinh Nguyen (MD McDonald's VN until 04/2026), Darryl Peacock and jean H.
