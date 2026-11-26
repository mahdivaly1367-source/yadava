# Audio Sample Notices & Open Licenses (منابع و مجوزهای سمپل‌های صوتی واقعی)

Navanegar (نوانگار) bundles compact, YIN-calibrated studio acoustic recordings under `public/samples/` to power its hybrid acoustic engine alongside its physical-modeling synthesizer. Every included audio recording is sourced from verified open-licensed libraries:

## 1. Real Studio Persian Tombak Samples (`public/samples/tombak/`)
- **License**: Creative Commons Attribution 3.0 Unported (**CC BY 3.0**) — https://creativecommons.org/licenses/by/3.0/
- **Original Recording**: *"Tombak, Alireza.mp3"* by `sonsbcnintercultural` (Freesound #256123)
- **Round-Robin Slicing**: `sinak/zarbsaz` (https://github.com/sinak/zarbsaz)
- **Modifications**: Downsampled to 22,050 Hz 16-bit mono PCM, DC-offset removed, leading silence trimmed, and peak-normalized to -1.5 dBFS.

## 2. Versilian Community Sample Library (`public/samples/{daf,santur,lute,oud,ney}/`)
- **License**: Creative Commons Zero 1.0 Universal (**CC0 1.0 Public Domain**) — https://creativecommons.org/publicdomain/zero/1.0/
- **Source**: Versilian Studios LLC — Versilian Community Sample Library (`sgossner/VCSL`, https://github.com/sgossner/VCSL)
- **Instruments Used**:
  - `Frame Drum` (`daf/`)
  - `Psaltery, Bowed and Plucked` & `Dan Tranh` (`santur/`, `oud/`)
  - `Strumstick` (`lute/` — acoustically sculpted for Tar, Setar & Tanbur)
  - `Baroque Bass Recorder` & `Baroque Tenor Recorder` (`ney/` — acoustically sculpted with Iranian reed-edge breath articulation)
- **Modifications**: Trimmed, resampled to 22,050 Hz 16-bit mono PCM, YIN pitch-calibrated to concert frequency, zero-crossing loop points computed for sustained winds, and normalized.

## 3. Aliexpress Erhu Bowed Spike-Fiddle (`public/samples/kamancheh/`)
- **License**: Creative Commons Zero 1.0 Universal (**CC0 1.0 Public Domain**) — https://creativecommons.org/publicdomain/zero/1.0/
- **Source**: `sfzinstruments/aliexpress-erhu` (https://github.com/sfzinstruments/aliexpress-erhu)
- **Modifications**: Trimmed, resampled to 22,050 Hz 16-bit mono PCM, YIN pitch-calibrated, zero-crossing sustain loops computed, and shaped via Kamancheh mulberry-bowl formants.
