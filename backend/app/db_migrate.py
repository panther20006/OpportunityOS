import logging
from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

OPPORTUNITY_TYPES_SQL = (
    "'internship','full_time','part_time','contract','career_page','program','hackathon','grant','fellowship','unknown'"
)


def migrate_database(engine: Engine) -> None:
    """
    Safely migrates the database schema preserving all existing records.
    Supports both SQLite and PostgreSQL.
    Ensures:
    1. 'is_demo' column exists on 'opportunities'.
    2. 'chk_opp_opportunity_type' constraint supports hackathons, grants, and fellowships.
    """
    dialect_name = engine.dialect.name

    if dialect_name == "sqlite":
        _migrate_sqlite(engine)
    elif dialect_name in ("postgresql", "postgres"):
        _migrate_postgres(engine)
    else:
        logger.info(f"Database dialect {dialect_name} does not require manual constraint rebuild.")


def _migrate_sqlite(engine: Engine) -> None:
    with engine.begin() as conn:
        # Check if opportunities table exists
        table_exists = conn.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='opportunities'"
        ).fetchone()
        if not table_exists:
            return

        # Check existing table SQL and columns
        create_sql_row = conn.exec_driver_sql(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='opportunities'"
        ).fetchone()
        create_sql = create_sql_row[0] if create_sql_row else ""

        cols_info = conn.exec_driver_sql("PRAGMA table_info(opportunities)").fetchall()
        existing_cols = [c[1] for c in cols_info]

        needs_demo_col = "is_demo" not in existing_cols
        needs_constraint_update = "hackathon" not in create_sql

        if not needs_demo_col and not needs_constraint_update:
            logger.info("SQLite 'opportunities' table schema is already up to date.")
            return

        logger.info(
            f"Migrating SQLite 'opportunities' table (needs_demo_col={needs_demo_col}, "
            f"needs_constraint_update={needs_constraint_update})..."
        )

        # Disable foreign keys during table rebuild
        conn.exec_driver_sql("PRAGMA foreign_keys = OFF;")

        # 1. Create temporary new table
        conn.exec_driver_sql(
            f"""
            CREATE TABLE opportunities_new (
                id VARCHAR(36) NOT NULL,
                dedupe_hash VARCHAR(64) NOT NULL,
                source_engine VARCHAR(20) NOT NULL,
                external_id TEXT,
                title VARCHAR(300) NOT NULL,
                company_name VARCHAR(200),
                location VARCHAR(200),
                is_remote BOOLEAN NOT NULL,
                opportunity_type VARCHAR(20) NOT NULL,
                schedule_type VARCHAR(50),
                description TEXT,
                highlights JSON,
                source_via VARCHAR(200),
                apply_url TEXT,
                posted_at_text VARCHAR(50),
                first_seen_at DATETIME NOT NULL,
                last_seen_at DATETIME NOT NULL,
                raw JSON,
                is_demo BOOLEAN DEFAULT 0 NOT NULL,
                created_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT chk_opp_source_engine CHECK (source_engine IN ('google_jobs','google')),
                CONSTRAINT chk_opp_opportunity_type CHECK (opportunity_type IN ({OPPORTUNITY_TYPES_SQL}))
            );
            """
        )

        # 2. Copy existing data
        if "is_demo" in existing_cols:
            demo_select = "is_demo"
        else:
            demo_select = "0 AS is_demo"

        copy_cols = [
            "id", "dedupe_hash", "source_engine", "external_id", "title",
            "company_name", "location", "is_remote", "opportunity_type",
            "schedule_type", "description", "highlights", "source_via",
            "apply_url", "posted_at_text", "first_seen_at", "last_seen_at",
            "raw", "created_at"
        ]
        cols_csv = ", ".join(copy_cols)

        conn.exec_driver_sql(
            f"""
            INSERT INTO opportunities_new ({cols_csv}, is_demo)
            SELECT {cols_csv}, {demo_select} FROM opportunities;
            """
        )

        # 3. Drop old table and rename
        conn.exec_driver_sql("DROP TABLE opportunities;")
        conn.exec_driver_sql("ALTER TABLE opportunities_new RENAME TO opportunities;")

        # 4. Recreate indexes
        conn.exec_driver_sql("CREATE UNIQUE INDEX ix_opportunities_dedupe_hash ON opportunities (dedupe_hash);")
        conn.exec_driver_sql("CREATE INDEX ix_opportunities_title ON opportunities (title);")
        conn.exec_driver_sql("CREATE INDEX ix_opportunities_company_name ON opportunities (company_name);")
        conn.exec_driver_sql("CREATE INDEX ix_opportunities_is_remote ON opportunities (is_remote);")
        conn.exec_driver_sql("CREATE INDEX ix_opportunities_opportunity_type ON opportunities (opportunity_type);")
        conn.exec_driver_sql("CREATE INDEX ix_opportunities_is_demo ON opportunities (is_demo);")

        conn.exec_driver_sql("PRAGMA foreign_keys = ON;")
        logger.info("SQLite 'opportunities' migration completed successfully.")


def _migrate_postgres(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE NOT NULL;")
        )
        conn.execute(
            text("ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_opp_opportunity_type;")
        )
        conn.execute(
            text(
                f"ALTER TABLE opportunities ADD CONSTRAINT chk_opp_opportunity_type "
                f"CHECK (opportunity_type IN ({OPPORTUNITY_TYPES_SQL}));"
            )
        )
        logger.info("PostgreSQL 'opportunities' migration completed successfully.")
