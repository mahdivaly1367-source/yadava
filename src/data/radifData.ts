import type {
  DastgahSystem,
  Gusheh,
  GushehRole,
  IranianMeter,
  MelodyNote,
  ModulationTarget,
  OrnamentType,
  PersianNoteSpec,
} from '../types/music';

const n = (
  letter: PersianNoteSpec['letter'],
  accidental: PersianNoteSpec['accidental'] = 'natural',
  octave = 4
): PersianNoteSpec => ({ letter, accidental, octave });

interface CompactGushehDef {
  id: string;
  nameFa: string;
  nameEn: string;
  role: GushehRole;
  difficulty: 1 | 2 | 3;
  shahedIdx: number;
  istIdx: number;
  aghazIdx: number;
  moteghayer?: PersianNoteSpec;
  ornaments: OrnamentType[];
  contour: number[]; // indices into scale
  meter?: IranianMeter;
  bpm?: number;
  modulations?: ModulationTarget[];
  descriptionFa: string;
}

function buildGusheh(
  dastgahId: string,
  order: number,
  scale: PersianNoteSpec[],
  def: CompactGushehDef
): Gusheh {
  const pick = (idx: number): PersianNoteSpec => {
    const safeIdx = Math.max(0, Math.min(scale.length - 1, idx));
    return scale[safeIdx];
  };

  const shahed = pick(def.shahedIdx);
  const ist = pick(def.istIdx);
  const aghaz = pick(def.aghazIdx);
  const isZarbi = def.role === 'zarbi';
  const meter: IranianMeter = def.meter ?? (isZarbi ? '6/8' : '4/4');
  const defaultBpm = def.bpm ?? (isZarbi ? 116 : def.role === 'owj' ? 78 : def.role === 'foroud' ? 68 : 74);

  const melody: MelodyNote[] = def.contour.map((degIdx, stepIdx) => {
    const baseNote = pick(degIdx);
    const isLast = stepIdx === def.contour.length - 1;
    const isNearPeak =
      def.role === 'owj' && stepIdx === Math.floor(def.contour.length * 0.55);
    const hasTahrir = def.ornaments.includes('tahrir') && (isNearPeak || stepIdx === def.contour.length - 3);
    const hasOrnament =
      stepIdx === 1 && def.ornaments[0]
        ? def.ornaments[0]
        : hasTahrir
        ? 'tahrir'
        : isZarbi && stepIdx % 3 === 0
        ? 'dorab'
        : stepIdx === def.contour.length - 2 && def.ornaments.includes('tekieh')
        ? 'tekieh'
        : undefined;

    const durationBeats = isLast
      ? 2.0
      : isZarbi
      ? stepIdx % 2 === 0
        ? 0.5
        : 1.0
      : hasTahrir
      ? 1.5
      : stepIdx % 3 === 0
      ? 1.0
      : 0.75;

    return {
      ...baseNote,
      durationBeats,
      ornament: hasOrnament,
      isForoudTarget: isLast || (def.role === 'foroud' && stepIdx >= def.contour.length - 2),
      isTahrirZone: hasTahrir,
    };
  });

  const loopStart = Math.min(1, Math.max(0, melody.length - 4));
  const loopEnd = Math.max(loopStart + 2, melody.length - 1);

  return {
    id: `${dastgahId}_${def.id}`,
    dastgahId,
    order,
    nameFa: def.nameFa,
    nameEn: def.nameEn,
    role: def.role,
    difficulty: def.difficulty,
    shahed,
    ist,
    aghaz,
    moteghayer: def.moteghayer,
    scale,
    ornaments: def.ornaments,
    melody,
    practiceLoop: {
      startIndex: loopStart,
      endIndex: Math.min(melody.length - 1, loopEnd),
      defaultBpm,
      meter,
    },
    modulations: def.modulations ?? [],
    descriptionFa: def.descriptionFa,
  };
}

// =============================================================================
// 1. دستگاه شور (Dastgah-e Shur) — 18 Gushehs [FREE]
// Scale (Shur of G): F4, G4 (shahed/ist), Ak4, Bb4, C5, D5, Eb5, F5, G5
// =============================================================================
const SHUR_SCALE: PersianNoteSpec[] = [
  n('F', 'natural', 4), // 0
  n('G', 'natural', 4), // 1 (پایه / شاهد / ایست)
  n('A', 'koron', 4),   // 2 (دوم کُرُن)
  n('B', 'flat', 4),    // 3
  n('C', 'natural', 5), // 4
  n('D', 'natural', 5), // 5
  n('E', 'flat', 5),    // 6
  n('F', 'natural', 5), // 7
  n('G', 'natural', 5), // 8
];

const SHUR_DEFS: CompactGushehDef[] = [
  { id: 'daramad_1', nameFa: 'درآمد اول شور', nameEn: 'Daramad-e Avval', role: 'daramad', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['eshareh', 'tekieh'], contour: [1, 2, 3, 2, 1, 0, 1, 2, 1], descriptionFa: 'ورود بنیادین دستگاه شور با تأکید بر فاصله ربع‌پرده لا کُرُن و استقرار بر نت سل.' },
  { id: 'daramad_2', nameFa: 'درآمد دوم شور', nameEn: 'Daramad-e Dovvom', role: 'daramad', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 3, ornaments: ['tekieh', 'riz'], contour: [3, 2, 1, 2, 3, 4, 3, 2, 1], descriptionFa: 'گسترش دانگ نخست شور تا نت دو و بازگشت ملایم به شاهد.' },
  { id: 'daramad_khara', nameFa: 'درآمد خارا', nameEn: 'Daramad-e Khara', role: 'daramad', difficulty: 1, shahedIdx: 3, istIdx: 1, aghazIdx: 2, ornaments: ['eshareh', 'tahrir'], contour: [2, 3, 4, 3, 2, 3, 2, 1, 0, 1], descriptionFa: 'درآمد شاعرانه با تکیه لطیف بر سی‌بمل و فرود کلاسیک شور.' },
  { id: 'kereshmeh', nameFa: 'کرشمه شور', nameEn: 'Kereshmeh', role: 'zarbi', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['dorab', 'eshareh'], meter: '6/8', bpm: 108, contour: [1, 2, 3, 2, 1, 2, 3, 4, 3, 2, 1], descriptionFa: 'گوشه ضربی موزون بر وزن عروضی مفاعیلن با مضراب‌های چابک.' },
  { id: 'rahavi', nameFa: 'رهاوی', nameEn: 'Rahavi', role: 'miani', difficulty: 2, shahedIdx: 1, istIdx: 1, aghazIdx: 4, ornaments: ['tekieh', 'tahrir'], contour: [4, 3, 2, 1, 0, 1, 2, 3, 2, 1], descriptionFa: 'گوشه کهن و متفکرانه در محدوده پایین شور با رنگ‌آمیزی فا تا دو.' },
  { id: 'naghmeh', nameFa: 'نغمه', nameEn: 'Naghmeh', role: 'zarbi', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 2, ornaments: ['dorab', 'riz'], meter: '2/4', bpm: 104, contour: [2, 1, 2, 3, 4, 3, 2, 1, 2, 1], descriptionFa: 'قطعه سازی روان و پرنشاط برای تمرین مضراب‌گیری در شور.' },
  { id: 'owj_shur', nameFa: 'اوج شور', nameEn: 'Owj-e Shur', role: 'owj', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 3, ornaments: ['tahrir', 'tekieh'], contour: [3, 4, 5, 4, 3, 4, 3, 2, 1], descriptionFa: 'عروج نخست به دانگ دوم با شاهد دو و تحریرهای پیوسته.' },
  { id: 'salmak', nameFa: 'سلمک', nameEn: 'Salmak', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 4, moteghayer: n('D', 'koron', 5), ornaments: ['tahrir', 'eshareh'], contour: [4, 5, 4, 3, 4, 5, 4, 3, 2, 1], modulations: [{ targetDastgahId: 'dashti', labelFa: 'پیوند با حال‌وهوای دشتی', alteredNoteFa: 'ر کُرُن / می بمل' }], descriptionFa: 'گوشه کلیدی با تغییر رنگ در درجه پنجم و گذار نرم به فضای دشتی.' },
  { id: 'golriz', nameFa: 'گلریز', nameEn: 'Golriz', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 5, ornaments: ['riz', 'tekieh'], contour: [5, 4, 3, 4, 5, 6, 5, 4, 3, 2, 1], descriptionFa: 'گوشه ریزنقش و مزین با چرخش‌های پیاپی پیرامون دو و ر.' },
  { id: 'bozorg', nameFa: 'بزرگ', nameEn: 'Bozorg', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 4, ornaments: ['tahrir', 'tekieh'], contour: [4, 5, 6, 5, 4, 3, 4, 2, 1], descriptionFa: 'گوشه باوقار و گسترده با جمله‌بندی کشیده در میانه دستگاه.' },
  { id: 'dobeyti', nameFa: 'دوبیتی', nameEn: 'Dobeyti', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 3, ornaments: ['eshareh', 'tahrir'], contour: [3, 4, 5, 4, 3, 2, 3, 2, 1], descriptionFa: 'گوشه آوازی متناسب با دوبیتی‌های محلی و عاشقانه ایرانی.' },
  { id: 'hoseini', nameFa: 'حسینی', nameEn: 'Hoseini', role: 'owj', difficulty: 3, shahedIdx: 5, istIdx: 1, aghazIdx: 4, ornaments: ['tahrir', 'riz'], contour: [4, 5, 6, 7, 6, 5, 4, 3, 2, 1], modulations: [{ targetDastgahId: 'nava', labelFa: 'مدولاسیون به نوا', alteredNoteFa: 'شاهد ر و ایست سل' }], descriptionFa: 'از باشکوه‌ترین گوشه‌های اوج شور با اوج‌گیری تا فا و بازگشت پرهیجان.' },
  { id: 'shahnaz', nameFa: 'شهناز', nameEn: 'Shahnaz', role: 'owj', difficulty: 3, shahedIdx: 4, istIdx: 1, aghazIdx: 4, moteghayer: n('B', 'natural', 4), ornaments: ['tahrir', 'tekieh'], contour: [4, 5, 6, 5, 4, 5, 4, 3, 2, 1], modulations: [{ targetDastgahId: 'abuata', labelFa: 'گذر به حجاز ابوعطا', alteredNoteFa: 'سی بکار / ر شاهد' }], descriptionFa: 'مُد درخشان دانگ دوم شور با جذابیت آوازی بالا و پیوند با حجاز.' },
  { id: 'gharcheh', nameFa: 'قرچه', nameEn: 'Gharcheh', role: 'owj', difficulty: 3, shahedIdx: 5, istIdx: 4, aghazIdx: 5, ornaments: ['tahrir', 'eshareh'], contour: [5, 6, 7, 6, 5, 4, 5, 4], descriptionFa: 'ادامه اوج شهناز با استقرار روی ر و تحریرهای پرتحرک.' },
  { id: 'razavi', nameFa: 'رضوی', nameEn: 'Razavi', role: 'owj', difficulty: 3, shahedIdx: 6, istIdx: 1, aghazIdx: 5, ornaments: ['tahrir', 'riz'], contour: [5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1], descriptionFa: 'اوج عالی شور تا اکتاو بالا (سل۵) با تحریرهای پیچیده آوازی.' },
  { id: 'gereyli', nameFa: 'گریلی', nameEn: 'Gereyli', role: 'zarbi', difficulty: 2, shahedIdx: 1, istIdx: 1, aghazIdx: 3, ornaments: ['dorab', 'riz'], meter: '2/4', bpm: 118, contour: [3, 4, 3, 2, 1, 2, 3, 2, 1, 0, 1], descriptionFa: 'گوشه ضربی فولکلوریک و شاد در انتهای شور پیش از فرود.' },
  { id: 'chaharmezrab_shur', nameFa: 'چهارمضراب شور', nameEn: 'Chaharmezrab-e Shur', role: 'zarbi', difficulty: 2, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 132, contour: [1, 3, 2, 4, 3, 5, 4, 3, 2, 1], descriptionFa: 'چهارمضراب پرانرژی برای تسلط بر چابکی مضراب و واخوان.' },
  { id: 'foroud_shur', nameFa: 'فرود شور', nameEn: 'Foroud-e Shur', role: 'foroud', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 4, ornaments: ['tekieh', 'eshareh'], contour: [4, 3, 2, 1, 0, 1, 2, 1], descriptionFa: 'الگوی کادانس و فرود قطعی دستگاه شور بر نت پایه سل.' },
];

