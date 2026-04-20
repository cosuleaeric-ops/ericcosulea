#!/usr/bin/env python3
"""
Reads 🤑 TE 2025.xlsx and generates import_2025.php for pnlpersonal.
Run: python3 generate_import_2025.py
Then deploy and visit /pnlpersonal/import_2025.php once.
"""

import pandas as pd
import json
from pathlib import Path

EXCEL = Path.home() / "Downloads" / "🤑 TE 2025.xlsx"

MONTHS = [
    "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
    "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"
]

# Map Excel column names → DB category names
CAT_MAP = {
    "Groceries 🍎":  "Groceries 🍎",
    "Snacks 🍫":     "Snacks 🍫",
    "Fast-food 🍔":  "Fast-food 🍔",
    "Cafea☕":        "Cafea ☕",
    "Iesiri 🎳":     "Fun 🎳",
    "Igiena 🧼":     "Igiena 🧼",
    "Transport 🚌":  "Transport 🚌",
    "Abonamente 📺": "Abonamente 📺",
    "Proiecte 💻":   "Proiecte 💻",
    "Chirie 🏠":     "Chirie 🏠",
    "Shopping 🛍️":  "Shopping 🛍️",
    "Altele 📦":     "Altele 📦",
}

cheltuieli = []  # {data, categorie, suma}
venituri   = []  # {data, descriere, suma}
portofel   = []  # {data, cash, ing, revolut, trading212}

seen_portofel_dates = set()
all_portofel = []  # collect all first, then filter to weekly

for month in MONTHS:
    try:
        df = pd.read_excel(EXCEL, sheet_name=month)
    except Exception as e:
        print(f"Skip {month}: {e}")
        continue

    for _, row in df.iterrows():
        raw_date = row.get("Data")
        if pd.isna(raw_date):
            continue
        try:
            date_str = pd.to_datetime(raw_date).strftime("%Y-%m-%d")
        except Exception:
            continue

        # Cheltuieli
        for col, cat in CAT_MAP.items():
            val = row.get(col)
            try:
                fval = float(val) if pd.notna(val) else 0
            except (ValueError, TypeError):
                fval = 0
            if fval > 0:
                cheltuieli.append({
                    "data": date_str,
                    "categorie": cat,
                    "suma": round(fval, 2),
                })

        # Venituri
        venit_src  = row.get("Venit")
        venit_suma = row.get("Suma")
        if pd.notna(venit_src) and pd.notna(venit_suma) and str(venit_src).strip():
            try:
                venituri.append({
                    "data": date_str,
                    "descriere": str(venit_src).strip(),
                    "suma": round(float(venit_suma), 2),
                })
            except (ValueError, TypeError):
                pass

        # Portofel — one entry per date (last value wins)
        cash = row.get("Portofel")
        ing  = row.get("ING")
        rev  = row.get("Revolut")
        t212 = row.get("Trading212")

        has_any = any(pd.notna(x) for x in [cash, ing, rev, t212])
        if has_any and date_str not in seen_portofel_dates:
            seen_portofel_dates.add(date_str)
            all_portofel.append({
                "data":       date_str,
                "cash":       round(float(cash),  2) if pd.notna(cash)  else 0.0,
                "ing":        round(float(ing),   2) if pd.notna(ing)   else 0.0,
                "revolut":    round(float(rev),   2) if pd.notna(rev)   else 0.0,
                "trading212": round(float(t212),  2) if pd.notna(t212)  else 0.0,
            })

# Keep one portofel entry every 7 days
all_portofel.sort(key=lambda x: x["data"])
portofel = []
last_kept = None
for p in all_portofel:
    from datetime import datetime
    d = datetime.strptime(p["data"], "%Y-%m-%d")
    if last_kept is None or (d - last_kept).days >= 7:
        portofel.append(p)
        last_kept = d

print(f"Cheltuieli: {len(cheltuieli)}")
print(f"Venituri:   {len(venituri)}")
print(f"Portofel:   {len(all_portofel)} → {len(portofel)} (weekly)")

# All unique new categories (besides the standard ones already seeded)
standard_cats = {
    "Groceries 🍎","Snacks 🍫","Fast-food 🍔","Băuturi ☕","Fun 🎳",
    "Igiena 🧼","Transport 🚌","Abonamente 📺","Proiecte 💻","Chirie 🏠","Altele 📦",
}
extra_cats = sorted({c["categorie"] for c in cheltuieli} - standard_cats)
print(f"Extra categories to add: {extra_cats}")

def php_str(s):
    return "'" + str(s).replace("\\", "\\\\").replace("'", "\\'") + "'"

def php_float(f):
    return str(f)

