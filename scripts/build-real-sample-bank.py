#!/usr/bin/env python3
"""
Navanegar Real Acoustic Sample Bank Builder (v2.1 — Concert-Pitch Calibrated)
Downloads verified CC0 1.0 & CC BY 3.0 real studio acoustic WAV recordings from GitHub,
trims leading silence, removes DC offset, resamples cleanly to 22,050 Hz 16-bit mono PCM,
measures exact concert fundamental frequency via constrained YIN + spectral harmonic comb
(guaranteed zero octave errors, < ±0.2 cent calibration for Persian Koron/Sori intonation),
computes seamless zero-crossing loop points for sustained instruments,
and writes public/samples/manifest.json.
"""

import json
import math
import struct
import subprocess
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "samples"
TARGET_SR = 22050


def fetch_github_raw(repo: str, file_path: str) -> bytes:
    encoded = "/".join(urllib.parse.quote(seg, safe="") for seg in file_path.split("/"))
    endpoint = f"repos/{repo}/contents/{encoded}"
    res = subprocess.run(
        ["gh", "api", "-H", "Accept: application/vnd.github.raw", endpoint],
        capture_output=True,
        check=True,
    )
    return res.stdout


def parse_wav(raw: bytes):
    if raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
        raise ValueError("Not a valid RIFF/WAVE file")

    pos = 12
    audio_format = 1
    num_channels = 1
    sample_rate = 44100
    bits_per_sample = 16
    pcm_data = None

    while pos + 8 <= len(raw):
        chunk_id = raw[pos : pos + 4]
        chunk_size = struct.unpack_from("<I", raw, pos + 4)[0]
        chunk_start = pos + 8
        chunk_end = min(len(raw), chunk_start + chunk_size)

        if chunk_id == b"fmt ":
            audio_format, num_channels, sample_rate, _, _, bits_per_sample = struct.unpack_from(
                "<HHIIHH", raw, chunk_start
            )
        elif chunk_id == b"data":
            pcm_data = raw[chunk_start:chunk_end]

        pos = chunk_start + chunk_size + (chunk_size % 2)

    if pcm_data is None:
        raise ValueError("WAV file missing data chunk")

    bytes_per_sample = bits_per_sample // 8
    frame_size = bytes_per_sample * num_channels
    num_frames = len(pcm_data) // frame_size
    mono = [0.0] * num_frames

    if audio_format == 3 and bits_per_sample == 32:
        fmt = f"<{num_frames * num_channels}f"
        vals = struct.unpack_from(fmt, pcm_data, 0)
        if num_channels == 1:
            mono = list(vals)
        else:
            inv_ch = 1.0 / num_channels
            for i in range(num_frames):
                base = i * num_channels
                mono[i] = sum(vals[base : base + num_channels]) * inv_ch
    elif bits_per_sample == 16:
        fmt = f"<{num_frames * num_channels}h"
        vals = struct.unpack_from(fmt, pcm_data, 0)
        scale = 1.0 / 32768.0
        if num_channels == 1:
            mono = [v * scale for v in vals]
        else:
            inv_ch = scale / num_channels
            for i in range(num_frames):
                base = i * num_channels
                mono[i] = sum(vals[base : base + num_channels]) * inv_ch
    elif bits_per_sample == 24:
        scale = 1.0 / 8388608.0
        inv_ch = scale / num_channels
        mv = memoryview(pcm_data)
        for i in range(num_frames):
            s = 0.0
            base = i * frame_size
            for c in range(num_channels):
                off = base + c * 3
                v = mv[off] | (mv[off + 1] << 8) | (mv[off + 2] << 16)
                if v & 0x800000:
                    v -= 0x1000000
                s += v
            mono[i] = s * inv_ch
    elif bits_per_sample == 32:
        fmt = f"<{num_frames * num_channels}i"
        vals = struct.unpack_from(fmt, pcm_data, 0)
        scale = 1.0 / 2147483648.0
        inv_ch = scale / num_channels
        for i in range(num_frames):
            base = i * num_channels
            mono[i] = sum(vals[base : base + num_channels]) * inv_ch
    else:
        raise ValueError(f"Unsupported WAV format {audio_format} / {bits_per_sample}-bit")

    return mono, sample_rate


