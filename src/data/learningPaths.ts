import type { UserLearningState } from '../types/music';

export interface LearningPathStep {
  id: string;
  dayRangeFa: string;
  titleFa: string;
  goalFa: string;
  systemId: string;
  gushehId: string;
  recommendedBpm: number;
  targetAccuracy: number;
  practiceTipFa: string;
}

export interface GuidedLearningPath {
  id: string;
  titleFa: string;
  subtitleFa: string;
  levelBadgeFa: string;
  durationFa: string;
  isPro: boolean;
  accentColor: string;
  steps: LearningPathStep[];
}

export const GUIDED_LEARNING_PATHS: GuidedLearningPath[] = [
  {
    id: 'path_shur_30d',
    titleFa: 'مسیر ۳۰ روزه تسلط بر دستگاه شور',
    subtitleFa: 'مادر دستگاه‌های موسیقی ایرانی — از شناخت دقیق می کُرُن و درآمد تا شهناز و فرود',
    levelBadgeFa: 'مقدماتی تا متوسط • رایگان',
    durationFa: '۳۰ روز (۶ ایستگاه)',
    isPro: false,
    accentColor: '#c8a96e',
    steps: [
      {
        id: 'shur_step_1',
        dayRangeFa: 'روز ۱ تا ۵',
        titleFa: 'درآمد اول شور و تثبیت می کُرُن',
        goalFa: 'تثبیت گوش بر فاصله دوم خنثی (ر — می کُرُن — فا) با خطای کمتر از ۱۸ سنت',
        systemId: 'shur',
        gushehId: 'shur_daramad_1',
        recommendedBpm: 62,
        targetAccuracy: 78,
        practiceTipFa: 'از واکوک (Drone) روی نت ر استفاده کنید و می کُرُن را کمی ملایم‌تر از نیم‌پرده اجرا نمایید.',
      },
      {
        id: 'shur_step_2',
        dayRangeFa: 'روز ۶ تا ۱۰',
        titleFa: 'درآمد دوم و حرکت به شاهد سُل',
        goalFa: 'تسلط بر نوسان ملودیک بین شاهد ر و ایست موقت سُل با ریتم آزاد آوازی',
        systemId: 'shur',
        gushehId: 'shur_daramad_2',
        recommendedBpm: 66,
        targetAccuracy: 80,
        practiceTipFa: 'حالت صبر تا کوک دقیق (Wait Mode) را روشن کنید تا هر نت کاملاً در جای خود بنشیند.',
      },
      {
        id: 'shur_step_3',
        dayRangeFa: 'روز ۱۱ تا ۱۵',
        titleFa: 'کرشمه شور و پیوند با وزن عروضی',
        goalFa: 'اجرای الگوی ضرب‌آهنگین کرشمه (فعلاتن مفاعلن فعلن) با مضراب‌گذاری منظم',
        systemId: 'shur',
        gushehId: 'shur_kereshmeh',
        recommendedBpm: 76,
        targetAccuracy: 82,
        practiceTipFa: 'تمبک کرشمه ۶/۸ را روی سرعت ۷۶ فعال کرده و همراه شعر حافظ هجاها را بسنجید.',
      },
      {
        id: 'shur_step_4',
        dayRangeFa: 'روز ۱۶ تا ۲۰',
        titleFa: 'گوشه سلمک و آماده‌سازی اوج',
        goalFa: 'گسترش دامنه به اکتاو بالاتر و اجرای تحریرهای کوتاه و شفاف روی سُل و لا بمل',
        systemId: 'shur',
        gushehId: 'shur_salmak',
        recommendedBpm: 72,
        targetAccuracy: 83,
        practiceTipFa: 'در آزمایشگاه نفس و تحریر، نرخ تحریر خود را در بازه ۵.۵ تا ۶.۸ هرتز تثبیت کنید.',
      },
      {
        id: 'shur_step_5',
        dayRangeFa: 'روز ۲۱ تا ۲۵',
        titleFa: 'گوشه شهناز (اوج باشکوه شور)',
        goalFa: 'تمرکز بر نت شاهد سُل در اوج و حفظ تعادل دینامیکی در جملات کشیده',
        systemId: 'shur',
        gushehId: 'shur_shahnaz',
        recommendedBpm: 70,
        targetAccuracy: 85,
        practiceTipFa: 'از ضبط قبل/بعد استفاده کنید و نمودار هم‌پوشانی خط کوک خود را با خط استاد مقایسه نمایید.',
      },
      {
        id: 'shur_step_6',
        dayRangeFa: 'روز ۲۶ تا ۳۰',
        titleFa: 'فرود کامل شور و جمع‌بندی نهایی',
        goalFa: 'بازگشت اصیل و آرام از اوج به نت ایست ر با حس پایان‌پذیری ردیف قدما',
        systemId: 'shur',
        gushehId: 'shur_foroud_shur',
        recommendedBpm: 64,
        targetAccuracy: 86,
        practiceTipFa: 'در روز پایانی، حالت بدون دست (Hands-Free) را فعال کنید و کل توالی شور را پیوسته بنوازید.',
      },
    ],
  },
  {
    id: 'path_mahur_abuata_30d',
    titleFa: 'مسیر ۳۰ روزه ابوعطا و شکوه دستگاه ماهور',
    subtitleFa: 'شناخت دقیق حجاز، مدولاسیون به دلکش و مقایسه گام‌های شاد و تغزلی ردیف',
    levelBadgeFa: 'متوسط • رایگان',
    durationFa: '۳۰ روز (۶ ایستگاه)',
    isPro: false,
    accentColor: '#38bdf8',
    steps: [
      {
        id: 'ma_step_1',
        dayRangeFa: 'روز ۱ تا ۵',
        titleFa: 'درآمد ابوعطا (درجه چهارم شور)',
        goalFa: 'درک جایگاه سُل به‌عنوان شاهد ابوعطا و بازگشت لطیف به ایست ر',
        systemId: 'abuata',
        gushehId: 'abuata_daramad_abuata',
        recommendedBpm: 66,
        targetAccuracy: 80,
        practiceTipFa: 'درجه سوم و چهارم گام را با دقت زیر و بم بررسی کنید تا هویت ابوعطا از شور متمایز شود.',
      },
      {
        id: 'ma_step_2',
        dayRangeFa: 'روز ۶ تا ۱۰',
        titleFa: 'گوشه حجاز و اوج عاطفی ابوعطا',
        goalFa: 'تمرکز روی نت لا و تحریرهای پرفراز در گوشه شاخص حجاز',
        systemId: 'abuata',
        gushehId: 'abuata_hejaz',
        recommendedBpm: 68,
        targetAccuracy: 82,
        practiceTipFa: 'مقایسه روایت میرزاعبدالله و دوامی در پنل «مقایسه روایت‌های ردیف» را گوش دهید.',
      },
      {
        id: 'ma_step_3',
        dayRangeFa: 'روز ۱۱ تا ۱۵',
        titleFa: 'فرود ابوعطا به شور',
        goalFa: 'فرود نرم و بدون شکست ریتمیک از حجاز به پایه ر',
        systemId: 'abuata',
        gushehId: 'abuata_foroud_abuata',
        recommendedBpm: 64,
        targetAccuracy: 82,
        practiceTipFa: 'نت پایان را دست‌کم ۴ ثانیه با ثبات داینامیکی بالای ۸۰٪ نگه دارید.',
      },
      {
        id: 'ma_step_4',
        dayRangeFa: 'روز ۱۶ تا ۲۰',
        titleFa: 'درآمد ماهور (شکوه و درخشش)',
        goalFa: 'اجرای دقیق فواصل بزرگ (شبیه ماژور) با جمله‌بندی و ریزهای ایرانی',
        systemId: 'mahur',
        gushehId: 'mahur_daramad_mahur',
        recommendedBpm: 76,
        targetAccuracy: 84,
        practiceTipFa: 'اگر ساز شما تار یا سنتور است، علائم مضراب راست/چپ را روی خط حامل روشن کنید.',
      },
      {
        id: 'ma_step_5',
        dayRangeFa: 'روز ۲۱ تا ۲۵',
        titleFa: 'گوشه دلکش (پل مدولاسیون به شور)',
        goalFa: 'تغییر ظریف نت لا بکار به لا کُرُن و ایجاد فضای اسرارآمیز دلکش',
        systemId: 'mahur',
        gushehId: 'mahur_delkash',
        recommendedBpm: 70,
        targetAccuracy: 85,
        practiceTipFa: 'تغییر لا بکار به لا کُرُن قلب مدولاسیون دلکش است؛ حتماً در ویرایشگر کوک A/B بشنوید.',
      },
      {
        id: 'ma_step_6',
        dayRangeFa: 'روز ۲۶ تا ۳۰',
        titleFa: 'فرود باشکوه ماهور',
        goalFa: 'بازگشت مقتدرانه از فضای دلکش به نت پایه دو ماهور',
        systemId: 'mahur',
        gushehId: 'mahur_foroud_mahur',
        recommendedBpm: 72,
        targetAccuracy: 86,
        practiceTipFa: 'خروجی MusicXML یا گزارش PDF خود را برای ارزیابی استاد ذخیره کنید.',
      },
    ],
  },
  {
    id: 'path_mastery_30d',
    titleFa: 'مسیر ۳۰ روزه ردیف پیشرفته (همایون، اصفهان و سه‌گاه)',
    subtitleFa: 'ویژه هنرجویان پیشرفته و نسخه پرو: ربع‌پرده‌های ظریف سه‌گاه، بیداد و مرکب‌خوانی',
    levelBadgeFa: 'پیشرفته • نسخه پرو',
    durationFa: '۳۰ روز (۶ ایستگاه)',
    isPro: true,
    accentColor: '#a855f7',
    steps: [
      {
        id: 'adv_step_1',
        dayRangeFa: 'روز ۱ تا ۵',
        titleFa: 'درآمد همایون و فاصله دوم افزوده',
        goalFa: 'تسلط کامل بر فاصله مشخصه همایون (لا کُرُن به سی بکار) بدون فالش شدن',
        systemId: 'homayun',
        gushehId: 'homayun_daramad_homayun',
        recommendedBpm: 66,
        targetAccuracy: 84,
        practiceTipFa: 'کوک مکتب اصفهان یا فرهت را در ویرایشگر کوک امتحان کنید و تفاوت حس همایون را بسنجید.',
      },
      {
        id: 'adv_step_2',
        dayRangeFa: 'روز ۶ تا ۱۰',
        titleFa: 'گوشه بیداد همایون',
        goalFa: 'انتقال شاهد به درجه پنجم (ر) و اجرای تحریرهای پراحساس بیداد',
        systemId: 'homayun',
        gushehId: 'homayun_bidad',
        recommendedBpm: 68,
        targetAccuracy: 85,
        practiceTipFa: 'نفس‌گیری را پیش از اوج جمله بیداد تنظیم کنید تا کشش نت شاهد بی‌لرزش باشد.',
      },
      {
        id: 'adv_step_3',
        dayRangeFa: 'روز ۱۱ تا ۱۵',
        titleFa: 'درآمد بیات اصفهان (شعر و تغزل)',
        goalFa: 'ایست و شاهد بر دو با رنگ شاعرانه سی بکار و لا کُرُن',
        systemId: 'bayat_esfahan',
        gushehId: 'bayat_esfahan_daramad_esfahan',
        recommendedBpm: 72,
        targetAccuracy: 85,
        practiceTipFa: 'تصنیف‌خانه را باز کرده و تصنیف اصفهان را همراه تمبک ۶/۸ اجرا کنید.',
      },
      {
        id: 'adv_step_4',
        dayRangeFa: 'روز ۱۶ تا ۲۰',
        titleFa: 'درآمد سه‌گاه (استقرار روی می کُرُن)',
        goalFa: 'تثبیت شنیداری نت شاهد و ایست روی درجه ربع‌پرده (می کُرُن)',
        systemId: 'segah',
        gushehId: 'segah_daramad_segah',
        recommendedBpm: 66,
        targetAccuracy: 86,
        practiceTipFa: 'واکوک می کُرُن را روشن کنید؛ سه‌گاه بهترین محک برای گوش ربع‌پرده‌ای شماست.',
      },
      {
        id: 'adv_step_5',
        dayRangeFa: 'روز ۲۱ تا ۲۵',
        titleFa: 'گوشه زابل سه‌گاه',
        goalFa: 'تأکید بر درجه سوم سه‌گاه (سُل) و انتقال پیوسته به مویه و مخالف',
        systemId: 'segah',
        gushehId: 'segah_zabol',
        recommendedBpm: 68,
        targetAccuracy: 86,
        practiceTipFa: 'در حالت آزمایشگاه گوش ربع‌پرده‌ای، سطح پیشرفته را تمرین کنید تا دقت زیر ۱۰ سنت برسد.',
      },
      {
        id: 'adv_step_6',
        dayRangeFa: 'روز ۲۶ تا ۳۰',
        titleFa: 'مخالف سه‌گاه و فرود مرکب',
        goalFa: 'اجرای اوج شکوهمند مخالف روی دو و فرود استادانه به می کُرُن',
        systemId: 'segah',
        gushehId: 'segah_mokhalef',
        recommendedBpm: 66,
        targetAccuracy: 88,
        practiceTipFa: 'ضبط نهایی خود را با خط مرجع استاد هم‌پوشانی کرده و به عنوان دستاورد ۳۰ روزه ذخیره کنید.',
      },
    ],
  },
];

export function evaluateLearningPathProgress(
  path: GuidedLearningPath,
  userState: UserLearningState
): {
  completedStepIds: Set<string>;
  completedCount: number;
  totalCount: number;
  percent: number;
  nextStep: LearningPathStep | null;
} {
  const manualCompleted = new Set(userState.completedPathStepIds ?? []);
  const completedStepIds = new Set<string>();

  for (const step of path.steps) {
    // Auto-complete if the student achieved the target accuracy on this gusheh OR manually checked it off!
    const achievedBySession = userState.sessions.some(
      (s) => s.gushehId === step.gushehId && s.accuracyPercent >= step.targetAccuracy
    );
    if (achievedBySession || manualCompleted.has(step.id)) {
      completedStepIds.add(step.id);
    }
  }

  const totalCount = path.steps.length;
  const completedCount = completedStepIds.size;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const nextStep = path.steps.find((st) => !completedStepIds.has(st.id)) ?? null;

  return {
    completedStepIds,
    completedCount,
    totalCount,
    percent,
    nextStep,
  };
}