// =============================================================================
// 2. آواز ابوعطا (Avaz-e Abu-Ata) — 9 Gushehs [FREE]
// =============================================================================
const ABUATA_SCALE: PersianNoteSpec[] = [
  n('G', 'natural', 4), // 0 (ایست نهایی شور)
  n('A', 'koron', 4),   // 1 (ایست ابوعطا)
  n('B', 'flat', 4),    // 2
  n('C', 'natural', 5), // 3 (شاهد اصلی ابوعطا)
  n('D', 'natural', 5), // 4 (شاهد حجاز)
  n('E', 'flat', 5),    // 5
  n('F', 'natural', 5), // 6
  n('G', 'natural', 5), // 7
];

const ABUATA_DEFS: CompactGushehDef[] = [
  { id: 'daramad_abuata', nameFa: 'درآمد ابوعطا', nameEn: 'Daramad-e Abu-Ata', role: 'daramad', difficulty: 1, shahedIdx: 3, istIdx: 1, aghazIdx: 1, ornaments: ['eshareh', 'tekieh'], contour: [1, 2, 3, 2, 3, 4, 3, 2, 1], descriptionFa: 'آغاز محزون و پرسوز ابوعطا با شاهد دو و ایست بر لا کُرُن.' },
  { id: 'sayakhi', nameFa: 'سیخی', nameEn: 'Sayakhi', role: 'miani', difficulty: 1, shahedIdx: 3, istIdx: 1, aghazIdx: 2, ornaments: ['tekieh', 'tahrir'], contour: [2, 3, 4, 3, 2, 3, 2, 1], descriptionFa: 'گوشه کوتاه و پرکشش در میانه ابوعطا با تکیه بر سی‌بمل و دو.' },
  { id: 'hejaz', nameFa: 'حجاز', nameEn: 'Hejaz', role: 'owj', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 3, ornaments: ['tahrir', 'riz'], contour: [3, 4, 5, 6, 5, 4, 3, 2, 1], modulations: [{ targetDastgahId: 'shur', labelFa: 'بازگشت به شهناز شور', alteredNoteFa: 'شاهد ر به دو' }], descriptionFa: 'گوشه شاخص و حماسی ابوعطا با اوج‌گیری از ر تا فا و تحریر پرقدرت.' },
  { id: 'chaharbagh', nameFa: 'چهارباغ', nameEn: 'Chaharbagh', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 4, ornaments: ['tahrir', 'eshareh'], contour: [4, 5, 4, 3, 4, 5, 4, 3, 2, 1], descriptionFa: 'تحریرهای متوالی و چرخش ملودیک در محدوده حجاز.' },
  { id: 'baghdadi', nameFa: 'بغدادی', nameEn: 'Baghdadi', role: 'owj', difficulty: 2, shahedIdx: 5, istIdx: 3, aghazIdx: 4, ornaments: ['tahrir', 'tekieh'], contour: [4, 5, 6, 5, 4, 3, 4, 3], descriptionFa: 'اوج فرعی حجاز با رنگ‌آمیزی بر نت می‌بمل.' },
  { id: 'gabriel', nameFa: 'گبری', nameEn: 'Gabri', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 1, aghazIdx: 3, ornaments: ['eshareh', 'riz'], contour: [3, 4, 3, 2, 1, 2, 3, 1], descriptionFa: 'گوشه آرام و باستانی با فرود نرم به لا کُرُن.' },
  { id: 'gam_angiz', nameFa: 'غم‌انگیز', nameEn: 'Gham-Angiz', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 1, aghazIdx: 4, ornaments: ['tahrir', 'tekieh'], contour: [4, 3, 2, 3, 2, 1, 0, 1], descriptionFa: 'جمله عاطفی و کشیده پیش از بازگشت نهایی.' },
  { id: 'chaharmezrab_abuata', nameFa: 'چهارمضراب ابوعطا', nameEn: 'Chaharmezrab-e Abu-Ata', role: 'zarbi', difficulty: 2, shahedIdx: 3, istIdx: 1, aghazIdx: 1, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 120, contour: [1, 3, 2, 4, 3, 5, 4, 3, 2, 1], descriptionFa: 'قطعه ضربی شاخص ابوعطا بر پایه شاهد دو.' },
  { id: 'foroud_abuata', nameFa: 'فرود ابوعطا به شور', nameEn: 'Foroud-e Abu-Ata', role: 'foroud', difficulty: 1, shahedIdx: 1, istIdx: 0, aghazIdx: 3, ornaments: ['tekieh', 'eshareh'], contour: [3, 2, 1, 2, 1, 0], modulations: [{ targetDastgahId: 'shur', labelFa: 'فرود نهایی به پایه شور', alteredNoteFa: 'ایست سل' }], descriptionFa: 'فرود کلاسیک ابوعطا از دو به لا کُرُن و نهایتاً سل شور.' },
];

// =============================================================================
// 3. دستگاه ماهور (Dastgah-e Mahur) — 16 Gushehs [FREE]
// (Free total = 18 + 9 + 16 = 43 Gushehs!)
// =============================================================================
const MAHUR_SCALE: PersianNoteSpec[] = [
  n('C', 'natural', 4), // 0 (پایه / شاهد)
  n('D', 'natural', 4), // 1
  n('E', 'natural', 4), // 2
  n('F', 'natural', 4), // 3
  n('G', 'natural', 4), // 4
  n('A', 'natural', 4), // 5
  n('B', 'natural', 4), // 6
  n('C', 'natural', 5), // 7
  n('D', 'natural', 5), // 8
];

const MAHUR_DEFS: CompactGushehDef[] = [
  { id: 'daramad_mahur', nameFa: 'درآمد ماهور', nameEn: 'Daramad-e Mahur', role: 'daramad', difficulty: 1, shahedIdx: 0, istIdx: 0, aghazIdx: 0, ornaments: ['eshareh', 'tekieh'], contour: [0, 1, 2, 3, 4, 3, 2, 1, 0], descriptionFa: 'درآمد باشکوه و روشن دستگاه ماهور در گام دو بزرگ ایرانی.' },
  { id: 'goshayesh', nameFa: 'گشایش', nameEn: 'Goshayesh', role: 'daramad', difficulty: 1, shahedIdx: 2, istIdx: 0, aghazIdx: 2, ornaments: ['eshareh', 'riz'], contour: [2, 3, 4, 3, 2, 1, 2, 1, 0], descriptionFa: 'گسترش درآمد با درخشش بر درجه سوم (می بکار).' },
  { id: 'dad', nameFa: 'داد', nameEn: 'Dad', role: 'miani', difficulty: 1, shahedIdx: 3, istIdx: 0, aghazIdx: 2, ornaments: ['tekieh', 'tahrir'], contour: [2, 3, 4, 3, 2, 3, 2, 1, 0], descriptionFa: 'گوشه گرم و لطیف با تکیه بر فا و جمله‌بندی متوازن.' },
  { id: 'khosravani', nameFa: 'خسروانی', nameEn: 'Khosravani', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 3, ornaments: ['tahrir', 'tekieh'], contour: [3, 4, 5, 4, 3, 2, 1, 0], descriptionFa: 'گوشه باستانی و فاخر با وقار و گام‌های استوار.' },
  { id: 'delkash', nameFa: 'دلکش', nameEn: 'Delkash', role: 'owj', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 4, moteghayer: n('A', 'koron', 4), ornaments: ['tahrir', 'eshareh'], contour: [4, 5, 6, 5, 4, 3, 4, 2, 1, 0], modulations: [{ targetDastgahId: 'shur', labelFa: 'مدولاسیون مرکب از دلکش به شور', alteredNoteFa: 'لا کُرُن و سی بمل' }], descriptionFa: 'زیباترین گذار مدال ماهور به فضای شور با ورود نت متغیر لا کُرُن.' },
  { id: 'khavaran', nameFa: 'خاوران', nameEn: 'Khavaran', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 4, ornaments: ['riz', 'tekieh'], contour: [4, 5, 4, 3, 4, 5, 3, 2, 0], descriptionFa: 'گوشه روشن در میانه ماهور با تأکید بر پنجم درست.' },
  { id: 'tarab_angiz', nameFa: 'طرب‌انگیز', nameEn: 'Tarab-Angiz', role: 'zarbi', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 2, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 122, contour: [2, 4, 3, 5, 4, 3, 2, 1, 0], descriptionFa: 'گوشه ضربی پرطراوت و ریتمیک در میانه ماهور.' },
  { id: 'shekasteh', nameFa: 'شکسته', nameEn: 'Shekasteh', role: 'owj', difficulty: 3, shahedIdx: 5, istIdx: 0, aghazIdx: 4, moteghayer: n('E', 'koron', 4), ornaments: ['tahrir', 'tekieh'], contour: [4, 5, 6, 7, 6, 5, 4, 3, 2, 0], modulations: [{ targetDastgahId: 'afshari', labelFa: 'پیوند شکسته با افشاری و شور', alteredNoteFa: 'می کُرُن و سی بمل' }], descriptionFa: 'گوشه عاطفی و سرشار از تحریر که ماهور را به رنگ‌آمیزی شور پیوند می‌دهد.' },
  { id: 'aragh', nameFa: 'عراق', nameEn: 'Aragh', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 4, aghazIdx: 5, moteghayer: n('B', 'koron', 4), ornaments: ['tahrir', 'riz'], contour: [5, 6, 7, 8, 7, 6, 5, 4], modulations: [{ targetDastgahId: 'afshari', labelFa: 'گوشه مشترک با افشاری و نوا', alteredNoteFa: 'سی کُرُن در اوج' }], descriptionFa: 'اوج پرشکوه ماهور روی اکتاو بالا با حضور سی کُرُن.' },
  { id: 'neyriz', nameFa: 'نیریز', nameEn: 'Neyriz', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 5, ornaments: ['tekieh', 'tahrir'], contour: [5, 4, 3, 4, 2, 3, 1, 0], descriptionFa: 'گوشه سرکش و آوازی در مسیر بازگشت از اوج عراق.' },
  { id: 'rak', nameFa: 'راک هندی', nameEn: 'Rak-e Hendi', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 4, aghazIdx: 4, ornaments: ['tahrir', 'dorab'], contour: [4, 5, 6, 7, 8, 7, 5, 4], modulations: [{ targetDastgahId: 'rast_panjgah', labelFa: 'پیوند با راست‌پنجگاه', alteredNoteFa: 'شاهد دو بالا' }], descriptionFa: 'گوشه پرصلابت و متأثر از راگاهای کهن با جهش‌های پنجم و اکتاو.' },
  { id: 'rak_kashmir', nameFa: 'راک کشمیر', nameEn: 'Rak-e Kashmir', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 4, aghazIdx: 6, ornaments: ['tahrir', 'riz'], contour: [6, 7, 8, 7, 6, 5, 4, 5, 4], descriptionFa: 'تداوم خانواده راک با تحریرهای بلند و شکوهمند.' },
  { id: 'sufi_nameh', nameFa: 'صوفی‌نامه', nameEn: 'Sufi-Nameh', role: 'zarbi', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 4, ornaments: ['dorab', 'eshareh'], meter: '2/4', bpm: 110, contour: [4, 5, 4, 3, 2, 3, 2, 1, 0], descriptionFa: 'گوشه ضربی عارفانه با ضرب‌آهنگ منظم.' },
  { id: 'saghi_nameh', nameFa: 'ساقی‌نامه', nameEn: 'Saghi-Nameh', role: 'zarbi', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 4, ornaments: ['dorab', 'tekieh'], meter: '2/4', bpm: 106, contour: [4, 4, 5, 4, 3, 2, 1, 2, 0], descriptionFa: 'گوشه حماسی متناسب با مثنوی ساقی‌نامه.' },
  { id: 'reng_shalkhu', nameFa: 'رنگ شلخو (ماهور)', nameEn: 'Reng-e Mahur', role: 'zarbi', difficulty: 2, shahedIdx: 0, istIdx: 0, aghazIdx: 4, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 134, contour: [4, 3, 2, 1, 2, 3, 4, 2, 1, 0], descriptionFa: 'رنگ پرنشاط پایانی دستگاه ماهور در میزان ۶/۸.' },
  { id: 'foroud_mahur', nameFa: 'فرود ماهور', nameEn: 'Foroud-e Mahur', role: 'foroud', difficulty: 1, shahedIdx: 0, istIdx: 0, aghazIdx: 4, ornaments: ['tekieh', 'eshareh'], contour: [4, 3, 2, 1, 2, 1, 0], descriptionFa: 'فرود نهایی و آرامش‌بخش ماهور بر نت پایه دو.' },
];

