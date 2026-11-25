"""Real pgvector permission/migration tests. Only use disposable test containers."""

import concurrent.futures
import os
import subprocess
import time
import unittest
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IMAGE = "pgvector/pgvector:0.8.2-pg16"
PASSWORDS = {
    "rag_admin": "test-admin-only",
    "rag_reader": "test-reader-only",
    "rag_ingest": "test-ingest-only",
    "rag_migrator": "test-migrator-only",
}


class RagPostgresTest(unittest.TestCase):
    @classmethod
    def command(cls, *args, input=None):
        return subprocess.run(
            args, input=input, text=True, capture_output=True, check=False
        )

    @classmethod
    def sql(cls, statement, user="rag_admin", database="growtogether_rag"):
        return cls.command(
            "docker",
            "exec",
            "-i",
            "-e",
            f"PGPASSWORD={PASSWORDS[user]}",
            cls.container,
            "psql",
            "-X",
            "-h",
            "127.0.0.1",
            "-U",
            user,
            "-d",
            database,
            "-v",
            "ON_ERROR_STOP=1",
            "-At",
            input=statement,
        )

    @classmethod
    def apply(cls, bootstrap=True):
        env = {
            "PGHOST": "127.0.0.1",
            "PGDATABASE": "growtogether_rag",
            "PGUSER": "rag_admin",
            "PGPASSWORD": PASSWORDS["rag_admin"],
            "RAG_MIGRATOR_PASSWORD": PASSWORDS["rag_migrator"],
            "RAG_INGEST_PASSWORD": PASSWORDS["rag_ingest"],
            "RAG_READER_PASSWORD": PASSWORDS["rag_reader"],
            "RAG_MIGRATION_DIR": "/test-db/migrations",
            "RAG_MIGRATION_SCRIPT": "/test-db/migrate.sh",
        }
        if not bootstrap:
            env.update(PGUSER="rag_migrator", PGPASSWORD=PASSWORDS["rag_migrator"])
        args = ["docker", "exec"]
        for key, value in env.items():
            args.extend(["-e", f"{key}={value}"])
        args += [
            cls.container,
            "sh",
            "/test-bootstrap/apply.sh" if bootstrap else "/test-db/migrate.sh",
        ]
        return cls.command(*args)

    @classmethod
    def setUpClass(cls):
        cls.container = os.getenv("RAG_TEST_CONTAINER")
        cls.owned = not cls.container
        if cls.owned:
            cls.container = "rag-239-test-" + uuid.uuid4().hex[:8]
            result = cls.command(
                "docker",
                "run",
                "-d",
                "--name",
                cls.container,
                "--tmpfs",
                "/var/lib/postgresql/data",
                "-e",
                "POSTGRES_DB=growtogether_rag",
                "-e",
                "POSTGRES_USER=rag_admin",
                "-e",
                f"POSTGRES_PASSWORD={PASSWORDS['rag_admin']}",
                IMAGE,
            )
            if result.returncode:
                raise RuntimeError(result.stderr)
            cls.addClassCleanup(cls.command, "docker", "rm", "-f", cls.container)
        elif not cls.container.startswith("rag-239-test"):
            raise RuntimeError(
                "External container must be a disposable rag-239-test* fixture"
            )
        deadline = time.monotonic() + 60
        while cls.sql("SELECT 1").returncode:
            if time.monotonic() > deadline:
                raise RuntimeError("Test PostgreSQL did not become ready")
            time.sleep(0.25)
        if not cls.owned:
            result = cls.sql(
                """
                DROP DATABASE growtogether_rag WITH (FORCE);
                CREATE DATABASE growtogether_rag;
                DROP ROLE IF EXISTS rag_reader, rag_ingest, rag_migrator;
            """,
                database="postgres",
            )
            if result.returncode:
                raise RuntimeError(result.stderr)
        for source, dest in [
            (ROOT / "infra/rag-postgres", "/test-bootstrap"),
            (ROOT / "apps/worker/db", "/test-db"),
        ]:
            result = cls.command(
                "docker", "cp", str(source) + "/.", f"{cls.container}:{dest}"
            )
            if result.returncode:
                raise RuntimeError(result.stderr)
        # Existing volume/role: PUBLIC initially permits connecting to maintenance DBs.
        result = cls.sql("""
            CREATE ROLE rag_reader LOGIN PASSWORD 'test-reader-only';
            GRANT CONNECT ON DATABASE postgres, template1 TO rag_reader;
            GRANT CREATE, TEMPORARY ON DATABASE growtogether_rag TO rag_reader;
            GRANT CREATE, USAGE ON SCHEMA public TO rag_reader;
            CREATE TABLE public.preexisting(id integer PRIMARY KEY, body text NOT NULL);
            INSERT INTO public.preexisting VALUES (1, 'keep existing data');
        """)
        if result.returncode:
            raise RuntimeError(result.stderr)
        result = cls.apply()
        if result.returncode:
            raise RuntimeError(result.stderr)

    def test_rag_retrieval_tables_are_present(self):
        result = self.sql(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='rag' AND table_name IN ('collections', 'documents', 'chunks')"
        )
        self.assertEqual(result.stdout.strip(), "3")

    def test_reader_cannot_connect_maintenance_database(self):
        for database in ["postgres", "template1"]:
            result = self.sql("SELECT 1", user="rag_reader", database=database)
            self.assertNotEqual(
                result.returncode, 0, "reader must not inherit PUBLIC CONNECT"
            )
            self.assertIn("permission denied", result.stderr)

    def test_extension_and_data_survive_reapply(self):
        self.assertEqual(
            self.sql(
                "SELECT extversion FROM pg_extension WHERE extname='vector'"
            ).stdout.strip(),
            "0.8.2",
        )
        result = self.apply()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            self.sql("SELECT body FROM public.preexisting").stdout.strip(),
            "keep existing data",
        )
        self.assertEqual(
            self.sql("SELECT count(*) FROM rag.schema_migrations").stdout.strip(),
            str(len(list((ROOT / "apps/worker/db/migrations").glob("*.sql")))),
        )
        self.assertEqual(
            self.sql(
                "SELECT '[1,2,3]'::extensions.vector <-> '[1,2,4]'::extensions.vector",
                "rag_reader",
            ).stdout.strip(),
            "1",
        )

    def test_runtime_permissions_and_future_tables(self):
        result = self.sql(
            "CREATE TABLE rag.permission_probe(id serial PRIMARY KEY, value text);",
            "rag_migrator",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        try:
            for statement in [
                "INSERT INTO rag.permission_probe(value) VALUES ('write');",
                "UPDATE rag.permission_probe SET value='updated';",
                "DELETE FROM rag.permission_probe;",
            ]:
                result = self.sql(statement, "rag_ingest")
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertNotEqual(self.sql(statement, "rag_reader").returncode, 0)
            for user in ["rag_reader", "rag_ingest"]:
                self.assertEqual(
                    self.sql(
                        "SELECT count(*) FROM rag.permission_probe", user
                    ).returncode,
                    0,
                )
                for statement in [
                    "CREATE TABLE rag.forbidden(id integer)",
                    "CREATE TABLE public.forbidden(id integer)",
                    "CREATE TABLE extensions.forbidden(id integer)",
                    "CREATE SCHEMA forbidden",
                    "CREATE TEMP TABLE forbidden(id integer)",
                    "UPDATE rag.schema_migrations SET checksum='bad'",
                    "SET ROLE rag_migrator",
                    "CREATE EXTENSION hstore",
                ]:
                    self.assertNotEqual(
                        self.sql(statement, user).returncode, 0, statement
                    )
        finally:
            self.sql("DROP TABLE rag.permission_probe", "rag_migrator")

    def test_checksum_drift_and_failed_migration_roll_back(self):
        original = ROOT / "apps/worker/db/migrations/0001__vector_permissions.sql"
        self.command(
            "docker",
            "exec",
            self.container,
            "sh",
            "-c",
            "printf '\\n-- changed\\n' >> /test-db/migrations/0001__vector_permissions.sql",
        )
        try:
            result = self.apply(bootstrap=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("checksum", result.stdout.lower() + result.stderr.lower())
        finally:
            self.command(
                "docker",
                "cp",
                str(original),
                f"{self.container}:/test-db/migrations/0001__vector_permissions.sql",
            )
        self.command(
            "docker",
            "exec",
            "-i",
            self.container,
            "sh",
            "-c",
            "cat > /test-db/migrations/9999__failure.sql",
            input="CREATE TABLE rag.must_rollback(id integer); SELECT 1/0;\n",
        )
        try:
            self.assertNotEqual(self.apply(bootstrap=False).returncode, 0)
            self.assertEqual(
                self.sql(
                    "SELECT to_regclass('rag.must_rollback') IS NULL"
                ).stdout.strip(),
                "t",
            )
            self.assertEqual(
                self.sql("SELECT count(*) FROM rag.schema_migrations").stdout.strip(),
                str(len(list((ROOT / "apps/worker/db/migrations").glob("*.sql")))),
            )
        finally:
            self.command(
                "docker",
                "exec",
                self.container,
                "rm",
                "/test-db/migrations/9999__failure.sql",
            )

    def test_concurrent_migration_runs(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            for result in pool.map(lambda _: self.apply(bootstrap=False), range(2)):
                self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            self.sql("SELECT count(*) FROM rag.schema_migrations").stdout.strip(),
            str(len(list((ROOT / "apps/worker/db/migrations").glob("*.sql")))),
        )


if __name__ == "__main__":
    unittest.main()
