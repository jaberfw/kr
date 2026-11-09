#!/usr/bin/env python3
"""
generate_audio.py
-----------------
Creates the audio files for the EPS Korean Vocabulary Quiz from database.json
using Microsoft Edge neural voices (the free `edge-tts` package; needs internet).

For every word id it writes up to three files:

    audio/kor/<id>.mp3   Korean word   (database field "korean")
    audio/bng/<id>.mp3   Bangla word   (database field "bengali")
    audio/eng/<id>.mp3   English word  (database field "english")

Put this file next to database.json and run:

    pip install edge-tts
    python generate_audio.py

Handy options (all optional):

    python generate_audio.py --langs kor            only Korean
    python generate_audio.py --langs bng,eng        only Bangla + English
    python generate_audio.py --start-id 1 --end-id 50
    python generate_audio.py --lessons 6,7,8        only those lessons
    python generate_audio.py --rate=-15%            speak slower (note the "=")
    python generate_audio.py --force                re-create files that already exist
    python generate_audio.py --dry-run              show what would be created
    python generate_audio.py --list-voices          list Korean/Bangla/English voices

    python generate_audio.py --check                only report which audio files are missing

Every run first scans the audio folders and compares them with database.json:
files that already exist (and are valid) are skipped, only the MISSING ones are
generated. Tiny/broken files (and leftover *.part files from a stopped run) count
as missing and are re-created. You can stop and re-run any time.
Words that fail are listed in failed_audio.txt - just run the script again to retry them.
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
MIN_VALID_BYTES = 200   # anything smaller than this is treated as a broken/empty mp3

# Default voices (change with --voice-kor / --voice-bng / --voice-eng).
DEFAULT_VOICES = {
    "kor": "ko-KR-SunHiNeural",       # alternative: ko-KR-InJoonNeural (male)
    "bng": "bn-BD-NabanitaNeural",    # alternative: bn-BD-PradeepNeural (male)
    "eng": "en-US-JennyNeural",       # alternative: en-US-GuyNeural (male)
}

# language folder -> database field holding the text to speak
FIELDS = {"kor": "korean", "bng": "bengali", "eng": "english"}


def clean_text(text):
    """Make a dictionary-style entry sound natural when read aloud."""
    text = (text or "").strip()
    text = text.replace("/", ", ")                  # "teacher / student" -> short pause
    text = re.sub(r"\s*[()（）]\s*", ", ", text)    # "가운데(중간)" -> "가운데, 중간"
    text = re.sub(r"\s*,\s*(,\s*)+", ", ", text)    # collapse repeated commas
    text = re.sub(r"\s+", " ", text).strip(" ,")
    return text


def load_words(db_path, lessons=None):
    with open(db_path, encoding="utf-8") as f:
        db = json.load(f)
    words = []
    for lesson in db.get("lessons", []):
        if lessons and lesson.get("lesson") not in lessons:
            continue
        for w in lesson.get("words", []):
            words.append(w)
    return words


def is_valid_audio(path):
    try:
        return os.path.getsize(path) > MIN_VALID_BYTES
    except OSError:
        return False


def scan_folder(folder):
    """Return (set of word ids that already have a valid mp3, number of broken files, leftover .part files removed)."""
    present, broken, parts = set(), 0, 0
    if not os.path.isdir(folder):
        return present, broken, parts
    for name in os.listdir(folder):
        full = os.path.join(folder, name)
        if name.endswith(".part"):                       # leftover from a stopped run
            try:
                os.remove(full)
                parts += 1
            except OSError:
                pass
            continue
        stem, ext = os.path.splitext(name)
        if ext.lower() != ".mp3" or not stem.isdigit():
            continue
        if is_valid_audio(full):
            present.add(int(stem))
        else:
            broken += 1
    return present, broken, parts


def parse_args():
    p = argparse.ArgumentParser(description="Generate word audio (mp3) from database.json with edge-tts.")
    p.add_argument("--db", default=os.path.join(HERE, "database.json"), help="path to database.json (default: next to this script)")
    p.add_argument("--out", default=os.path.join(HERE, "audio"), help="output folder (default: audio/ next to this script)")
    p.add_argument("--langs", default="kor,bng,eng", help="comma list of: kor,bng,eng (default: all three)")
    p.add_argument("--start-id", type=int, default=None, help="first word id to generate")
    p.add_argument("--end-id", type=int, default=None, help="last word id to generate")
    p.add_argument("--lessons", default=None, help="comma list of lesson numbers, e.g. 6,7,8")
    p.add_argument("--voice-kor", default=DEFAULT_VOICES["kor"])
    p.add_argument("--voice-bng", default=DEFAULT_VOICES["bng"])
    p.add_argument("--voice-eng", default=DEFAULT_VOICES["eng"])
    p.add_argument("--rate", default="+0%", help='speaking speed, e.g. "-10%%" slower / "+10%%" faster (use --rate=-10%%)')
    p.add_argument("--concurrency", type=int, default=5, help="parallel downloads (default 5; lower it if you get errors)")
    p.add_argument("--retries", type=int, default=4, help="retries per file (default 4)")
    p.add_argument("--force", action="store_true", help="overwrite files that already exist")
    p.add_argument("--dry-run", action="store_true", help="only print what would be generated")
    p.add_argument("--check", action="store_true", help="only report which audio files are missing, then exit")
    p.add_argument("--list-voices", action="store_true", help="list Korean / Bangla / English voices and exit")
    return p.parse_args()


async def list_voices(edge_tts):
    voices = await edge_tts.list_voices()
    for v in sorted(voices, key=lambda x: x["ShortName"]):
        if v["Locale"].startswith(("ko-", "bn-", "en-US", "en-GB")):
            print(f'{v["ShortName"]:<32} {v["Gender"]:<7} {v["Locale"]}')


async def make_one(edge_tts, sem, job, args, stats):
    """Create a single mp3 (writes to a temp file first so a stopped run never leaves a broken mp3)."""
    path, text, voice, label = job
    tmp = path + ".part"
    async with sem:
        for attempt in range(1, args.retries + 1):
            try:
                await edge_tts.Communicate(text, voice, rate=args.rate).save(tmp)
                if os.path.getsize(tmp) <= MIN_VALID_BYTES:                       # suspiciously tiny = no audio came back
                    raise RuntimeError("empty audio")
                os.replace(tmp, path)
                stats["done"] += 1
                break
            except Exception as err:                                  # network hiccup, throttling, bad text...
                if os.path.exists(tmp):
                    os.remove(tmp)
                if attempt == args.retries:
                    stats["failed"].append(f"{label}\t{voice}\t{text}\t{type(err).__name__}: {err}")
                else:
                    await asyncio.sleep(1.5 * attempt)
        stats["seen"] += 1
        if stats["seen"] % 25 == 0 or stats["seen"] == stats["total"]:
            elapsed = time.time() - stats["t0"]
            print(f'  {stats["seen"]}/{stats["total"]}  created {stats["done"]}  failed {len(stats["failed"])}  ({elapsed:0.0f}s)', flush=True)


async def main():
    args = parse_args()

    edge_tts = None
    try:
        import edge_tts
    except ImportError:
        # Only needed for real generation / listing voices; --check and --dry-run work without it.
        if not (args.check or args.dry_run):
            print("The 'edge-tts' package is missing. Install it with:\n\n    pip install edge-tts\n")
            sys.exit(1)

    if args.list_voices:
        await list_voices(edge_tts)
        return

    langs = [l.strip() for l in args.langs.split(",") if l.strip()]
    bad = [l for l in langs if l not in FIELDS]
    if bad:
        sys.exit(f"Unknown language(s): {', '.join(bad)}. Use kor, bng, eng.")

    lessons = {int(x) for x in args.lessons.split(",")} if args.lessons else None
    if not os.path.exists(args.db):
        sys.exit(f"Cannot find {args.db}. Run this script from the folder that contains database.json "
                 f"(or pass --db path/to/database.json).")

    words = load_words(args.db, lessons)
    if args.start_id is not None:
        words = [w for w in words if w["id"] >= args.start_id]
    if args.end_id is not None:
        words = [w for w in words if w["id"] <= args.end_id]
    if not words:
        sys.exit("No words match your filters.")

    voices = {"kor": args.voice_kor, "bng": args.voice_bng, "eng": args.voice_eng}
    jobs, skipped, empty = [], 0, 0
    missing_ids = {}
    print(f"Audio folder: {os.path.abspath(args.out)}")
    print(f"Words in database: {len(words)}\n")
    print(f"  {'lang':<5}{'have':>7}{'missing':>9}{'broken':>8}")
    for lang in langs:
        folder = os.path.join(args.out, lang)
        os.makedirs(folder, exist_ok=True)
        present, broken, parts = scan_folder(folder)
        lang_missing = []
        for w in words:
            text = clean_text(w.get(FIELDS[lang]))
            if not text:
                empty += 1
                continue
            if w["id"] in present and not args.force:
                skipped += 1                              # already there -> skip
                continue
            path = os.path.join(folder, f'{w["id"]}.mp3')
            lang_missing.append(w["id"])
            jobs.append((path, text, voices[lang], f'{lang}/{w["id"]}'))
        missing_ids[lang] = lang_missing
        have = sum(1 for w in words if w["id"] in present)
        print(f"  {lang:<5}{have:>7}{len(lang_missing):>9}{broken:>8}")
    print()

    if args.check:
        for lang in langs:
            ids = missing_ids[lang]
            if ids:
                shown = ", ".join(str(i) for i in ids[:60])
                more = f" ... (+{len(ids) - 60} more)" if len(ids) > 60 else ""
                print(f"Missing {lang}: {shown}{more}")
        if not jobs:
            print("Nothing is missing - all audio files exist.")
        return

    for lang in langs:
        ids = missing_ids[lang]
        if ids:
            shown = ", ".join(str(i) for i in ids[:40])
            more = f" ... (+{len(ids) - 40} more)" if len(ids) > 40 else ""
            print(f"Missing {lang} ids: {shown}{more}")
    print(f"Languages: {', '.join(langs)}")
    print(f"To create (missing): {len(jobs)}   already exist (skipped): {skipped}   empty text: {empty}")
    if args.dry_run:
        for path, text, voice, _ in jobs[:20]:
            print(f"  {path}  <-  [{voice}] {text}")
        if len(jobs) > 20:
            print(f"  ... and {len(jobs) - 20} more")
        return
    if not jobs:
        print("Nothing to do - all audio files already exist.")
        return

    stats = {"done": 0, "seen": 0, "total": len(jobs), "failed": [], "t0": time.time()}
    sem = asyncio.Semaphore(max(1, args.concurrency))
    print("Generating... (you can stop with Ctrl+C and run again later; finished files are kept)")
    await asyncio.gather(*(make_one(edge_tts, sem, job, args, stats) for job in jobs))

    print(f'\nFinished. Created {stats["done"]} file(s) in {time.time() - stats["t0"]:0.0f}s.')
    if stats["failed"]:
        with open("failed_audio.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(stats["failed"]) + "\n")
        print(f'{len(stats["failed"])} file(s) failed - see failed_audio.txt. Run the script again to retry them.')
    elif os.path.exists("failed_audio.txt"):
        os.remove("failed_audio.txt")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nStopped. Run again to continue where you left off.")
