const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '../email-templates');
const SUBJECTS_FILE = path.join(TEMPLATES_DIR, 'subjects.json');

const TEMPLATE_KEYS = {
  confirmation: 'confirmation.html',
  reminder: 'reminder.html',
};

const DEFAULT_SUBJECTS = {
  confirmation: '【GPCC 香港站】報名確認｜{{teamCode}} {{displayName}}',
  reminder: '【GPCC 香港站】海選提醒｜{{teamCode}} {{displayName}}',
};

function templatePath(kind) {
  const file = TEMPLATE_KEYS[kind];
  if (!file) throw new Error(`Unknown email template: ${kind}`);
  return path.join(TEMPLATES_DIR, file);
}

function readSubjects() {
  try {
    const raw = fs.readFileSync(SUBJECTS_FILE, 'utf8');
    return { ...DEFAULT_SUBJECTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SUBJECTS };
  }
}

function writeSubjects(subjects) {
  const next = {
    confirmation: String(subjects.confirmation || DEFAULT_SUBJECTS.confirmation),
    reminder: String(subjects.reminder || DEFAULT_SUBJECTS.reminder),
  };
  fs.writeFileSync(SUBJECTS_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function readTemplateHtml(kind) {
  return fs.readFileSync(templatePath(kind), 'utf8');
}

function writeTemplateHtml(kind, html) {
  const file = templatePath(kind);
  fs.writeFileSync(file, String(html || ''), 'utf8');
  return file;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Replace {{key}} placeholders. Values are HTML-escaped unless key ends with Html.
 * Supports simple {{#if key}}...{{/if}} blocks (truthy string check).
 */
function renderTemplate(source, vars = {}) {
  let out = String(source || '');

  out = out.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, block) => {
    const val = vars[key];
    if (val == null || val === false || String(val).trim() === '') return '';
    return block;
  });

  out = out.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars) || vars[key] == null) return '';
    if (key.endsWith('Html')) return String(vars[key]);
    return escapeHtml(vars[key]);
  });

  return out;
}

function listPlaceholders() {
  return [
    'applicationId',
    'teamCode',
    'displayName',
    'captainName',
    'captainEnglishName',
    'captainEmail',
    'teammateName',
    'teammateEnglishName',
    'teammateEmail',
    'captainClub',
    'ageGroup',
    'eventCategory',
    'preferredVenue',
    'qualifierSlot',
    'packTier',
    'status',
    'paymentStatus',
    'paymentTotal',
    'customMessage',
    'year',
    'venueCode',
    'venueShort',
    'slotLabel',
    'matchDateText',
    'weekday',
    'checkInTime',
    'startTime',
    'endTime',
    'venueAddress',
  ];
}

module.exports = {
  TEMPLATES_DIR,
  TEMPLATE_KEYS,
  readSubjects,
  writeSubjects,
  readTemplateHtml,
  writeTemplateHtml,
  renderTemplate,
  listPlaceholders,
};
