// Deterministic lexical fee filter for job posts (ADR-047). Server-side
// authority; the client hint in JobPostFormDialog is cosmetic only.
export const FEE_BLOCK_TERMS = [
  'registration fee', 'processing fee', 'processing payment', 'placement fee', 'recruitment fee',
];
export const FEE_HOLD_TERMS = [
  'fee', 'fees', 'payment', 'payments', 'deposit', 'donation', 'donations',
  'bayad', 'magsingil', 'singil', 'pabayad', 'magbayad', 'reg fee', 'application fee', 'training fee',
];

function normalize(text) {
  // Multi-space gaps are word boundaries even for letter-spaced runs, so
  // "r e g ... n   f e e" re-joins into "registration fee", not one token.
  const s = String(text ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s{2,}/g, '\n');
  const segResults = [];
  for (const seg of s.split('\n')) {
    const tokens = seg.split(/\s+/).filter(Boolean);
    const out = [];
    let run = [];
    const flush = () => {
      if (run.length >= 3) out.push(run.join(''));
      else out.push(...run);
      run = [];
    };
    for (const tok of tokens) {
      if (/^[a-z]$/.test(tok)) run.push(tok);
      else { flush(); out.push(tok); }
    }
    flush();
    segResults.push(out.join(' '));
  }
  return segResults.join(' ').replace(/\s+/g, ' ').trim();
}

export function scanJobText(text) {
  const norm = normalize(text);
  const padded = ` ${norm} `;
  const block = FEE_BLOCK_TERMS.filter((t) => padded.includes(` ${t} `));
  const hold = FEE_HOLD_TERMS.filter((t) => padded.includes(` ${t} `));
  const severity = block.length ? 'blocked' : hold.length ? 'held' : 'none';
  const matchedTerms = [
    ...FEE_BLOCK_TERMS.filter((t) => block.includes(t)),
    ...FEE_HOLD_TERMS.filter((t) => hold.includes(t)),
  ];
  return { severity, matchedTerms, sourceFields: [] };
}

export function extractScannableText(job) {
  const parts = [job?.title, job?.description, job?.requirements, job?.benefits, job?.instructions];
  const tags = job?.tags;
  if (Array.isArray(tags)) parts.push(tags.join(' '));
  else if (tags != null) parts.push(tags);
  return parts.filter((v) => v != null).map(String).join(' ');
}

export function scanJob(job) {
  const fields = {
    title: job?.title,
    description: job?.description,
    requirements: job?.requirements,
    benefits: job?.benefits,
    instructions: job?.instructions,
    tags: Array.isArray(job?.tags) ? job.tags.join(' ') : job?.tags,
  };
  const blockSet = new Set();
  const holdSet = new Set();
  const sourceFields = [];
  for (const [field, value] of Object.entries(fields)) {
    if (value == null) continue;
    const padded = ` ${normalize(value)} `;
    const fb = FEE_BLOCK_TERMS.filter((t) => padded.includes(` ${t} `));
    const fh = FEE_HOLD_TERMS.filter((t) => padded.includes(` ${t} `));
    if (fb.length || fh.length) sourceFields.push(field);
    fb.forEach((t) => blockSet.add(t));
    fh.forEach((t) => holdSet.add(t));
  }
  const matchedTerms = [
    ...FEE_BLOCK_TERMS.filter((t) => blockSet.has(t)),
    ...FEE_HOLD_TERMS.filter((t) => holdSet.has(t)),
  ];
  const severity = blockSet.size ? 'blocked' : holdSet.size ? 'held' : 'none';
  return { severity, matchedTerms, sourceFields };
}