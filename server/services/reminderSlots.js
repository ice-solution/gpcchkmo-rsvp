const fs = require('fs');
const path = require('path');

const SLOTS_FILE = path.join(__dirname, '../email-templates/reminder-slots.json');

function loadReminderSlots() {
  const raw = fs.readFileSync(SLOTS_FILE, 'utf8');
  return JSON.parse(raw);
}

function getReminderSlotById(id) {
  return loadReminderSlots().find((s) => s.id === id) || null;
}

function slotVars(slot) {
  if (!slot) return {};
  return {
    venueCode: slot.venueCode || '',
    venueShort: slot.venueShort || '',
    slotLabel: slot.slotLabel || '',
    matchDateText: slot.matchDateText || '',
    weekday: slot.weekday || '',
    checkInTime: slot.checkInTime || '',
    startTime: slot.startTime || '',
    endTime: slot.endTime || '',
    venueAddress: slot.venueAddress || '',
  };
}

function normalizeText(s) {
  return String(s || '')
    .replace(/–/g, '-')
    .replace(/｜/g, '|')
    .replace(/\s+/g, ' ')
    .trim();
}

function venueMatches(hay, slot) {
  const hayUpper = hay.toUpperCase();
  const code = String(slot.venueCode || '').toUpperCase();
  return (
    (code && hayUpper.includes(code)) ||
    (slot.venueShort && hay.includes(normalizeText(slot.venueShort))) ||
    (code === 'P12' && /PICKLEDISE/i.test(hay)) ||
    (code === 'P07' && /PICKLE\s*LAB/i.test(hay)) ||
    (code === 'P08' && /錦綉/.test(hay)) ||
    (code === 'P01' && /PICK\s*&\s*MATCH|PICK AND MATCH/i.test(hay)) ||
    (code === 'P04' && /PICKLE\.READY/i.test(hay)) ||
    (code === 'P03' && /PICKLEVIBES/i.test(hay)) ||
    (code === 'P05' && /MYPW|MY PICKLE WORLD/i.test(hay)) ||
    (code === 'P02' && /LIT\s*PICKLE/i.test(hay))
  );
}

/**
 * Match team to a reminder slot.
 * Prefer qualifierSlotLabel (specific slot); avoid matching multi-date venue notes alone.
 */
function teamMatchesSlot(team, slot) {
  if (!team || !slot) return false;
  const venue = normalizeText(team.preferredVenueLabel);
  const qSlot = normalizeText(team.qualifierSlotLabel);
  // Prefer precise slot text when present; else use venue label
  // Venue labels for LIT/MYPW often list ALL dates — don't use those alone for slot match
  const multiDateVenueNote =
    !qSlot &&
    ((slot.venueCode === 'P02' || slot.venueCode === 'P05') &&
      ((venue.match(/\d{1,2}\/\d{1,2}/g) || []).length > 1 ||
        /女雙.*男雙|男雙.*混雙|28\/10.*31\/10|31\/10.*04\/11|按年齡組別/.test(venue)));
  const scheduleHay = qSlot || (multiDateVenueNote ? '' : venue);
  const venueHay = venue || qSlot;
  const slotLabel = normalizeText(slot.slotLabel);

  if (!venueMatches(venueHay, slot) && !venueMatches(`${venue} ${qSlot}`, slot)) {
    return false;
  }

  // LIT/MYPW without qualifierSlotLabel cannot be safely matched from multi-date venue note
  if (!scheduleHay && (slot.venueCode === 'P02' || slot.venueCode === 'P05')) {
    return false;
  }

  if (slotLabel && (qSlot.includes(slotLabel) || scheduleHay.includes(slotLabel))) {
    return true;
  }

  // Day-level / venue-only schedules (no multi-date ambiguity)
  if (slot.id === 'p12-pickledise-1101') {
    return /01\/11|1\/11/.test(scheduleHay) && /19:00/.test(scheduleHay);
  }
  if (slot.id === 'p07-picklelab-1108') {
    return /P07|PICKLE\s*LAB/i.test(venueHay);
  }
  if (slot.id === 'p03-picklevibes-1107-08') {
    return (
      /7\/11.*8\/11|8\/11.*7\/11/.test(scheduleHay.replace(/\s/g, '')) ||
      scheduleHay.includes('7/11, 8/11')
    );
  }
  if (slot.id === 'p04-pickle-ready-1108') {
    return /8\/11/.test(scheduleHay);
  }
  if (slot.id === 'p01-pick-match-1107') {
    return /7\/11/.test(scheduleHay);
  }
  if (slot.id === 'p08-fairview-1025') {
    return /25\/10/.test(scheduleHay);
  }

  // LIT / MYPW: require qualifierSlotLabel (or a single-slot venue string)
  const hay = scheduleHay;
  if (slot.venueCode === 'P02') {
    if (slot.id.includes('1028')) return /28\/10/.test(hay) && /女雙/.test(hay);
    if (slot.id.includes('1031')) return /31\/10/.test(hay) && /男雙/.test(hay);
    if (slot.id.includes('1104')) return /(04\/11|4\/11)/.test(hay) && /混雙/.test(hay);
  }

  if (slot.venueCode === 'P05') {
    if (slot.id === 'p05-mypw-1031-open-md') {
      return /31\/10/.test(hay) && /09:00|9:00/.test(hay) && /公開組/.test(hay) && /男雙/.test(hay);
    }
    if (slot.id === 'p05-mypw-1031-open-xd') {
      return /31\/10/.test(hay) && /11:00/.test(hay) && /公開組/.test(hay) && /混雙/.test(hay);
    }
    if (slot.id === 'p05-mypw-1031-masters-xd') {
      return /31\/10/.test(hay) && /11:00/.test(hay) && /壯年組/.test(hay) && /混雙/.test(hay);
    }
    if (slot.id === 'p05-mypw-1031-masters-wd') {
      return /31\/10/.test(hay) && /16:15/.test(hay) && /女雙/.test(hay);
    }
    if (slot.id === 'p05-mypw-1101-open-md') {
      return /(1\/11|01\/11)/.test(hay) && /15:00/.test(hay) && /公開組/.test(hay) && /男雙/.test(hay);
    }
    if (slot.id === 'p05-mypw-1101-masters-md') {
      return /(1\/11|01\/11)/.test(hay) && /15:00/.test(hay) && /壯年組/.test(hay) && /男雙/.test(hay);
    }
  }

  return false;
}

function findTeamsForSlot(teams, slot) {
  return (teams || []).filter((t) => teamMatchesSlot(t, slot));
}

module.exports = {
  loadReminderSlots,
  getReminderSlotById,
  slotVars,
  teamMatchesSlot,
  findTeamsForSlot,
};