// =============================================================================
// 4. آواز بیات ترک / زند (Avaz-e Bayat-e Tork) — 11 Gushehs [PRO]
// =============================================================================
const BAYAT_TORK_SCALE: PersianNoteSpec[] = [
  n('G', 'natural', 4), // 0 (شور)
  n('A', 'koron', 4),   // 1
  n('B', 'flat', 4),    // 2 (شاهد اصلی بیات ترک)
  n('C', 'natural', 5), // 3
  n('D', 'natural', 5), // 4
  n('E', 'flat', 5),    // 5
  n('F', 'natural', 5), // 6 (شاهد شکسته / روح‌الارواح)
  n('G', 'natural', 5), // 7
];

const BAYAT_TORK_DEFS: CompactGushehDef[] = [
  { id: 'daramad_tork', nameFa: 'درآمد بیات ترک', nameEn: 'Daramad-e Bayat-e Tork', role: 'daramad', difficulty: 1, shahedIdx: 2, istIdx: 2, aghazIdx: 2, ornaments: ['eshareh', 'tekieh'], contour: [2, 3, 4, 3, 2, 1, 2, 3, 2], descriptionFa: 'درآمد دلنشین بیات زند بر شاهد سی‌بمل.' },
  { id: 'dogah', nameFa: 'دوگاه', nameEn: 'Dogah', role: 'daramad', difficulty: 1, shahedIdx: 2, istIdx: 2, aghazIdx: 1, ornaments: ['eshareh', 'tahrir'], contour: [1, 2, 3, 2, 1, 2, 3, 2], descriptionFa: 'گوشه گرم و صمیمی با شروع از زیر شاهد.' },
  { id: 'ruh_ol_arvah', nameFa: 'روح‌الارواح', nameEn: 'Ruh-ol-Arvah', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 2, aghazIdx: 3, ornaments: ['tahrir', 'tekieh'], contour: [3, 4, 5, 4, 3, 2, 3, 2], descriptionFa: 'گوشه لطیف و عارفانه با حرکت موج‌دار حول ر.' },
  { id: 'jamedaran_tork', nameFa: 'جامه‌دران', nameEn: 'Jamedaran', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 2, aghazIdx: 4, ornaments: ['tahrir', 'riz'], contour: [4, 3, 2, 3, 4, 3, 2, 1, 2], descriptionFa: 'گوشه عاطفی با جهش‌های ملودیک بیانگر.' },
  { id: 'feyli', nameFa: 'فیلی', nameEn: 'Feyli', role: 'owj', difficulty: 2, shahedIdx: 5, istIdx: 2, aghazIdx: 4, ornaments: ['tahrir', 'tekieh'], contour: [4, 5, 6, 5, 4, 3, 2], descriptionFa: 'عروج به می‌بمل و فا با حس‌وحال حماسی و پرکشش.' },
  { id: 'shekasteh_tork', nameFa: 'شکسته بیات ترک', nameEn: 'Shekasteh-ye Tork', role: 'owj', difficulty: 3, shahedIdx: 6, istIdx: 2, aghazIdx: 5, moteghayer: n('E', 'koron', 5), ornaments: ['tahrir', 'eshareh'], contour: [5, 6, 7, 6, 5, 4, 3, 2], modulations: [{ targetDastgahId: 'mahur', labelFa: 'مدولاسیون به شکسته ماهور', alteredNoteFa: 'می کُرُن' }], descriptionFa: 'گوشه شورانگیز شکسته در اوج بیات ترک.' },
  { id: 'ghatar', nameFa: 'قطار', nameEn: 'Ghatar', role: 'owj', difficulty: 2, shahedIdx: 6, istIdx: 2, aghazIdx: 6, ornaments: ['tahrir', 'riz'], contour: [6, 5, 4, 5, 6, 5, 4, 3, 2], descriptionFa: 'گوشه محبوب و پرشور با تحریرهای پی‌درپی.' },
  { id: 'gharaei', nameFa: 'قرایی', nameEn: 'Gharaei', role: 'owj', difficulty: 3, shahedIdx: 6, istIdx: 2, aghazIdx: 5, ornaments: ['tahrir', 'tekieh'], contour: [5, 6, 7, 6, 5, 4, 3, 2], descriptionFa: 'ادامه اوج قطار با حال‌وهوای بومی خراسان و فارس.' },
  { id: 'mehrabani', nameFa: 'مهربانی', nameEn: 'Mehrabani', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 2, aghazIdx: 4, ornaments: ['eshareh', 'tekieh'], contour: [4, 3, 2, 1, 2, 3, 2], descriptionFa: 'گوشه نرم و آرام در مسیر بازگشت.' },
  { id: 'shah_khatayi', nameFa: 'شاه‌ختایی', nameEn: 'Shah-Khatayi', role: 'zarbi', difficulty: 2, shahedIdx: 2, istIdx: 2, aghazIdx: 2, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 114, contour: [2, 3, 4, 3, 2, 3, 4, 2], descriptionFa: 'گوشه ضربی موزون بر وزن شاه‌ختایی.' },
  { id: 'foroud_tork', nameFa: 'فرود بیات ترک', nameEn: 'Foroud-e Tork', role: 'foroud', difficulty: 1, shahedIdx: 2, istIdx: 0, aghazIdx: 4, ornaments: ['tekieh', 'eshareh'], contour: [4, 3, 2, 1, 0, 1, 2], modulations: [{ targetDastgahId: 'shur', labelFa: 'بازگشت به شور', alteredNoteFa: 'ایست سل / سی‌بمل' }], descriptionFa: 'فرود نهایی بر سی‌بمل و پیوند به پایه شور.' },
];

// =============================================================================
// 5. آواز افشاری (Avaz-e Afshari) — 10 Gushehs [PRO]
// =============================================================================
const AFSHARI_SCALE: PersianNoteSpec[] = [
  n('G', 'natural', 4), // 0 (ایست پایین)
  n('A', 'koron', 4),   // 1
  n('B', 'flat', 4),    // 2
  n('C', 'natural', 5), // 3 (شاهد اصلی افشاری)
  n('D', 'natural', 5), // 4 (متغیر ر / ر کُرُن)
  n('E', 'flat', 5),    // 5
  n('F', 'natural', 5), // 6
  n('G', 'natural', 5), // 7
];

const AFSHARI_DEFS: CompactGushehDef[] = [
  { id: 'daramad_afshari', nameFa: 'درآمد افشاری', nameEn: 'Daramad-e Afshari', role: 'daramad', difficulty: 1, shahedIdx: 3, istIdx: 0, aghazIdx: 3, moteghayer: n('D', 'koron', 5), ornaments: ['eshareh', 'tekieh'], contour: [3, 4, 3, 2, 1, 2, 3, 2, 1, 0], descriptionFa: 'درآمد سوزناک افشاری با فرود ممتد از دو به سل.' },
  { id: 'jamedaran_afshari', nameFa: 'جامه‌دران افشاری', nameEn: 'Jamedaran-e Afshari', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 0, aghazIdx: 4, ornaments: ['tahrir', 'tekieh'], contour: [4, 3, 2, 3, 4, 3, 2, 1, 0], descriptionFa: 'گوشه غمناک و پرکشش در فضای افشاری.' },
  { id: 'hesar_afshari', nameFa: 'حصار افشاری', nameEn: 'Hesar-e Afshari', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 3, ornaments: ['tahrir', 'eshareh'], contour: [3, 4, 5, 4, 3, 2, 1, 0], descriptionFa: 'گوشه میانی با تمرکز بر نت ر و گذار به اوج.' },
  { id: 'gharib', nameFa: 'قریب (قرائی)', nameEn: 'Gharib', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 5, ornaments: ['tahrir', 'riz'], contour: [5, 4, 3, 4, 3, 2, 1, 0], descriptionFa: 'گوشه آوازی پرحس‌وحال با تکیه‌های پی‌درپی.' },
  { id: 'aragh_afshari', nameFa: 'عراق افشاری', nameEn: 'Aragh-e Afshari', role: 'owj', difficulty: 3, shahedIdx: 6, istIdx: 0, aghazIdx: 5, moteghayer: n('E', 'koron', 5), ornaments: ['tahrir', 'riz'], contour: [5, 6, 7, 6, 5, 4, 3, 2, 1, 0], modulations: [{ targetDastgahId: 'mahur', labelFa: 'گوشه واسطه با عراق ماهور', alteredNoteFa: 'می کُرُن و فا شاهد' }], descriptionFa: 'اوج شکوهمند افشاری با پل مدال مستقیم به عراق ماهور.' },
  { id: 'nahib', nameFa: 'نهیب', nameEn: 'Nahib', role: 'owj', difficulty: 3, shahedIdx: 6, istIdx: 3, aghazIdx: 6, ornaments: ['tahrir', 'tekieh'], contour: [6, 7, 6, 5, 4, 5, 4, 3], descriptionFa: 'فریاد آوازی در اوج افشاری با تحریرهای بلند.' },
  { id: 'hazin', nameFa: 'حزین', nameEn: 'Hazin', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 5, ornaments: ['eshareh', 'tahrir'], contour: [5, 4, 3, 2, 3, 2, 1, 0], descriptionFa: 'فرود نرم و غم‌آلود از اوج عراق و نهیب.' },
  { id: 'rohab', nameFa: 'رهاب', nameEn: 'Rohab', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 0, aghazIdx: 2, ornaments: ['tekieh', 'riz'], contour: [2, 3, 4, 3, 2, 1, 0], descriptionFa: 'گوشه کهن و تأمل‌برانگیز پیش از بخش ضربی.' },
  { id: 'masnavi_pich', nameFa: 'مثنوی پیچ', nameEn: 'Masnavi-Pich', role: 'zarbi', difficulty: 2, shahedIdx: 3, istIdx: 0, aghazIdx: 3, ornaments: ['tahrir', 'dorab'], meter: '3/4', bpm: 92, contour: [3, 4, 3, 2, 3, 2, 1, 0], descriptionFa: 'اجرای مثنوی معنوی مولانا در قالب موزون و عرفانی افشاری.' },
  { id: 'foroud_afshari', nameFa: 'فرود افشاری', nameEn: 'Foroud-e Afshari', role: 'foroud', difficulty: 1, shahedIdx: 0, istIdx: 0, aghazIdx: 3, ornaments: ['tekieh', 'eshareh'], contour: [3, 2, 1, 0, 1, 0], modulations: [{ targetDastgahId: 'shur', labelFa: 'بازگشت به شور', alteredNoteFa: 'ایست سل' }], descriptionFa: 'فرود پایانی افشاری به نت پایه سل شور.' },
];

// =============================================================================
// 6. آواز دشتی (Avaz-e Dashti) — 11 Gushehs [PRO]
// =============================================================================
const DASHTI_SCALE: PersianNoteSpec[] = [
  n('G', 'natural', 4), // 0 (ایست)
  n('A', 'koron', 4),   // 1
  n('B', 'flat', 4),    // 2
  n('C', 'natural', 5), // 3
  n('D', 'natural', 5), // 4 (شاهد و متغیر دشتی)
  n('E', 'flat', 5),    // 5
  n('F', 'natural', 5), // 6
  n('G', 'natural', 5), // 7
];

