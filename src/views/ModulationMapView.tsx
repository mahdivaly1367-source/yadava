import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Crown, Lock, Play, Volume2 } from 'lucide-react';
import { playGushehPhrase } from '../audio/karplusStrong';
import {
  ALL_GUSHEHS,
  isDastgahUnlocked,
  RADIF_SYSTEMS,
  SYSTEM_BY_ID,
} from '../data/radifData';
import type { Gusheh, InstrumentId, KoronMode } from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface ModulationMapViewProps {
  isPro: boolean;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  onPracticeGusheh: (gushehId: string) => void;
  onRequestUpgrade: () => void;
}

interface ModulationEdge {
  id: string;
  fromSystemId: string;
  toSystemId: string;
  pivotGusheh: Gusheh;
  labelFa: string;
  alteredNoteFa: string;
}

// Carefully arranged circular-constellation coordinates for all 12 modal systems
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  shur: { x: 420, y: 245 },          // Center Mother System (شور)
  abuata: { x: 255, y: 120 },
  bayat_tork: { x: 420, y: 78 },
  afshari: { x: 590, y: 120 },
  dashti: { x: 675, y: 245 },
  mahur: { x: 590, y: 390 },
  nava: { x: 420, y: 425 },
  homayun: { x: 255, y: 390 },
  bayat_esfahan: { x: 115, y: 315 },
  segah: { x: 115, y: 180 },
  chahargah: { x: 185, y: 475 },
  rast_panjgah: { x: 660, y: 465 },
};

