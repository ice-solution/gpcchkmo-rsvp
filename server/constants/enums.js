/** Shared enums for RSVP + future payment / QR / email phases */

const REGISTRATION_TYPES = {
  FIRST_OR_ONLY: 'first_or_only',
  SECOND_ADDITIONAL: 'second_additional',
};

/** 賽事報名邀請球會（固定選項；含 P0x 代號） */
const CAPTAIN_CLUBS = [
  'P01 Pick and Match',
  'P02 Lit Pickle',
  'P03 PickleVibes',
  'P04 PICKLE.READY',
  'P05 My Pickle World',
  'P06 Table meets Pickle',
  'P07 PickleLab',
  'P08 錦綉花園鄉村俱樂部',
  'P12 PICKLEDISE',
  'P09 企業機構',
  'P10 其他（非指定名單內之球會）',
  'P11 個人名義（獨立球員隊伍）',
];

/** Club portal logins (P01–P12) */
const CLUB_PORTAL_ACCOUNTS = [
  { code: 'P01', label: 'P01 Pick and Match' },
  { code: 'P02', label: 'P02 Lit Pickle' },
  { code: 'P03', label: 'P03 PickleVibes' },
  { code: 'P04', label: 'P04 PICKLE.READY' },
  { code: 'P05', label: 'P05 My Pickle World' },
  { code: 'P06', label: 'P06 Table meets Pickle' },
  { code: 'P07', label: 'P07 PickleLab' },
  { code: 'P08', label: 'P08 錦綉花園鄉村俱樂部' },
  { code: 'P09', label: 'P09 企業機構' },
  { code: 'P10', label: 'P10 其他（非指定名單內之球會）' },
  { code: 'P11', label: 'P11 個人名義（獨立球員隊伍）' },
  { code: 'P12', label: 'P12 PICKLEDISE' },
];

function captainClubBelongsToPortalCode(captainClub, code) {
  const club = String(captainClub || '').trim();
  const c = String(code || '').trim().toUpperCase();
  if (!club || !c) return false;
  return club.toUpperCase().startsWith(c);
}

function buildClubPortalFilter(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return { _id: null };
  // Match "P01 …" / "P09 企業機構（…）"；避免 P01 誤中 P10
  return { captainClub: { $regex: `^${c}([^0-9]|$)`, $options: 'i' } };
}

/** Older club labels still accepted on submit / admin filters */
const LEGACY_CAPTAIN_CLUBS = [
  'Pick&Match',
  'Bay Pickle',
  'PickleVibe',
  'PICKLE.READY',
  'My Pickle World',
  'Table meets Pickle',
  'Pickle Lab',
  '錦綉花園鄉村俱樂部',
  'LIT PICKLE',
];

/** Temporarily hide from RSVP dropdowns (still valid if already submitted) */
const HIDDEN_CAPTAIN_CLUBS = [];

/** @deprecated replaced by P10；仍接受舊 draft／舊提交 */
const CAPTAIN_CLUB_OTHER_VALUE = '__other__';

/** Follow-up fields when certain invite-club options are selected */
const CAPTAIN_CLUB_FOLLOWUPS = {
  'P09 企業機構': {
    kind: 'name',
    required: true,
    label: '請填寫球會／機構名稱 *',
    placeholder: '請輸入企業／機構名稱',
  },
  'P10 其他（非指定名單內之球會）': {
    kind: 'name',
    required: true,
    label: '請填寫球會／機構名稱 *',
    placeholder: '請輸入球會或機構名稱',
  },
  'P11 個人名義（獨立球員隊伍）': {
    kind: 'source',
    required: false,
    label: '請填寫獲取比賽資料來源（選填）',
    placeholder: '例如：社交媒體、朋友介紹等',
  },
};

const GENDERS = {
  MALE: 'male',
  FEMALE: 'female',
};

const AGE_GROUPS = {
  SENIOR: 'senior', // 常青組 50–65
  MID: 'mid', // 壯年組 36–49
  OPEN: 'open', // 公開組 18–65
};

const AGE_GROUP_LABELS = {
  [AGE_GROUPS.SENIOR]: '常青組（50–65 歲；1961-01-01 至 1976-12-31 出生）',
  [AGE_GROUPS.MID]: '壯年組（36–49 歲；1977-01-01 至 1990-12-31 出生）',
  [AGE_GROUPS.OPEN]: '公開組（18–65 歲；1961-01-01 至 2008-12-31 出生）',
};

/** Official birth-date windows (inclusive start / inclusive end) */
const AGE_GROUP_DOB_RANGES = {
  [AGE_GROUPS.SENIOR]: { start: '1961-01-01', end: '1976-12-31' },
  [AGE_GROUPS.MID]: { start: '1977-01-01', end: '1990-12-31' },
  [AGE_GROUPS.OPEN]: { start: '1961-01-01', end: '2008-12-31' },
};

