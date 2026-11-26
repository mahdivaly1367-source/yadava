import type { Gusheh, RadifTraditionId } from '../types/music';

export interface RadifTraditionInfo {
  id: RadifTraditionId;
  nameFa: string;
  shortNameFa: string;
  masterFa: string;
  categoryFa: 'ردیف سازی' | 'ردیف آوازی' | 'ردیف سازی (ویولن/سنتور)';
  eraFa: string;
  characterFa: string;
  foroudStyleFa: string;
  ornamentFocusFa: string;
  tempoFactor: number;
}

export const RADIF_TRADITIONS: RadifTraditionInfo[] = [
  {
    id: 'mirza_abdollah',
    nameFa: 'ردیف سازی میرزاعبدالله',
    shortNameFa: 'میرزاعبدالله',
    masterFa: 'استاد میرزاعبدالله فراهانی (روایت برومند / طلایی)',
    categoryFa: 'ردیف سازی',
    eraFa: 'بنیاد کلاسیک تار و سه‌تار',
    characterFa: 'ساختار دقیق مضرابی، تفکیک شفاف درآمدها و گوشه‌های کوتاه و تکیه بر جمله‌بندی ریتمیک سازی.',
    foroudStyleFa: 'فرود کوتاه، قاطع و مضراب‌محور با تأکید روی ریز و دراب روی نت ایست.',
    ornamentFocusFa: 'دراب، ریز، شلال و تک‌مضراب‌های دقیق روی پرده‌های کُرُن.',
    tempoFactor: 1.0,
  },
  {
    id: 'mahmoud_karimi',
    nameFa: 'ردیف آوازی محمود کریمی',
    shortNameFa: 'محمود کریمی',
    masterFa: 'استاد محمود کریمی (آوانگاری محمدتقی مسعودیه)',
    categoryFa: 'ردیف آوازی',
    eraFa: 'مرجع استاندارد آواز ایرانی',
    characterFa: 'آزادی ریتمیک بالا (آوازی)، پیوند عمیق با بحور عروضی غزل و پرورش تحریرهای متراکم در اوج.',
    foroudStyleFa: 'فرود کشیده با تحریرهای پلکانی نزولی و مکث تنفسی روی شاهد پیش از استقرار.',
    ornamentFocusFa: 'تحریرهای ۶ هرتزی، غلت آوازی، اشاره نرم و مالش بین درجات.',
    tempoFactor: 0.86,
  },
  {
    id: 'saba',
    nameFa: 'ردیف ابوالحسن صبا',
    shortNameFa: 'ابوالحسن صبا',
    masterFa: 'استاد ابوالحسن صبا (ردیف سنتور، ویولن و سه‌تار)',
    categoryFa: 'ردیف سازی (ویولن/سنتور)',
    eraFa: 'مکتب نوین آموزشی و ضربی',
    characterFa: 'پرورش جمله‌های روان، الحاق چهارمضراب‌ها و ضربی‌های تعلیمی و استفاده از آرشه‌کشی و مالش‌های لطیف.',
    foroudStyleFa: 'فرود تغزلی با آرپژهای کوتاه سنتور یا ویبراتوی کنترل‌شده ویولن و کمانچه.',
    ornamentFocusFa: 'چهارمضراب‌های زینتی، اشاره، تکیه سریع و دوراب‌های روان.',
    tempoFactor: 1.06,
  },
  {
    id: 'davami',
    nameFa: 'ردیف آوازی عبدالله دوامی',
    shortNameFa: 'عبدالله دوامی',
    masterFa: 'استاد عبدالله دوامی (مکتب قدمای آواز و تصنیف)',
    categoryFa: 'ردیف آوازی',
    eraFa: 'اصالت قدما و پیوند آواز با تصنیف',
    characterFa: 'تحریرهای چکشی و منسجم، جمله‌های موجز و بسیار استوار در کوک سنتی کُرُن (-۵۶ سنت).',
    foroudStyleFa: 'فرود مقتدر، بی‌حاشیه و کلاسیک با استقرار دقیق روی ایست اصلی دستگاه.',
    ornamentFocusFa: 'تحریر چکشی، تکیه‌های پرقدرت و ادای دقیق هجاهای کشیده شعر.',
    tempoFactor: 0.92,
  },
];

export const TRADITION_BY_ID: Record<RadifTraditionId, RadifTraditionInfo> = Object.fromEntries(
  RADIF_TRADITIONS.map((t) => [t.id, t])
) as Record<RadifTraditionId, RadifTraditionInfo>;

export interface GushehTraditionNote {
  traditionId: RadifTraditionId;
  phrasingFa: string;
  moteghayerNoteFa: string;
  foroudCueFa: string;
  recommendedKoronFa: string;
}

