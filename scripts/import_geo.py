"""Import the reviewed GRID3 snapshot and, optionally, INEC's ward reference."""
import argparse
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DIGESTS = {
    "state": "6e1d8e9309813760dcaecfa90d4961b6a8030ba7244f37c67c0b87e9ed147cc2",
    "lga": "d43fb821a5d4df78b7a3558d2465ec1848514da8eb487958b413f54d80a74680",
    "wards": "a3eb0656f32096bfb846e462b4262b19b4c301701a8bc4e98a97fae24693d021",
    "rac": "7af4fe924412edd4107a3bfc48e405999889a9a637f53d831d6e9fcceb632eba",
}


def checked(path, key):
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != DIGESTS[key]:
        raise ValueError(f"{key}: source changed; review before importing")
    return raw


def area_id(name):
    return re.sub(r"[- /]+", "-", name.lower())


def copy_rows(table, rows):
    buf = io.StringIO()
    csv.writer(buf, lineterminator="\n").writerows(rows)
    return f"COPY {table} FROM STDIN WITH (FORMAT csv);\n{buf.getvalue()}\\.\n"


def ward_rows(pdf, parents):
    raw = checked(pdf, "rac")
    layout = subprocess.check_output(["pdftotext", "-layout", "-enc", "UTF-8", "-", "-"], input=raw).decode("utf-8")
    rows = []
    for line in layout.splitlines():
        match = re.fullmatch(r"\s*(\d+)\s+(.+?)\s{2,}(.+?)\s*", line)
        if match:
            number, parent, ward = match.groups()
            slug = {"ado": "ado-ekiti", "irepodun": "irepodun-ifelodun",
                    "gboyin": "gbonyin"}.get(area_id(parent), area_id(parent))
            if int(number) != len(rows) + 1 or slug not in parents:
                raise ValueError(f"Unexpected INEC row {line}")
            rows.append((f"inec-rac-ekiti-{number}", slug, ward))
    if len(rows) != 177 or len({(parent, name) for _, parent, name in rows}) != 177:
        raise ValueError("Incomplete or duplicate INEC reference")
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inec-pdf", type=Path)
    args = parser.parse_args()
    records = []
    parents = set()
    for kind in ("state", "lga"):
        data = json.loads(checked(ROOT / f"data/grid3/{kind}.json", kind))
        if data["crs"]["properties"]["name"] != "EPSG:4326":
            raise ValueError("Unexpected source CRS")
        for feature in data["features"]:
            props = feature["properties"]
            if props["statename"] != "Ekiti":
                raise ValueError("Unexpected state")
            key = "ekiti" if kind == "state" else area_id(props["lganame"])
            if kind == "lga":
                parents.add(key)
            records.append((key, f"grid3-{kind}-2020", json.dumps(feature)))
    sql = """BEGIN;
    SELECT pg_advisory_xact_lock(23178501);
    LOCK TABLE geo.areas, geo.boundaries, geo.import_quarantine IN SHARE ROW EXCLUSIVE MODE;
    CREATE TEMP TABLE features(area_key text PRIMARY KEY,source_key text,feature jsonb) ON COMMIT DROP;
    """ + copy_rows("features", records)
    sql += (ROOT / "scripts/import_grid3.sql").read_text()
    if args.inec_pdf:
        sql += "CREATE TEMP TABLE wards(id text,parent_id text,name text) ON COMMIT DROP;\n"
        sql += copy_rows("wards", ward_rows(args.inec_pdf, parents))
        sql += """
        INSERT INTO geo.data_sources(id,title,publisher,source_url,verification_notes)
        VALUES ('inec-ekiti-rac','Ekiti PVC collection centers, registration areas','INEC',
          'https://inecnigeria.org/documents/resources/rac/EKITI.pdf',
          'Pinned PDF, retrieved 2026-11-10. IDs use document serial numbers. Redistribution license unspecified.')
        ON CONFLICT DO NOTHING;
        INSERT INTO geo.areas(id,parent_id,name,area_kind,data_source_id,verification_state)
        SELECT id,parent_id,name,'ward','inec-ekiti-rac','verified' FROM wards
        ON CONFLICT(id) DO NOTHING;
        DO $$ BEGIN
          IF (SELECT count(*) FROM geo.areas WHERE data_source_id='inec-ekiti-rac') <> 177
            OR EXISTS (
              SELECT FROM wards w LEFT JOIN geo.areas a ON a.id=w.id
              LEFT JOIN geo.areas p ON p.id=a.parent_id
              WHERE (a.area_kind,a.name,a.parent_id,a.verification_state,a.data_source_id)
                IS DISTINCT FROM ('ward',w.name,w.parent_id,'verified','inec-ekiti-rac')
                OR (p.area_kind,p.parent_id,p.verification_state)
                IS DISTINCT FROM ('lga','ekiti','verified')
            ) THEN RAISE EXCEPTION 'INEC import differs from the reviewed 177 ward references';
          END IF;
        END $$;
        """
    subprocess.run(["psql", "-X", "-v", "ON_ERROR_STOP=1", os.environ["DATABASE_URL"]],
                   input=sql + "\nCOMMIT;\n", text=True, check=True, cwd=ROOT / "scripts")


if __name__ == "__main__":
    main()
