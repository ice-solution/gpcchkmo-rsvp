/** Shared enums for RSVP + future payment / QR / email phases */

const REGISTRATION_TYPES = {
  FIRST_OR_ONLY: 'first_or_only',
  SECOND_ADDITIONAL: 'second_additional',
};

/** 隊長所屬匹克球球會／機構（固定選項） */
const CAPTAIN_CLUBS = [
  'Pick&Match',
  'Bay Pickle',
  'PickleVibe',
  'Pickle.Ready',
  'My Pickle World',
  'Table meets Pickle',
];

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
  [AGE_GROUPS.SENIOR]: '常青組（50–65 歲）',
  [AGE_GROUPS.MID]: '壯年組（36–49 歲）',
  [AGE_GROUPS.OPEN]: '公開組（18–65 歲）',
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
  { value: 'weekday_morning', label: '平日早上' },
  { value: 'weekday_afternoon', label: '平日下午' },
  { value: 'weekday_evening', label: '平日晚上' },
  { value: 'weekend_morning', label: '週末早上' },
  { value: 'weekend_afternoon', label: '週末下午' },
  { value: 'weekend_evening', label: '週末晚上' },
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
  { value: 'carnival_zone', label: '城市嘉年華體驗區' },
  { value: 'cantonese_night', label: '匹克球廣東歌之夜' },
  { value: 'city_challenge', label: '城市擂台公開賽' },
  { value: 'star_match', label: '明星賽' },
  { value: 'charity', label: '慈善賽' },
  { value: 'family', label: '親子賽' },
  { value: 'corporate', label: '企業盃' },
  { value: 'workshop', label: '教學與訓練工作坊' },
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
  { value: 'sms', label: '短訊' },
  { value: 'no_promo', label: '不接收推廣資訊' },
];

/** Team-level application / payment / qualification lifecycle */
const TEAM_STATUS = {
  DRAFT: 'draft',
  SUBMITTED_PENDING_PAYMENT: 'submitted_pending_payment',
  PAID_PENDING_REVIEW: 'paid_pending_review',
  PAYMENT_FAILED: 'payment_failed',
  CONFIRMED: 'confirmed',
  DQ: 'dq',
  WITHDRAWN: 'withdrawn',
};

const TEAM_STATUS_LABELS = {
  [TEAM_STATUS.DRAFT]: '草稿',
  [TEAM_STATUS.SUBMITTED_PENDING_PAYMENT]: '已提交／待付款',
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

const FEE = {
  BASE_HKD: 680,
  CURRENCY: 'HKD',
  MAX_EVENTS_PER_PLAYER: 2,
};

/** Reference year for age-group eligibility (event year) */
const EVENT_YEAR = 2026;

module.exports = {
  REGISTRATION_TYPES,
  CAPTAIN_CLUBS,
  GENDERS,
  AGE_GROUPS,
  AGE_GROUP_LABELS,
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
  FEE,
  EVENT_YEAR,
};
