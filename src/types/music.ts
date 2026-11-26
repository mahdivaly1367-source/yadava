export type InstrumentId =
  | 'tar'
  | 'setar'
  | 'santur'
  | 'ney'
  | 'kamancheh'
  | 'oud'
  | 'tanbur';

export type KoronMode = 'standard_50' | 'traditional_56';

export type Accidental = 'natural' | 'koron' | 'sori' | 'flat' | 'sharp';

export type NoteLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export type GushehRole = 'daramad' | 'miani' | 'owj' | 'zarbi' | 'foroud';

export type OrnamentType = 'eshareh' | 'tekieh' | 'dorab' | 'riz' | 'tahrir';

export type IranianMeter = '2/4' | '3/4' | '4/4' | '5/8' | '6/8' | '7/8';

export type Subdivision = 1 | 2 | 3;

export type LearnerLevel = 'beginner' | 'intermediate' | 'advanced';

export type AppTab = 'dashboard' | 'studio' | 'explorer' | 'modulation' | 'community';

export interface PersianNoteSpec {
  letter: NoteLetter;
  accidental: Accidental;
  octave: number;
}

export interface MelodyNote extends PersianNoteSpec {
  durationBeats: number;
  ornament?: OrnamentType;
  isForoudTarget?: boolean;
  isTahrirZone?: boolean;
}

export interface ModulationTarget {
  targetDastgahId: string;
  targetGushehId?: string;
  labelFa: string;
  alteredNoteFa: string;
}

export interface PracticeLoopSpec {
  startIndex: number;
  endIndex: number;
  defaultBpm: number;
  meter: IranianMeter;
}

export interface Gusheh {
  id: string;
  dastgahId: string;
  order: number;
  nameFa: string;
  nameEn: string;
  role: GushehRole;
  difficulty: 1 | 2 | 3;
  shahed: PersianNoteSpec;
  ist: PersianNoteSpec;
  aghaz: PersianNoteSpec;
  moteghayer?: PersianNoteSpec;
  scale: PersianNoteSpec[];
  ornaments: OrnamentType[];
  melody: MelodyNote[];
  practiceLoop: PracticeLoopSpec;
  modulations: ModulationTarget[];
  descriptionFa: string;
}

export interface DastgahSystem {
  id: string;
  nameFa: string;
  nameEn: string;
  category: 'dastgah' | 'avaz';
  parentDastgahId?: string;
  isFree: boolean;
  colorHex: string;
  moodFa: string;
  summaryFa: string;
  signatureNotes: PersianNoteSpec[];
  shahed: PersianNoteSpec;
  ist: PersianNoteSpec;
  gushehs: Gusheh[];
}

export interface PitchAnalysisFrame {
  frequency: number | null;
  clarity: number;
  rms: number;
  note: PersianNoteSpec | null;
  noteLabelFa: string;
  centsOffset: number;
  tahrirDetected: boolean;
  tahrirRateHz: number;
  foroudScore: number;
}

export interface HarmonicPeak {
  harmonicNumber: number;
  frequencyHz: number;
  magnitudeDb: number;
}

export interface SrsCard {
  gushehId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: number;
  lastQuality: number;
  updatedAt: number;
}

export interface PracticeSessionRecord {
  id: string;
  gushehId: string;
  dastgahId: string;
  instrument: InstrumentId;
  durationSeconds: number;
  accuracyPercent: number;
  foroudScore: number;
  tahrirDetected: boolean;
  avgCentsError: number;
  completedAt: number;
}

export interface PlacementResult {
  id: string;
  earScore: number;
  pitchScore: number;
  recommendedLevel: LearnerLevel;
  weakIntervals: string[];
  completedAt: number;
}

export interface RecordedPitchPoint {
  timeSec: number;
  freqHz: number;
  centsOffset: number;
  noteLabelFa: string;
}

export interface RecordingAnalysis {
  durationSeconds: number;
  rmsDb: number;
  avgAccuracy: number;
  avgCentsError: number;
  envelope: number[];
  pitchContour?: RecordedPitchPoint[];
}

