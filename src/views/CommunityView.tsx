import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Headphones,
  MessageSquare,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Square,
  Users,
} from 'lucide-react';
import { PrecisionMetronome } from '../audio/metronome';
import { playGushehPhrase } from '../audio/karplusStrong';
import { GUSHEH_BY_ID, RADIF_SYSTEMS, SYSTEM_BY_ID } from '../data/radifData';
import type { HandledFirestoreError } from '../services/firebase';
import {
  commitForumReplyBatch,
  createForumPostCloud,
  createPracticeRoomCloud,
  fetchPostRepliesCloud,
  subscribeCommunityFeed,
  updatePracticeRoomCloud,
} from '../services/firestoreSync';
import { GUEST_OWNER_UID } from '../services/sessionStore';
import type {
  ForumPost,
  ForumReply,
  InstrumentId,
  IranianMeter,
  KoronMode,
  PracticeRoom,
  SavedRecordingMeta,
} from '../types/music';
import {
  formatDurationFa,
  INSTRUMENT_LABELS_FA,
  toPersianDigits,
} from '../utils/persian';

interface CommunityViewProps {
  ownerUid: string;
  displayName: string;
  a4Hz: number;
  koronMode: KoronMode;
  localPublicRecordings: SavedRecordingMeta[];
  onOpenAuth: () => void;
  onPracticeGusheh: (gushehId: string) => void;
}

const DEMO_ROOMS: PracticeRoom[] = [
  {
    id: 'demo_room_shur',
    hostUid: 'master_shur',
    hostName: 'استاد مهرداد (اتاق تمرینی نمونه)',
    title: 'هم‌نوازی درآمد شور و کرشمه',
    dastgahId: 'shur',
    gushehId: 'shur_daramad_1',
    instrument: 'tar',
    tempoBpm: 76,
    meter: '6/8',
    metronomeActive: false,
    isPlaying: false,
    activeParticipants: ['master_shur', 'learner_1', 'learner_2'],
    createdAt: Date.now() - 3600_000,
    updatedAt: Date.now() - 120_000,
  },
  {
    id: 'demo_room_mahur',
    hostUid: 'master_mahur',
    hostName: 'استاد نیلوفر (سنتور)',
    title: 'تمرین داد و دلکش ماهور',
    dastgahId: 'mahur',
    gushehId: 'mahur_delkash',
    instrument: 'santur',
    tempoBpm: 84,
    meter: '4/4',
    metronomeActive: false,
    isPlaying: false,
    activeParticipants: ['master_mahur', 'learner_3'],
    createdAt: Date.now() - 7200_000,
    updatedAt: Date.now() - 600_000,
  },
];

const DEMO_POSTS: ForumPost[] = [
  {
    id: 'demo_post_1',
    authorUid: 'user_demo_1',
    authorName: 'کیوان (تارنواز)',
    title: 'تفاوت کُرُن سنتی (-۵۶ سنت) و کُرُن استاندارد (-۵۰ سنت) در درآمد شور چیست؟',
    body: 'هنگام تمرین درآمد اول شور، احساس می‌کنم لا کُرُن سنتی (-۵۶ سنت) حس درونی‌تر و نزدیک‌تری به ردیف میرزا عبدالله دارد. نظر دوستان درباره تمرین با هر دو حالت چیست؟',
    dastgahId: 'shur',
    tags: ['شور', 'کُرُن', 'کوک'],
    replyCount: 1,
    lastReplyId: 'demo_reply_1',
    createdAt: Date.now() - 86400_000,
    updatedAt: Date.now() - 43200_000,
  },
  {
    id: 'demo_post_2',
    authorUid: 'user_demo_2',
    authorName: 'مریم (آواز)',
    title: 'بهترین روش تثبیت نوسان ۶ هرتزی تحریر در حجاز ابوعطا',
    body: 'در کارگاه DSP زنده نوانگار وقتی تحریر می‌زنم گاهی بسامد نوسانم به ۴ هرتز افت می‌کند. برای یکنواخت شدن تحریر چه تمرینی پیشنهاد می‌دهید؟',
    dastgahId: 'abuata',
    tags: ['ابوعطا', 'تحریر', 'آواز'],
    replyCount: 0,
    lastReplyId: null,
    createdAt: Date.now() - 50000_000,
    updatedAt: Date.now() - 50000_000,
  },
];