lines = []
lines.append("<?php")
lines.append("declare(strict_types=1);")
lines.append("")
lines.append("// ONE-TIME IMPORT SCRIPT — delete after running")
lines.append("// Generated from 🤑 TE 2025.xlsx")
lines.append("")
lines.append("require __DIR__ . '/../admin/auth.php';")
lines.append("if (!is_logged_in()) { http_response_code(401); exit; }")
lines.append("")
lines.append("$db_dir = __DIR__ . '/data';")
lines.append("if (!is_dir($db_dir)) { mkdir($db_dir, 0750, true); }")
lines.append("$db = new SQLite3($db_dir . '/pnlpersonal.sqlite');")
lines.append("$db->enableExceptions(true);")
lines.append("$db->busyTimeout(5000);")
lines.append("$db->exec('PRAGMA journal_mode=WAL');")
lines.append("")
lines.append("// Guard: run only once")
lines.append("$flag = $db_dir . '/import_2025_done.flag';")
lines.append("if (file_exists($flag)) { echo 'Already imported.'; exit; }")
lines.append("")
lines.append("// Backup")
lines.append("$src = $db_dir . '/pnlpersonal.sqlite';")
lines.append("$bak = $db_dir . '/pnlpersonal.sqlite.pre-import-2025-' . date('Ymd-His');")
lines.append("copy($src, $bak);")
lines.append("")
lines.append("$db->exec('BEGIN');")
lines.append("try {")
lines.append("")

# Extra categories
if extra_cats:
    lines.append("    // Add extra categories")
    for cat in extra_cats:
        lines.append(f"    $db->exec(\"INSERT OR IGNORE INTO cheltuiala_categorii (nume) VALUES ({php_str(cat)})\");")
    lines.append("")

# Cheltuieli
lines.append("    // Cheltuieli")
lines.append("    $sc = $db->prepare('INSERT INTO cheltuieli (data,categorie,detalii,suma) VALUES (:d,:c,:det,:s)');")
lines.append("    $data_c = [")
for c in cheltuieli:
    lines.append(f"        [{php_str(c['data'])},{php_str(c['categorie'])},{php_float(c['suma'])}],")
lines.append("    ];")
lines.append("    foreach ($data_c as [$d,$cat,$s]) {")
lines.append("        $sc->bindValue(':d',$d); $sc->bindValue(':c',$cat);")
lines.append("        $sc->bindValue(':det',''); $sc->bindValue(':s',$s);")
lines.append("        $sc->execute(); $sc->reset();")
lines.append("    }")
lines.append("")

# Venituri
lines.append("    // Venituri")
lines.append("    $sv = $db->prepare('INSERT INTO venituri (data,descriere,suma) VALUES (:d,:desc,:s)');")
lines.append("    $data_v = [")
for v in venituri:
    lines.append(f"        [{php_str(v['data'])},{php_str(v['descriere'])},{php_float(v['suma'])}],")
lines.append("    ];")
lines.append("    foreach ($data_v as [$d,$desc,$s]) {")
lines.append("        $sv->bindValue(':d',$d); $sv->bindValue(':desc',$desc); $sv->bindValue(':s',$s);")
lines.append("        $sv->execute(); $sv->reset();")
lines.append("    }")
lines.append("")

# Portofel
lines.append("    // Portofel")
lines.append("    $sp = $db->prepare('INSERT INTO portofel (data,cash,ing,revolut,trading212) VALUES (:d,:cash,:ing,:rev,:t212)');")
lines.append("    $data_p = [")
for p in portofel:
    lines.append(f"        [{php_str(p['data'])},{php_float(p['cash'])},{php_float(p['ing'])},{php_float(p['revolut'])},{php_float(p['trading212'])}],")
lines.append("    ];")
lines.append("    foreach ($data_p as [$d,$cash,$ing,$rev,$t212]) {")
lines.append("        $sp->bindValue(':d',$d); $sp->bindValue(':cash',$cash);")
lines.append("        $sp->bindValue(':ing',$ing); $sp->bindValue(':rev',$rev); $sp->bindValue(':t212',$t212);")
lines.append("        $sp->execute(); $sp->reset();")
lines.append("    }")
lines.append("")

lines.append("    $db->exec('COMMIT');")
lines.append("    touch($flag);")
lines.append(f"    echo 'Import done. Cheltuieli: {len(cheltuieli)}, Venituri: {len(venituri)}, Portofel: {len(portofel)}.';")
lines.append("} catch (Exception $e) {")
lines.append("    $db->exec('ROLLBACK');")
lines.append("    echo 'ERROR: ' . $e->getMessage();")
lines.append("}")
lines.append("")

out = Path(__file__).parent / "import_2025.php"
out.write_text("\n".join(lines), encoding="utf-8")
print(f"\nGenerated: {out}")
