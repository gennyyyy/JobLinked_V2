// The one place matching terminology lives. Deterministic skills-based ranking
// is the product; an AI provider is an optional assist that only re-ranks the
// top results when one is configured. Components import these strings instead
// of restating them, so the product is never called "AI" anywhere.
export const MATCHING_NAME = 'Skills-based matching'
export const MODE_AI = 'AI-assisted ranking active'
export const MODE_STANDARD = 'Skills-based ranking'
export const MATCH_UNAVAILABLE = 'AI assistance is unavailable — showing skills-based ranking.'
export const MATCHING_NOTICE = 'Ranked by exact skill matches, barangay, preferred position, and recency. When available, AI re-ranks the top results and writes the reasons. It is not a hiring score or a guarantee.'
export const DIALOG_AI_NOTICE = 'Your request may be processed by an AI provider to re-rank vacancies. Never include personal details; your name and resume are never sent.'

// `mode` is the server's last ranking verdict: null until a request settles,
// then 'ai' when the model ranked or 'deterministic' on the fallback path.
export const matchModeLabel = (mode) => (mode === 'ai' ? MODE_AI : MODE_STANDARD)
