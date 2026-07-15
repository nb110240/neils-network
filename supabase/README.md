# Database migrations

The unprefixed SQL files in `migrations/` are legacy, already-applied schema
history. Do not edit or rerun them to deploy a new database change.

Create each new change as an immutable, forward-only migration named with a
UTC timestamp:

```text
YYYYMMDDHHMMSS_short_description.sql
```

Production migrations are currently applied manually in the Supabase SQL
Editor. Run only the new timestamped migration, verify its behavior in
production, and commit the exact SQL that was applied so Git remains the
reproducible source of truth.

The account-deletion hardening migration was applied and verified in
production on 2026-07-15.
