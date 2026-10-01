// Shea Business Solutions — first-party lead RECORDER (Bloomview, 2026-08-06).
//
// WHY THIS EXISTS
// Every form on this site posts to api.web3forms.com, a third party. That works — Ryan gets the
// email — but it leaves no record we can count, so "how many form leads came in last week" had no
// answer and the account read RED on the daily table for forms that are actually working.
//
// WHAT THIS IS NOT
// This is NOT a delivery path. web3forms remains the one and only way a lead reaches Ryan, and
// its call is byte-unchanged in every page. The browser beacons here on a separate, unawaited
// navigator.sendBeacon() that the real submission never waits on, so if this endpoint is slow,
// broken, or deleted outright, the customer's enquiry is completely unaffected. A tracking gap is
// cheaper than a lost customer, and this file is built to fail that way.
//
// WHY IT FORWARDS INSTEAD OF WRITING
// A Vercel function has no durable filesystem — /tmp is per-invocation — and this project's
// Vercel storage is not ours to provision. So the record is forwarded to the Hostinger box that
// already holds every other client's lead log, where it lands as one JSONL line per lead in a
// file outside any web root. leads_report.py reads it with the same `ssh … cat <path>` call it
// uses for AN Irrigation, SSKM and Diakite.
//
// ONE LINE PER LEAD. Single write. No pending/final pair.

const COLLECTOR = 'https://bloomviewgrowth.com/collect/shea-lead.php';
const FORWARD_TIMEOUT_MS = 4000;

async function readRaw(req) {
  // Vercel's body parser may hand back a string, an object, a Buffer, or nothing at all
  // depending on the Content-Type. The beacon sends text/plain (the only type sendBeacon is
  // guaranteed never to reject), so handle every shape rather than betting on one.
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Collapse control characters to a space so a stray newline in a name cannot split one lead
// across two JSONL lines downstream, then cap the length.
const str = (v, max) =>
  String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);

// First-touch attribution from /assets/bv-attr.js. Same rules as the phone-click collector:
// channel /^[a-z_]{2,20}$/, landing = a same-site path (starts with '/', not '//', no '..', <=200),
// evidence <=80. All three are returned ONLY when the channel is valid; otherwise nothing, so a
// missing field reads as "source not recorded", never a guess.
function bvAttr(p) {
  const ch = str(p.bv_channel, 20);
  if (!/^[a-z_]{2,20}$/.test(ch)) return {};
  let land = str(p.bv_landing, 200);
  if (land && (land[0] !== '/' || land.startsWith('//') || land.includes('..'))) land = '';
  return { bv_channel: ch, bv_landing: land, bv_evidence: str(p.bv_evidence, 80) };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end();
    return;
  }

  let payload = null;
  try {
    const raw = await readRaw(req);
    if (raw && raw.length <= 20000) payload = JSON.parse(raw);
  } catch (e) {
    payload = null;
  }
  if (!payload || typeof payload !== 'object') {
    res.status(400).end();
    return;
  }

  const fwd = req.headers['x-forwarded-for'];
  const record = {
    name: str(payload.name, 100),
    phone: str(payload.phone, 40),
    email: str(payload.email, 254),
    message: String(payload.message == null ? '' : payload.message).slice(0, 4000),
    subject: str(payload.subject, 200),
    form: str(payload.form, 60),
    page: str(payload.page, 300),
    // First-touch attribution: the landing page, referrer and utm/oppref of the session's
    // FIRST page view. Without it a lead that landed on an ad and submitted elsewhere reads as
    // organic, which is exactly what made the ChatGPT ads unmeasurable. Added 2026-08-25.
    ft: str(payload.ft, 500),
    // bv-attr.js first touch (Bloomview kit v1, 2026-10-01): window.bvAttr() fields captured at
    // submit. Validated here; forwarded only when the channel is valid (collector re-validates).
    ...bvAttr(payload),
    ip: str(Array.isArray(fwd) ? fwd[0] : (fwd || '').split(',')[0], 60),
  };

  if (!record.name && !record.phone && !record.email) {
    res.status(422).end();
    return;
  }

  // Awaited on purpose: a serverless function is frozen the moment it responds, so a
  // fire-and-forget forward here would be killed mid-flight and the lead would never be written.
  // The browser is not waiting on any of this — it already moved on when sendBeacon returned.
  try {
    await fetch(COLLECTOR, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
  } catch (e) {
    // Swallowed deliberately. Losing the count is acceptable; surfacing an error to a page that
    // has already told the customer "message received" is not.
    console.error('lead-log forward failed:', e && e.message);
  }

  res.status(204).end();
};
