"""Download the DOL OFLC LCA disclosure files for the last 3 fiscal years into data/raw/.

Source page: https://www.dol.gov/agencies/eta/foreign-labor/performance
dol.gov returns 403 to automated clients unless the User-Agent carries a contact email,
so set LCA_CONTACT_EMAIL before running:

    LCA_CONTACT_EMAIL=you@example.edu python3 scripts/download_lca.py
"""
import os
import pathlib
import sys
import urllib.request

BASE = "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/"
FILES = {f"LCA_Disclosure_Data_FY{fy}_Q{q}.xlsx": BASE + f"LCA_Disclosure_Data_FY{fy}_Q{q}.xlsx"
         for fy in (2024, 2025) for q in (1, 2, 3, 4)}
# FY2026 Q3 is the latest release as of Oct 2026 and is published under /media/.
FILES["LCA_Disclosure_Data_FY2026_Q3.xlsx"] = "https://www.dol.gov/media/LCA_Disclosure_Data_FY2026_Q3.xlsx"
CONTACT = os.environ.get("LCA_CONTACT_EMAIL")
if not CONTACT:
    sys.exit("Set LCA_CONTACT_EMAIL (dol.gov requires a contact email in the User-Agent).")
HEADERS = {
    "User-Agent": f"sponsor-signal-coursework/0.1 ({CONTACT})",
    "Referer": "https://www.dol.gov/agencies/eta/foreign-labor/performance",
}

out = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw"
out.mkdir(parents=True, exist_ok=True)
for name, url in FILES.items():
    dest = out / name
    if dest.exists():
        print("have", name)
        continue
    print("get ", name, flush=True)
    req = urllib.request.Request(url, headers=HEADERS)
    tmp = dest.with_suffix(".part")
    try:
        with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
        tmp.rename(dest)
    except Exception as e:  # keep going so one missing quarter does not block the rest
        print("FAIL", name, e, file=sys.stderr)