const DASTGAH_TRADITION_NUANCES: Record<string, Record<RadifTraditionId, string>> = {
  shur: {
    mirza_abdollah: 'تأکید بر چهار درآمد متمایز، سلمک شفاف و شهناز با ربع‌پرده دقیق می کُرُن.',
    mahmoud_karimi: 'درآمد اول با شعر تغزلی و تحریرهای گسترده در شهناز و رضوی اجرا می‌شود.',
    saba: 'افزودن ضربی‌ها و حرکت‌های پلکانی روان از درآمد به سلمک و حسینی.',
    davami: 'کُرُن درجه دوم (لا کُرُن) اندکی بم‌تر (-۵۶¢) و با شکوه آوازی قدما خوانده می‌شود.',
  },
  mahur: {
    mirza_abdollah: 'ترتیب مفصل از درآمد تا داد، خاوران، دلکش (مدولاسیون شور) و راک‌های سه‌گانه.',
    mahmoud_karimi: 'تمرکز ویژه بر تغییر حال‌وهوا در دلکش و شکسته با تحریرهای اوج.',
    saba: 'ترکیب کرشمه، چهارمضراب ماهور و انتقال شفاف به شکسته.',
    davami: 'جمله‌بندی حماسی‌تر در خاوران و عراق با تحریرهای چکشی کوتاه.',
  },
  homayun: {
    mirza_abdollah: 'برجسته‌سازی فاصله دوم افزوده (لا کُرُن به سی بکار) در درآمد، چکاوک و بیداد.',
    mahmoud_karimi: 'پویایی آوازی بالا در بیداد و عشاق با فرودهای کشیده به مایه همایون.',
    saba: 'استفاده از تکیه‌ها و مضراب‌های دراب در شوشتری و منصوری برای بیان سوزناک.',
    davami: 'اجرای سنجیده و کم‌تکلف بیداد و بختیاری با تأکید بر وضوح شعر.',
  },
  segah: {
    mirza_abdollah: 'مرکزیت کامل روی می کُرُن در درآمد، زابل، مویه و مخالف با فرود استاندارد.',
    mahmoud_karimi: 'تأکید آوازی روی حس اندوهگین مویه و اوج پرکشش مخالف و مغلوب.',
    saba: 'تلفیق ریتمیک پیش‌درآمد و رنگ سه‌گاه همراه با جملات روان زابل.',
    davami: 'استقرار دقیق می کُرُن سنتی (-۵۶¢) بدون لغزش به می بمل در فرود مخالف.',
  },
  chahargah: {
    mirza_abdollah: 'روند حماسی از درآمد و زابل به حصار، مخالف و منصوری با مضراب‌های پرقدرت.',
    mahmoud_karimi: 'پرورش تحریرهای پرصلابت در حصار و مغلوب با دامنه صدایی وسیع.',
    saba: 'چهارمضراب‌های درخشان و جمله‌بندی روشن زنگوله و بسته، مناسب تمرین تکنیک.',
    davami: 'ریتم درونی منظم‌تر در حدی و پهلوی با تکیه بر حماسه شعر.',
  },
};

export function getGushehTraditionComparison(gusheh: Gusheh): GushehTraditionNote[] {
  const dastgahSpecific = DASTGAH_TRADITION_NUANCES[gusheh.dastgahId];

  return RADIF_TRADITIONS.map((trad) => {
    const baseNuance =
      dastgahSpecific?.[trad.id] ??
      `در ${trad.nameFa}، گوشه «${gusheh.nameFa}» با تکیه بر ${trad.ornamentFocusFa}`;

    const roleHint =
      gusheh.role === 'daramad'
        ? 'معرفی مایه با مکث‌های سنجیده روی شاهد'
        : gusheh.role === 'owj'
        ? 'گسترش در منطقه اوج با مدیریت نفس و انرژی'
        : gusheh.role === 'foroud'
        ? 'بازگشت تدریجی به ایست و تثبیت کامل دستگاه'
        : gusheh.role === 'zarbi'
        ? 'حفظ ضرب‌آهنگ دقیق و تاکید روی ضرب‌های قوی'
        : 'بسط ملودیک میانی و آماده‌سازی برای اوج یا مدولاسیون';

    return {
      traditionId: trad.id,
      phrasingFa: `${baseNuance} (${roleHint}).`,
      moteghayerNoteFa: gusheh.moteghayer
        ? trad.id === 'mirza_abdollah' || trad.id === 'saba'
          ? 'نت متغیر با اشاره و مضراب شفاف در رفت و برگشت تغییر می‌کند.'
          : 'نت متغیر در آواز با لغزش نرم حنجره و تحریر در برگشت به مایه فرود می‌آید.'
        : 'در این گوشه ساختار درجات پایدار است و تمرکز بر تثبیت نت شاهد می‌باشد.',
      foroudCueFa: trad.foroudStyleFa,
      recommendedKoronFa:
        trad.id === 'davami' || trad.id === 'mahmoud_karimi'
          ? 'پیشنهاد این روایت: کُرُن سنتی (-۵۶¢)'
          : 'پیشنهاد این روایت: کُرُن استاندارد (-۵۰¢)',
    };
  });
}
