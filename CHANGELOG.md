# Changelog

## 1.0.0 - 2026-10-23

- Join on contact ID between a dispositions export and a CRM activity export, with orphan records listed in both directions.
- Configurable mismatch rules: long interactions (default over 5 minutes) with no CRM note, enrolled dispositions with no enrollment record, and promised callbacks with no callback task.
- DNC safety rule: a dnc or do not call disposition while the contact is still in an active cadence is shown as a STOP signal, remove from cadence, and is never presented as overridable.
- Agent rollup counts plus an exportable exception list CSV with an evidence row for every exception, ready for coaching and QA review.
