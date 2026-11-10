"""Integration regressions. Run on a disposable database after the full INEC import."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from import_geo import area_id, copy_rows


def psql(sql):
    return subprocess.run(["psql", "-XAtq", "-F", "|", "-v", "ON_ERROR_STOP=1", os.environ["DATABASE_URL"]],
                          input=sql, cwd=ROOT / "scripts", text=True, capture_output=True)


class ImportChecks(unittest.TestCase):
    def test_complete_inec_reference(self):
        result = psql("""
            SELECT w.id,p.id,w.name FROM geo.areas w JOIN geo.areas p ON p.id=w.parent_id
            WHERE w.area_kind='ward' AND w.verification_state='verified' AND w.data_source_id='inec-ekiti-rac'
              AND p.area_kind='lga' AND p.parent_id='ekiti' AND p.verification_state='verified'
            ORDER BY substring(w.id from '[0-9]+$')::integer
        """)
        self.assertEqual(result.returncode, 0, result.stderr)
        rows = result.stdout.splitlines()
        self.assertEqual(len(rows), 177)
        self.assertEqual(len({row.split("|")[1] for row in rows}), 16)
        # Fingerprint of all reviewed document serial, parent ID and name triples.
        self.assertEqual(hashlib.sha256(result.stdout.encode()).hexdigest(),
                         "0b03fa6dc2ae2a320d843b2ec9c80ce2f6b943c79a48c93afcbe0bd79b485cf8")

    def test_promotion_rejects_bad_batches(self):
        records = []
        for kind in ["state", "lga"]:
            for f in json.loads((ROOT / f"data/grid3/{kind}.json").read_text())["features"]:
                key = area_id(f["properties"].get("lganame", "Ekiti"))
                records.append((key, f"grid3-{kind}-2020", json.dumps(f)))
        setup = """
            BEGIN;
            DELETE FROM geo.boundaries WHERE data_source_id IN ('grid3-state-2020','grid3-lga-2020');
            UPDATE geo.areas SET verification_state='unverified',data_source_id='ekiti-lga-name-audit'
              WHERE data_source_id IN ('grid3-state-2020','grid3-lga-2020');
            CREATE TEMP TABLE features(area_key text PRIMARY KEY,source_key text,feature jsonb);
        """ + copy_rows("features", records)
        cases = [
            ("DELETE FROM features WHERE area_key='efon'", "Unexpected GRID3 input IDs"),
            ("UPDATE features SET feature=jsonb_set(feature,'{properties,uniq_id}','0') WHERE area_key='efon'",
             "Unexpected GRID3 input IDs"),
            ("UPDATE features SET feature=feature-'geometry' WHERE area_key='efon'", "quarantined records"),
            ("""UPDATE features SET feature=jsonb_set(feature,'{geometry}',
                (SELECT feature->'geometry' FROM features WHERE area_key='oye')) WHERE area_key='efon'""",
             "topology exceeds zero"),
            ("UPDATE geo.areas SET verification_state='disputed' WHERE id='efon'", "unexpected GRID3 snapshot record"),
        ]
        for mutation, message in cases:
            with self.subTest(mutation=mutation):
                result = psql(setup + mutation + ";\n" + r"\i import_grid3.sql" + "\nROLLBACK;")
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(message, result.stderr)
                restored = psql("SELECT count(*) FROM geo.boundaries WHERE verification_state='verified' "
                                "AND data_source_id IN ('grid3-state-2020','grid3-lga-2020')")
                self.assertEqual(restored.stdout.strip(), "17")

    def test_coverage_rejects_missing_verified_geometry(self):
        # Run the coverage script with a transaction-local withdrawal immediately after BEGIN.
        report = (ROOT / "scripts/coverage.sql").read_text()
        result = psql(report.replace("BEGIN ISOLATION LEVEL REPEATABLE READ;",
            "BEGIN ISOLATION LEVEL REPEATABLE READ; UPDATE geo.boundaries SET verification_state='unverified' "
            "WHERE area_id='efon' AND data_source_id='grid3-lga-2020';"))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("snapshot is not fully verified", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
