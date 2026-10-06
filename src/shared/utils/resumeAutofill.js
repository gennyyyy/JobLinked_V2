// Pure regex resume text -> registration field mapper. High-confidence only:
// labeled lines or unambiguous patterns match, everything else stays blank
// for the user to fill in.
// ponytail: labeled-line/first-lines heuristics + curated skills gazetteer;
// per-field confidence scores or NLP if autofill hit-rate ever matters.
const FIELDS = [
  "firstName",
  "middleName",
  "lastName",
  "email",
  "mobileNumber",
  "birthdate",
  "houseNumberUnit",
  "streetAddress",
  "subdivisionBuilding",
  "barangayDistrict",
  "cityMunicipality",
  "provinceState",
  "postalCode",
  "skills",
];

const MONTHS = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04", jun: "06",
  jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
};

function blank() {
  const out = Object.fromEntries(FIELDS.map((f) => [f, ""]));
  out.skills = [];
  out.education = { level: "", school: "", field: "", year: "" };
  return out;
}

function labeled(text, label) {
  const m = text.match(new RegExp(`^\\s*(?:${label})\\s*[:\\-]\\s*(.+)$`, "im"));
  return m ? m[m.length - 1].trim() : "";
}

// Designed PDFs letter-space headings ("P R O G R A M M I N G", "H I , I A M").
// Collapse runs of single-character tokens back into words so headers match.
function despace(s) {
  return String(s || "")
    .split(/(\s{2,})/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      const toks = part.trim().split(/\s+/);
      if (toks.length > 1 && toks.every((t) => /^[A-Za-z0-9.,&'#+-]$/.test(t))) return toks.join("");
      return part;
    })
    .join("");
}

const NAME_WORD = /^[A-Za-z][A-Za-z.'-]*$/;
const NAME_SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;
const NAME_HEADERS = /^(resume|curriculum vitae|profile)$/i;
const SURNAME_PARTICLE = new Set([
  "de", "la", "los", "las", "del", "dela", "san", "santa", "santo", "van", "von", "dos",
]);

const FIRST_DOUBLE = new Set([
  "mary", "ana", "maria", "john", "jean", "juan", "jose", "luis", "antonio", "rosa",
]);
// ponytail: lead-only join eats Santos-type middles (Juan Santos Cruz), so the 2nd token must be a known double-first half too.
const SECOND_DOUBLE = new Set([...FIRST_DOUBLE, "ann", "marie", "paul", "carlos", "rizal"]);

function splitName(raw) {
  if (!raw || !raw.trim()) return null;
  const comma = raw.trim().match(/^([^,]+),\s*(.+)$/);
  let parts = comma
    ? [...comma[2].split(/\s+/), ...comma[1].split(/\s+/)]
    : raw.trim().split(/\s+/);
  parts = parts.map((p) => p.replace(/,+$/, "")).filter(Boolean);
  parts = parts.filter((p) => !NAME_SUFFIX.test(p));
  if (parts.length < 2 || parts.length > 6) return null;
  if (!parts.every((p) => NAME_WORD.test(p) && p[0] === p[0].toUpperCase())) return null;
  const low = parts.map((p) => p.toLowerCase());
  const n = parts.length;
  let lastSize = 1;
  if (n >= 3 && (low[n - 3] === "de" || low[n - 3] === "del")) lastSize = 3;
  else if (n >= 2 && SURNAME_PARTICLE.has(low[n - 2])) lastSize = 2;
  let firstSize = 1;
  if (n >= 3 && FIRST_DOUBLE.has(low[0]) && SECOND_DOUBLE.has(low[1])) firstSize = 2;
  if (n > 4 && lastSize === 1) return null;
  if (n > 5 && !(firstSize === 2 && lastSize > 1)) return null;
  return {
    firstName: parts.slice(0, firstSize).join(" "),
    middleName: parts.slice(firstSize, n - lastSize).join(" "),
    lastName: parts.slice(n - lastSize).join(" "),
  };
}

function mapName(text, lines) {
  const fromLabel = splitName(labeled(text, "name") || labeled(text, "full\\s*name"));
  if (fromLabel) return fromLabel;
  for (const line of lines.slice(0, 5)) {
    if (/[@\d]/.test(line)) continue;
    if (/https?:|www\.|\.com\b/i.test(line)) continue;
    if (NAME_HEADERS.test(line)) continue;
    const parsed = splitName(line);
    if (parsed) return parsed;
  }
  return null;
}

function roundTrips(y, mm, dd) {
  const d = new Date(Date.UTC(+y, +mm - 1, +dd));
  return d.getUTCFullYear() === +y && d.getUTCMonth() === +mm - 1 && d.getUTCDate() === +dd;
}

function extractBirthdate(s) {
  let m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return roundTrips(m[1], m[2], m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : "";
  m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) {
    const mm = m[2].padStart(2, "0");
    const dd = m[1].padStart(2, "0");
    if (+mm >= 1 && +mm <= 12 && roundTrips(m[3], mm, dd)) return `${m[3]}-${mm}-${dd}`;
    return "";
  }
  m = s.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i,
  );
  if (m) {
    const dd = m[2].padStart(2, "0");
    const mm = MONTHS[m[1].toLowerCase()];
    if (roundTrips(m[3], mm, dd)) return `${m[3]}-${mm}-${dd}`;
    return "";
  }
  return "";
}

function mapBirthdate(text) {
  // Labeled lines win over position — a resume often carries two dates
  // (contract end, graduation) around the real birthdate.
  for (const line of String(text).split(/\r?\n/)) {
    if (/birth|dob|\bborn\b/i.test(line)) {
      const hit = extractBirthdate(line);
      if (hit) return hit;
    }
  }
  return extractBirthdate(text);
}

const PHONE_RE = /(\+63[\s-]?\d{10}|09\d{2}[\s-]?\d{3}[\s-]?\d{4})/;
const STREET_KEY = /\b(st\.?|street|road|ave\.?|avenue|blvd\.?|boulevard|lot|blk\.?|block|subdivision|village)\b/i;
const BARANGAY_RE = /^\s*(brgy\.?|barangay|purok|sitio)\s*\.?\s*(.*)$/i;
const HOUSE_SEG = /^(unit|apt\.?|apartment|house(\s*(no\.?|number))?|bldg\.?|building(\s*(no\.?|number))?|blk\.?|lot)\b/i;
const STREET_WORD = /\b(st\.?|street|road|ave\.?|avenue|blvd\.?|boulevard)\b/i;
const SUBDIV_SEG = /\b(subdivision|subd\.?|village)\b/i;
const ZIP_TAIL = /\b\d{4}\s*$/;

function mapAddress(text, lines, out) {
  const street = labeled(text, "((?:home|present|permanent|current|provincial|mailing|residential|residence)?\\s*(?:street\\s*)?address|lot\\s*/\\s*block\\s*address)");
  if (street) out.streetAddress = street;
  const house =
    labeled(text, "(house\\s*/\\s*building\\s*/\\s*unit(\\s*(number|no\\.?))?|house(\\s*(number|no\\.?))?|unit(\\s*(number|no\\.?))?|building(\\s*(number|no\\.?))?|apartment|apt\\.?)");
  if (house) out.houseNumberUnit = house;
  const subdiv =
    labeled(text, "(subdivision(\\s*/\\s*village(\\s*/\\s*building(\\s*name)?)?)?|village|building(\\s*name)?)");
  if (subdiv) out.subdivisionBuilding = subdiv;
  const barangay =
    labeled(text, "(barangay(\\s*/\\s*district)?|district|brgy\\.?)");
  if (barangay) out.barangayDistrict = barangay.replace(/^(brgy\.?|barangay|purok|sitio)\s*\.?\s*/i, "").trim() || barangay;
  const city = labeled(text, "(city\\s*/\\s*municipality|city|municipality|town)");
  if (city) out.cityMunicipality = city.replace(/\s+\d{4}$/, "").trim();
  const province =
    labeled(text, "(province\\s*/\\s*state|province|state)") ||
    labeled(text, "(provincia|lalawigan)");
  if (province) out.provinceState = province.replace(/\s+\d{4}$/, "").trim();
  const postal = labeled(text, "(postal(\\s*/\\s*zip)?(\\s*code)?|zip(\\s*code)?)");
  if (/^\d{4}$/.test(postal.trim())) out.postalCode = postal.trim();
  if (out.streetAddress && out.houseNumberUnit && out.subdivisionBuilding && out.barangayDistrict && out.cityMunicipality && out.provinceState && out.postalCode) return;
  parseAddressBlock(lines, out);
}

// Addresses wrap across lines ("... abarca" / "street, Pulong" / "Buhangin,
// Sta Maria, 3017,") and often carry no labels. Gather the contiguous block,
// stitch wrapped lines back together, then peel province/city/barangay off the
// right and classify what is left. Only fills fields the labels above missed.
const COUNTRY_RE = /^(philippines|ph|phils?\.?)$/i;
const SECTION_STOP = /^(education|educational|experience|work|employment|references?|objective|profile|personal|programming|skills?|competen|projects?|certificat|awards?|interests?|languages?|summary)\b/i;

function hasDate(l) {
  return extractBirthdate(l) !== "";
}

function startsAddress(l) {
  if (/@/.test(l) || /https?:|www\./i.test(l) || PHONE_RE.test(l) || hasDate(l)) return false;
  if (SECTION_STOP.test(despace(l))) return false;
  return STREET_KEY.test(l) || BARANGAY_RE.test(l) || HOUSE_SEG.test(l) || SUBDIV_SEG.test(l) || (l.includes(",") && /\d/.test(l));
}

function continuesAddress(l) {
  if (/@/.test(l) || /https?:|www\./i.test(l) || PHONE_RE.test(l)) return false;
  if (SECTION_STOP.test(despace(l))) return false;
  return l.includes(",") || STREET_KEY.test(l) || BARANGAY_RE.test(l) || HOUSE_SEG.test(l) || SUBDIV_SEG.test(l) || ZIP_TAIL.test(l);
}

function isBarangayLike(s) {
  return !/\d/.test(s) && !/@/.test(s) && s.split(/\s+/).length <= 3 &&
    !STREET_WORD.test(s) && !HOUSE_SEG.test(s) && !SUBDIV_SEG.test(s);
}

function parseAddressBlock(lines, out) {
  const start = lines.findIndex(startsAddress);
  if (start < 0) return;
  const block = [lines[start]];
  for (let i = start + 1; i < lines.length && block.length < 8; i++) {
    if (!continuesAddress(lines[i])) break;
    block.push(lines[i]);
  }
  // Stitch lines: a plain line-join would split wrapped words ("abarca" +
  // "street"), so only merge into the previous segment when the previous line
  // did NOT end on a comma and its last segment isn't already a full field.
  const segs = block
    .map((l) => l.replace(/^\s*[A-Za-z][A-Za-z /.]*\s*:\s*/, "").trim())
    .reduce((acc, l) => {
      const parts = l.split(",").map((p) => p.trim()).filter(Boolean);
      const last = acc[acc.length - 1];
      if (acc.length && !acc.endsComma && parts.length && !BARANGAY_RE.test(last) && !/\d{4}/.test(last)) {
        acc[acc.length - 1] = `${last} ${parts.shift()}`;
      }
      acc.push(...parts);
      acc.endsComma = /,\s*$/.test(l);
      return acc;
    }, []);
  const zip = segs.join(", ").match(/\b(\d{4})\b/);
  if (zip && !out.postalCode) out.postalCode = zip[1];
  const rest = segs
    .filter((s) => !COUNTRY_RE.test(s))
    .map((s) => (zip ? s.replace(zip[1], "").replace(/[\s,]+$/, "").trim() : s))
    .filter(Boolean);

  if (rest.length >= 2 && !/\d/.test(rest[rest.length - 1]) && !out.provinceState) {
    out.provinceState = rest.pop();
    if (rest.length && !/\d/.test(rest[rest.length - 1]) && !out.cityMunicipality) {
      out.cityMunicipality = rest.pop();
    }
  }
  if (!out.barangayDistrict && rest.length >= 2) {
    const cand = rest[rest.length - 1];
    const b = cand.match(BARANGAY_RE);
    if (b && b[2].trim()) { out.barangayDistrict = b[2].trim(); rest.pop(); }
    else if (isBarangayLike(cand)) { out.barangayDistrict = cand; rest.pop(); }
  }
  for (const seg of rest) {
    const b = seg.match(BARANGAY_RE);
    if (b && b[2].trim() && !out.barangayDistrict) { out.barangayDistrict = b[2].trim(); continue; }
    if (HOUSE_SEG.test(seg) && /\d/.test(seg) && !STREET_WORD.test(seg) && !out.houseNumberUnit && !SUBDIV_SEG.test(seg)) { out.houseNumberUnit = seg; continue; }
    if (SUBDIV_SEG.test(seg) && !out.subdivisionBuilding) { out.subdivisionBuilding = seg; continue; }
    if (!out.streetAddress) { out.streetAddress = seg; continue; }
    // A plain name sitting after the street (and left of the barangay) is the
    // subdivision/village/building even without the keyword — "…street, cityland".
    if (!out.subdivisionBuilding && !/\d/.test(seg) && !STREET_WORD.test(seg) && seg.split(/\s+/).length <= 3) {
      out.subdivisionBuilding = seg;
      continue;
    }
    if (!out.streetAddress.includes(seg)) out.streetAddress += `, ${seg}`;
  }
}

const SKILL_TERMS = [
  "communication", "customer service", "data entry", "encoding", "typing", "filing",
  "computer", "computer literate", "microsoft office", "microsoft word", "microsoft excel",
  "excel", "microsoft powerpoint", "powerpoint", "google sheets", "google workspace",
  "bookkeeping", "accounting", "cashiering", "inventory", "sales", "marketing",
  "leadership", "teamwork", "time management", "problem solving",
  "driving", "driving NC II", "delivery", "warehouse", "security",
  "cooking", "cookery NC II", "cookery", "baking", "food handling", "bartending",
  "caregiving", "caregiving NC II", "child care", "elderly care", "first aid", "nursing aide",
  "housekeeping", "housekeeping NC II", "cleaning", "laundry",
  "sewing", "hairdressing", "hairdressing NC II", "barbering", "massage therapy",
  "welding", "welding SMAW", "SMAW", "welding NC II", "NC II",
  "carpentry", "plumbing", "electrical", "painting", "gardening",
  "graphic design", "photography", "programming", "web development", "social media",
  "javascript", "react", "photoshop", "canva", "sap",
  "python", "java", "php", "typescript", "node", "html", "css", "sql", "mysql", "mongodb",
  "tailwind", "c#", "c++", "git", "github", "docker", "figma", "linux", "wordpress", "api",
  "teaching", "tutoring", "english proficiency",
];
const SKILLS_HEADER = /^\s*(?:(?:technical|key|core|soft|hard|additional|special|relevant|other|professional|computer|programming)\s+)*(?:skills?|skill\s*set|competencies|competency|expertise|qualifications|proficienc(?:y|ies)|abilit(?:y|ies)|strengths|tools?|tech\s+stack|technologies|frameworks?|languages?)\b/i;
const SECTION_END = /^(experience|employment|work|education|references|objective|profile|contact|personal)\b/i;

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapSkills(text, lines) {
  const found = [];
  const seen = new Set();
  function push(raw, maxWords = 5) {
    const t = String(raw || "")
      .replace(/^\d+[.)]\s*/, "")
      .replace(/^[^A-Za-z0-9+#]+|[^A-Za-z0-9+#]+$/g, "")
      .replace(/^([&/]|and)\b\s*/i, "")
      .replace(/^(proficient|skilled|experienced|familiar)\s+(in|with|at)\s+|^knowledge\s+of\s+/i, "")
      .trim();
    if (!t || !/[A-Za-z]/.test(t) || t.length > 40 || t.split(/\s+/).length > maxWords) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push(t);
  }
  const splitSection = (line) =>
    String(line || "")
      .split(/[•·▪●⋅;,|/]/)
      .flatMap((p) => p.split(/\s*(?:\band\b|&)\s*/i));
  const idx = lines.findIndex((l) => SKILLS_HEADER.test(despace(l)));
  if (idx >= 0) {
    const same = despace(lines[idx]).replace(SKILLS_HEADER, "").replace(/^[\s:;\-—–|/]+/, "");
    if (same.trim()) splitSection(same).filter((f) => !SKILLS_HEADER.test(f.trim())).forEach((f) => push(f, 8));
    for (let i = idx + 1; i < lines.length && i < idx + 30; i++) {
      const l = lines[i];
      if (SECTION_END.test(despace(l))) break;
      splitSection(l).forEach((f) => push(f, 8));
    }
  }
  // URLs/emails mention stack words (github, api) that aren't skills — scrub them.
  const scrubbed = text.replace(/https?:\/\/\S+|www\.\S+|\S+@\S+/gi, " ");
  for (const term of SKILL_TERMS) {
    const tail = /[A-Za-z0-9]$/.test(term) ? "\\b" : "(?![A-Za-z0-9])";
    const m = scrubbed.match(new RegExp(`\\b${esc(term)}${tail}`, "i"));
    if (m) push(m[0]);
  }
  const lower = found.map((f) => f.toLowerCase());
  const longest = found.filter(
    (t, i) => !found.some((u, j) => j !== i && u.length > t.length && lower[j].includes(lower[i])),
  );
  return longest.slice(0, 20);
}

// Highest attainment only. The content often sits *above* the "Education"
// heading (and wraps/letter-spaces), so rank every line by level instead of
// scanning after the heading, then read the strongest one.
const EDU_ORDER = ["Elementary", "High School", "Senior High School", "Vocational", "College", "Post-Graduate"];
const EDU_MASTERS = /\b(master'?s?|graduate studies|\bmsc?\b|\bmba\b|\bm\.?a\.?\b|ph\.?d|doctorate)\b/i;
const EDU_COLLEGE = /\b(college|university|polytechnic|\bpup\b|\bbs[a-z]{0,4}\b|\bab\b|\bba\b|bach(?:elor)?|associate|diploma)\b/i;
const EDU_VOCATIONAL = /\b(vocational|tesda|\bnc ii\b|technical)\b/i;
const EDU_SENIOR = /\b(senior high|\bgrade 1[12]\b|\bshs\b|\bstem\b|\babm\b|\bhumss\b|\bgas\b)\b/i;
const EDU_HIGH = /\b(high school|secondary|junior high|\bnational high\b|\bgrade (7|8|9|10)\b)\b/i;
const EDU_ELEMENTARY = /\b(elementary|primary|\bgrade [1-6]\b)\b/i;
const EDU_DEGREE = /\b(BS[A-Z]{0,4}|AB|BA|MA|MS|MBA|PHD)\b/;

function eduRank(l) {
  if (EDU_MASTERS.test(l)) return 5;
  if (EDU_COLLEGE.test(l)) return 4;
  if (EDU_VOCATIONAL.test(l)) return 3;
  if (EDU_SENIOR.test(l)) return 2;
  if (EDU_HIGH.test(l)) return 1;
  if (EDU_ELEMENTARY.test(l)) return 0;
  return -1;
}

function mapEducation(lines) {
  const empty = { level: "", school: "", field: "", year: "" };
  let best = "";
  let bestRank = -1;
  for (const l of lines) {
    const rank = eduRank(l);
    // Tie-break on a line that also looks like a school entry.
    const looksEntry = /school|university|college|academy|institute|\b(19|20)\d{2}\b/i.test(l);
    if (rank > bestRank || (rank === bestRank && rank >= 0 && looksEntry && !/school|university|college|academy|institute|\b(19|20)\d{2}\b/i.test(best))) {
      bestRank = rank;
      best = l;
    }
  }
  if (bestRank < 0) return empty;
  const yearM = best.match(/\b((?:19|20)\d{2})\b\s*[-–]\s*((?:19|20)\d{2}|present)\b/i);
  const year = yearM ? yearM[1] : "";
  let rest = best.replace(/\(.*?\)/g, " ").replace(/\b(19|20)\d{2}\s*[-–]\s*((?:19|20)\d{2}|present)\b/i, " ").replace(/[•·▪●⋅|]/g, " ").replace(/\s+/g, " ").trim();
  rest = rest.replace(/^education(al)?(\s*history)?\s*[:\-–]?\s*/i, "").trim();
  const deg = rest.match(EDU_DEGREE);
  let field = "";
  if (deg && rest.toUpperCase().startsWith(deg[0].toUpperCase())) {
    field = deg[0];
    rest = rest.slice(deg[0].length).trim();
  }
  return { level: EDU_ORDER[bestRank], school: rest.replace(/^[-–,\s]+|[-–,\s]+$/g, "").trim(), field, year };
}

export function mapResumeText(input) {
  const out = blank();
  const text = String(input || "");
  if (!text.trim()) return out;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const name = mapName(text, lines);
  if (name) {
    out.firstName = name.firstName;
    out.middleName = name.middleName;
    out.lastName = name.lastName;
  }

  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (email) out.email = email[0];

  const phone = text.match(PHONE_RE);
  if (phone) {
    const digits = phone[0].replace(/\D/g, "");
    out.mobileNumber = digits.startsWith("63") ? `0${digits.slice(2)}` : digits;
  }

  out.birthdate = mapBirthdate(text);
  mapAddress(text, lines, out);
  out.skills = mapSkills(text, lines);
  out.education = mapEducation(lines);

  return out;
}
