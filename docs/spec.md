# Sponsor Signal: One-Page Spec

Oct 7, 2026 · Vishal Menon · revision 2

Sponsor Signal reads one job posting and returns a card with two facts: what the posting says about visa sponsorship, and what the public Labor Department record shows for that employer and similar roles. Team: Khushi Advani, Vishal Menon. Product Management with AI, Fall 2026.

Changes in revision 2: the "less restrictive label wins" tie-break is removed and replaced by a fifth label, Unclear; the records are called LCA certifications, not filings; "no records found" gets a guard so it never reads as a no; examples and success criteria are updated to match.

## User

An international MS student in recruiting season with about 30 postings open and deadlines at the end of the week. Before spending an hour on a cover letter, they want to know what the posting says about sponsorship and whether this company has certified LCAs for similar roles before.

- On F-1 status, so they will need OPT first and H-1B sponsorship later. \[GUESS\]
- Browses job pages in Chrome on a laptop and screens postings in one sitting, one posting at a time. \[GUESS\]
- Not the user: domestic students, recruiters, and anyone looking for legal advice.

## Flow

1. **Capture.** On a job page, the student clicks the Chrome extension, which pulls the job description text from the page they have open. By default it reads only that page, only on click. If extraction fails, the student can paste the text instead. Optionally, the student can turn on "Auto-check when I switch tabs" in the side panel. This is off by default and asks Chrome for permission to read pages. When on, the extension reads the tab the student switches to and sends its text to the model only if it looks like a job posting (at least three distinct job-posting keywords); other tabs are not sent. Results are cached per URL.
2. **Classify.** The model assigns one label: sponsors, does not sponsor, citizenship or clearance required, silent, or unclear. It quotes the exact words behind the label and gives a confidence score. Conflicting or ambiguous wording (for example, "authorized to work on a permanent basis") is labeled unclear; there is no tie-break toward any other label. One hard rule: a posting that explicitly excludes sponsorship or requires citizenship is never labeled sponsors.
3. **Extract.** The model pulls the employer name and a normalized job title.
4. **Match.** Code, not the model, matches employer and title to Department of Labor records. Source is the H-1B LCA disclosure files, last 3 fiscal years.
5. **Card.** One card shows the label with its quote, then the history for similar roles: count of LCA certifications, recent years, typical titles. No match shows "no records found," never "does not sponsor," and says plainly that this is not a no. Unclear cards show the quote, the history for similar roles, and the nudge "Worth a recruiter question. Don't rule this out." The card appears in the extension panel beside the posting. Confidence under 70% adds a "check with recruiter" flag. \[GUESS\]
6. **Decide.** The student prioritizes, skips, or asks a recruiter.

## Wording for the records

An LCA (Labor Condition Application) is a step an employer takes with the Department of Labor before filing an H-1B petition. A certified LCA is not a petition, an approval, or a hire. The card says "LCA certifications" and "history for similar roles," and never "filings," "sponsorships," or "hires."

## Example inputs and ideal outputs

Postings, employers other than Meta, and confidence scores are invented for illustration. History lines now come from the real DOL files, so the card shows whatever the record holds. Swap in real cases from the 200-posting set.

| # | Posting says (input) | Ideal card (output) |
| --- | --- | --- |
| 1 | Data Scientist II, Ads at Meta: "We will sponsor H-1B visas for qualified candidates." | **Sponsors**, quote shown. Matched to the Meta entity in the records. History for similar roles: LCA certifications for data scientist titles, by year. |
| 2 | Quantitative Analyst at a bank: "Must be authorized to work in the United States on a permanent basis." | **Unclear**, quote shown, recruiter nudge. History for similar roles still shown. Label does not change because of it. |
| 3 | ML Engineer at a defense contractor: "U.S. persons only. Active Secret clearance required." | **Citizenship or clearance required**, quote shown. History shown as history; if there are certifications but none for similar roles, the card says so. |
| 4 | Associate Consultant at a consulting firm: no mention of visas, sponsorship, or work authorization. | **Silent**, "no sponsorship language found" in place of a quote. History for consultant titles. No prediction added. |
| 5 | Data Analyst at a 20-person startup: "Sponsorship is not available for this role, now or in the future." | **Does not sponsor**, quote shown. Employer not matched: "no records found." |

## Success criteria

Pass or fail, on 200 hand-labeled postings across finance, tech, and consulting, labeled with the five categories:

- Correct sponsorship category on at least 85%.
- Higher accuracy than the keyword-search baseline on the same 200 postings. Any margin counts. \[GUESS\]
- Employer matched to the right records at least 90% of the time, scored on the 100 hand-verified companies. \[GUESS\]
- Zero postings that exclude sponsorship or require citizenship labeled as sponsors.

Reported but not pass or fail: whether confidence scores are honest (90% confident means right about 90% of the time), accuracy by category with silent, unclear, and indirect phrasing called out, how often unclear is used and whether hand labelers agree it was warranted, and how often silent postings come from employers with substantial LCA history.

## Data sources

- **DOL OFLC LCA disclosure data** (used). Has employer name and job title, which the "similar roles" history needs.
- **USCIS H-1B Employer Data Hub** (checked, not used in this version). It counts actual petition decisions (approvals and denials, initial and continuing) by employer, fiscal year, NAICS code, and location, through FY2026 Q3. That is closer to real sponsorship than an LCA. It has no job title or occupation field, so it cannot answer "similar roles," and it is published as an interactive download rather than a stable file. It is a complement, not a replacement: a later version could add one employer-level line ("H-1B petitions approved, by year") under the role history.

## Out of scope

- Immigration or legal advice.
- Predictions of sponsorship, approval, or lottery odds.
- Green card and non-U.S. visas.
- Crawling job boards in bulk, reading pages the student has not opened, or auto-applying.
- Wage or salary analysis (possible stretch goal).
- Accounts, saved history, or batch upload of many postings at once. \[GUESS\]
- Non-English postings and jobs outside the U.S. \[GUESS\]
- Questions about OPT, CPT, or STEM extension eligibility. \[GUESS\]
