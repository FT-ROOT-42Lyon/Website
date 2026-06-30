#!/usr/bin/env python3
"""
Import CTFd correct submissions into the ft_root platform.

  - Reads CHALLENGE.json / SUBMISSION.json / USERS.json from the same dir
  - Maps each CTFd challenge to the platform's slug (some names were
    translated to French on the new platform — see CHALLENGE_MAP below)
  - Maps CTFd user_id to the 42 login via USERS.json
  - For each "correct" submission, emits an INSERT ... ON CONFLICT DO NOTHING
    so already-imported solves are silently skipped
  - Then recomputes user.score and event_member.score from the canonical
    solve table so the global + per-event leaderboards stay consistent

Usage from the repo root:

    python3 db/import_solves.py | \
      docker compose -f platform/docker-compose.yml exec -T postgres \
      psql -U ftroot -d ftroot -v ON_ERROR_STOP=1

The script prints the SQL to stdout and a summary to stderr.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).parent

# ─── Hand-built mapping: CTFd challenge name → platform slug ─────────────────
# The platform's slug is the kebab-case of the (sometimes-translated) title.
CHALLENGE_MAP: dict[str, str] = {
    "HTML - disabled buttons": "html-boutons-desactives",
    "Javascript - Authentication": "javascript-authentification",
    "Javascript - Source": "javascript-source",
    "Javascript - Authentication 2": "javascript-authentification-2",
    "Javascript - Obfuscation 1": "javascript-obfuscation-1",
    "Javascript - Obfuscation 2": "javascript-obfuscation-2",
    "Javascript - Obfuscation 3": "javascript-obfuscation-3",
    "Javascript - Native code": "javascript-native-code",
    "HTML - Source code": "html-code-source",
    "HTTP - IP restriction bypass": "http-contournement-de-filtrage-ip",
    "Weak password": "mot-de-passe-faible",
    "Bash - System 1": "bash-system-1",
    "ELF x86 0 protection": "elf-x86-0-protection",
    "HTTP - Open redirect": "http-open-redirect",
    "HTTP - User-agent": "http-user-agent",
    "PHP - Command injection": "php-injection-de-commande",
    "API - Broken Access": "api-broken-access",
    "Backup file": "fichier-de-sauvegarde",
    "HTTP - Directory indexing": "http-directory-indexing",
    "HTTP - Headers": "http-headers",
    "HTTP - POST": "http-post",
    "HTTP - Improper redirect": "http-redirection-invalide",
    "HTTP - Verb tampering": "http-verb-tampering",
    "Install files": "install-files",
    "Nginx - Alias Misconfiguration": "nginx-alias-misconfiguration",
    "Nginx - Root Location Misconfiguration": "nginx-root-location-misconfiguration",
    "API - Mass Assignment": "api-mass-assignment",
    "HTTP - Cookies": "http-cookies",
    "sudo - weak configuration": "sudo-faiblesse-de-configuration",
    "Bash - System 2": "bash-system-2",
    "Bash - cron": "bash-cron",
    "Python - input()": "python-input",
    "Python - pickle": "python-pickle",
    "Bash - unquoted expression injection": "bash-unquoted-expression-injection",
    "Perl - Command injection": "perl-command-injection",
    "Encoding - ASCII": "encodage-ascii",
    "Encoding - UU": "encodage-uu",
    "Hash - Message Digest 5": "hash-message-digest-5",
    "EXIF - Metadata": "exif-metadata",
    "Dot and next line": "point-a-la-ligne",
    "Steganomobile": "steganomobile",
    "Javascript - Webpack": "javascript-webpack",
    "ELF x86 - Basique": "rootme-elf-x86-basique",
    "PE x86 - 0 protection": "pe-x86-0-protection",
    "ELF C++ - 0 protection": "rootme-elf-c-0-protection",
    "Godot - 0 protection": "rootme-godot-0-protection",
    "PE DotNet - 0 protection": "rootme-pe-dotnet-0-protection",
    "APK - Introduction": "rootme-apk-introduction",
    "ELF MIPS - Basic Crackme": "elf-mips-basic-crackme",
    "ELF x64 - Golang basique": "elf-x64-golang-basique",
    "ELF x86 - Fake Instructions": "elf-x86-fake-instructions",
    "ELF x86 - Ptrace": "elf-x86-ptrace",
    "Godot - Bytecode": "godot-bytecode",
    "WASM - Introduction": "wasm-introduction",
    "APK - Flutter Debug": "apk-flutter-debug",
    "ELF ARM - Basic Crackme": "elf-arm-basic-crackme",
    "ELF x64 - Basic KeygenMe": "elf-x64-basic-keygenme",
    "Gestion de sauvegarde sous Unity3D": "gestion-de-sauvegarde-sous-unity3d",
    "Godot - Mono": "godot-mono",
    "PE DotNet - Basic Anti-Debug": "pe-dotnet-basic-anti-debug",
    "PE DotNet - Basic Crackme": "pe-dotnet-basic-crackme",
    "PYC - ByteCode": "pyc-bytecode",
    "Basic ? crackme": "basic-crackme",
    "ELF x86 - Pas de points d’arrêt logiciels": "elf-x86-pas-de-points-d-arret-logiciels",
    "Lua - Bytecode": "lua-bytecode",
    "Voracious Nanomites": "voracious-nanomites",
    "ELF x64 - Nanomites": "elf-x64-nanomites",
    "ELF x64 - Nanomites - Introduction": "elf-x64-nanomites-introduction",
}


def sql_quote(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main() -> int:
    challenges = {
        c["id"]: c for c in json.loads((HERE / "CHALLENGE.json").read_text())["results"]
    }
    submissions = json.loads((HERE / "SUBMISSION.json").read_text())["results"]
    raw_users = json.loads((HERE / "USERS.json").read_text())["results"]

    user_login: dict[int, str] = {}
    for entry in raw_users:
        if entry["type"] == "user" and entry["field_id"] == 1 and entry["user_id"]:
            user_login[entry["user_id"]] = entry["value"]

    # Detect any unmapped challenge ids
    unmapped: set[str] = set()
    for ch in challenges.values():
        if ch["name"] not in CHALLENGE_MAP:
            unmapped.add(ch["name"])
    if unmapped:
        print("[ERROR] Unmapped CTFd challenges:", file=sys.stderr)
        for name in sorted(unmapped):
            print(f"  - {name!r}", file=sys.stderr)
        return 1

    rows: list[tuple[str, str, int, str]] = []
    skipped_user: dict[int, int] = {}
    skipped_chal: dict[int, int] = {}
    for s in submissions:
        if s["type"] != "correct":
            continue
        uid = s["user_id"]
        cid = s["challenge_id"]
        login = user_login.get(uid)
        if not login:
            skipped_user[uid] = skipped_user.get(uid, 0) + 1
            continue
        ch = challenges.get(cid)
        if not ch:
            skipped_chal[cid] = skipped_chal.get(cid, 0) + 1
            continue
        slug = CHALLENGE_MAP[ch["name"]]
        rows.append((login, slug, ch["value"], s["date"]))

    if skipped_user:
        print(f"[warn] skipped {sum(skipped_user.values())} submissions from "
              f"{len(skipped_user)} unknown CTFd users", file=sys.stderr)
    if skipped_chal:
        print(f"[warn] skipped {sum(skipped_chal.values())} submissions on "
              f"{len(skipped_chal)} unknown CTFd challenges", file=sys.stderr)

    print(f"[info] {len(rows)} correct submissions ready to import",
          file=sys.stderr)

    # ── Emit SQL ──
    print("BEGIN;")

    # Stage rows in a temp table — easier to introspect / debug.
    print("""