export interface SavedRecordingMeta {
  id: string;
  ownerUid: string;
  ownerName: string;
  gushehId: string;
  dastgahId: string;
  instrument: InstrumentId;
  title: string;
  durationSeconds: number;
  avgAccuracy: number;
  rmsDb: number;
  envelope: number[];
  pitchContour?: RecordedPitchPoint[];
  isPublic: boolean;
  hasLocalAudio: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface EarTrainingStats {
  totalAnswered: number;
  totalCorrect: number;
  bestStreak: number;
  completedSessions: number;
}

export interface UserLearningState {
  ownerUid: string;
  displayName: string;
  level: LearnerLevel;
  totalPracticeMinutes: number;
  streakDays: number;
  streakFreezesRemaining?: number;
  frozenDateKeys?: string[];
  earTrainingStats?: EarTrainingStats;
  completedChallengeIds?: string[];
  completedPathStepIds?: string[];
  bestBreathSeconds?: number;
  averageAccuracy: number;
  weakIntervals: string[];
  badges: string[];
  placementCompleted: boolean;
  srsCards: Record<string, SrsCard>;
  sessions: PracticeSessionRecord[];
  recordings: SavedRecordingMeta[];
  lastPlacement: PlacementResult | null;
  dailyCompletedSteps: string[];
  dailyPlanDateKey: string;
  updatedAt: number;
}

export type RadifTraditionId = 'mirza_abdollah' | 'mahmoud_karimi' | 'saba' | 'davami';

export type DroneTimbre = 'tanbur' | 'ney' | 'kamancheh';
export type DroneVoicing = 'base' | 'base_fifth' | 'base_shahed';

export type PercussionInstrument = 'tombak' | 'daf';
export type IranianGrooveId =
  | 'chaharmezrab_6_8'
  | 'reng_sangin_6_8'
  | 'reng_shad_6_8'
  | 'pishdaramad_4_4'
  | 'kereshmeh_3_4'
  | 'saghinameh_2_4'
  | 'lang_5_8'
  | 'lang_7_8';

export type VocalRangePresetId =
  | 'rast_kuk'
  | 'chap_kuk'
  | 'shur_sol'
  | 'shur_re'
  | 'shur_la'
  | 'soprano'
  | 'alto'
  | 'tenor'
  | 'baritone';

export type FootPedalPresetId = 'airturn_page' | 'play_record' | 'loop_next';

export interface CustomTemperamentProfile {
  id: string;
  nameFa: string;
  schoolFa: string;
  descriptionFa: string;
  koronCents: number; // e.g. -50, -56, -62, -45
  soriCents: number;  // e.g. +50, +46, +54
  noteOffsetsCents: Record<NoteLetter, number>; // per-letter fine cent offsets (-30..+30)
}

export interface TeacherAssignment {
  version: 1;
  id: string;
  titleFa: string;
  teacherName: string;
  gushehId: string;
  traditionId: RadifTraditionId;
  instrument: InstrumentId;
  speedPercent: number;
  loopStart: number;
  loopEnd: number;
  transposeSemitones: number;
  koronMode: KoronMode;
  targetAccuracyPercent: number;
  requireWaitMode: boolean;
  notesFa: string;
  createdAt: number;
}

export interface ForumPost {
  id: string;
  authorUid: string;
  authorName: string;
  title: string;
  body: string;
  dastgahId: string;
  tags: string[];
  replyCount: number;
  lastReplyId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ForumReply {
  id: string;
  postId: string;
  authorUid: string;
  authorName: string;
  body: string;
  createdAt: number;
}

export interface PracticeRoom {
  id: string;
  hostUid: string;
  hostName: string;
  title: string;
  dastgahId: string;
  gushehId: string;
  instrument: InstrumentId;
  tempoBpm: number;
  meter: IranianMeter;
  metronomeActive: boolean;
  isPlaying: boolean;
  activeParticipants: string[];
  createdAt: number;
  updatedAt: number;
}

export type BillingProductId = 'navanegar_pro_lifetime' | 'navanegar_pro_quarterly';

export type MarketFlavor = 'web' | 'bazaar' | 'myket';

export type BillingStatus =
  | 'purchased'
  | 'restored'
  | 'cancelled'
  | 'expired'
  | 'not_owned'
  | 'offline_unverified'
  | 'error';

export interface BillingEntitlement {
  isPro: boolean;
  productId: BillingProductId | null;
  market: MarketFlavor;
  purchasedAt: number | null;
  expiresAt: number | null;
  status: BillingStatus;
  verifiedByNative: boolean;
  webPreviewMode: boolean;
  messageFa: string;
}
