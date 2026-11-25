# Worker knowledge datasets

Version reviewed, redistributable normalized JSONL with the Worker. Keep original PDFs,
private records, credentials, vectors, and database dumps out of Git. Each dataset lives
in its source directory and keeps stable original record IDs. Ingest into a dedicated
versioned collection; do not mix embedding models or text/pre-chunked ingestion modes.
Adding a source does not automatically connect it to chat, schedules, or reports.

## CDC Korean editorial dataset

`cdc/cdc_milestones_ko.jsonl` is the user-supplied Korean editorial translation based
on the 24-page English CDC Milestone Checklists PDF. It is **not official CDC Korean
material** and **has not been clinically reviewed**. These are dataset provenance
statements, not an independent verification of its translation, PDF hash, or clinical
accuracy. The original PDF is not included or fetched by ingestion.

- Source: https://www.cdc.gov/ActEarly
- Source file: `cdc-milestone-checklists-ltsae-english-508.pdf`
- Declared source SHA-256: `40b10b8a0fc05ca2ccf6d3a830bc7ed3b8c5f005c6fbf59d67af864016f7ed9a`
- 92 records: 48 milestone, 36 parenting guidance, 4 screening, 4 reference guidance.
- Checklist ages: 2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60 months.
- The supplied content contains 159 milestone items and 145 parenting guidance items.
- Source pages, language/locale, translation and review status remain attached to each record.

CDC milestones describe behaviors at least 75% of children can do by the checklist
age. They are not a diagnosis or a replacement for validated developmental screening.
For unmet milestones, lost skills, or caregiver concerns, consult a healthcare
professional. US screening schedules and support programs must be identified as US
information; they must not be described as Korean programs or contact information.

Review source attribution, translation, and suitability before deployment. Record any
future review changes in metadata; do not silently relabel this as an official or
clinically reviewed translation. Ingestion preserves the provided content verbatim.
See [ingestion and retrieval](../docs/knowledge.md).

Dataset file SHA-256 (distinct from the declared original PDF hash):
`dbd1aafffa05ca72e76cd5cad87cc02f781b441a21c9d959cd1a5f23bb403c86`.
The loader does not require this particular snapshot hash: intended edits are versioned
in Git and ingestion compares each content hash. Update this catalog entry when the
curated dataset file changes.