const DASHTI_DEFS: CompactGushehDef[] = [
  { id: 'daramad_dashti', nameFa: 'درآمد دشتی', nameEn: 'Daramad-e Dashti', role: 'daramad', difficulty: 1, shahedIdx: 4, istIdx: 0, aghazIdx: 3, moteghayer: n('D', 'koron', 5), ornaments: ['eshareh', 'tekieh'], contour: [3, 4, 5, 4, 3, 2, 1, 0], descriptionFa: 'آغاز چوپانی و عاطفی دشتی با نوسان حساس بر نت ر و می‌بمل.' },
  { id: 'bidakani', nameFa: 'بیدکانی', nameEn: 'Bidakani', role: 'miani', difficulty: 1, shahedIdx: 4, istIdx: 0, aghazIdx: 4, ornaments: ['tekieh', 'tahrir'], contour: [4, 5, 4, 3, 4, 3, 2, 1, 0], descriptionFa: 'گوشه لطیف در ادامه درآمد با حس روستایی و دلنشین.' },
  { id: 'chupani', nameFa: 'چوپانی', nameEn: 'Chupani', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 5, ornaments: ['eshareh', 'tahrir'], contour: [5, 4, 3, 4, 5, 4, 2, 1, 0], descriptionFa: 'ملودی الهام‌گرفته از نوای نی چوپانان در کوهستان‌های ایران.' },
  { id: 'dashtestani', nameFa: 'دشتستانی', nameEn: 'Dashtestani', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 3, ornaments: ['tahrir', 'riz'], contour: [3, 4, 5, 4, 3, 2, 3, 1, 0], descriptionFa: 'رنگ‌آمیزی جنوب ایران (دشتستان) با تحریرهای شکسته.' },
  { id: 'hajiani', nameFa: 'حاجیانی', nameEn: 'Hajiani', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 0, aghazIdx: 4, ornaments: ['tekieh', 'tahrir'], contour: [4, 3, 2, 3, 4, 3, 2, 0], descriptionFa: 'گوشه غم‌انگیز با فرودهای کوتاه و تأثیرگذار.' },
  { id: 'gilaki', nameFa: 'گیلکی', nameEn: 'Gilaki', role: 'zarbi', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 4, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 122, contour: [4, 5, 4, 3, 4, 3, 2, 1, 0], descriptionFa: 'گوشه ضربی پرطراوت برگرفته از موسیقی خطه گیلان.' },
  { id: 'oshagh_dashti', nameFa: 'عشاق دشتی', nameEn: 'Oshagh-e Dashti', role: 'owj', difficulty: 3, shahedIdx: 6, istIdx: 0, aghazIdx: 5, ornaments: ['tahrir', 'riz'], contour: [5, 6, 7, 6, 5, 4, 3, 2, 1, 0], modulations: [{ targetDastgahId: 'nava', labelFa: 'مدولاسیون از عشاق به نوا و همایون', alteredNoteFa: 'شاهد فا / ر' }], descriptionFa: 'اوج پرقدرت دشتی با پل مدال به عشاق نوا و اصفهان.' },
  { id: 'kuch_baghi', nameFa: 'کوچه‌باغی', nameEn: 'Kucheh-Baghi', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 4, ornaments: ['tahrir', 'eshareh'], contour: [4, 5, 4, 3, 2, 3, 2, 1, 0], descriptionFa: 'گوشه خاطره‌انگیز با جملات محاوره‌ای و عاشقانه.' },
  { id: 'gham_angiz_dashti', nameFa: 'غم‌انگیز دشتی', nameEn: 'Gham-Angiz-e Dashti', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 0, aghazIdx: 4, ornaments: ['tahrir', 'tekieh'], contour: [4, 3, 2, 1, 2, 1, 0], descriptionFa: 'بخش سوگوارانه دشتی با تحریرهای عمیق.' },
  { id: 'deylaman', nameFa: 'دیلمان', nameEn: 'Deylaman', role: 'owj', difficulty: 3, shahedIdx: 5, istIdx: 0, aghazIdx: 4, ornaments: ['tahrir', 'eshareh'], contour: [4, 5, 6, 5, 4, 3, 2, 1, 0], descriptionFa: 'آواز سترگ و آزاد دیلمان از شاهکارهای ملودیک گیلان.' },
  { id: 'foroud_dashti', nameFa: 'فرود دشتی', nameEn: 'Foroud-e Dashti', role: 'foroud', difficulty: 1, shahedIdx: 0, istIdx: 0, aghazIdx: 4, ornaments: ['tekieh', 'eshareh'], contour: [4, 3, 2, 1, 0], modulations: [{ targetDastgahId: 'shur', labelFa: 'بازگشت به شور', alteredNoteFa: 'ایست سل' }], descriptionFa: 'فرود نهایی دشتی بر پایه سل شور.' },
];

// =============================================================================
// 7. دستگاه همایون (Dastgah-e Homayun) — 19 Gushehs [PRO]
// Scale (Homayun of G): F4, G4 (ایست), Ak4 (دوم کُرُن), B4 (سوم بزرگ), C5, D5, Eb5, F5, G5
// =============================================================================
const HOMAYUN_SCALE: PersianNoteSpec[] = [
  n('F', 'natural', 4), // 0
  n('G', 'natural', 4), // 1 (شاهد / ایست)
  n('A', 'koron', 4),   // 2 (کُرُن شاخص همایون)
  n('B', 'natural', 4), // 3 (فاصله ۵/۴ پرده با لا کُرُن!)
  n('C', 'natural', 5), // 4
  n('D', 'natural', 5), // 5 (شاهد بیداد)
  n('E', 'flat', 5),    // 6
  n('F', 'natural', 5), // 7
  n('G', 'natural', 5), // 8
];

const HOMAYUN_DEFS: CompactGushehDef[] = [
  { id: 'daramad_homayun', nameFa: 'درآمد اول همایون', nameEn: 'Daramad-e Avval', role: 'daramad', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['eshareh', 'tekieh'], contour: [1, 2, 3, 4, 3, 2, 1, 0, 1], descriptionFa: 'ورود باشکوه همایون با فاصله جادویی لا کُرُن تا سی بکار.' },
  { id: 'daramad_2_homayun', nameFa: 'درآمد دوم همایون', nameEn: 'Daramad-e Dovvom', role: 'daramad', difficulty: 1, shahedIdx: 2, istIdx: 1, aghazIdx: 3, ornaments: ['tekieh', 'riz'], contour: [3, 4, 3, 2, 3, 2, 1, 0, 1], descriptionFa: 'توسعه درآمد همایون با ایست‌های میانی روی لا کُرُن.' },
  { id: 'chakavak', nameFa: 'چکاوک', nameEn: 'Chakavak', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 3, ornaments: ['tahrir', 'eshareh'], contour: [3, 4, 5, 4, 3, 2, 1], descriptionFa: 'گوشه سرشار از لطافت و شادی نهفته بر شاهد دو.' },
  { id: 'tarz', nameFa: 'طرز', nameEn: 'Tarz', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 4, ornaments: ['tahrir', 'tekieh'], contour: [4, 5, 6, 5, 4, 3, 2, 1], descriptionFa: 'جملات کشیده و کلاسیک پیرامون دو و ر.' },
  { id: 'bidad', nameFa: 'بیداد', nameEn: 'Bidad', role: 'owj', difficulty: 2, shahedIdx: 5, istIdx: 1, aghazIdx: 4, ornaments: ['tahrir', 'riz'], contour: [4, 5, 6, 5, 4, 5, 4, 3, 2, 1], modulations: [{ targetDastgahId: 'bayat_esfahan', labelFa: 'گسترش مدال به بیات اصفهان', alteredNoteFa: 'شاهد ر / دو' }], descriptionFa: 'قلب تپنده همایون در اوج با شاهد ر و بیان دراماتیک.' },
  { id: 'ney_davood', nameFa: 'نی‌داوود', nameEn: 'Ney-Davood', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 4, ornaments: ['tekieh', 'tahrir'], contour: [4, 3, 4, 5, 4, 3, 2, 1], descriptionFa: 'گوشه پرشور و پرظرافت در پیوند چکاوک و بیداد.' },
  { id: 'bavi', nameFa: 'باوی', nameEn: 'Bavi', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 3, ornaments: ['eshareh', 'tahrir'], contour: [3, 4, 5, 4, 3, 2, 1], descriptionFa: 'گوشه بومی و عاطفی در میانه همایون.' },
  { id: 'leyli_majnun', nameFa: 'لیلی و مجنون', nameEn: 'Leyli o Majnun', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 4, ornaments: ['tahrir', 'eshareh'], contour: [4, 5, 4, 3, 4, 2, 1], descriptionFa: 'روایت عاشقانه و متأثرکننده با چرخش‌های آوازی.' },
  { id: 'shushtari', nameFa: 'شوشتری', nameEn: 'Shushtari', role: 'owj', difficulty: 3, shahedIdx: 5, istIdx: 1, aghazIdx: 5, moteghayer: n('E', 'koron', 5), ornaments: ['tahrir', 'tekieh'], contour: [5, 6, 7, 6, 5, 4, 3, 2, 1], modulations: [{ targetDastgahId: 'segah', labelFa: 'مدولاسیون شوشتری به رنگ سه‌گاه', alteredNoteFa: 'می کُرُن و شاهد ر' }], descriptionFa: 'مُد سرشناس و سوزناک شوشتری با قدرت بیان فوق‌العاده.' },
  { id: 'mansuri_homayun', nameFa: 'منصوری همایون', nameEn: 'Mansuri-ye Homayun', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 5, aghazIdx: 6, ornaments: ['tahrir', 'riz'], contour: [6, 7, 8, 7, 6, 5, 4, 5], descriptionFa: 'اوج بلند و پرتوان در ادامه شوشتری.' },
  { id: 'bakhtiari', nameFa: 'بختیاری', nameEn: 'Bakhtiari', role: 'miani', difficulty: 2, shahedIdx: 5, istIdx: 1, aghazIdx: 5, ornaments: ['tahrir', 'eshareh'], contour: [5, 6, 5, 4, 3, 2, 1], descriptionFa: 'گوشه حماسی و صمیمی با ریشه در موسیقی زاگرس.' },
  { id: 'moalef', nameFa: 'مؤلف', nameEn: 'Moalef', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 3, ornaments: ['tekieh', 'riz'], contour: [3, 4, 5, 4, 3, 2, 1], descriptionFa: 'گوشه پیونددهنده در نیمه دوم دستگاه همایون.' },
  { id: 'oshagh_homayun', nameFa: 'عشاق همایون', nameEn: 'Oshagh-e Homayun', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 1, aghazIdx: 5, ornaments: ['tahrir', 'riz'], contour: [5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1], modulations: [{ targetDastgahId: 'nava', labelFa: 'گذر به عشاق نوا', alteredNoteFa: 'شاهد فا' }], descriptionFa: 'اوج وسیع و ملکوتی همایون با پیوند مستقیم به نوا.' },
  { id: 'ozal', nameFa: 'عُزّال', nameEn: 'Ozal', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 4, aghazIdx: 6, ornaments: ['tahrir', 'tekieh'], contour: [6, 7, 8, 7, 6, 5, 4], descriptionFa: 'گوشه درخشان در منطقه زیرین همایون.' },
  { id: 'abol_chap', nameFa: 'ابول‌چپ', nameEn: 'Abol-Chap', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 1, aghazIdx: 4, ornaments: ['eshareh', 'tekieh'], contour: [4, 3, 2, 3, 2, 1], descriptionFa: 'گوشه کوتاه و پرظرافت در مسیر فرود.' },
  { id: 'raze_o_niaz', nameFa: 'راز و نیاز', nameEn: 'Raz o Niaz', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 3, ornaments: ['tahrir', 'eshareh'], contour: [3, 4, 3, 2, 3, 2, 1], descriptionFa: 'گوشه لطیف و نجواگونه با حال‌وهوای مناجات.' },
  { id: 'noruz_arab', nameFa: 'نوروز عرب', nameEn: 'Noruz-e Arab', role: 'miani', difficulty: 2, shahedIdx: 5, istIdx: 1, aghazIdx: 4, ornaments: ['tahrir', 'riz'], contour: [4, 5, 6, 5, 4, 3, 2, 1], descriptionFa: 'گوشه تاریخی از خانواده نوروزها در همایون.' },
  { id: 'reng_farah', nameFa: 'رنگ فرح (همایون)', nameEn: 'Reng-e Farah', role: 'zarbi', difficulty: 2, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 128, contour: [1, 2, 3, 4, 5, 4, 3, 2, 1], descriptionFa: 'رنگ معروف و پرشور پایانی دستگاه همایون.' },
  { id: 'foroud_homayun', nameFa: 'فرود همایون', nameEn: 'Foroud-e Homayun', role: 'foroud', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 4, ornaments: ['tekieh', 'eshareh'], contour: [4, 3, 2, 1, 0, 1], descriptionFa: 'فرود شاخص همایون با عبور از سی بکار و لا کُرُن به سل.' },
];

// =============================================================================
// 8. آواز بیات اصفهان (Avaz-e Bayat-e Esfahan) — 11 Gushehs [PRO]
// Scale (Esfahan of C): B3, C4 (شاهد/ایست), D4, Eb4, F4, G4, Ak4, B4, C5
// =============================================================================
const ESFAHAN_SCALE: PersianNoteSpec[] = [
  n('B', 'natural', 3), // 0 (نت محسوس زیر پایه)
  n('C', 'natural', 4), // 1 (شاهد و ایست اصفهان)
  n('D', 'natural', 4), // 2
  n('E', 'flat', 4),    // 3
  n('F', 'natural', 4), // 4
  n('G', 'natural', 4), // 5
  n('A', 'koron', 4),   // 6
  n('B', 'natural', 4), // 7
  n('C', 'natural', 5), // 8
];

