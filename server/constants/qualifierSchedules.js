const { AGE_GROUPS, EVENT_CATEGORIES, AGE_GROUP_LABELS, EVENT_CATEGORY_LABELS } = require('./enums');

/** Stable keys on ClubVenue.scheduleKey */
const QUALIFIER_SCHEDULE_KEYS = {
  LIT_PICKLE: 'lit_pickle',
  MYPW: 'mypw',
};

const SCHEDULE_NOTICE = {
  title: '賽程管理與特別說明',
  body: [
    '大會致力為全體參賽者提供優質、公平且順暢的賽事體驗。為配合場地營運安排及應對不可預期之狀況，主辦單位及協辦球館將以保障賽事整體品質與參賽者權益為首要考量，保留對比賽時間、日期及賽制進行合理協調與微調之權利。',
    '如賽程需作任何變動，大會將第一時間主動通知參賽者。大會將秉持專業與公正原則處理賽務，主辦單位及協辦球館對賽事日程與相關安排保留最終協調及解釋權。',
  ],
};

/** LIT PICKLE：只按競賽項目 */
const LIT_PICKLE_SLOTS = {
  [EVENT_CATEGORIES.WD]: {
    date: '28/10',
    time: '20:00–23:00',
    eventShort: '女雙',
  },
  [EVENT_CATEGORIES.MD]: {
    date: '31/10',
    time: '20:00–23:00',
    eventShort: '男雙',
  },
  [EVENT_CATEGORIES.XD]: {
    date: '04/11',
    time: '20:00–23:00',
    eventShort: '混雙',
  },
};

/** MY PICKLE WORLD：年齡組別 + 競賽項目 */
const MYPW_SLOTS = {
  [`${AGE_GROUPS.OPEN}|${EVENT_CATEGORIES.MD}`]: {
    date: '31/10',
    time: '09:00–11:20',
    ageShort: '公開組',
    eventShort: '男雙',
  },
  [`${AGE_GROUPS.OPEN}|${EVENT_CATEGORIES.XD}`]: {
    date: '31/10',
    time: '11:30–13:45',
    ageShort: '公開組',
    eventShort: '混雙',
  },
  [`${AGE_GROUPS.OPEN}|${EVENT_CATEGORIES.WD}`]: {
    date: '31/10',
    time: '13:50–16:00',
    ageShort: '公開組',
    eventShort: '女雙',
  },
  [`${AGE_GROUPS.MID}|${EVENT_CATEGORIES.WD}`]: {
    date: '31/10',
    time: '16:15–18:30',
    ageShort: '壯年組',
    eventShort: '女雙',
  },
  [`${AGE_GROUPS.SENIOR}|${EVENT_CATEGORIES.MD}`]: {
    date: '1/11',
    time: '08:00–10:20',
    ageShort: '長青組',
    eventShort: '男雙',
  },
  [`${AGE_GROUPS.SENIOR}|${EVENT_CATEGORIES.XD}`]: {
    date: '1/11',
    time: '10:30–12:40',
    ageShort: '長青組',
    eventShort: '混雙',
  },
  [`${AGE_GROUPS.SENIOR}|${EVENT_CATEGORIES.WD}`]: {
    date: '1/11',
    time: '12:50–15:00',
    ageShort: '長青組',
    eventShort: '女雙',
  },
  [`${AGE_GROUPS.MID}|${EVENT_CATEGORIES.MD}`]: {
    date: '1/11',
    time: '15:10–17:20',
    ageShort: '壯年組',
    eventShort: '男雙',
  },
  [`${AGE_GROUPS.MID}|${EVENT_CATEGORIES.XD}`]: {
    date: '1/11',
    time: '17:30–19:40',
    ageShort: '壯年組',
    eventShort: '混雙',
  },
};

function inferScheduleKey(venueLabel) {
  const label = String(venueLabel || '');
  if (/LIT\s*PICKLE/i.test(label)) return QUALIFIER_SCHEDULE_KEYS.LIT_PICKLE;
  if (/My Pickle World|MYPW/i.test(label)) return QUALIFIER_SCHEDULE_KEYS.MYPW;
  return '';
}

function formatSlotText(slot, { ageGroup, eventCategory } = {}) {
  if (!slot) return '';
  const agePart = slot.ageShort || (ageGroup ? AGE_GROUP_LABELS[ageGroup]?.split('（')[0] : '');
  const eventPart =
    slot.eventShort ||
    (eventCategory ? EVENT_CATEGORY_LABELS[eventCategory] : '');
  const category = [agePart, eventPart].filter(Boolean).join(' ');
  return category
    ? `${slot.date} ${slot.time}｜${category}`
    : `${slot.date} ${slot.time}`;
}

/**
 * Resolve fixed qualifier slot for venues that publish fixed schedules.
 * @returns {{ scheduleKey, slot, text, needsAge, needsEvent } | null}
 */
function resolveQualifierSlot({ scheduleKey, venueLabel, ageGroup, eventCategory }) {
  const key = scheduleKey || inferScheduleKey(venueLabel);
  if (!key) return null;

  if (key === QUALIFIER_SCHEDULE_KEYS.LIT_PICKLE) {
    if (!eventCategory) {
      return { scheduleKey: key, slot: null, text: '', needsAge: false, needsEvent: true };
    }
    const slot = LIT_PICKLE_SLOTS[eventCategory] || null;
    return {
      scheduleKey: key,
      slot,
      text: formatSlotText(slot, { eventCategory }),
      needsAge: false,
      needsEvent: false,
    };
  }

  if (key === QUALIFIER_SCHEDULE_KEYS.MYPW) {
    if (!ageGroup || !eventCategory) {
      return {
        scheduleKey: key,
        slot: null,
        text: '',
        needsAge: !ageGroup,
        needsEvent: !eventCategory,
      };
    }
    const slot = MYPW_SLOTS[`${ageGroup}|${eventCategory}`] || null;
    return {
      scheduleKey: key,
      slot,
      text: formatSlotText(slot, { ageGroup, eventCategory }),
      needsAge: false,
      needsEvent: false,
    };
  }

  return null;
}

function getQualifierSchedulesMeta() {
  return {
    notice: SCHEDULE_NOTICE,
    keys: QUALIFIER_SCHEDULE_KEYS,
    litPickle: LIT_PICKLE_SLOTS,
    mypw: MYPW_SLOTS,
  };
}

module.exports = {
  QUALIFIER_SCHEDULE_KEYS,
  SCHEDULE_NOTICE,
  resolveQualifierSlot,
  getQualifierSchedulesMeta,
  inferScheduleKey,
  formatSlotText,
};