const DEMO_REPLIES: Record<string, ForumReply[]> = {
  demo_post_1: [
    {
      id: 'demo_reply_1',
      postId: 'demo_post_1',
      authorUid: 'master_shur',
      authorName: 'استاد مهرداد',
      body: 'دقیقاً درست متوجه شده‌اید؛ در ردیف سنتی، درجه دوم شور اندکی بم‌تر از ربع‌پرده مساوی است (-۵۵ تا -۵۸ سنت). پیشنهاد می‌شود ابتدا گوش خود را با -۵۰¢ تثبیت کنید و سپس حالت کُرُن سنتی (-۵۶¢) را در نوانگار فعال نمایید.',
      createdAt: Date.now() - 43200_000,
    },
  ],
};

export const CommunityView: React.FC<CommunityViewProps> = ({
  ownerUid,
  displayName,
  a4Hz,
  koronMode,
  localPublicRecordings,
  onOpenAuth,
  onPracticeGusheh,
}) => {
  const [subTab, setSubTab] = useState<'rooms' | 'forum' | 'gallery'>('rooms');
  const [networkError, setNetworkError] = useState<HandledFirestoreError | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);

  const [rooms, setRooms] = useState<PracticeRoom[]>(DEMO_ROOMS);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomGushehId, setNewRoomGushehId] = useState('shur_daramad_1');

  const [posts, setPosts] = useState<ForumPost[]>(DEMO_POSTS);
  const [repliesMap, setRepliesMap] = useState<Record<string, ForumReply[]>>(DEMO_REPLIES);
  const [expandedPostId, setExpandedPostId] = useState<string | null>('demo_post_1');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostBody, setNewPostBody] = useState('');
  const [newPostDastgah, setNewPostDastgah] = useState('shur');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const [cloudRecordings, setCloudRecordings] = useState<SavedRecordingMeta[]>([]);
  const roomMetronomeRef = useRef<PrecisionMetronome | null>(null);

  const isGuest = ownerUid === GUEST_OWNER_UID;

  // Subscribe to Firestore live community feeds with graceful `unavailable` handling
  useEffect(() => {
    setNetworkError(null);
    if (isGuest) return;

    const unsub = subscribeCommunityFeed({
      ownerUid,
      onRooms: (cloudRooms) => {
        setNetworkError(null);
        setRooms(cloudRooms.length > 0 ? cloudRooms : DEMO_ROOMS);
      },
      onPosts: (cloudPosts) => {
        setNetworkError(null);
        setPosts(cloudPosts.length > 0 ? cloudPosts : DEMO_POSTS);
      },
      onPublicRecordings: (recs) => setCloudRecordings(recs),
      onError: (err) => {
        // Gracefully show offline/unavailable error without crashing!
        setNetworkError(err);
      },
    });

    return () => unsub();
  }, [ownerUid, isGuest, retryCounter]);

  // Synchronize live metronome to joined room's host state
  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  useEffect(() => {
    const m = new PrecisionMetronome();
    roomMetronomeRef.current = m;
    return () => m.stop();
  }, []);

  useEffect(() => {
    const m = roomMetronomeRef.current;
    if (!m) return;
    if (activeRoom && activeRoom.metronomeActive) {
      m.configure({ bpm: activeRoom.tempoBpm, meter: activeRoom.meter, subdivision: 1 });
      m.start();
    } else {
      m.stop();
    }
  }, [activeRoom]);

  const handleCreateRoom = async () => {
    const title = newRoomTitle.trim();
    if (!title) return;
    const g = GUSHEH_BY_ID[newRoomGushehId];
    const now = Date.now();
    const room: PracticeRoom = {
      id: `room_${now}_${Math.random().toString(36).slice(2, 6)}`,
      hostUid: ownerUid,
      hostName: displayName,
      title,
      dastgahId: g?.dastgahId ?? 'shur',
      gushehId: newRoomGushehId,
      instrument: 'tar',
      tempoBpm: g?.practiceLoop.defaultBpm ?? 80,
      meter: g?.practiceLoop.meter ?? '6/8',
      metronomeActive: false,
      isPlaying: false,
      activeParticipants: [ownerUid],
      createdAt: now,
      updatedAt: now,
    };

    setRooms((prev) => [room, ...prev]);
    setActiveRoomId(room.id);
    setNewRoomTitle('');

    const res = await createPracticeRoomCloud(room);
    if (res.error) setNetworkError(res.error);
  };

  const handleHostUpdateRoom = async (
    room: PracticeRoom,
    patch: Partial<Pick<PracticeRoom, 'tempoBpm' | 'meter' | 'metronomeActive' | 'gushehId' | 'instrument'>>
  ) => {
    const updated: PracticeRoom = { ...room, ...patch, updatedAt: Date.now() };
    setRooms((prev) => prev.map((r) => (r.id === room.id ? updated : r)));
    const res = await updatePracticeRoomCloud(ownerUid, room.id, patch);
    if (res.error) setNetworkError(res.error);
  };

  const handleCreatePost = async () => {
    const title = newPostTitle.trim();
    const body = newPostBody.trim();
    if (title.length < 3 || body.length < 5) return;
    const now = Date.now();
    const post: ForumPost = {
      id: `post_${now}_${Math.random().toString(36).slice(2, 6)}`,
      authorUid: ownerUid,
      authorName: displayName,
      title,
      body,
      dastgahId: newPostDastgah,
      tags: [SYSTEM_BY_ID[newPostDastgah]?.nameFa.replace('دستگاه ', '').replace('آواز ', '') ?? 'ردیف'],
      replyCount: 0,
      lastReplyId: null,
      createdAt: now,
      updatedAt: now,
    };

    setPosts((prev) => [post, ...prev]);
    setNewPostTitle('');
    setNewPostBody('');

    const res = await createForumPostCloud(post);
    if (res.error) setNetworkError(res.error);
  };

  const handleSubmitReply = async (post: ForumPost) => {
    const body = (replyDrafts[post.id] ?? '').trim();
    if (body.length < 2) return;
    const now = Date.now();
    const reply: ForumReply = {
      id: `rep_${now}_${Math.random().toString(36).slice(2, 7)}`,
      postId: post.id,
      authorUid: ownerUid,
      authorName: displayName,
      body,
      createdAt: now,
    };

    // Optimistic local state update
    setRepliesMap((prev) => ({
      ...prev,
      [post.id]: [...(prev[post.id] ?? []), reply],
    }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, replyCount: p.replyCount + 1, lastReplyId: reply.id, updatedAt: now }
          : p
      )
    );
    setReplyDrafts((prev) => ({ ...prev, [post.id]: '' }));

    // Atomic writeBatch committing reply + parent replyCount/lastReplyId
    const res = await commitForumReplyBatch({ postId: post.id, reply });
    if (res.error) setNetworkError(res.error);
  };

  const handleExpandPost = async (postId: string) => {
    const next = expandedPostId === postId ? null : postId;
    setExpandedPostId(next);
    if (next && !isGuest && !postId.startsWith('demo_')) {
      const res = await fetchPostRepliesCloud(ownerUid, postId);
      if (res.error) {
        setNetworkError(res.error);
      } else if (res.replies.length > 0) {
        setRepliesMap((prev) => ({ ...prev, [postId]: res.replies }));
      }
    }
  };

  const combinedGallery = [
    ...localPublicRecordings,
    ...cloudRecordings.filter(
      (cr) => !localPublicRecordings.some((lr) => lr.id === cr.id)
    ),
  ];

  return (
    <div className="space-y-4">
      {/* Header & Sub-Tabs */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              انجمن موسیقی‌دانان و اتاق‌های تمرین زنده
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              همگام‌سازی زنده گوشه و مترونوم میزبان، تالار پرسش و پاسخ ردیف و گالری بازشنوایی اجراها
            </p>
          </div>
          {isGuest && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-teal-700"
            >
              ورود برای همگام‌سازی ابری انجمن
            </button>
          )}
        </div>

        {/* Graceful Offline / Unavailable Network Error Banner (Never crashes!) */}
        {networkError && (
          <div
            role="alert"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/12 p-3 text-xs text-amber-800 dark:text-amber-200"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <span>{networkError.messageFa}</span>
            </div>
            <button
              type="button"
              onClick={() => setRetryCounter((c) => c + 1)}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-extrabold text-slate-950"
            >
              <RefreshCw className="h-3 w-3" />
              تلاش مجدد
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              { id: 'rooms', labelFa: 'اتاق‌های تمرین زنده', icon: Radio },
              { id: 'forum', labelFa: 'تالار پرسش و پاسخ', icon: MessageSquare },
              { id: 'gallery', labelFa: 'گالری بازشنوایی اجراها', icon: Headphones },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  subTab === t.id
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.labelFa}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. LIVE PRACTICE ROOMS */}
      {subTab === 'rooms' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            {/* Create Room Form */}
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
              <div className="mb-2 text-xs font-extrabold text-slate-800 dark:text-slate-100">
                ساخت اتاق تمرین همزمان جدید
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  placeholder="عنوان اتاق (مثلاً تمرین کرشمه شور با تار)..."
                  className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <select
                  value={newRoomGushehId}
                  onChange={(e) => setNewRoomGushehId(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {RADIF_SYSTEMS.slice(0, 3).flatMap((s) =>
                    s.gushehs.slice(0, 4).map((g) => (
                      <option key={g.id} value={g.id}>
                        {s.nameFa} — {g.nameFa}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => void handleCreateRoom()}
                  className="inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-teal-700"
                >
                  <Plus className="h-4 w-4" />
                  ایجاد اتاق
                </button>
              </div>
            </div>

            {/* Room List */}
            {rooms.map((room) => {
              const g = GUSHEH_BY_ID[room.gushehId];
              const joined = activeRoomId === room.id;
              return (
                <div
                  key={room.id}
                  className={`rounded-3xl border p-4 transition ${
                    joined
                      ? 'border-teal-500 bg-teal-500/8 shadow-md'
                      : 'border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/85'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {room.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        میزبان: {room.hostName} • گوشه: <strong>{g?.nameFa ?? room.gushehId}</strong> •
                        تندا {toPersianDigits(room.tempoBpm)} BPM ({toPersianDigits(room.meter)})
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Users className="h-3 w-3" />
                        {toPersianDigits(room.activeParticipants.length)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveRoomId(joined ? null : room.id)}
                        className={`rounded-xl px-3.5 py-2 text-xs font-extrabold text-white ${
                          joined
                            ? 'bg-rose-500 hover:bg-rose-600'
                            : 'bg-teal-600 hover:bg-teal-700'
                        }`}
                      >
                        {joined ? 'خروج از اتاق' : 'ورود و همگام‌سازی'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Synced Room Console */}
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm lg:col-span-5 dark:border-slate-800 dark:bg-slate-900/90">
            {activeRoom ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                    متصل و همگام با میزبان
                  </span>
                  <span className="text-xs text-slate-500">{activeRoom.hostName}</span>
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {activeRoom.title}
                </h2>
                <div className="rounded-2xl bg-slate-100/80 p-3 text-xs dark:bg-slate-800/75">
                  <div>
                    گوشه همگام‌شده:{' '}
                    <strong className="text-teal-700 dark:text-teal-300">
                      {GUSHEH_BY_ID[activeRoom.gushehId]?.nameFa}
                    </strong>
                  </div>
                  <div className="mt-1">
                    ساز میزبان: {INSTRUMENT_LABELS_FA[activeRoom.instrument]} • میزان{' '}
                    {toPersianDigits(activeRoom.meter)} • تندا {toPersianDigits(activeRoom.tempoBpm)} BPM
                  </div>
                </div>

                {/* Host Live Controls (or interactive sandbox controls for demo room) */}
                {(activeRoom.hostUid === ownerUid || activeRoom.id.startsWith('demo_')) && (
                  <div className="space-y-3 rounded-2xl border border-teal-500/25 bg-teal-500/5 p-3">
                    <div className="text-xs font-bold text-teal-700 dark:text-teal-300">
                      کنترل زنده میزبان (همگام‌سازی با همه شرکت‌کنندگان)
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">تندا:</span>
                      <input
                        type="range"
                        min={50}
                        max={160}
                        value={activeRoom.tempoBpm}
                        onChange={(e) =>
                          void handleHostUpdateRoom(activeRoom, {
                            tempoBpm: Number(e.target.value),
                          })
                        }
                        className="flex-1 accent-teal-500"
                      />
                      <span className="ltr-num text-xs font-bold">{activeRoom.tempoBpm} BPM</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(['2/4', '3/4', '4/4', '6/8', '7/8'] as IranianMeter[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => void handleHostUpdateRoom(activeRoom, { meter: m })}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            activeRoom.meter === m
                              ? 'bg-teal-600 text-white'
                              : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {toPersianDigits(m)}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleHostUpdateRoom(activeRoom, {
                          metronomeActive: !activeRoom.metronomeActive,
                        })
                      }
                      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold text-white ${
                        activeRoom.metronomeActive ? 'bg-rose-500' : 'bg-teal-600'
                      }`}
                    >
                      {activeRoom.metronomeActive ? (
                        <>
                          <Square className="h-3.5 w-3.5" />
                          توقف مترونوم همزمان اتاق
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          شروع مترونوم همزمان اتاق
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const g = GUSHEH_BY_ID[activeRoom.gushehId];
                      if (g) {
                        playGushehPhrase(g.melody, {
                          instrument: activeRoom.instrument as InstrumentId,
                          bpm: activeRoom.tempoBpm,
                          speedMultiplier: 1,
                          a4Hz,
                          koronMode,
                          startIndex: 0,
                          endIndex: Math.min(g.melody.length - 1, 7),
                          loop: false,
                        });
                      }
                    }}
                    className="flex-1 rounded-xl bg-amber-500 py-2 text-xs font-extrabold text-slate-950"
                  >
                    پخش نمونه گوشه اتاق
                  </button>
                  <button
                    type="button"
                    onClick={() => onPracticeGusheh(activeRoom.gushehId)}
                    className="flex-1 rounded-xl bg-slate-900 py-2 text-xs font-extrabold text-white dark:bg-slate-700"
                  >
                    باز کردن در کارگاه تمرین
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400">
                <Radio className="mb-2 h-8 w-8 text-teal-500 opacity-70" />
                برای هم‌نوازی همزمان، وارد یکی از اتاق‌های فعال شوید یا اتاق جدید بسازید.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Q&A FORUM (Atomic writeBatch Replies) */}
      {subTab === 'forum' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              طرح پرسش جدید در تالار ردیف
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
              <input
                type="text"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="عنوان پرسش (حداقل ۳ حرف)..."
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs sm:col-span-3 dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={newPostDastgah}
                onChange={(e) => setNewPostDastgah(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {RADIF_SYSTEMS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameFa}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              rows={2}
              value={newPostBody}
              onChange={(e) => setNewPostBody(e.target.value)}
              placeholder="شرح پرسش درباره کوک، مضراب، تحریر یا مدولاسیون..."
              className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void handleCreatePost()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-teal-700"
              >
                <Send className="h-3.5 w-3.5" />
                ارسال پرسش
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {posts.map((post) => {
              const isOpen = expandedPostId === post.id;
              const replies = repliesMap[post.id] ?? [];
              return (
                <div
                  key={post.id}
                  className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {post.title}
                      </h3>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        نویسنده: {post.authorName} •{' '}
                        {SYSTEM_BY_ID[post.dastgahId]?.nameFa ?? post.dastgahId}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleExpandPost(post.id)}
                      className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {toPersianDigits(post.replyCount)} پاسخ {isOpen ? '▲' : '▼'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                    {post.body}
                  </p>

                  {isOpen && (
                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                      {replies.map((rep) => (
                        <div
                          key={rep.id}
                          className="rounded-2xl bg-slate-50 p-3 text-xs dark:bg-slate-800/70"
                        >
                          <div className="font-bold text-teal-700 dark:text-teal-300">
                            {rep.authorName}
                          </div>
                          <p className="mt-1 leading-6 text-slate-700 dark:text-slate-200">
                            {rep.body}
                          </p>
                        </div>
                      ))}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyDrafts[post.id] ?? ''}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          placeholder="پاسخ تخصصی خود را بنویسید (ثبت اتمیک writeBatch)..."
                          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSubmitReply(post)}
                          className="rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-teal-700"
                        >
                          ثبت پاسخ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. PUBLIC RECORDINGS GALLERY */}
      {subTab === 'gallery' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {combinedGallery.length === 0 ? (
            <div className="col-span-2 rounded-3xl border border-dashed border-slate-300 bg-white/75 p-10 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
              هنوز اجرای عمومی به اشتراک گذاشته نشده است. از بخش «ضبط و تحلیل قطعه» در کارگاه
              تمرین، وضعیت هر ضبط را به «عمومی در انجمن» تغییر دهید تا اینجا نمایش داده شود.
            </div>
          ) : (
            combinedGallery.map((rec) => (
              <div
                key={rec.id}
                className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {rec.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      نوازنده: {rec.ownerName} • {SYSTEM_BY_ID[rec.dastgahId]?.nameFa} •{' '}
                      {INSTRUMENT_LABELS_FA[rec.instrument]}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                    دقت {toPersianDigits(rec.avgAccuracy)}٪
                  </span>
                </div>

                {/* Envelope Preview */}
                <div className="mt-3 flex h-10 items-end gap-0.5 rounded-xl bg-slate-950/90 px-2 py-1.5" dir="ltr">
                  {(rec.envelope.length > 0 ? rec.envelope : [0.3, 0.6, 0.8, 0.5, 0.7]).map(
                    (val, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-full bg-gradient-to-t from-teal-500 to-amber-300"
                        style={{ height: `${Math.max(12, Math.round(val * 100))}%` }}
                      />
                    )
                  )}
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>مدت: {formatDurationFa(rec.durationSeconds)}</span>
                  <span className="ltr-num">RMS: {rec.rmsDb.toFixed(1)} dB</span>
                  <button
                    type="button"
                    onClick={() => onPracticeGusheh(rec.gushehId)}
                    className="font-bold text-teal-600 hover:underline dark:text-teal-300"
                  >
                    تمرین این گوشه ←
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