const ESFAHAN_DEFS: CompactGushehDef[] = [
  { id: 'daramad_esfahan', nameFa: 'درآمد بیات اصفهان', nameEn: 'Daramad-e Esfahan', role: 'daramad', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['eshareh', 'tekieh'], contour: [1, 2, 3, 2, 1, 0, 1, 2, 1], descriptionFa: 'آغاز لطیف و شاعرانه بیات اصفهان با حساسیت نت سی بکار زیر دو.' },
  { id: 'jamedaran_esfahan', nameFa: 'جامه‌دران اصفهان', nameEn: 'Jamedaran-e Esfahan', role: 'miani', difficulty: 1, shahedIdx: 3, istIdx: 1, aghazIdx: 1, ornaments: ['tekieh', 'tahrir'], contour: [1, 2, 3, 4, 3, 2, 1, 0, 1], descriptionFa: 'گوشه عاطفی با تکیه بر می‌بمل و بازگشت به دو.' },
  { id: 'bayat_raje', nameFa: 'بیات راجع', nameEn: 'Bayat-e Raje', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 1, aghazIdx: 3, ornaments: ['tahrir', 'eshareh'], contour: [3, 4, 5, 4, 3, 2, 3, 1], descriptionFa: 'گوشه شاخص و تغزلی بیات اصفهان با شاهد می‌بمل.' },
  { id: 'oshagh_esfahan', nameFa: 'عشاق اصفهان', nameEn: 'Oshagh-e Esfahan', role: 'owj', difficulty: 3, shahedIdx: 5, istIdx: 1, aghazIdx: 4, ornaments: ['tahrir', 'riz'], contour: [4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1], modulations: [{ targetDastgahId: 'homayun', labelFa: 'پیوند مستقیم به اوج همایون', alteredNoteFa: 'لا کُرُن و سی بکار' }], descriptionFa: 'اوج باشکوه بیات اصفهان با تسلط بر دانگ دوم و تحریرهای کشیده.' },
  { id: 'shah_khatayi_esfahan', nameFa: 'شاه‌ختایی اصفهان', nameEn: 'Shah-Khatayi-ye Esfahan', role: 'miani', difficulty: 2, shahedIdx: 5, istIdx: 1, aghazIdx: 5, ornaments: ['tahrir', 'tekieh'], contour: [5, 6, 5, 4, 3, 2, 1], descriptionFa: 'گوشه وقارمند در ادامه عشاق.' },
  { id: 'suzo_godaz', nameFa: 'سوز و گداز', nameEn: 'Suz o Godaz', role: 'owj', difficulty: 2, shahedIdx: 5, istIdx: 1, aghazIdx: 4, ornaments: ['tahrir', 'eshareh'], contour: [4, 5, 6, 5, 4, 3, 2, 1], descriptionFa: 'گوشه پرعاطفه و شورانگیز با کشش‌های آوازی.' },
  { id: 'naghmeh_esfahan', nameFa: 'نغمه اصفهان', nameEn: 'Naghmeh-ye Esfahan', role: 'zarbi', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['dorab', 'riz'], meter: '2/4', bpm: 108, contour: [1, 2, 3, 4, 3, 2, 1, 0, 1], descriptionFa: 'قطعه سازی دلپذیر برای تمرین مضراب و آرشه در اصفهان.' },
  { id: 'sufi_nameh_esfahan', nameFa: 'صوفی‌نامه اصفهان', nameEn: 'Sufi-Nameh-ye Esfahan', role: 'zarbi', difficulty: 2, shahedIdx: 3, istIdx: 1, aghazIdx: 3, ornaments: ['dorab', 'tekieh'], meter: '6/8', bpm: 112, contour: [3, 4, 5, 4, 3, 2, 1], descriptionFa: 'قطعه ضربی عرفانی و لطیف.' },
  { id: 'kereshmeh_esfahan', nameFa: 'کرشمه اصفهان', nameEn: 'Kereshmeh-ye Esfahan', role: 'zarbi', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['dorab', 'eshareh'], meter: '6/8', bpm: 110, contour: [1, 2, 3, 2, 1, 2, 3, 1], descriptionFa: 'کرشمه کلاسیک در حال‌وهوای شیرین بیات اصفهان.' },
  { id: 'reng_esfahan', nameFa: 'رنگ بیات اصفهان', nameEn: 'Reng-e Esfahan', role: 'zarbi', difficulty: 2, shahedIdx: 1, istIdx: 1, aghazIdx: 3, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 126, contour: [3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1], descriptionFa: 'رنگ شاد و رقصان پایانی در میزان ۶/۸.' },
  { id: 'foroud_esfahan', nameFa: 'فرود بیات اصفهان', nameEn: 'Foroud-e Esfahan', role: 'foroud', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 4, ornaments: ['tekieh', 'eshareh'], contour: [4, 3, 2, 1, 0, 1], modulations: [{ targetDastgahId: 'homayun', labelFa: 'بازگشت به همایون', alteredNoteFa: 'ایست دو / سل' }], descriptionFa: 'فرود ماندگار اصفهان با اشاره سی بکار به دو.' },
];

// =============================================================================
// 9. دستگاه سه‌گاه (Dastgah-e Segah) — 14 Gushehs [PRO]
// Scale (Segah of Ek): D4, Ek4 (شاهد/ایست), F4, G4, Ak4, Bb4, C5, D5, Ek5
// =============================================================================
const SEGAH_SCALE: PersianNoteSpec[] = [
  n('D', 'natural', 4), // 0
  n('E', 'koron', 4),   // 1 (شاهد / ایست سه‌گاه)
  n('F', 'natural', 4), // 2
  n('G', 'natural', 4), // 3 (شاهد زابل)
  n('A', 'koron', 4),   // 4 (شاهد مویه)
  n('B', 'flat', 4),    // 5
  n('C', 'natural', 5), // 6 (شاهد مخالف)
  n('D', 'natural', 5), // 7
  n('E', 'koron', 5),   // 8
];

const SEGAH_DEFS: CompactGushehDef[] = [
  { id: 'daramad_segah', nameFa: 'درآمد سه‌گاه', nameEn: 'Daramad-e Segah', role: 'daramad', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['eshareh', 'tekieh'], contour: [1, 2, 3, 2, 1, 0, 1, 2, 1], descriptionFa: 'ورود متین و درونی دستگاه سه‌گاه بر نت شاهد می کُرُن.' },
  { id: 'kereshmeh_segah', nameFa: 'کرشمه سه‌گاه', nameEn: 'Kereshmeh-ye Segah', role: 'zarbi', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['dorab', 'eshareh'], meter: '6/8', bpm: 108, contour: [1, 2, 3, 2, 1, 2, 3, 1], descriptionFa: 'کرشمه موزون بر پایه فواصل سه‌گاه.' },
  { id: 'zabol', nameFa: 'زابل', nameEn: 'Zabol', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 1, aghazIdx: 2, ornaments: ['tahrir', 'tekieh'], contour: [2, 3, 4, 3, 2, 3, 2, 1], descriptionFa: 'گوشه کلیدی با شاهد سل و رنگ‌آمیزی ربع‌پرده لا کُرُن.' },
  { id: 'basteh_negar', nameFa: 'بسته‌نگار', nameEn: 'Basteh-Negar', role: 'zarbi', difficulty: 2, shahedIdx: 3, istIdx: 1, aghazIdx: 3, ornaments: ['dorab', 'riz'], meter: '2/4', bpm: 112, contour: [3, 4, 3, 2, 1, 2, 3, 2, 1], descriptionFa: 'گوشه سازی چابک و تزیینی در سه‌گاه.' },
  { id: 'muyeh', nameFa: 'مویه', nameEn: 'Muyeh', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 3, moteghayer: n('A', 'flat', 4), ornaments: ['tahrir', 'eshareh'], contour: [3, 4, 5, 4, 3, 2, 1], descriptionFa: 'گوشه غمگین و تأثیرگذار با شاهد لا کُرُن و نوسان عاطفی.' },
  { id: 'hesar_segah', nameFa: 'حصار سه‌گاه', nameEn: 'Hesar-e Segah', role: 'owj', difficulty: 3, shahedIdx: 5, istIdx: 1, aghazIdx: 4, moteghayer: n('B', 'koron', 4), ornaments: ['tahrir', 'riz'], contour: [4, 5, 6, 5, 4, 3, 2, 1], modulations: [{ targetDastgahId: 'chahargah', labelFa: 'مدولاسیون به حصار چهارگاه', alteredNoteFa: 'سی کُرُن و ر' }], descriptionFa: 'پنجره مدال سه‌گاه به قلمرو چهارگاه با ورود سی کُرُن.' },
  { id: 'mokhalef', nameFa: 'مخالف سه‌گاه', nameEn: 'Mokhalef', role: 'owj', difficulty: 3, shahedIdx: 6, istIdx: 1, aghazIdx: 5, ornaments: ['tahrir', 'tekieh'], contour: [5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1], modulations: [{ targetDastgahId: 'chahargah', labelFa: 'گوشه مشترک با چهارگاه', alteredNoteFa: 'شاهد دو بالا' }], descriptionFa: 'درخشان‌ترین و پرشکوهترین اوج سه‌گاه با شاهد دو.' },
  { id: 'maghlub', nameFa: 'مغلوب', nameEn: 'Maghlub', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 6, aghazIdx: 6, ornaments: ['tahrir', 'riz'], contour: [6, 7, 8, 7, 6, 7, 6], descriptionFa: 'اوج نهایی مخالف تا می کُرُن اکتاو بالا.' },
  { id: 'hodi', nameFa: 'حُدی', nameEn: 'Hodi', role: 'miani', difficulty: 2, shahedIdx: 6, istIdx: 1, aghazIdx: 6, ornaments: ['tekieh', 'tahrir'], contour: [6, 5, 4, 5, 4, 3, 2, 1], descriptionFa: 'گوشه موقر در آغاز مسیر فرود از مخالف.' },
  { id: 'pahlavi', nameFa: 'پهلوی', nameEn: 'Pahlavi', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 5, ornaments: ['tahrir', 'eshareh'], contour: [5, 4, 3, 4, 3, 2, 1], descriptionFa: 'گوشه کهن با ریشه در ترانه‌های فهلویات.' },
  { id: 'rajaz', nameFa: 'رجز', nameEn: 'Rajaz', role: 'zarbi', difficulty: 2, shahedIdx: 3, istIdx: 1, aghazIdx: 3, ornaments: ['dorab', 'tekieh'], meter: '2/4', bpm: 114, contour: [3, 4, 3, 2, 3, 2, 1], descriptionFa: 'گوشه حماسی و استوار با ضرب‌آهنگ قاطع.' },
  { id: 'masnavi_mokhalef', nameFa: 'مثنوی مخالف', nameEn: 'Masnavi-ye Mokhalef', role: 'miani', difficulty: 2, shahedIdx: 6, istIdx: 1, aghazIdx: 5, ornaments: ['tahrir', 'eshareh'], contour: [5, 6, 7, 6, 5, 4, 3, 2, 1], descriptionFa: 'مثنوی‌خوانی عارفانه در فضای مخالف سه‌گاه.' },
  { id: 'reng_delgosha', nameFa: 'رنگ دلگشا (سه‌گاه)', nameEn: 'Reng-e Delgosha', role: 'zarbi', difficulty: 2, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 126, contour: [1, 2, 3, 4, 3, 2, 1, 0, 1], descriptionFa: 'رنگ شاداب پایانی در دستگاه سه‌گاه.' },
  { id: 'foroud_segah', nameFa: 'فرود سه‌گاه', nameEn: 'Foroud-e Segah', role: 'foroud', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 4, ornaments: ['tekieh', 'eshareh'], contour: [4, 3, 2, 1, 0, 1], descriptionFa: 'فرود قطعی سه‌گاه با آرامش بر می کُرُن.' },
];