DROP TABLE IF EXISTS _import_solves;
CREATE TEMP TABLE _import_solves (
  login         text,
  slug          text,
  score_awarded int,
  solved_at     timestamptz
);
""")

    # Bulk INSERT via VALUES (batched for sanity).
    BATCH = 200
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        values = ",\n  ".join(
            f"({sql_quote(login)}, {sql_quote(slug)}, {score}, {sql_quote(at)}::timestamptz)"
            for (login, slug, score, at) in chunk
        )
        print(f"INSERT INTO _import_solves (login, slug, score_awarded, solved_at) VALUES\n  {values};")

    # Insert solves. Skip rows whose user or challenge does not exist in
    # the platform (LEFT JOIN drops them), and skip duplicates via the
    # @@unique([userId, challengeId]) constraint.
    print("""
INSERT INTO challenge_solves (user_id, challenge_id, score_awarded, solved_at)
SELECT u.id, c.id, i.score_awarded, i.solved_at
FROM _import_solves i
JOIN users u ON u.login = i.login
JOIN challenges c ON c.slug = i.slug
ON CONFLICT (user_id, challenge_id) DO NOTHING;
""")

    # Report missing logins / slugs (would have been silently dropped above).
    print("""
\\echo === Users present in dump but missing from platform ===
SELECT DISTINCT i.login
FROM _import_solves i
LEFT JOIN users u ON u.login = i.login
WHERE u.id IS NULL;

\\echo === Challenge slugs missing from platform ===
SELECT DISTINCT i.slug
FROM _import_solves i
LEFT JOIN challenges c ON c.slug = i.slug
WHERE c.id IS NULL;
""")

    # Recompute global user scores from the canonical solves table.
    print("""
UPDATE users SET score = COALESCE((
  SELECT SUM(s.score_awarded) FROM challenge_solves s WHERE s.user_id = users.id
), 0);
""")

    # Recompute per-event member scores: only solves that fall within the
    # event window AND target challenges declared for that event count.
    print("""
UPDATE event_members SET score = 0;

UPDATE event_members em
SET score = sub.total
FROM (
  SELECT em.id AS em_id, SUM(s.score_awarded) AS total
  FROM event_members em
  JOIN events e ON e.id = em.event_id
  JOIN event_challenges ec ON ec.event_id = em.event_id
  JOIN challenge_solves s
    ON s.challenge_id = ec.challenge_id
   AND s.user_id = em.user_id
   AND s.solved_at BETWEEN e.starts_at AND e.ends_at
  GROUP BY em.id
) AS sub
WHERE em.id = sub.em_id;
""")

    print("""
\\echo === Summary ===
SELECT COUNT(*) AS total_solves FROM challenge_solves;
SELECT COUNT(*) AS users_with_solves FROM (SELECT DISTINCT user_id FROM challenge_solves) x;
""")

    print("COMMIT;")
    return 0


if __name__ == "__main__":
    sys.exit(main())