export const ModulationMapView: React.FC<ModulationMapViewProps> = ({
  isPro,
  instrument,
  a4Hz,
  koronMode,
  onPracticeGusheh,
  onRequestUpgrade,
}) => {
  const [selectedSystemId, setSelectedSystemId] = useState<string>('shur');

  const edges = useMemo<ModulationEdge[]>(() => {
    const list: ModulationEdge[] = [];
    for (const g of ALL_GUSHEHS) {
      for (const mod of g.modulations) {
        if (SYSTEM_BY_ID[mod.targetDastgahId]) {
          list.push({
            id: `${g.id}__${mod.targetDastgahId}`,
            fromSystemId: g.dastgahId,
            toSystemId: mod.targetDastgahId,
            pivotGusheh: g,
            labelFa: mod.labelFa,
            alteredNoteFa: mod.alteredNoteFa,
          });
        }
      }
    }
    return list;
  }, []);

  const selectedSystem = SYSTEM_BY_ID[selectedSystemId] ?? RADIF_SYSTEMS[0];
  const selectedUnlocked = isDastgahUnlocked(selectedSystem.id, isPro);

  const connectedEdges = useMemo(
    () =>
      edges.filter(
        (e) => e.fromSystemId === selectedSystemId || e.toSystemId === selectedSystemId
      ),
    [edges, selectedSystemId]
  );

  const auditionPivot = (g: Gusheh) => {
    playGushehPhrase(g.melody, {
      instrument,
      bpm: g.practiceLoop.defaultBpm,
      speedMultiplier: 1.0,
      a4Hz,
      koronMode,
      startIndex: 0,
      endIndex: Math.min(g.melody.length - 1, 6),
      loop: false,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              نقشه تعاملی مدولاسیون و مرکب‌خوانی ردیف
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              روی هر دستگاه یا آواز کلیک کنید تا گوشه‌های واسطه، نت‌های متغیر و مسیرهای گذر مُدال را بشنوید و تمرین کنید.
            </p>
          </div>
          {!isPro && (
            <button
              type="button"
              onClick={onRequestUpgrade}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-l from-amber-500 to-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow"
            >
              <Crown className="h-4 w-4" />
              بازکردن کامل نقشه ۱۲ دستگاه (Pro)
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Interactive Constellation Map SVG */}
        <div className="rounded-3xl border border-slate-200/80 bg-slate-950 p-3 shadow-lg lg:col-span-7">
          <svg
            viewBox="0 0 800 530"
            className="h-[420px] w-full select-none sm:h-[470px]"
            role="img"
            aria-label="نقشه مدولاسیون ۱۲ دستگاه و آواز موسیقی ایرانی"
          >
            {/* Subtle orbital guide rings */}
            <circle cx="420" cy="245" r="175" fill="none" stroke="rgba(148,163,184,0.12)" strokeDasharray="6 6" />
            <circle cx="420" cy="245" r="275" fill="none" stroke="rgba(148,163,184,0.08)" strokeDasharray="4 8" />

            {/* Modulation edges */}
            {edges.map((edge) => {
              const p1 = NODE_POSITIONS[edge.fromSystemId];
              const p2 = NODE_POSITIONS[edge.toSystemId];
              if (!p1 || !p2) return null;
              const isHighlighted =
                edge.fromSystemId === selectedSystemId || edge.toSystemId === selectedSystemId;
              const mx = (p1.x + p2.x) / 2;
              const my = (p1.y + p2.y) / 2 - 22;

              return (
                <path
                  key={edge.id}
                  d={`M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`}
                  fill="none"
                  stroke={isHighlighted ? '#2dd4bf' : 'rgba(148,163,184,0.22)'}
                  strokeWidth={isHighlighted ? 2.6 : 1.2}
                  strokeDasharray={isHighlighted ? undefined : '4 4'}
                />
              );
            })}

            {/* 12 Modal System Nodes */}
            {RADIF_SYSTEMS.map((sys) => {
              const pos = NODE_POSITIONS[sys.id];
              if (!pos) return null;
              const isSelected = sys.id === selectedSystemId;
              const unlocked = isDastgahUnlocked(sys.id, isPro);
              const isNeighbor = connectedEdges.some(
                (e) => e.fromSystemId === sys.id || e.toSystemId === sys.id
              );

              return (
                <g
                  key={sys.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedSystemId(sys.id)}
                >
                  {isSelected && (
                    <circle
                      r={44}
                      fill={sys.colorHex}
                      fillOpacity="0.22"
                      stroke={sys.colorHex}
                      strokeWidth="2"
                    />
                  )}
                  <circle
                    r={sys.id === 'shur' ? 35 : 29}
                    fill={isSelected ? sys.colorHex : '#0f172a'}
                    stroke={isSelected ? '#ffffff' : isNeighbor ? '#2dd4bf' : sys.colorHex}
                    strokeWidth={isSelected ? 3 : 2}
                    opacity={unlocked ? 1 : 0.72}
                  />
                  <text
                    y={-2}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="800"
                  >
                    {sys.nameFa.replace('دستگاه ', '').replace('آواز ', '')}
                  </text>
                  <text
                    y={14}
                    textAnchor="middle"
                    fill={isSelected ? '#fef3c7' : '#94a3b8'}
                    fontSize="9"
                    fontWeight="600"
                  >
                    {unlocked ? `${toPersianDigits(sys.gushehs.length)} گوشه` : 'Pro 🔒'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Node Details & Pivot Transitions */}
        <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm lg:col-span-5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: selectedSystem.colorHex }}
                />
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {selectedSystem.nameFa}
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {selectedSystem.moodFa}
              </p>
            </div>
            <span className="rounded-full bg-teal-500/15 px-2.5 py-1 text-xs font-bold text-teal-700 dark:text-teal-300">
              {toPersianDigits(connectedEdges.length)} پیوند مُدال
            </span>
          </div>

          <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
            {selectedSystem.summaryFa}
          </p>

          {!selectedUnlocked && (
            <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">
                  این دستگاه در نسخه حرفه‌ای (Pro) باز می‌شود.
                </span>
                <button
                  type="button"
                  onClick={onRequestUpgrade}
                  className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-extrabold text-slate-950"
                >
                  ارتقا
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200">
              <ArrowLeftRight className="h-4 w-4 text-teal-500" />
              گذرها و گوشه‌های واسطه (مرکب‌خوانی)
            </h3>

            {connectedEdges.map((edge) => {
              const fromSys = SYSTEM_BY_ID[edge.fromSystemId];
              const toSys = SYSTEM_BY_ID[edge.toSystemId];
              const pivotUnlocked = isDastgahUnlocked(edge.pivotGusheh.dastgahId, isPro);

              return (
                <div
                  key={edge.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/75 p-3 dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {fromSys?.nameFa} ← {toSys?.nameFa}
                    </span>
                    <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      واسطه: {edge.pivotGusheh.nameFa}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                    {edge.labelFa} — نت متغیر/محوری: <strong>{edge.alteredNoteFa}</strong>
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        pivotUnlocked
                          ? auditionPivot(edge.pivotGusheh)
                          : onRequestUpgrade()
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
                    >
                      <Volume2 className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                      شنیدن گذار
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        pivotUnlocked
                          ? onPracticeGusheh(edge.pivotGusheh.id)
                          : onRequestUpgrade()
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-teal-700"
                    >
                      {pivotUnlocked ? (
                        <>
                          <Play className="h-3 w-3" />
                          تمرین گوشه واسطه
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3" />
                          نیاز به Pro
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
