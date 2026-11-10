"""Audit a downloaded GRID3 v4 Ekiti response in temporary PostGIS tables."""
import json
import os
from pathlib import Path
import subprocess
import sys

from import_geo import ROOT, area_id, checked, copy_rows

data = json.loads(checked(Path(sys.argv[1]), "wards"))
if data["crs"]["properties"]["name"] != "EPSG:4326" or data.get("exceededTransferLimit"):
    raise ValueError("Unexpected CRS or partial response")
rows = []
for feature in data["features"]:
    props = feature["properties"]
    if props["state"] != "Ekiti":
        raise ValueError("Unexpected state")
    rows.append((props["OBJECTID"], area_id(props["lga"]), props["ward"], json.dumps(feature["geometry"])))
sql = """BEGIN;
SET LOCAL search_path=pg_catalog,extensions;
CREATE TEMP TABLE raw(id int PRIMARY KEY,parent text,name text,geometry_json jsonb);
""" + copy_rows("raw", rows) + (ROOT / "scripts/audit_wards.sql").read_text()
subprocess.run(["psql", "-X", "-v", "ON_ERROR_STOP=1", os.environ["DATABASE_URL"]],
               input=sql, text=True, check=True)