const EVENT_CATEGORIES = {
  MD: 'mens_doubles',
  WD: 'womens_doubles',
  XD: 'mixed_doubles',
};

const EVENT_CATEGORY_LABELS = {
  [EVENT_CATEGORIES.MD]: '男子雙打',
  [EVENT_CATEGORIES.WD]: '女子雙打',
  [EVENT_CATEGORIES.XD]: '混合雙打',
};

const AVAILABILITY_SLOTS = [
  { value: 'morning', label: '早上（9am – 12pm）' },
  { value: 'afternoon', label: '下午（1pm – 4pm）' },
  { value: 'evening', label: '晚上（4pm – 當日比賽結束）' },
];

const CARNIVAL_INTENT = [
  { value: 'attend_experience', label: '會，並有意參與體驗' },
  { value: 'attend_spectate', label: '會，主要觀賽及支持朋友' },
  { value: 'maybe', label: '可能到場' },
  { value: 'no', label: '不會到場' },
  { value: 'match_only', label: '僅按賽程參加正式比賽' },
];

const SPECTATOR_COUNTS = ['0', '1', '2', '3', '4_plus', 'unsure'];

const SKILL_LEVELS = [
  { value: 'first_time', label: '初次接觸' },
  { value: 'beginner', label: '初階（少於 6 個月）' },
  { value: 'casual', label: '休閒球友' },
  { value: 'intermediate', label: '中階業餘球員' },
  { value: 'advanced', label: '進階競技球員' },
  { value: 'coach_pro', label: '教練或專業從業者' },
];

const INTEREST_TOPICS = [
  { value: 'finals_carnival', label: '11月14-15日決賽日城市嘉年華及體驗區' },
  { value: 'player_dinner_fairway', label: '11月13日球員晚宴／見面會／聚會（錦綉花園俱樂部）' },
  { value: 'gba_finals_guangzhou', label: '大灣區匹克球城市總決賽（於廣州舉辦 - 約11月尾至12月）' },
  { value: 'pro_photo_video', label: '參賽者比賽專業攝影／攝錄團隊' },
  { value: 'club_experience_hk_mo', label: '球會匹克球體驗日（港澳）' },
  { value: 'club_exchange_gba', label: '球會匹克球交流活動（大灣區其他城市）' },
  { value: 'corp_team_building', label: '企業／團體匹克球團建／比賽訓練' },
  { value: 'corp_private_cup', label: '企業／團體獨立盃賽' },
  { value: 'star_coach_camp', label: '明星教練訓練營' },
  { value: 'masterclass', label: '匹克球大師班訓練' },
  { value: 'celebration_gala', label: '大賽祝捷會（將邀請明星或大師參與）' },
  { value: 'referee_training', label: '專業裁判訓練及資格考核' },
  { value: 'cantonese_night', label: '匹克球廣東歌之夜' },
  { value: 'city_challenge', label: '城市擂台公開賽' },
  { value: 'star_match', label: '明星賽' },
  { value: 'charity', label: '慈善賽' },
  { value: 'family', label: '親子賽' },
  { value: 'corporate', label: '企業盃' },
  { value: 'workshop', label: '入門教學與訓練工作坊' },
  { value: 'merch', label: '官方紀念品' },
  { value: 'volunteer', label: '義工或社區參與' },
  { value: 'other', label: '其他' },
];

const HEAR_ABOUT = [
  { value: 'partner_club', label: '合作球會' },
  { value: 'coach', label: '教練' },
  { value: 'friend', label: '朋友或隊友' },
  { value: 'social', label: '社交媒體' },
  { value: 'mall', label: '商場宣傳' },
  { value: 'media', label: '媒體報道' },
  { value: 'official', label: '大會官方渠道' },
  { value: 'other', label: '其他' },
];

const CONTACT_PREFS = [
  { value: 'email', label: '電郵' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'wechat', label: '微信' },
  { value: 'phone', label: '電話' },
];

/** Team-level application / payment / qualification lifecycle */
const TEAM_STATUS = {
  DRAFT: 'draft',
  SUBMITTED_PENDING_PAYMENT: 'submitted_pending_payment',
  MANUAL_PENDING_PAYMENT: 'manual_pending_payment',
  PAID_PENDING_REVIEW: 'paid_pending_review',
  PAYMENT_FAILED: 'payment_failed',
  CONFIRMED: 'confirmed',
  DQ: 'dq',
  WITHDRAWN: 'withdrawn',
};