// =============================================================================
// 10. دستگاه چهارگاه (Dastgah-e Chahargah) — 17 Gushehs [PRO]
// Scale (Chahargah of C): C4 (پایه), Dk4 (کُرُن), E4, F4, G4, Ak4 (کُرُن), B4, C5, Dk5
// =============================================================================
const CHAHARGAH_SCALE: PersianNoteSpec[] = [
  n('C', 'natural', 4), // 0 (پایه / شاهد)
  n('D', 'koron', 4),   // 1 (دوم کُرُن)
  n('E', 'natural', 4), // 2 (سوم بزرگ)
  n('F', 'natural', 4), // 3
  n('G', 'natural', 4), // 4 (شاهد زابل/حصار)
  n('A', 'koron', 4),   // 5 (ششم کُرُن)
  n('B', 'natural', 4), // 6 (هفتم بزرگ)
  n('C', 'natural', 5), // 7 (اکتاو / منصوری)
  n('D', 'koron', 5),   // 8
];

const CHAHARGAH_DEFS: CompactGushehDef[] = [
  { id: 'daramad_chahargah', nameFa: 'درآمد اول چهارگاه', nameEn: 'Daramad-e Avval', role: 'daramad', difficulty: 1, shahedIdx: 0, istIdx: 0, aghazIdx: 0, ornaments: ['eshareh', 'tekieh'], contour: [0, 1, 2, 3, 2, 1, 0, 2, 1, 0], descriptionFa: 'ورود حماسی و پرهیبت چهارگاه با تقارن دو دانگ ربع‌پرده.' },
  { id: 'daramad_2_chahargah', nameFa: 'درآمد دوم چهارگاه', nameEn: 'Daramad-e Dovvom', role: 'daramad', difficulty: 1, shahedIdx: 2, istIdx: 0, aghazIdx: 2, ornaments: ['tekieh', 'riz'], contour: [2, 3, 4, 3, 2, 1, 0], descriptionFa: 'توسعه درآمد چهارگاه تا نت سل و بازگشت پرصلابت.' },
  { id: 'pish_zanguleh', nameFa: 'پیش‌زنگوله', nameEn: 'Pish-Zanguleh', role: 'zarbi', difficulty: 1, shahedIdx: 0, istIdx: 0, aghazIdx: 0, ornaments: ['dorab', 'eshareh'], meter: '2/4', bpm: 112, contour: [0, 1, 2, 1, 0, 2, 3, 2, 1, 0], descriptionFa: 'مقدمه ریتمیک پیش از گوشه زنگوله.' },
  { id: 'zanguleh', nameFa: 'زنگوله', nameEn: 'Zanguleh', role: 'zarbi', difficulty: 2, shahedIdx: 2, istIdx: 0, aghazIdx: 2, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 124, contour: [2, 3, 2, 1, 0, 1, 2, 3, 1, 0], descriptionFa: 'گوشه ضربی طنین‌انداز با الهام از صدای زنگ کاروان.' },
  { id: 'zabol_chahargah', nameFa: 'زابل چهارگاه', nameEn: 'Zabol-e Chahargah', role: 'miani', difficulty: 2, shahedIdx: 2, istIdx: 0, aghazIdx: 2, ornaments: ['tahrir', 'tekieh'], contour: [2, 3, 4, 5, 4, 3, 2, 1, 0], descriptionFa: 'درخشش روی می بکار و سل در میانه چهارگاه.' },
  { id: 'muyeh_chahargah', nameFa: 'مویه چهارگاه', nameEn: 'Muyeh-ye Chahargah', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 0, aghazIdx: 4, ornaments: ['tahrir', 'eshareh'], contour: [4, 3, 2, 3, 2, 1, 0], descriptionFa: 'لحظه عاطفی و نرم در دل فضای حماسی چهارگاه.' },
  { id: 'hesar_chahargah', nameFa: 'حصار چهارگاه', nameEn: 'Hesar-e Chahargah', role: 'owj', difficulty: 3, shahedIdx: 4, istIdx: 0, aghazIdx: 4, moteghayer: n('E', 'koron', 4), ornaments: ['tahrir', 'riz'], contour: [4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0], modulations: [{ targetDastgahId: 'segah', labelFa: 'مدولاسیون حصار به سه‌گاه', alteredNoteFa: 'می کُرُن و شاهد سل' }], descriptionFa: 'اوج درخشان چهارگاه بر پایه درجه پنجم (سل) و پیوند با سه‌گاه.' },
  { id: 'mokhalef_chahargah', nameFa: 'مخالف چهارگاه', nameEn: 'Mokhalef-e Chahargah', role: 'owj', difficulty: 3, shahedIdx: 5, istIdx: 0, aghazIdx: 4, ornaments: ['tahrir', 'tekieh'], contour: [4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0], modulations: [{ targetDastgahId: 'segah', labelFa: 'گوشه مشترک با مخالف سه‌گاه', alteredNoteFa: 'لا کُرُن شاهد' }], descriptionFa: 'مخالف شورانگیز چهارگاه با قدرت آوازی برجسته.' },
  { id: 'maghlub_chahargah', nameFa: 'مغلوب چهارگاه', nameEn: 'Maghlub-e Chahargah', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 5, aghazIdx: 6, ornaments: ['tahrir', 'riz'], contour: [6, 7, 8, 7, 6, 5, 6, 5], descriptionFa: 'ادامه اوج مخالف تا ر کُرُن بالا.' },
  { id: 'mansuri', nameFa: 'منصوری', nameEn: 'Mansuri', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 0, aghazIdx: 7, ornaments: ['tahrir', 'riz'], contour: [7, 8, 7, 6, 5, 4, 3, 2, 1, 0], descriptionFa: 'بلندترین و پرصلابت‌ترین اوج دستگاه چهارگاه روی اکتاو بالا.' },
  { id: 'rajaz_chahargah', nameFa: 'رجز چهارگاه', nameEn: 'Rajaz-e Chahargah', role: 'zarbi', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 4, ornaments: ['dorab', 'tekieh'], meter: '2/4', bpm: 118, contour: [4, 5, 4, 3, 2, 3, 2, 1, 0], descriptionFa: 'گوشه رزم‌آهنگ و حماسی چهارگاه.' },
  { id: 'hodi_chahargah', nameFa: 'حدی و پهلوی', nameEn: 'Hodi o Pahlavi', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 5, ornaments: ['tahrir', 'eshareh'], contour: [5, 4, 3, 2, 3, 1, 0], descriptionFa: 'فرود تاریخی از مخالف و منصوری به دامنه میانی.' },
  { id: 'ordibehesht', nameFa: 'اردیبهشت', nameEn: 'Ordibehesht', role: 'miani', difficulty: 2, shahedIdx: 2, istIdx: 0, aghazIdx: 3, ornaments: ['eshareh', 'riz'], contour: [3, 2, 1, 2, 3, 2, 1, 0], descriptionFa: 'گوشه ظریف و بهاری در بازگشت به دانگ اول.' },
  { id: 'matn_chahargah', nameFa: 'متن (حاشیه)', nameEn: 'Matn', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 2, ornaments: ['tekieh', 'tahrir'], contour: [2, 3, 4, 3, 2, 1, 0], descriptionFa: 'تأکید ساختاری بر فواصل محوری چهارگاه.' },
  { id: 'chaharmezrab_chahargah', nameFa: 'چهارمضراب چهارگاه', nameEn: 'Chaharmezrab-e Chahargah', role: 'zarbi', difficulty: 3, shahedIdx: 0, istIdx: 0, aghazIdx: 0, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 136, contour: [0, 2, 1, 3, 2, 4, 3, 2, 1, 0], descriptionFa: 'از تکنیکی‌ترین چهارمضراب‌های موسیقی ایرانی.' },
  { id: 'reng_lazu', nameFa: 'رنگ لزگی / چهارگاه', nameEn: 'Reng-e Chahargah', role: 'zarbi', difficulty: 2, shahedIdx: 0, istIdx: 0, aghazIdx: 4, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 134, contour: [4, 3, 2, 1, 0, 1, 2, 1, 0], descriptionFa: 'رنگ پرهیجان پایانی چهارگاه.' },
  { id: 'foroud_chahargah', nameFa: 'فرود چهارگاه', nameEn: 'Foroud-e Chahargah', role: 'foroud', difficulty: 1, shahedIdx: 0, istIdx: 0, aghazIdx: 4, ornaments: ['tekieh', 'eshareh'], contour: [4, 3, 2, 1, 0], descriptionFa: 'فرود قاطع چهارگاه بر نت پایه دو.' },
];

// =============================================================================
// 11. دستگاه نوا (Dastgah-e Nava) — 16 Gushehs [PRO]
// Scale (Nava of G — built on the 4th degree of Shur of D):
// F4 (زیرپایه), G4 (ایست/شاهد), A4 (بکار), Bb4, C5, D5 (شاهد نهفت/عشاق), Ek5 (می کُرُن), F5, G5
// Intervals from G4: [200, 100, 200, 200, 150, 150, 200] (Authentic Nava)
// =============================================================================
const NAVA_SCALE: PersianNoteSpec[] = [
  n('F', 'natural', 4), // 0
  n('G', 'natural', 4), // 1 (شاهد / ایست نوا)
  n('A', 'natural', 4), // 2 (دوم بزرگ — لا بکار، متمایز از شور)
  n('B', 'flat', 4),    // 3
  n('C', 'natural', 5), // 4
  n('D', 'natural', 5), // 5
  n('E', 'koron', 5),   // 6 (ششم کُرُن — می کُرُن اصیل نوا)
  n('F', 'natural', 5), // 7
  n('G', 'natural', 5), // 8
];

