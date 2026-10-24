# Disposition CRM Auditor
Live page: https://aamirtechs.github.io/disposition-crm-auditor/

Cross-checks contact dispositions against CRM records and catches the mismatches that lose callbacks and create compliance gaps: missing notes, enrollments that were never recorded, promised callbacks that were never scheduled, and do-not-call contacts still sitting in an active cadence.

## Features
- Join on contact ID between a dispositions export and a CRM activity export, with orphan records listed in both directions.
- Configurable mismatch rules: long interactions (default over 5 minutes) with no CRM note, enrolled dispositions with no enrollment record, and promised callbacks with no callback task.
- DNC safety rule: a dnc or do not call disposition while the contact is still in an active cadence is shown as a STOP signal, remove from cadence, and is never presented as overridable.
- Agent rollup counts plus an exportable exception list CSV with an evidence row for every exception, ready for coaching and QA review.

## How it works
Paste or upload both CSV exports, set the long-call threshold and the callback wording list, and run the audit. Exceptions appear with evidence rows and agent rollups, and the full exception list downloads as a CSV. Synthetic data only. It runs entirely in the browser.

## Privacy
Runs 100% in your browser. Your files never leave this device, nothing is uploaded,
and there is no tracking.

## Development
Core logic lives in `src/logic.js` and is shared by the page and the tests.
Run the tests with `npm test`.

## License
MIT, Copyright 2026 Amir Hussain.
