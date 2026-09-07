# data/knowledge/

The BIS knowledge base. **This is the source of truth for BIS information** — the
retrieval and AI layers (later phases) read from here and must not add facts of
their own.

## Files

One JSON file per category. Each file is a JSON **array** of knowledge items. The
filename must match the `category` field of every item inside it.

| File | Category |
|------|----------|
| `bis_general.json` | BIS general information |
| `indian_standards.json` | Indian Standards |
| `certification.json` | Certification |
| `testing.json` | Testing |
| `laboratories.json` | BIS-recognized laboratories |
| `hallmarking.json` | Hallmarking / HUID |
| `consumer_information.json` | Consumer information |
| `faqs.json` | FAQs |

## Item schema

Defined and enforced in `backend/app/knowledge/schema.py`.

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Stable slug, lowercase, hyphen-separated, e.g. `is-15757-scope`. Unique across all files. |
| `title` | yes | 3–200 chars. |
| `category` | yes | One of the eight above. Must match the file. |
| `content` | yes | ≥ 20 chars. Plain prose quoted or paraphrased from the source. |
| `keywords` | no | List of lowercase tags. Helps later keyword retrieval. |
| `standard_number` | conditional | Required for `indian_standards`. e.g. `IS 15757:2007`. |
| `source_organization` | yes | Defaults to `Bureau of Indian Standards (BIS)`. |
| `source_url` | conditional | Official URL. Required unless `verification_status` is `sample`. Must be `http(s)://…`. |
| `document_name` | no | Source document name, if applicable. |
| `reference` | no | Section / clause / page within the source. |
| `verification_status` | yes | `verified` \| `unverified` \| `sample`. Defaults to `unverified`. |
| `last_verified` | conditional | ISO date `YYYY-MM-DD`. Required when `verified`. Cannot be in the future. |

### verification_status meanings

- **`verified`** — a human checked this against the official BIS source. Needs
  `source_url` and `last_verified`.
- **`unverified`** — taken from official BIS material but not yet double-checked.
  Still needs `source_url`.
- **`sample`** — development/demo placeholder. **NOT official BIS data.** The two
  sample records currently in `indian_standards.json` and `faqs.json` exist only
  to exercise the loader and must be replaced with real verified content.

## Rules

- Do not invent BIS content: no made-up standard numbers, clauses, fees, schemes,
  test requirements, or lab capabilities.
- Every non-sample item must be traceable to an official source (`source_url`).
- If information is uncertain, mark it `unverified` — do not guess.

## Validate before use

```bash
cd backend
./.venv/bin/python scripts/check_knowledge.py
```

Reports valid item counts per category and lists every problem (bad JSON, schema
violations, duplicate IDs, category/file mismatches) with its exact location. Exit
code is non-zero when anything is wrong.

## Migrating to PostgreSQL later

The schema is deliberately flat: one item = one table row. A future table would be

```
knowledge_item(
  id text primary key,
  title text not null,
  category text not null,
  content text not null,
  keywords text[] not null default '{}',
  standard_number text,
  source_organization text not null,
  source_url text,
  document_name text,
  reference text,
  verification_status text not null,
  last_verified date
)
```

The loader can be pointed at a database instead of files without changing the
schema or the validation rules.