const NAVA_DEFS: CompactGushehDef[] = [
  { id: 'daramad_nava', nameFa: 'درآمد نوا', nameEn: 'Daramad-e Nava', role: 'daramad', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['eshareh', 'tekieh'], contour: [1, 2, 3, 2, 1, 0, 1, 2, 1], descriptionFa: 'درآمد آرام، عارفانه و متوازن دستگاه نوا بر نت شاهد سل.' },
  { id: 'gardaniyeh', nameFa: 'گردانیه', nameEn: 'Gardaniyeh', role: 'daramad', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 3, ornaments: ['tekieh', 'eshareh'], contour: [3, 2, 1, 2, 3, 2, 1, 0, 1], descriptionFa: 'چرخشی ملایم حول پایه نوا در ادامه درآمد.' },
  { id: 'bayat_raje_nava', nameFa: 'بیات راجع نوا', nameEn: 'Bayat-e Raje-e Nava', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 1, aghazIdx: 3, ornaments: ['tahrir', 'tekieh'], contour: [3, 4, 3, 2, 3, 2, 1], descriptionFa: 'گوشه پیوندیافته با بیات اصفهان در میانه نوا.' },
  { id: 'nahoft', nameFa: 'نهفت', nameEn: 'Nahoft', role: 'miani', difficulty: 2, shahedIdx: 5, istIdx: 1, aghazIdx: 4, ornaments: ['tahrir', 'eshareh'], contour: [4, 5, 4, 3, 2, 1, 0, 1], modulations: [{ targetDastgahId: 'shur', labelFa: 'پیوند با حسینی شور', alteredNoteFa: 'شاهد ر و فرود سل' }], descriptionFa: 'از عمیق‌ترین گوشه‌های ردیف با اوج متین و فرود بسیار آرام.' },
  { id: 'gavesht', nameFa: 'گوشت', nameEn: 'Gavesht', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 4, ornaments: ['tekieh', 'riz'], contour: [4, 5, 4, 3, 4, 2, 1], descriptionFa: 'گوشه کوتاه و پرمغز در پیوند نهفت و نیشابورک.' },
  { id: 'neyshaburak', nameFa: 'نیشابورک', nameEn: 'Neyshaburak', role: 'owj', difficulty: 2, shahedIdx: 5, istIdx: 1, aghazIdx: 4, ornaments: ['tahrir', 'riz'], contour: [4, 5, 6, 5, 4, 3, 2, 1], descriptionFa: 'گوشه باستانی خراسانی با طراوت و حرکت پیوسته.' },
  { id: 'khojasteh', nameFa: 'خجسته', nameEn: 'Khojasteh', role: 'owj', difficulty: 2, shahedIdx: 5, istIdx: 1, aghazIdx: 5, ornaments: ['tahrir', 'tekieh'], contour: [5, 6, 7, 6, 5, 4, 3, 2, 1], descriptionFa: 'اوج ملایم و باوقار در نیمه دوم نوا.' },
  { id: 'aragh_nava', nameFa: 'عراق نوا', nameEn: 'Aragh-e Nava', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 1, aghazIdx: 5, moteghayer: n('E', 'koron', 5), ornaments: ['tahrir', 'riz'], contour: [5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1], modulations: [{ targetDastgahId: 'mahur', labelFa: 'گذر از عراق نوا به ماهور و افشاری', alteredNoteFa: 'می کُرُن و شاهد فا' }], descriptionFa: 'اوج سترگ نوا با قابلیت مرکب‌خوانی به ماهور و افشاری.' },
  { id: 'oshagh_nava', nameFa: 'عشاق نوا', nameEn: 'Oshagh-e Nava', role: 'owj', difficulty: 3, shahedIdx: 5, istIdx: 1, aghazIdx: 5, ornaments: ['tahrir', 'tekieh'], contour: [5, 6, 7, 6, 5, 4, 3, 2, 1], modulations: [{ targetDastgahId: 'homayun', labelFa: 'پیوند با عشاق همایون', alteredNoteFa: 'شاهد ر' }], descriptionFa: 'گوشه کانونی پیونددهنده نوا، همایون و دشتی.' },
  { id: 'majles_afruz', nameFa: 'مجلس‌افروز', nameEn: 'Majles-Afruz', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 4, ornaments: ['eshareh', 'tahrir'], contour: [4, 5, 4, 3, 2, 3, 2, 1], descriptionFa: 'گوشه گرم و مجلسی با جمله‌بندی روان.' },
  { id: 'hoseini_nava', nameFa: 'حسینی نوا', nameEn: 'Hoseini-ye Nava', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 1, aghazIdx: 5, ornaments: ['tahrir', 'tekieh'], contour: [5, 4, 3, 4, 3, 2, 1], descriptionFa: 'انعکاس حسینی شور در رنگ‌آمیزی دستگاه نوا.' },
  { id: 'busalik', nameFa: 'بوسلیک', nameEn: 'Busalik', role: 'miani', difficulty: 2, shahedIdx: 3, istIdx: 1, aghazIdx: 4, ornaments: ['eshareh', 'riz'], contour: [4, 3, 2, 1, 2, 3, 2, 1], descriptionFa: 'مقام کهن بوسلیک در بستر دستگاه نوا.' },
  { id: 'naghmeh_nava', nameFa: 'نغمه نوا', nameEn: 'Naghmeh-ye Nava', role: 'zarbi', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 1, ornaments: ['dorab', 'riz'], meter: '2/4', bpm: 106, contour: [1, 2, 3, 4, 3, 2, 1, 0, 1], descriptionFa: 'قطعه ضربی آرام و دلنشین در نوا.' },
  { id: 'nastari', nameFa: 'نستاری', nameEn: 'Nastari', role: 'zarbi', difficulty: 2, shahedIdx: 1, istIdx: 1, aghazIdx: 2, ornaments: ['dorab', 'eshareh'], meter: '6/8', bpm: 118, contour: [2, 3, 2, 1, 0, 1, 2, 1], descriptionFa: 'گوشه ضربی پایانی با طنین ظریف.' },
  { id: 'reng_nava', nameFa: 'رنگ نوا', nameEn: 'Reng-e Nava', role: 'zarbi', difficulty: 2, shahedIdx: 1, istIdx: 1, aghazIdx: 3, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 124, contour: [3, 2, 1, 2, 3, 4, 3, 2, 1], descriptionFa: 'رنگ متین پایانی دستگاه نوا.' },
  { id: 'foroud_nava', nameFa: 'فرود نوا', nameEn: 'Foroud-e Nava', role: 'foroud', difficulty: 1, shahedIdx: 1, istIdx: 1, aghazIdx: 4, ornaments: ['tekieh', 'eshareh'], contour: [4, 3, 2, 1, 0, 1], descriptionFa: 'فرود آرام و صلح‌آمیز نوا بر پایه سل.' },
];

// =============================================================================
// 12. دستگاه راست‌پنجگاه (Dastgah-e Rast-Panjgah) — 21 Gushehs [PRO]
// (Total check: 43 Free + 11+10+11+19+11+14+17+16+21 = 43 + 130 = 173 Gushehs!)
// =============================================================================
const RAST_SCALE: PersianNoteSpec[] = [
  n('F', 'natural', 4), // 0 (پایه راست‌پنجگاه)
  n('G', 'natural', 4), // 1
  n('A', 'natural', 4), // 2
  n('B', 'flat', 4),    // 3
  n('C', 'natural', 5), // 4 (پنجم / شاهد پنجگاه)
  n('D', 'natural', 5), // 5
  n('E', 'natural', 5), // 6
  n('F', 'natural', 5), // 7 (اکتاو)
  n('G', 'natural', 5), // 8
];

const RAST_DEFS: CompactGushehDef[] = [
  { id: 'daramad_rast', nameFa: 'درآمد راست‌پنجگاه', nameEn: 'Daramad-e Rast', role: 'daramad', difficulty: 1, shahedIdx: 0, istIdx: 0, aghazIdx: 0, ornaments: ['eshareh', 'tekieh'], contour: [0, 1, 2, 3, 4, 3, 2, 1, 0], descriptionFa: 'ورود جامع و تاریخی دستگاه راست‌پنجگاه بر پایه فا.' },
  { id: 'parvaneh', nameFa: 'پروانه', nameEn: 'Parvaneh', role: 'daramad', difficulty: 1, shahedIdx: 2, istIdx: 0, aghazIdx: 2, ornaments: ['eshareh', 'riz'], contour: [2, 3, 4, 3, 2, 1, 0], descriptionFa: 'گوشه سبک‌بال و لطیف در ابتدای راست‌پنجگاه.' },
  { id: 'khosravani_rast', nameFa: 'خسروانی راست', nameEn: 'Khosravani-ye Rast', role: 'miani', difficulty: 2, shahedIdx: 2, istIdx: 0, aghazIdx: 1, ornaments: ['tekieh', 'tahrir'], contour: [1, 2, 3, 4, 3, 2, 1, 0], descriptionFa: 'گوشه باستانی و سنگین‌وزن در دانگ اول.' },
  { id: 'ruh_afza', nameFa: 'روح‌افزا', nameEn: 'Ruh-Afza', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 3, ornaments: ['tahrir', 'eshareh'], contour: [3, 4, 5, 4, 3, 2, 1, 0], descriptionFa: 'گوشه نشاط‌آور و روشن با استقرار بر دو.' },
  { id: 'panjgah', nameFa: 'پنجگاه', nameEn: 'Panjgah', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 4, ornaments: ['tahrir', 'tekieh'], contour: [4, 5, 4, 3, 2, 3, 2, 1, 0], descriptionFa: 'بخش کانونی درجه پنجم که نام دستگاه از آن برگرفته شده است.' },
  { id: 'sepehr', nameFa: 'سپهر', nameEn: 'Sepehr', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 4, ornaments: ['tahrir', 'riz'], contour: [4, 5, 6, 5, 4, 3, 2, 0], descriptionFa: 'گوشه بلندپرواز و وسیع در میانه دستگاه.' },
  { id: 'zabol_rast', nameFa: 'زابل راست‌پنجگاه', nameEn: 'Zabol-e Rast', role: 'miani', difficulty: 2, shahedIdx: 2, istIdx: 0, aghazIdx: 2, moteghayer: n('A', 'koron', 4), ornaments: ['tahrir', 'eshareh'], contour: [2, 3, 4, 3, 2, 1, 0], modulations: [{ targetDastgahId: 'segah', labelFa: 'ورود به قلمرو سه‌گاه', alteredNoteFa: 'لا کُرُن' }], descriptionFa: 'مرکب‌خوانی راست‌پنجگاه به رنگ‌آمیزی سه‌گاه.' },
  { id: 'oshagh_rast', nameFa: 'عشاق راست', nameEn: 'Oshagh-e Rast', role: 'owj', difficulty: 3, shahedIdx: 5, istIdx: 0, aghazIdx: 4, ornaments: ['tahrir', 'riz'], contour: [4, 5, 6, 7, 6, 5, 4, 3, 2, 0], modulations: [{ targetDastgahId: 'nava', labelFa: 'مدولاسیون به عشاق نوا', alteredNoteFa: 'شاهد ر' }], descriptionFa: 'گوشه مشترک با نوا و همایون برای مرکب‌خوانی استادانه.' },
  { id: 'bayat_ajam', nameFa: 'بیات عجم', nameEn: 'Bayat-e Ajam', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 4, ornaments: ['tekieh', 'tahrir'], contour: [4, 5, 4, 3, 2, 1, 0], descriptionFa: 'گوشه دلپذیر با ملودی روان و آوازپسند.' },
  { id: 'bahr_e_nur', nameFa: 'بحر نور', nameEn: 'Bahr-e Nur', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 5, ornaments: ['riz', 'tekieh'], contour: [5, 4, 3, 4, 5, 4, 2, 0], descriptionFa: 'گوشه درخشان با جملات پیوسته.' },
  { id: 'gharcheh_rast', nameFa: 'قرچه راست‌پنجگاه', nameEn: 'Gharcheh-ye Rast', role: 'owj', difficulty: 3, shahedIdx: 5, istIdx: 0, aghazIdx: 5, moteghayer: n('D', 'koron', 5), ornaments: ['tahrir', 'eshareh'], contour: [5, 6, 7, 6, 5, 4, 3, 0], modulations: [{ targetDastgahId: 'shur', labelFa: 'گذر به قرچه شور', alteredNoteFa: 'ر کُرُن' }], descriptionFa: 'پل مدال راست‌پنجگاه به فضای اوج شور.' },
  { id: 'mobarghe', nameFa: 'مبرقع', nameEn: 'Mobarghe', role: 'owj', difficulty: 3, shahedIdx: 5, istIdx: 0, aghazIdx: 4, moteghayer: n('E', 'koron', 5), ornaments: ['tahrir', 'tekieh'], contour: [4, 5, 6, 7, 6, 5, 4, 2, 0], modulations: [{ targetDastgahId: 'segah', labelFa: 'گذر مدال به سه‌گاه و اصفهان', alteredNoteFa: 'می کُرُن' }], descriptionFa: 'گوشه منحصربه‌فرد راست‌پنجگاه با سیمای رازآلود و ترکیبی.' },
  { id: 'neyriz_rast', nameFa: 'نیریز راست', nameEn: 'Neyriz-e Rast', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 5, ornaments: ['tahrir', 'eshareh'], contour: [5, 4, 3, 2, 3, 2, 1, 0], descriptionFa: 'رنگ‌آمیزی نیریز در ساختار راست‌پنجگاه.' },
  { id: 'aragh_rast', nameFa: 'عراق راست‌پنجگاه', nameEn: 'Aragh-e Rast', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 4, aghazIdx: 5, ornaments: ['tahrir', 'riz'], contour: [5, 6, 7, 8, 7, 6, 5, 4], modulations: [{ targetDastgahId: 'mahur', labelFa: 'هم‌پیوندی با عراق ماهور', alteredNoteFa: 'شاهد فا بالا' }], descriptionFa: 'اوج رفیع راست‌پنجگاه روی اکتاو فا.' },
  { id: 'ley_li_o_majnun_rast', nameFa: 'لیلی و مجنون راست', nameEn: 'Leyli o Majnun-e Rast', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 4, ornaments: ['tahrir', 'tekieh'], contour: [4, 5, 4, 3, 2, 1, 0], modulations: [{ targetDastgahId: 'homayun', labelFa: 'بازتاب فضای همایون', alteredNoteFa: 'لا کُرُن' }], descriptionFa: 'مرکب‌خوانی لطیف به حال‌وهوای همایون.' },
  { id: 'mavara_ol_nahr', nameFa: 'ماوراءالنهر', nameEn: 'Mavara-ol-Nahr', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 0, aghazIdx: 6, ornaments: ['tahrir', 'riz'], contour: [6, 7, 8, 7, 6, 5, 4, 3, 2, 0], modulations: [{ targetDastgahId: 'mahur', labelFa: 'مدولاسیون عالی به ماهور', alteredNoteFa: 'اکتاو فا و سل' }], descriptionFa: 'از باشکوه‌ترین گوشه‌های اوج در کل ردیف موسیقی ایرانی.' },
  { id: 'rak_rast', nameFa: 'راک راست‌پنجگاه', nameEn: 'Rak-e Rast', role: 'owj', difficulty: 3, shahedIdx: 7, istIdx: 4, aghazIdx: 4, ornaments: ['tahrir', 'dorab'], contour: [4, 5, 6, 7, 8, 7, 5, 4], descriptionFa: 'حضور خانواده راک با صلابت در اوج راست‌پنجگاه.' },
  { id: 'tarz_rast', nameFa: 'طرز راست‌پنجگاه', nameEn: 'Tarz-e Rast', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 4, ornaments: ['tekieh', 'tahrir'], contour: [4, 5, 4, 3, 2, 1, 0], descriptionFa: 'بازآفرینی طرز همایون در مسیر بازگشت.' },
  { id: 'noruz_saba', nameFa: 'نوروز صبا', nameEn: 'Noruz-e Saba', role: 'miani', difficulty: 2, shahedIdx: 4, istIdx: 0, aghazIdx: 3, ornaments: ['eshareh', 'tahrir'], contour: [3, 4, 5, 4, 3, 2, 1, 0], descriptionFa: 'گوشه بهاری و عطرآگین از خانواده نوروزها.' },
  { id: 'reng_shaharashub', nameFa: 'رنگ شهرآشوب (راست‌پنجگاه)', nameEn: 'Reng-e Shahrashub', role: 'zarbi', difficulty: 3, shahedIdx: 0, istIdx: 0, aghazIdx: 4, ornaments: ['dorab', 'riz'], meter: '6/8', bpm: 132, contour: [4, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0], descriptionFa: 'رنگ استادانه و پرشور پایانی راست‌پنجگاه.' },
  { id: 'foroud_rast', nameFa: 'فرود راست‌پنجگاه', nameEn: 'Foroud-e Rast-Panjgah', role: 'foroud', difficulty: 1, shahedIdx: 0, istIdx: 0, aghazIdx: 4, ornaments: ['tekieh', 'eshareh'], contour: [4, 3, 2, 1, 0], descriptionFa: 'فرود جامع و پایانی بر نت پایه فا.' },
];

