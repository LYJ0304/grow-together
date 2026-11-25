"""Validate optional RAG topology without reading any local secret env files."""

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class RagComposeTest(unittest.TestCase):
    def config(self, filename, rag):
        env = {
            key: value
            for key, value in os.environ.items()
            if not key.startswith(("RAG_", "STAGING_"))
        }
        for line in (ROOT / "infra/staging/.env.example").read_text().splitlines():
            if line.startswith("STAGING_"):
                env[line.split("=", 1)[0]] = "test-only"
        env["STAGING_API_PORT"] = "18080"
        env["STAGING_MINIO_PORT"] = "19000"
        args = ["docker", "compose", "-f", str(ROOT / "infra" / filename)]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml") as override:
            override.write(
                "services:\n  api:\n    env_file: !reset []\n  worker:\n    env_file: !reset []\n"
            )
            override.flush()
            args += ["-f", override.name]
            if rag:
                args += ["--profile", "rag", "--profile", "worker"]
            args += ["config", "--format", "json", "--no-env-resolution"]
            result = subprocess.run(
                args, env=env, capture_output=True, text=True, check=False
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_isolated_optional_rag_and_unchanged_service_database(self):
        for filename in ["compose.yaml", "compose.staging.yaml"]:
            with self.subTest(filename=filename):
                config = self.config(filename, rag=True)
                services = config["services"]
                db = services["rag-postgres"]
                self.assertEqual(db["image"], "pgvector/pgvector:0.8.2-pg16")
                self.assertEqual(db["networks"], {"rag": None})
                self.assertNotIn("ports", db)
                self.assertTrue(config["networks"]["rag"]["internal"])
                self.assertEqual(set(services["worker"]["networks"]), {"ai", "rag"})
                self.assertEqual(set(services["api"]["networks"]), {"default", "ai"})
                self.assertEqual(set(services["postgres"]["networks"]), {"default"})
                self.assertEqual(
                    services["postgres"]["image"], "pgvector/pgvector:pg16"
                )
                self.assertEqual(
                    services["postgres"]["volumes"][0]["source"], "postgres-data"
                )
                self.assertEqual(db["volumes"][0]["source"], "rag-postgres-data")
                self.assertEqual(set(services["rag-migrate"]["networks"]), {"rag"})
                self.assertEqual(
                    services["worker"]["environment"]["RAG_DATABASE_URL"], ""
                )
                self.assertNotIn(
                    "rag-postgres", services["worker"].get("depends_on", {})
                )
                disabled = self.config(filename, rag=False)
                self.assertNotIn("rag-postgres", disabled["services"])
                self.assertNotIn("rag-migrate", disabled["services"])


if __name__ == "__main__":
    unittest.main()