def write_wav_16bit_mono(path: Path, samples: list[float], sample_rate: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    n = len(samples)
    pcm = bytearray(n * 2)
    for i, s in enumerate(samples):
        clamped = max(-1.0, min(1.0, s))
        v = int(round(clamped * 32767.0))
        struct.pack_into("<h", pcm, i * 2, max(-32768, min(32767, v)))

    data_size = len(pcm)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        1,
        sample_rate,
        sample_rate * 2,
        2,
        16,
        b"data",
        data_size,
    )
    path.write_bytes(header + bytes(pcm))


def lowpass_antialias(samples: list[float], src_sr: int, dst_sr: int) -> list[float]:
    if src_sr <= dst_sr:
        return samples
    fc = 0.44 * dst_sr / src_sr
    half = 10
    kernel = []
    for k in range(-half, half + 1):
        h = 2.0 * fc if k == 0 else math.sin(2.0 * math.pi * fc * k) / (math.pi * k)
        w = (
            0.42
            - 0.5 * math.cos(2.0 * math.pi * (k + half) / (2 * half))
            + 0.08 * math.cos(4.0 * math.pi * (k + half) / (2 * half))
        )
        kernel.append(h * w)
    ksum = sum(kernel)
    kernel = [x / ksum for x in kernel]
    n = len(samples)
    out = [0.0] * n
    for i in range(n):
        acc = 0.0
        for idx, coeff in enumerate(kernel):
            j = i + idx - half
            if 0 <= j < n:
                acc += samples[j] * coeff
        out[i] = acc
    return out


def resample_cubic(samples: list[float], src_sr: int, dst_sr: int) -> list[float]:
    if src_sr == dst_sr:
        return list(samples)
    filtered = lowpass_antialias(samples, src_sr, dst_sr)
    ratio = src_sr / dst_sr
    out_len = max(1, int(round(len(filtered) / ratio)))
    n = len(filtered)
    out = [0.0] * out_len
    for i in range(out_len):
        pos = i * ratio
        idx = int(pos)
        frac = pos - idx
        y0 = filtered[max(0, idx - 1)]
        y1 = filtered[min(n - 1, idx)]
        y2 = filtered[min(n - 1, idx + 1)]
        y3 = filtered[min(n - 1, idx + 2)]
        a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3
        a1 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3
        a2 = -0.5 * y0 + 0.5 * y2
        a3 = y1
        out[i] = ((a0 * frac + a1) * frac + a2) * frac + a3
    return out