export const RADIF_SYSTEMS: DastgahSystem[] = [
  {
    id: 'shur',
    nameFa: 'دستگاه شور',
    nameEn: 'Dastgah-e Shur',
    category: 'dastgah',
    isFree: true,
    colorHex: '#0d9488',
    moodFa: 'عمیق، تأمل‌برانگیز و مادر آوازهای ایرانی',
    summaryFa: 'بزرگ‌ترین خانواده موسیقی اصیل ایرانی با فاصله شاخص دوم کُرُن و چهار آواز وابسته.',
    signatureNotes: [n('A', 'koron', 4), n('B', 'flat', 4)],
    shahed: n('G', 'natural', 4),
    ist: n('G', 'natural', 4),
    gushehs: SHUR_DEFS.map((d, i) => buildGusheh('shur', i + 1, SHUR_SCALE, d)),
  },
  {
    id: 'abuata',
    nameFa: 'آواز ابوعطا',
    nameEn: 'Avaz-e Abu-Ata',
    category: 'avaz',
    parentDastgahId: 'shur',
    isFree: true,
    colorHex: '#14b8a6',
    moodFa: 'محزون، مناجات‌گونه و پرسوز',
    summaryFa: 'نخستین آواز از متعلقات شور با شاهد درجه چهارم (دو) و گوشه پرشکوه حجاز.',
    signatureNotes: [n('A', 'koron', 4), n('B', 'flat', 4)],
    shahed: n('C', 'natural', 5),
    ist: n('A', 'koron', 4),
    gushehs: ABUATA_DEFS.map((d, i) => buildGusheh('abuata', i + 1, ABUATA_SCALE, d)),
  },
  {
    id: 'mahur',
    nameFa: 'دستگاه ماهور',
    nameEn: 'Dastgah-e Mahur',
    category: 'dastgah',
    isFree: true,
    colorHex: '#f59e0b',
    moodFa: 'باشکوه، روشن، حماسی و سرشار از امید',
    summaryFa: 'دستگاه بزرگ و گسترده با مدولاسیون‌های درخشانی چون دلکش، شکسته، عراق و راک.',
    signatureNotes: [n('C', 'natural', 4), n('E', 'natural', 4), n('B', 'natural', 4)],
    shahed: n('C', 'natural', 4),
    ist: n('C', 'natural', 4),
    gushehs: MAHUR_DEFS.map((d, i) => buildGusheh('mahur', i + 1, MAHUR_SCALE, d)),
  },
  {
    id: 'bayat_tork',
    nameFa: 'آواز بیات ترک (زند)',
    nameEn: 'Avaz-e Bayat-e Tork',
    category: 'avaz',
    parentDastgahId: 'shur',
    isFree: false,
    colorHex: '#0ea5e9',
    moodFa: 'صمیمی، عارفانه و سرشار از طراوت',
    summaryFa: 'آواز دلنشین از خانواده شور بر شاهد درجه سوم (سی‌بمل) با گوشه‌های روح‌الارواح و قطار.',
    signatureNotes: [n('A', 'koron', 4), n('B', 'flat', 4)],
    shahed: n('B', 'flat', 4),
    ist: n('B', 'flat', 4),
    gushehs: BAYAT_TORK_DEFS.map((d, i) => buildGusheh('bayat_tork', i + 1, BAYAT_TORK_SCALE, d)),
  },
  {
    id: 'afshari',
    nameFa: 'آواز افشاری',
    nameEn: 'Avaz-e Afshari',
    category: 'avaz',
    parentDastgahId: 'shur',
    isFree: false,
    colorHex: '#6366f1',
    moodFa: 'سوزناک، پرهیبت و حماسی',
    summaryFa: 'آواز شکوهمند از متعلقات شور با نت متغیر درجه پنجم، عراق و مثنوی پیچ.',
    signatureNotes: [n('A', 'koron', 4), n('B', 'flat', 4), n('D', 'koron', 5)],
    shahed: n('C', 'natural', 5),
    ist: n('G', 'natural', 4),
    gushehs: AFSHARI_DEFS.map((d, i) => buildGusheh('afshari', i + 1, AFSHARI_SCALE, d)),
  },
  {
    id: 'dashti',
    nameFa: 'آواز دشتی',
    nameEn: 'Avaz-e Dashti',
    category: 'avaz',
    parentDastgahId: 'shur',
    isFree: false,
    colorHex: '#10b981',
    moodFa: 'عاطفی، شبانی و پیوندخورده با موسیقی نواحی',
    summaryFa: 'محبوب‌ترین آواز عاطفی ایرانی از خانواده شور با شاهد پنجم و گوشه‌های گیلکی و دیلمان.',
    signatureNotes: [n('A', 'koron', 4), n('B', 'flat', 4), n('D', 'koron', 5)],
    shahed: n('D', 'natural', 5),
    ist: n('G', 'natural', 4),
    gushehs: DASHTI_DEFS.map((d, i) => buildGusheh('dashti', i + 1, DASHTI_SCALE, d)),
  },
  {
    id: 'homayun',
    nameFa: 'دستگاه همایون',
    nameEn: 'Dastgah-e Homayun',
    category: 'dastgah',
    isFree: false,
    colorHex: '#e11d48',
    moodFa: 'پرشکوه، شاهانه، رازآلود و دراماتیک',
    summaryFa: 'دستگاه پرقدرت با فاصله شاخص ۵/۴ پرده (لا کُرُن تا سی بکار) و گوشه‌های بیداد و شوشتری.',
    signatureNotes: [n('A', 'koron', 4), n('B', 'natural', 4), n('E', 'flat', 5)],
    shahed: n('G', 'natural', 4),
    ist: n('G', 'natural', 4),
    gushehs: HOMAYUN_DEFS.map((d, i) => buildGusheh('homayun', i + 1, HOMAYUN_SCALE, d)),
  },
  {
    id: 'bayat_esfahan',
    nameFa: 'آواز بیات اصفهان',
    nameEn: 'Avaz-e Bayat-e Esfahan',
    category: 'avaz',
    parentDastgahId: 'homayun',
    isFree: false,
    colorHex: '#ec4899',
    moodFa: 'شاعرانه، لطیف، شیرین و تغزلی',
    summaryFa: 'آواز وابسته به همایون با پایه دو، نت محسوس سی بکار و گوشه‌های بیات راجع و عشاق.',
    signatureNotes: [n('E', 'flat', 4), n('A', 'koron', 4), n('B', 'natural', 4)],
    shahed: n('C', 'natural', 4),
    ist: n('C', 'natural', 4),
    gushehs: ESFAHAN_DEFS.map((d, i) => buildGusheh('bayat_esfahan', i + 1, ESFAHAN_SCALE, d)),
  },
  {
    id: 'segah',
    nameFa: 'دستگاه سه‌گاه',
    nameEn: 'Dastgah-e Segah',
    category: 'dastgah',
    isFree: false,
    colorHex: '#8b5cf6',
    moodFa: 'متین، پرصلابت، درونی و پرکشش',
    summaryFa: 'دستگاه مبتنی بر فواصل ربع‌پرده می کُرُن و لا کُرُن با گوشه‌های زابل، مویه و مخالف.',
    signatureNotes: [n('E', 'koron', 4), n('A', 'koron', 4), n('B', 'flat', 4)],
    shahed: n('E', 'koron', 4),
    ist: n('E', 'koron', 4),
    gushehs: SEGAH_DEFS.map((d, i) => buildGusheh('segah', i + 1, SEGAH_SCALE, d)),
  },
  {
    id: 'chahargah',
    nameFa: 'دستگاه چهارگاه',
    nameEn: 'Dastgah-e Chahargah',
    category: 'dastgah',
    isFree: false,
    colorHex: '#f97316',
    moodFa: 'حماسی، پرهیجان، رزم‌آهنگ و باعظمت',
    summaryFa: 'دستگاه متقارن دو دانگ با ر کُرُن و لا کُرُن و گوشه‌های زابل، حصار، مخالف و منصوری.',
    signatureNotes: [n('D', 'koron', 4), n('A', 'koron', 4)],
    shahed: n('C', 'natural', 4),
    ist: n('C', 'natural', 4),
    gushehs: CHAHARGAH_DEFS.map((d, i) => buildGusheh('chahargah', i + 1, CHAHARGAH_SCALE, d)),
  },
  {
    id: 'nava',
    nameFa: 'دستگاه نوا',
    nameEn: 'Dastgah-e Nava',
    category: 'dastgah',
    isFree: false,
    colorHex: '#06b6d4',
    moodFa: 'آرام، حکیمانه، عارفانه و متعادل',
    summaryFa: 'دستگاه آرامش‌بخش و کهن با گوشه‌های عمیقی چون نهفت، نیشابورک، عشاق و عراق.',
    signatureNotes: [n('A', 'natural', 4), n('B', 'flat', 4), n('E', 'koron', 5)],
    shahed: n('G', 'natural', 4),
    ist: n('G', 'natural', 4),
    gushehs: NAVA_DEFS.map((d, i) => buildGusheh('nava', i + 1, NAVA_SCALE, d)),
  },
  {
    id: 'rast_panjgah',
    nameFa: 'دستگاه راست‌پنجگاه',
    nameEn: 'Dastgah-e Rast-Panjgah',
    category: 'dastgah',
    isFree: false,
    colorHex: '#d97706',
    moodFa: 'جامع، دانشنامه‌ای و میدان مرکب‌خوانی استادان',
    summaryFa: 'وسیع‌ترین دستگاه برای مرکب‌خوانی و گذر به دیگر دستگاه‌ها با گوشه‌های پنجگاه، مبرقع و ماوراءالنهر.',
    signatureNotes: [n('B', 'flat', 4), n('A', 'natural', 4)],
    shahed: n('F', 'natural', 4),
    ist: n('F', 'natural', 4),
    gushehs: RAST_DEFS.map((d, i) => buildGusheh('rast_panjgah', i + 1, RAST_SCALE, d)),
  },
];

export const FREE_DASTGAH_IDS = ['shur', 'abuata', 'mahur'] as const;

export const ALL_GUSHEHS: Gusheh[] = RADIF_SYSTEMS.flatMap((sys) => sys.gushehs);

export const GUSHEH_BY_ID: Record<string, Gusheh> = Object.fromEntries(
  ALL_GUSHEHS.map((g) => [g.id, g])
);

export const SYSTEM_BY_ID: Record<string, DastgahSystem> = Object.fromEntries(
  RADIF_SYSTEMS.map((s) => [s.id, s])
);

export const FREE_GUSHEHS: Gusheh[] = RADIF_SYSTEMS.filter((s) => s.isFree).flatMap((s) => s.gushehs);

export function isDastgahUnlocked(dastgahId: string, isPro: boolean): boolean {
  if (isPro) return true;
  return SYSTEM_BY_ID[dastgahId]?.isFree ?? false;
}

export function isGushehUnlocked(gushehId: string, isPro: boolean): boolean {
  if (isPro) return true;
  const g = GUSHEH_BY_ID[gushehId];
  return g ? isDastgahUnlocked(g.dastgahId, isPro) : false;
}
