"use strict";

function parseCSV(text) {
  const rows = []; let row = [], field = "", inQ = false;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) { if (c === '"') { if (s[i+1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const clean = rows.filter(r => r.some(v => String(v).trim() !== ""));
  if (!clean.length) return [];
  const rawHeaders = clean[0].map(h => String(h).trim());
  const { mapping } = mapHeaders(rawHeaders);
  const headers = rawHeaders.map((h, idx) => {
    for (const [field, raw] of Object.entries(mapping)) if (rawHeaders.indexOf(raw) === idx) return field;
    return h.toLowerCase().replace(/\s+/g, "_");
  });
  return clean.slice(1).map(r => { const o = {}; headers.forEach((h, idx) => { o[h] = r[idx] === undefined ? "" : String(r[idx]).trim(); }); return o; });
}
function csvEscape(v) { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

// Salesforce export headers map onto the generic audit columns.
const HEADER_ALIASES = {
  contact_id: ["contact_id", "contactid", "contact id", "id", "contact"],
  agent: ["agent", "assigned_to", "assigned to", "owner", "owner_name", "owner name", "user", "user_name"],
  disposition: ["disposition", "call_disposition", "call disposition", "status", "call_status", "call status"],
  timestamp: ["timestamp", "date", "call_date", "call date", "activity_date", "activity date", "createddate", "created date"],
  duration_min: ["duration_min", "duration min", "duration", "call_duration", "call duration", "duration_minutes"],
  note_present: ["note_present", "note present", "has_note", "has note", "notes_present", "notes present", "note"],
  enrollment_record: ["enrollment_record", "enrollment record", "enrolled", "enrollment_created"],
  callback_task_date: ["callback_task_date", "callback task date", "callback_date", "callback date", "task_date", "task date"],
  in_active_cadence: ["in_active_cadence", "in active cadence", "active_cadence", "active cadence", "cadence"]
};

function mapHeaders(rawHeaders) {
  const mapping = {}; const unrecognized = [];
  const used = new Set();
  (rawHeaders || []).forEach((h) => {
    const key = String(h).trim().toLowerCase().replace(/\s+/g, "_");
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (used.has(field)) continue;
      if (aliases.indexOf(key) !== -1 || aliases.indexOf(String(h).trim().toLowerCase()) !== -1) {
        mapping[field] = h; used.add(field); return;
      }
    }
    unrecognized.push(h);
  });
  return { mapping, unrecognized };
}

function toCSV(headers, rows) { return [headers.join(",")].concat(rows.map(r => headers.map(h => csvEscape(r[h])).join(","))).join("\n") + "\n"; }
function num(v) { if (v === "" || v === null || v === undefined) return null; const n = Number(String(v).replace(/[$,]/g, "")); return isFinite(n) ? n : null; }
function round2(n) { return Math.round(n * 100) / 100; }
function parseDate(v) { if (!v) return null; const d = new Date(String(v).trim() + "T00:00:00Z"); return isNaN(d.getTime()) ? null : d; }
function fmtDate(d) { return d ? d.toISOString().slice(0, 10) : ""; }
function daysBetween(a, b) { const da = parseDate(a), db = parseDate(b); if (!da || !db) return null; return Math.round((db.getTime() - da.getTime()) / 86400000); }

function yes(v) { return String(v || "").trim().toLowerCase() === "yes"; }
function norm(v) { return String(v || "").trim().toLowerCase(); }
function audit(dispositions, crmRows, config) {
  const cfg = config || {};
  const longThreshold = cfg.longCallThreshold !== undefined ? Number(cfg.longCallThreshold) : 5;
  const callbackTerms = (cfg.callbackTerms && cfg.callbackTerms.length ? cfg.callbackTerms : ["callback"]).map(t => String(t).toLowerCase());
  const crmById = {}; (crmRows || []).forEach(r => { crmById[r.contact_id] = r; });
  const dispIds = {}; const exceptions = [];
  (dispositions || []).forEach(d => {
    dispIds[d.contact_id] = true;
    const crm = crmById[d.contact_id];
    const disp = norm(d.disposition);
    if (!crm) { exceptions.push({ contactId: d.contact_id, agent: d.agent || "", type: "orphan_disposition", severity: "medium", action: "Create or link the CRM record for this contact.", evidence: "Disposition '" + d.disposition + "' by " + (d.agent || "") + " at " + (d.timestamp || "") + " has no matching CRM record." }); return; }
    const duration = num(d.duration_min) || 0;
    if (duration > longThreshold && !yes(crm.note_present)) exceptions.push({ contactId: d.contact_id, agent: d.agent || "", type: "long_call_no_note", severity: "high", action: "Add a CRM note covering this interaction.", evidence: "Duration " + duration + " min exceeds " + longThreshold + " min threshold and note_present is not yes." });
    if (disp === "enrolled" && !yes(crm.enrollment_record)) exceptions.push({ contactId: d.contact_id, agent: d.agent || "", type: "enrolled_no_enrollment_record", severity: "high", action: "Create the enrollment record or correct the disposition.", evidence: "Disposition is enrolled but enrollment_record is not yes." });
    if (callbackTerms.some(t => disp.includes(t)) && !crm.callback_task_date) exceptions.push({ contactId: d.contact_id, agent: d.agent || "", type: "callback_no_task", severity: "high", action: "Schedule the promised callback task.", evidence: "Disposition '" + d.disposition + "' indicates a promised callback but callback_task_date is blank." });
    if ((disp === "dnc" || disp === "do not call") && yes(crm.in_active_cadence)) exceptions.push({ contactId: d.contact_id, agent: d.agent || "", type: "dnc_in_active_cadence", severity: "STOP", action: "Remove from cadence immediately. This is a stop signal and must not be overridden.", evidence: "Disposition is '" + d.disposition + "' while in_active_cadence is yes." });
  });
  (crmRows || []).forEach(r => { if (!dispIds[r.contact_id]) exceptions.push({ contactId: r.contact_id, agent: "", type: "orphan_crm_record", severity: "medium", action: "Link this CRM record to a disposition or close it out.", evidence: "CRM activity for contact " + r.contact_id + " has no matching disposition." }); });
  const rollup = {};
  (dispositions || []).forEach(d => { const a = d.agent || "Unknown"; rollup[a] = rollup[a] || { agent: a, total: 0, exceptions: 0 }; rollup[a].total++; });
  exceptions.forEach(e => { if (e.agent && rollup[e.agent]) rollup[e.agent].exceptions++; });
  return { exceptions, rollup: Object.values(rollup), summary: { dispositions: (dispositions||[]).length, crmRecords: (crmRows||[]).length, exceptions: exceptions.length, stopSignals: exceptions.filter(e => e.severity === "STOP").length } };
}
function toExceptionCSV(exceptions) { return toCSV(["contact_id","agent","type","severity","action","evidence"], (exceptions||[]).map(e => ({ contact_id: e.contactId, agent: e.agent, type: e.type, severity: e.severity, action: e.action, evidence: e.evidence }))); }
const api = { parseCSV, audit, toExceptionCSV, mapHeaders, HEADER_ALIASES };
if (typeof module !== "undefined" && module.exports) { module.exports = api; }
if (typeof window !== "undefined") { window.DispositionCrmAuditor = api; }