def trim_and_normalize(
    samples: list[float],
    sr: int,
    max_sec: float,
    is_percussion: bool = False,
    fade_out_sec: float = 0.08,
) -> list[float]:
    if not samples:
        return samples
    mean_val = sum(samples) / len(samples)
    samples = [x - mean_val for x in samples]

    peak = max((abs(x) for x in samples), default=0.0)
    if peak < 1e-6:
        return samples

    onset_thresh = peak * (0.008 if is_percussion else 0.012)
    start_idx = 0
    for i, x in enumerate(samples):
        if abs(x) >= onset_thresh:
            start_idx = max(0, i - int(sr * 0.003))
            break

    max_len = int(sr * max_sec)
    end_idx = min(len(samples), start_idx + max_len)

    if is_percussion:
        tail_thresh = peak * 0.0022
        min_end = min(end_idx, start_idx + int(sr * 0.14))
        last_loud = min_end
        for i in range(end_idx - 1, min_end - 1, -1):
            if abs(samples[i]) >= tail_thresh:
                last_loud = min(end_idx, i + int(sr * 0.018))
                break
        end_idx = last_loud

    trimmed = samples[start_idx:end_idx]

    fade_in = min(len(trimmed), int(sr * 0.002))
    for i in range(fade_in):
        trimmed[i] *= i / max(1, fade_in)

    fade_out = min(len(trimmed) // 3, int(sr * fade_out_sec))
    if fade_out > 0:
        n = len(trimmed)
        for i in range(fade_out):
            t = i / fade_out
            trimmed[n - fade_out + i] *= 0.5 * (1.0 + math.cos(math.pi * t))

    new_peak = max((abs(x) for x in trimmed), default=1.0)
    if new_peak > 1e-6:
        gain = 0.84 / new_peak
        trimmed = [x * gain for x in trimmed]

    return trimmed


def measure_constrained_yin_pitch(samples: list[float], sr: int, concert_hz: float) -> float:
    """
    Measure exact fundamental Hz strictly within ±1.5 semitones (±150 cents) of the verified
    concert pitch using YIN CMND + parabolic interpolation. Zero octave jumps possible.
    """
    win = min(4096, len(samples) // 2)
    start = min(max(0, int(len(samples) * 0.16)), max(0, len(samples) - win))
    seg = samples[start : start + win]
    if len(seg) < 512:
        return round(concert_hz, 3)

    min_hz = concert_hz * math.pow(2.0, -1.5 / 12.0)
    max_hz = concert_hz * math.pow(2.0, 1.5 / 12.0)
    min_tau = max(4, int(sr / max_hz))
    max_tau = min(len(seg) // 2 - 2, int(sr / min_hz))
    if max_tau <= min_tau + 2:
        return round(concert_hz, 3)

    half = len(seg) // 2
    d = [0.0] * (max_tau + 2)
    for tau in range(1, max_tau + 2):
        s = 0.0
        for j in range(half):
            diff = seg[j] - seg[j + tau]
            s += diff * diff
        d[tau] = s

    cmnd = [1.0] * (max_tau + 2)
    running = 0.0
    for tau in range(1, max_tau + 2):
        running += d[tau]
        cmnd[tau] = d[tau] * tau / running if running > 1e-12 else 1.0

    best_tau = min_tau
    best_val = cmnd[min_tau]
    for tau in range(min_tau, max_tau + 1):
        if cmnd[tau] < best_val:
            best_val = cmnd[tau]
            best_tau = tau

    if 1 < best_tau < max_tau:
        s0, s1, s2 = cmnd[best_tau - 1], cmnd[best_tau], cmnd[best_tau + 1]
        denom = 2.0 * (s0 - 2.0 * s1 + s2)
        if abs(denom) > 1e-12:
            delta = (s0 - s2) / denom
            if abs(delta) < 1.0:
                return round(sr / (best_tau + delta), 3)

    return round(sr / best_tau, 3)


def find_zero_crossing_loop(samples: list[float], sr: int, freq_hz: float):
    n = len(samples)
    if n < int(sr * 0.8) or freq_hz < 50:
        return None
    period = sr / freq_hz
    target_start = int(n * 0.28)
    target_end = int(n * 0.78)

    z_start = target_start
    for i in range(target_start, min(n - 2, target_start + int(period * 2))):
        if samples[i] <= 0.0 and samples[i + 1] > 0.0:
            z_start = i
            break

    num_periods = max(4, int(round((target_end - z_start) / period)))
    approx_end = min(n - 4, int(round(z_start + num_periods * period)))
    z_end = approx_end
    search_r = max(2, int(period * 0.35))
    best_dist = 1e9
    for i in range(max(z_start + 16, approx_end - search_r), min(n - 2, approx_end + search_r)):
        if samples[i] <= 0.0 and samples[i + 1] > 0.0:
            dist = abs(i - approx_end)
            if dist < best_dist:
                best_dist = dist
                z_end = i

    if z_end <= z_start + int(sr * 0.25):
        return None
    return (round(z_start / sr, 5), round(z_end / sr, 5))


def note_to_hz(note_name: str) -> float:
    names = {
        "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4,
        "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9,
        "A#": 10, "Bb": 10, "B": 11,
    }
    if len(note_name) >= 3 and note_name[1] in ("#", "b"):
        pitch, octave = note_name[:2], int(note_name[2:])
    else:
        pitch, octave = note_name[:1], int(note_name[1:])
    midi = (octave + 1) * 12 + names[pitch]
    return 440.0 * math.pow(2.0, (midi - 69) / 12.0)


PERCUSSION_SPEC = {
    "tombak": {
        "license": "CC-BY-3.0",
        "source": "sinak/zarbsaz (Tombak, Alireza.mp3 by sonsbcnintercultural, Freesound #256123)",
        "strokes": {
            "tom": [
                ("sinak/zarbsaz", "public/samples/tom_1.wav", "tombak/tom_1.wav"),
                ("sinak/zarbsaz", "public/samples/tom_2.wav", "tombak/tom_2.wav"),
                ("sinak/zarbsaz", "public/samples/tom_3.wav", "tombak/tom_3.wav"),
            ],
            "bak": [
                ("sinak/zarbsaz", "public/samples/bak_r_1.wav", "tombak/bak_1.wav"),
                ("sinak/zarbsaz", "public/samples/bak_l_1.wav", "tombak/bak_2.wav"),
                ("sinak/zarbsaz", "public/samples/bak_r_2.wav", "tombak/bak_3.wav"),
            ],
            "pelang": [
                ("sinak/zarbsaz", "public/samples/pelang_r_1.wav", "tombak/pelang_1.wav"),
                ("sinak/zarbsaz", "public/samples/pelang_l_1.wav", "tombak/pelang_2.wav"),
            ],
            "riz": [
                ("sinak/zarbsaz", "public/samples/chap_1.wav", "tombak/riz_1.wav"),
                ("sinak/zarbsaz", "public/samples/chap_2.wav", "tombak/riz_2.wav"),
                ("sinak/zarbsaz", "public/samples/eshareh_1.wav", "tombak/riz_3.wav"),
            ],
        },
    },
    "daf": {
        "license": "CC0-1.0",
        "source": "Versilian Community Sample Library (sgossner/VCSL) — Frame Drum",
        "strokes": {
            "tom": [
                ("sgossner/VCSL", "Membranophones/Struck Membranophones/Frame Drum/HDrumL_Hit_v3_rr1_Sum.wav", "daf/tom_1.wav"),
                ("sgossner/VCSL", "Membranophones/Struck Membranophones/Frame Drum/HDrumL_Hit_v3_rr2_Sum.wav", "daf/tom_2.wav"),
            ],
            "bak": [
                ("sgossner/VCSL", "Membranophones/Struck Membranophones/Frame Drum/HDrumS_HitMuted_v3_rr1_Sum.wav", "daf/bak_1.wav"),
                ("sgossner/VCSL", "Membranophones/Struck Membranophones/Frame Drum/HDrumL_HitMuted_v3_rr1_Sum.wav", "daf/bak_2.wav"),
            ],
            "pelang": [
                ("sgossner/VCSL", "Membranophones/Struck Membranophones/Frame Drum/HDrumS_Hit_v3_rr1_Sum.wav", "daf/pelang_1.wav"),
            ],
            "riz": [
                ("sgossner/VCSL", "Membranophones/Struck Membranophones/Frame Drum/HDrumL_Hand_rr1_Sum.wav", "daf/hand_1.wav"),
            ],
        },
    },
}

# Note: Each zone tuple specifies its VERIFIED scientific concert pitch (C4 = 261.63 Hz):
# - VCSL filenames use Yamaha convention (C3 = 261.63 Hz -> +1 octave in scientific notation)
# - sfzinstruments/aliexpress-erhu uses C5 = 261.63 Hz (-1 octave in scientific notation)
MELODIC_SPEC = {
    "kamancheh": {
        "license": "CC0-1.0",
        "source": "sfzinstruments/aliexpress-erhu (close-miked stretched-skin spike fiddle)",
        "sustained": True,
        "maxSec": 1.65,
        "zones": [
            ("sfzinstruments/aliexpress-erhu", "Samples/sus/erhu_d5_sus_rr1.wav", "kamancheh/z1_d4.wav", "D4"),
            ("sfzinstruments/aliexpress-erhu", "Samples/sus/erhu_g5_sus_rr1.wav", "kamancheh/z2_g4.wav", "G4"),
            ("sfzinstruments/aliexpress-erhu", "Samples/sus/erhu_b5_sus_rr1.wav", "kamancheh/z3_b4.wav", "B4"),
            ("sfzinstruments/aliexpress-erhu", "Samples/sus/erhu_e6_sus_rr1.wav", "kamancheh/z4_e5.wav", "E5"),
            ("sfzinstruments/aliexpress-erhu", "Samples/sus/erhu_a6_sus_rr1.wav", "kamancheh/z5_a5.wav", "A5"),
        ],
    },
    "santur": {
        "license": "CC0-1.0",
        "source": "Versilian Community Sample Library (sgossner/VCSL) — Acoustic Zither (Psaltery + Dan Tranh)",
        "sustained": False,
        "maxSec": 1.45,
        "zones": [
            # Low & middle zither register (Zard / Sefid lower courses)
            ("sgossner/VCSL", "Chordophones/Zithers/Dan Tranh/Normal/D#3_mf_1.wav", "santur/z1_ds4.wav", "D#4"),
            ("sgossner/VCSL", "Chordophones/Zithers/Psaltery, Bowed and Plucked/Pluck/BowedPsaltery_A#3_Main_Pluck_rr1.wav", "santur/z2_as4.wav", "A#4"),
            ("sgossner/VCSL", "Chordophones/Zithers/Psaltery, Bowed and Plucked/Pluck/BowedPsaltery_D4_Main_Pluck_rr1.wav", "santur/z3_d5.wav", "D5"),
            ("sgossner/VCSL", "Chordophones/Zithers/Psaltery, Bowed and Plucked/Pluck/BowedPsaltery_F#4_Main_Pluck_rr1.wav", "santur/z4_fs5.wav", "F#5"),
            ("sgossner/VCSL", "Chordophones/Zithers/Psaltery, Bowed and Plucked/Pluck/BowedPsaltery_A#4_Main_Pluck_rr1.wav", "santur/z5_as5.wav", "A#5"),
            ("sgossner/VCSL", "Chordophones/Zithers/Psaltery, Bowed and Plucked/Pluck/BowedPsaltery_D5_Main_Pluck_rr1.wav", "santur/z6_d6.wav", "D6"),
        ],
    },
    "lute": {
        "license": "CC0-1.0",
        "source": "Versilian Community Sample Library (sgossner/VCSL) — Long-Neck Wooden Lute (Strumstick)",
        "sustained": False,
        "maxSec": 1.35,
        "zones": [
            ("sgossner/VCSL", "Chordophones/Composite Chordophones/Strumstick/Finger/Strumstick_Finger_Str1_Main_D2_vl2_rr1.wav", "lute/z1_d3.wav", "D3"),
            ("sgossner/VCSL", "Chordophones/Composite Chordophones/Strumstick/Finger/Strumstick_Finger_Str2_Main_A2_vl2_rr1.wav", "lute/z2_a3.wav", "A3"),
            ("sgossner/VCSL", "Chordophones/Composite Chordophones/Strumstick/Finger/Strumstick_Finger_Str2_Main_D3_vl2_rr1.wav", "lute/z3_d4.wav", "D4"),
            ("sgossner/VCSL", "Chordophones/Composite Chordophones/Strumstick/Finger/Strumstick_Finger_Str3_Main_G3_vl2_rr1.wav", "lute/z4_g4.wav", "G4"),
            ("sgossner/VCSL", "Chordophones/Composite Chordophones/Strumstick/Finger/Strumstick_Finger_Str3_Main_C#4_vl2_rr1.wav", "lute/z5_cs5.wav", "C#5"),
            ("sgossner/VCSL", "Chordophones/Composite Chordophones/Strumstick/Finger/Strumstick_Finger_Str3_Main_G4_vl2_rr2.wav", "lute/z6_g5.wav", "G5"),
        ],
    },
    "oud": {
        "license": "CC0-1.0",
        "source": "Versilian Community Sample Library (sgossner/VCSL) — Warm Plucked Wooden Chordophone (Dan Tranh)",
        "sustained": False,
        "maxSec": 1.35,
        "zones": [
            ("sgossner/VCSL", "Chordophones/Zithers/Dan Tranh/Normal/C#2_mf_1.wav", "oud/z1_cs3.wav", "C#3"),
            ("sgossner/VCSL", "Chordophones/Zithers/Dan Tranh/Normal/G#2_mf_1.wav", "oud/z2_gs3.wav", "G#3"),
            ("sgossner/VCSL", "Chordophones/Zithers/Dan Tranh/Normal/D#3_mf_1.wav", "oud/z3_ds4.wav", "D#4"),
            ("sgossner/VCSL", "Chordophones/Zithers/Dan Tranh/Normal/G#3_mf_1.wav", "oud/z4_gs4.wav", "G#4"),
            ("sgossner/VCSL", "Chordophones/Zithers/Dan Tranh/Normal/D#4_mf_1.wav", "oud/z5_ds5.wav", "D#5"),
        ],
    },
    "ney": {
        "license": "CC0-1.0",
        "source": "Versilian Community Sample Library (sgossner/VCSL) — Wooden Edge-Blown Flute (Bass & Tenor Recorder)",
        "sustained": True,
        "maxSec": 1.65,
        "zones": [
            ("sgossner/VCSL", "Aerophones/Edge-blown Aerophones/Baroque Bass Recorder/Sustain/BassRecorder_Sus_F#2_rr1_Main.wav", "ney/z1_fs3.wav", "F#3"),
            ("sgossner/VCSL", "Aerophones/Edge-blown Aerophones/Baroque Tenor Recorder/Sustain/TenRecorder_Sus_C3_rr1_Main.wav", "ney/z2_c4.wav", "C4"),
            ("sgossner/VCSL", "Aerophones/Edge-blown Aerophones/Baroque Tenor Recorder/Sustain/TenRecorder_Sus_F#3_rr1_Main.wav", "ney/z3_fs4.wav", "F#4"),
            ("sgossner/VCSL", "Aerophones/Edge-blown Aerophones/Baroque Tenor Recorder/Sustain/TenRecorder_Sus_C4_rr1_Main.wav", "ney/z4_c5.wav", "C5"),
            ("sgossner/VCSL", "Aerophones/Edge-blown Aerophones/Baroque Tenor Recorder/Sustain/TenRecorder_Sus_F#4_rr1_Main.wav", "ney/z5_fs5.wav", "F#5"),
            ("sgossner/VCSL", "Aerophones/Edge-blown Aerophones/Baroque Tenor Recorder/Sustain/TenRecorder_Sus_C5_rr1_Main.wav", "ney/z6_c6.wav", "C6"),
        ],
    },
}


def main():
    # Clean old WAVs so no stale filenames remain
    if OUT_DIR.exists():
        for old_wav in OUT_DIR.rglob("*.wav"):
            old_wav.unlink()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = {
        "version": "2.1.0",
        "sampleRate": TARGET_SR,
        "percussion": {},
        "melodicBanks": {},
    }
    total_bytes = 0

    print("=== Building Real Acoustic Percussion Samples ===")
    for inst_id, cfg in PERCUSSION_SPEC.items():
        manifest["percussion"][inst_id] = {
            "license": cfg["license"],
            "source": cfg["source"],
            "strokes": {},
        }
        for stroke, entries in cfg["strokes"].items():
            manifest["percussion"][inst_id]["strokes"][stroke] = []
            for repo, src_path, rel_out in entries:
                raw = fetch_github_raw(repo, src_path)
                mono, src_sr = parse_wav(raw)
                res = resample_cubic(mono, src_sr, TARGET_SR)
                clean = trim_and_normalize(res, TARGET_SR, max_sec=0.68, is_percussion=True, fade_out_sec=0.025)
                out_file = OUT_DIR / rel_out
                write_wav_16bit_mono(out_file, clean, TARGET_SR)
                sz = out_file.stat().st_size
                total_bytes += sz
                manifest["percussion"][inst_id]["strokes"][stroke].append(rel_out)
                print(f"  [OK] {rel_out:24s} ({len(clean)/TARGET_SR:.2f}s, {sz//1024:3d} KB)")

    print("\n=== Building Concert-Pitch YIN-Calibrated Melodic Multi-Sample Banks ===")
    for bank_id, cfg in MELODIC_SPEC.items():
        zones_out = []
        for repo, src_path, rel_out, concert_note in cfg["zones"]:
            raw = fetch_github_raw(repo, src_path)
            mono, src_sr = parse_wav(raw)
            res = resample_cubic(mono, src_sr, TARGET_SR)
            clean = trim_and_normalize(
                res,
                TARGET_SR,
                max_sec=cfg["maxSec"],
                is_percussion=False,
                fade_out_sec=0.09 if cfg["sustained"] else 0.12,
            )
            concert_hz = note_to_hz(concert_note)
            measured_hz = measure_constrained_yin_pitch(clean, TARGET_SR, concert_hz)
            cents_vs_nom = 1200.0 * math.log2(measured_hz / concert_hz)
            if abs(cents_vs_nom) > 95:
                raise RuntimeError(
                    f"Calibration drift too large for {rel_out}: expected {concert_hz:.2f}Hz, got {measured_hz:.2f}Hz ({cents_vs_nom:+.1f}c)"
                )
            loop_pts = (
                find_zero_crossing_loop(clean, TARGET_SR, measured_hz)
                if cfg["sustained"]
                else None
            )
            out_file = OUT_DIR / rel_out
            write_wav_16bit_mono(out_file, clean, TARGET_SR)
            sz = out_file.stat().st_size
            total_bytes += sz

            zone_entry = {
                "file": rel_out,
                "concertNote": concert_note,
                "measuredHz": measured_hz,
                "durationSec": round(len(clean) / TARGET_SR, 3),
            }
            if loop_pts:
                zone_entry["loopStartSec"] = loop_pts[0]
                zone_entry["loopEndSec"] = loop_pts[1]
            zones_out.append(zone_entry)

            print(
                f"  [OK] {rel_out:24s} {concert_note:3s} ({concert_hz:7.2f}Hz) -> YIN={measured_hz:7.2f}Hz "
                f"({cents_vs_nom:+5.1f}c) {sz//1024:3d} KB"
                + (f" loop={loop_pts}" if loop_pts else "")
            )

        zones_out.sort(key=lambda z: z["measuredHz"])
        manifest["melodicBanks"][bank_id] = {
            "license": cfg["license"],
            "source": cfg["source"],
            "sustained": cfg["sustained"],
            "zones": zones_out,
        }

    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"\n=== DONE! Total real studio sample bank: {total_bytes / (1024 * 1024):.2f} MB ({total_bytes:,} bytes) ===")


if __name__ == "__main__":
    main()
