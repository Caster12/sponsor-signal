"""Stream the DOL LCA xlsx files in data/raw/ into one slim CSV at data/lca_slim.csv.

Keeps only what the matcher needs: fiscal year, visa class, case status, employer name, job title.
Reads the xlsx XML directly (two passes) because the files are too large to load whole.
"""
import csv
import pathlib
import re
import sys
import zipfile
from xml.etree.ElementTree import iterparse

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
WANTED = ["VISA_CLASS", "CASE_STATUS", "EMPLOYER_NAME", "JOB_TITLE", "DECISION_DATE"]
ROOT = pathlib.Path(__file__).resolve().parent.parent
COL = re.compile(r"[A-Z]+")


def sheet_rows(zf):
    """Yield each row as {column letters: (is_shared_string, value)}."""
    name = next(n for n in zf.namelist() if n.startswith("xl/worksheets/sheet"))
    with zf.open(name) as f:
        for _, el in iterparse(f):
            if el.tag != NS + "row":
                continue
            row = {}
            for c in el:
                col = COL.match(c.get("r")).group()
                t = c.get("t")
                if t == "inlineStr":
                    row[col] = (False, "".join(x.text or "" for x in c.iter(NS + "t")))
                else:
                    v = c.find(NS + "v")
                    if v is not None and v.text is not None:
                        row[col] = (t == "s", v.text)
            yield row
            el.clear()


def shared_strings(zf, needed):
    out = {}
    if "xl/sharedStrings.xml" not in zf.namelist():
        return out
    i = 0
    with zf.open("xl/sharedStrings.xml") as f:
        for _, el in iterparse(f):
            if el.tag == NS + "si":
                if i in needed:
                    out[i] = "".join(x.text or "" for x in el.iter(NS + "t"))
                i += 1
                el.clear()
    return out


def extract(path, writer):
    fy = re.search(r"FY(\d{4})", path.name).group(1)
    with zipfile.ZipFile(path) as zf:
        rows = sheet_rows(zf)
        header = next(rows)
        hdr_idx = {int(v) for s, v in header.values() if s}
        hdr_strings = shared_strings(zf, hdr_idx)
        names = {col: (hdr_strings[int(v)] if s else v) for col, (s, v) in header.items()}
        cols = {n: c for c, n in names.items() if n in WANTED}
        missing = [w for w in WANTED if w not in cols]
        if missing:
            sys.exit(f"{path.name}: missing columns {missing}")
        kept, needed = [], set()
        for row in rows:
            cells = [row.get(cols[w]) for w in WANTED]
            if cells[2] is None:  # the sheets carry long runs of empty trailing rows
                continue
            for cell in cells[:4]:
                if cell and cell[0]:
                    needed.add(int(cell[1]))
            kept.append(cells)
        strings = shared_strings(zf, needed)
    lo = hi = None
    for cells in kept:
        vals = [(strings[int(c[1])] if c[0] else c[1]) if c else "" for c in cells[:4]]
        writer.writerow([fy] + [v.strip() for v in vals])
        d = cells[4]
        if d and not d[0]:
            try:
                x = float(d[1])
                lo, hi = (x if lo is None else min(lo, x)), (x if hi is None else max(hi, x))
            except ValueError:
                pass
    # Decision dates are Excel serials; printed so a reader can see what period each file covers.
    print(f"{path.name}: {len(kept)} rows, decision date serials {lo}..{hi}", flush=True)


with open(ROOT / "data" / "lca_slim.csv", "w", newline="") as out:
    w = csv.writer(out)
    w.writerow(["fy", "visa_class", "case_status", "employer_name", "job_title"])
    for p in sorted((ROOT / "data" / "raw").glob("LCA_Disclosure_Data_FY*.xlsx")):
        extract(p, w)