const TEAM_STATUS_LABELS = {
  [TEAM_STATUS.DRAFT]: '草稿',
  [TEAM_STATUS.SUBMITTED_PENDING_PAYMENT]: '已提交／待付款',
  [TEAM_STATUS.MANUAL_PENDING_PAYMENT]: '人工待付',
  [TEAM_STATUS.PAID_PENDING_REVIEW]: '已付款／待核實',
  [TEAM_STATUS.PAYMENT_FAILED]: '付款失敗',
  [TEAM_STATUS.CONFIRMED]: '已確認',
  [TEAM_STATUS.DQ]: 'DQ',
  [TEAM_STATUS.WITHDRAWN]: '已退賽',
};

const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PENDING_MANUAL: 'pending_manual', // FPS / bank transfer awaiting verify
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIAL_REFUND: 'partial_refund',
};

const PAYMENT_STATUS_LABELS = {
  [PAYMENT_STATUS.UNPAID]: '未付款',
  [PAYMENT_STATUS.PENDING_MANUAL]: '待核實轉帳',
  [PAYMENT_STATUS.PROCESSING]: '處理中',
  [PAYMENT_STATUS.PAID]: '已付款',
  [PAYMENT_STATUS.FAILED]: '失敗',
  [PAYMENT_STATUS.REFUNDED]: '已退款',
  [PAYMENT_STATUS.PARTIAL_REFUND]: '部分退款',
};

const QUALIFICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DQ: 'dq',
};

const QUALIFICATION_STATUS_LABELS = {
  [QUALIFICATION_STATUS.PENDING]: '待審核',
  [QUALIFICATION_STATUS.APPROVED]: '已通過',
  [QUALIFICATION_STATUS.REJECTED]: '已拒絕',
  [QUALIFICATION_STATUS.DQ]: 'DQ',
};

const PLAYER_ROLES = {
  CAPTAIN: 'captain',
  TEAMMATE: 'teammate',
};

const PACK_TIERS = {
  STANDARD: 'standard',
  ESSENTIAL: 'essential',
  PREMIUM: 'premium',
};

const PACK_TIER_LABELS = {
  [PACK_TIERS.STANDARD]: '標準報名（僅參賽）',
  [PACK_TIERS.ESSENTIAL]: '基礎選手包（港幣 $200）',
  [PACK_TIERS.PREMIUM]: '尊尚選手包（港幣 $760）',
};

const FEE = {
  BASE_HKD: 680,
  PLAYER_PACK_HKD: 200, // Essential（向後兼容）
  ESSENTIAL_PACK_HKD: 200,
  PREMIUM_PACK_HKD: 760,
  PLATFORM_FEE_RATE: 0.03,
  CURRENCY: 'HKD',
  MAX_EVENTS_PER_PLAYER: 2,
};

const PACK_TIER_ADDON_HKD = {
  [PACK_TIERS.STANDARD]: 0,
  [PACK_TIERS.ESSENTIAL]: FEE.ESSENTIAL_PACK_HKD,
  [PACK_TIERS.PREMIUM]: FEE.PREMIUM_PACK_HKD,
};

/** Reference year for age-group eligibility (event year) */
const EVENT_YEAR = 2026;

/** Eligible DOB window for RSVP date inputs (ages 18–65 in EVENT_YEAR). */
function getEligibleDobBounds(eventYear = EVENT_YEAR) {
  const minYear = eventYear - 65;
  const maxYear = eventYear - 18;
  const midYear = Math.floor((minYear + maxYear) / 2);
  return {
    min: `${minYear}-01-01`,
    max: `${maxYear}-12-31`,
    /** Calendar opens near mid-range when field is empty */
    mid: `${midYear}-07-01`,
    minAge: 18,
    maxAge: 65,
    eventYear,
  };
}

module.exports = {
  REGISTRATION_TYPES,
  CAPTAIN_CLUBS,
  LEGACY_CAPTAIN_CLUBS,
  HIDDEN_CAPTAIN_CLUBS,
  CAPTAIN_CLUB_OTHER_VALUE,
  CAPTAIN_CLUB_FOLLOWUPS,
  CLUB_PORTAL_ACCOUNTS,
  captainClubBelongsToPortalCode,
  buildClubPortalFilter,
  GENDERS,
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  AGE_GROUP_DOB_RANGES,
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABELS,
  AVAILABILITY_SLOTS,
  CARNIVAL_INTENT,
  SPECTATOR_COUNTS,
  SKILL_LEVELS,
  INTEREST_TOPICS,
  HEAR_ABOUT,
  CONTACT_PREFS,
  TEAM_STATUS,
  TEAM_STATUS_LABELS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
  QUALIFICATION_STATUS,
  QUALIFICATION_STATUS_LABELS,
  PLAYER_ROLES,
  PACK_TIERS,
  PACK_TIER_LABELS,
  PACK_TIER_ADDON_HKD,
  FEE,
  EVENT_YEAR,
  getEligibleDobBounds,
};
