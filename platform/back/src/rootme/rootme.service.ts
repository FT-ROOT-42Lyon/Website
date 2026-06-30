import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { Difficulty } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../core/prisma/prisma.service";
import { env } from "../core/env";
import { slugify } from "../core/slug";

const ROOTME_API_BASE = "https://api.www.root-me.org";
const ROOTME_PREFIX = "RootMe - ";
// Min delay between two Root-Me API hits. The public API is quick to return
// 429 when hammered (especially when looping through dozens of /challenges/{id}
// calls during the initial sync of a new user). 600ms keeps us safely under
// the threshold while still letting a 170-validation user complete in <2min.
const MIN_REQUEST_INTERVAL_MS = 600;
const MAX_RETRIES_ON_429 = 4;

// ─── Defensive parsers ──────────────────────────────────────────────────────
// Root-Me commonly returns numeric ids as strings.
const numLike = z.union([z.number(), z.string().transform(Number)]);
const optStr = z.string().optional().nullable();

const AuteurSearchItem = z
  .object({
    id_auteur: numLike,
    nom: z.string().optional().default(""),
  })
  .passthrough();

// /auteurs/{id} returns the user detail with a `validations` array of solved
// challenges. (Note: the `challenges` field is for AUTHORED challenges and is
// usually empty.)
const AuteurValidation = z
  .object({
    id_challenge: numLike,
    titre: optStr,
    id_rubrique: numLike.optional(),
    date: optStr,
    date_solved: optStr,
  })
  .passthrough();

const AuteurDetail = z
  .object({
    id_auteur: numLike,
    nom: z.string(),
    score: numLike.optional(),
    position: numLike.optional(),
    validations: z.unknown().optional(),
  })
  .passthrough();

// /challenges/{id} returns `[{...}]` (array with one object). We unwrap.
const ChallengeDetail = z
  .object({
    titre: z.string(),
    rubrique: optStr,
    id_rubrique: numLike.optional(),
    soustitre: optStr,
    score: numLike.optional(),
    difficulte: optStr,
    url_challenge: optStr,
  })
  .passthrough();

/**
 * Root-Me's list responses come in two flavours:
 *   - a plain array of items
 *   - `[{"0": item}, {"1": item}, ...]` or `{"0": item, "1": item}` — indexed
 *     records (used by `/auteurs?nom=` and the `validations` / `auteurs` blobs
 *     inside challenge detail).
 * This helper flattens both into a plain array and silently drops items that
 * fail the per-item schema.
 */
function flatten<T extends z.ZodType>(
  raw: unknown,
  itemSchema: T,
): z.infer<T>[] {
  const out: z.infer<T>[] = [];
  const tryParse = (v: unknown) => {
    const r = itemSchema.safeParse(v);
    if (r.success) out.push(r.data);
  };
  if (Array.isArray(raw)) {
    for (const v of raw) {
      const r = itemSchema.safeParse(v);
      if (r.success) {
        out.push(r.data);
        continue;
      }
      if (v && typeof v === "object") {
        for (const inner of Object.values(v as Record<string, unknown>)) {
          tryParse(inner);
        }
      }
    }
  } else if (raw && typeof raw === "object") {
    for (const inner of Object.values(raw as Record<string, unknown>)) {
      tryParse(inner);
    }
  }
  return out;
}

// Root-Me labels difficulty in French on the API.
function difficultyFromLabel(label: string | null | undefined): Difficulty {
  const s = (label ?? "").trim().toLowerCase();
  if (s.includes("très facile") || s.includes("tres facile")) return "VERY_EASY";
  if (s.includes("très difficile") || s.includes("tres difficile")) return "VERY_HARD";
  if (s.startsWith("facile")) return "EASY";
  if (s.startsWith("moyen")) return "MEDIUM";
  if (s.startsWith("difficile")) return "HARD";
  return "MEDIUM";
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;/g, "’")
    .replace(/&#8230;/g, "…")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Custom error thrown when we couldn't fetch a challenge's detail (network
// glitch, persistent 429, etc.). The caller skips inserting the solve so the
// next sync can retry instead of creating a broken row.
class ChallengeFetchFailed extends Error {
  constructor(public readonly rootmeChalId: number, cause: unknown) {
    super(`Could not fetch Root-Me challenge ${rootmeChalId}: ${String(cause)}`);
  }
}

@Injectable()
export class RootmeService {
  private readonly logger = new Logger(RootmeService.name);
  // Serial queue: each fetch waits until at least MIN_REQUEST_INTERVAL_MS has
  // elapsed since the previous one finished. Avoids the 429 storm we'd
  // otherwise trigger when looping over a user's validations.
  private nextSlot = 0;

  constructor(private readonly prisma: PrismaService) {}

  private async acquireSlot(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, this.nextSlot - now);
    this.nextSlot = Math.max(now, this.nextSlot) + MIN_REQUEST_INTERVAL_MS;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  // ─── Linking ──────────────────────────────────────────────────────────

  async link(userId: number, rawInput: string) {
    const input = rawInput.trim();
    if (!input) throw new BadRequestException("Login Root-Me requis");

    let rootmeId: number;
    let nom: string;
    if (/^\d+$/.test(input)) {
      rootmeId = Number(input);
      const detail = await this.fetchAuteur(rootmeId);
      nom = detail.nom;
    } else {
      const raw = await this.fetchRootme<unknown>(
        `/auteurs?nom=${encodeURIComponent(input)}&lang=fr`,
      );
      const items = flatten(raw, AuteurSearchItem);
      if (items.length === 0) {
        throw new NotFoundException(`Aucun auteur Root-Me "${input}" trouvé`);
      }
      const exact = items.find(
        (a) => a.nom.toLowerCase() === input.toLowerCase(),
      );
      const picked = exact ?? items[0];
      rootmeId = picked.id_auteur;
      try {
        nom = (await this.fetchAuteur(rootmeId)).nom;
      } catch {
        nom = picked.nom;
      }
    }

    const clash = await this.prisma.user.findFirst({
      where: { rootmeId, NOT: { id: userId } },
    });
    if (clash) {
      throw new ConflictException(
        `Compte Root-Me déjà associé à ${clash.login}`,
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { rootmeId, rootmeUsername: nom },
    });
  }

  async unlink(userId: number) {
    await this.prisma.challengeSolve.deleteMany({
      where: { userId, challenge: { rootmeId: { not: null } } },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { rootmeId: null, rootmeUsername: null },
    });
    await this.recomputeUserScore(userId);
    await this.recomputeUserEventScores(userId);
  }

  // ─── Sync ────────────────────────────────────────────────────────────
  //
  // The Root-Me API has no `/categories` endpoint. We grow the local catalog
  // incrementally from each linked user's validations. Each validation entry
  // carries id_challenge + id_rubrique + titre + date; for any challenge we
  // haven't seen yet, we fetch /challenges/{id} once to get score + difficulty
  // + canonical rubrique name + url, then create the local Category / Challenge
  // rows.

  async syncAll() {
    const linked = await this.prisma.user.findMany({
      where: { rootmeId: { not: null } },
      select: { id: true, login: true, rootmeId: true, rootmeUsername: true },
    });
    this.logger.log(
      `Root-Me syncAll: ${linked.length} linked user(s): ${linked
        .map((u) => `${u.login}(${u.rootmeUsername ?? u.rootmeId})`)
        .join(", ") || "<none>"}`,
    );

    // Repair any rows that previous (buggy) syncs filled with placeholder
    // values — score=0, title starting with `#`, category named "Rubrique XX"
    // or "Autre". We re-pull /challenges/{id} for each, which fixes title,
    // score, difficulty, description AND moves the row to the correct
    // category (orphan categories are pruned at the end).
    const repaired = await this.repairBrokenCatalog();

    let usersOk = 0;
    let solves = 0;
    for (const u of linked) {
      try {
        solves += await this.syncUserSolves(u.id);
        usersOk += 1;
      } catch (e) {
        this.logger.warn(`Sync user ${u.login} failed: ${String(e)}`);
      }
    }

    // After repairs, prune any "RootMe - Rubrique XX" / "RootMe - Autre"
    // categories that no longer have any challenges attached.
    await this.pruneEmptyRootmeCategories();

    const counts = await this.prisma.$transaction([
      this.prisma.category.count({ where: { rootmeId: { not: null } } }),
      this.prisma.challenge.count({ where: { rootmeId: { not: null } } }),
    ]);

    this.logger.log(
      `Root-Me sync done: ${counts[0]} cats · ${counts[1]} chals · ${solves} solves added · ${repaired} catalog rows repaired across ${usersOk}/${linked.length} users`,
    );

    return {
      categories: counts[0],
      challenges: counts[1],
      solves,
      usersSynced: usersOk,
      linkedCount: linked.length,
      repaired,
    };
  }

  // Re-fetch /challenges/{id} for any Root-Me challenge that looks like a
  // placeholder leftover from a failed previous sync (score==0 OR placeholder
  // category). Score-only updates: scoreAwarded on existing solves is rebased
  // via recomputeUserScore at the end of each user sync.
  private async repairBrokenCatalog(): Promise<number> {
    const candidates = await this.prisma.challenge.findMany({
      where: {
        rootmeId: { not: null },
        OR: [
          { score: 0 },
          { category: { name: { startsWith: `${ROOTME_PREFIX}Rubrique ` } } },
          { category: { name: `${ROOTME_PREFIX}Autre` } },
        ],
      },
      select: { id: true, rootmeId: true },
    });
    if (candidates.length === 0) return 0;
    this.logger.log(
      `Root-Me catalog repair: re-pulling ${candidates.length} placeholder challenge(s)`,
    );
    let fixed = 0;
    for (const c of candidates) {
      if (c.rootmeId == null) continue;
      try {
        const updated = await this.upsertChallengeFromRootme(c.rootmeId);
        // Rebase scoreAwarded on solves to match the new score.
        await this.prisma.challengeSolve.updateMany({
          where: { challengeId: updated.id },
          data: { scoreAwarded: updated.score },
        });
        fixed += 1;
      } catch (e) {
        this.logger.warn(`Repair failed for rootmeId=${c.rootmeId}: ${String(e)}`);
      }
    }
    return fixed;
  }

  private async pruneEmptyRootmeCategories() {
    const empties = await this.prisma.category.findMany({
      where: {
        OR: [
          { name: { startsWith: `${ROOTME_PREFIX}Rubrique ` } },
          { name: `${ROOTME_PREFIX}Autre` },
        ],
        challenges: { none: {} },
      },
      select: { id: true },
    });
    if (empties.length === 0) return;
    await this.prisma.category.deleteMany({
      where: { id: { in: empties.map((e) => e.id) } },
    });
    this.logger.log(`Pruned ${empties.length} empty placeholder categor(y/ies)`);
  }

  async syncUserSolves(userId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { rootmeId: true, login: true },
    });
    if (!user?.rootmeId) {
      throw new BadRequestException("Compte Root-Me non lié");
    }

    const detail = await this.fetchAuteur(user.rootmeId);
    const validations = flatten(detail.validations, AuteurValidation);
    this.logger.log(
      `Sync ${user.login} (rootmeId=${user.rootmeId}): ${validations.length} validation(s) from Root-Me`,
    );

    let added = 0;
    for (const v of validations) {
      const rootmeChalId = v.id_challenge;
      if (!rootmeChalId) continue;

      let challenge = await this.prisma.challenge.findUnique({
        where: { rootmeId: rootmeChalId },
        select: { id: true, score: true },
      });

      if (!challenge) {
        try {
          challenge = await this.upsertChallengeFromRootme(rootmeChalId);
        } catch (e) {
          if (e instanceof ChallengeFetchFailed) {
            this.logger.warn(e.message);
            continue;
          }
          throw e;
        }
      }
      if (!challenge) continue;

      const solvedAt = parseDate(v.date_solved ?? v.date) ?? new Date();
      const existing = await this.prisma.challengeSolve.findUnique({
        where: {
          userId_challengeId: {
            userId,
            challengeId: challenge.id,
          },
        },
      });
      if (!existing) {
        await this.prisma.challengeSolve.create({
          data: {
            userId,
            challengeId: challenge.id,
            scoreAwarded: challenge.score,
            solvedAt,
          },
        });
        added += 1;
      } else if (existing.solvedAt.getTime() !== solvedAt.getTime()) {
        await this.prisma.challengeSolve.update({
          where: { id: existing.id },
          data: { solvedAt },
        });
      }
    }

    await this.recomputeUserScore(userId);
    await this.recomputeUserEventScores(userId);
    return added;
  }

  // ─── Catalog helpers ──────────────────────────────────────────────────

  // Fetches /challenges/{id}, picks the rubrique by name + id, upserts both
  // category and challenge rows. `rubriqueIdHint` and `titleHint` come from
  // the auteur's validation entry — used only as fallback if /challenges/{id}
  // is rate-limited or returns garbage.
  // Fetches /challenges/{id} and upserts the catalog row. Throws
  // ChallengeFetchFailed if the API call doesn't give us usable data — callers
  // skip the solve so the next sync retries instead of pinning a broken row.
  private async upsertChallengeFromRootme(
    rootmeChalId: number,
  ): Promise<{ id: number; score: number }> {
    let raw: unknown;
    try {
      raw = await this.fetchRootme<unknown>(
        `/challenges/${rootmeChalId}?lang=fr`,
      );
    } catch (e) {
      throw new ChallengeFetchFailed(rootmeChalId, e);
    }

    // Endpoint returns `[{...}]` — unwrap.
    const unwrapped = Array.isArray(raw) ? raw[0] : raw;
    const parsed = ChallengeDetail.safeParse(unwrapped);
    if (!parsed.success) {
      throw new ChallengeFetchFailed(
        rootmeChalId,
        `unexpected response shape: ${JSON.stringify(unwrapped).slice(0, 200)}`,
      );
    }
    const detail = parsed.data;

    const rubriqueId =
      detail.id_rubrique != null ? Number(detail.id_rubrique) : null;
    const rubriqueName =
      detail.rubrique ?? parseRubriqueFromUrl(detail.url_challenge);
    if (!rubriqueName) {
      throw new ChallengeFetchFailed(
        rootmeChalId,
        "no rubrique name in response",
      );
    }

    const category = await this.upsertRootmeCategory(rubriqueId, rubriqueName);

    const score = detail.score != null ? Number(detail.score) : 0;
    const title = `${ROOTME_PREFIX}${detail.titre.trim()}`;
    const description = stripHtml(detail.soustitre);
    const externalUrl = detail.url_challenge
      ? detail.url_challenge.startsWith("http")
        ? detail.url_challenge
        : `https://www.root-me.org/${detail.url_challenge}?lang=fr`
      : null;

    const existing = await this.prisma.challenge.findUnique({
      where: { rootmeId: rootmeChalId },
    });

    if (existing) {
      const updated = await this.prisma.challenge.update({
        where: { id: existing.id },
        data: {
          categoryId: category.id,
          title,
          description,
          score,
          difficulty: difficultyFromLabel(detail.difficulte),
          externalUrl,
        },
      });
      return { id: updated.id, score: updated.score };
    }

    const slug = await this.uniqueChallengeSlug(`rootme-${rootmeChalId}`);
    const created = await this.prisma.challenge.create({
      data: {
        slug,
        rootmeId: rootmeChalId,
        categoryId: category.id,
        title,
        description,
        score,
        difficulty: difficultyFromLabel(detail.difficulte),
        externalUrl,
      },
    });
    return { id: created.id, score: created.score };
  }

  private async upsertRootmeCategory(
    rubriqueId: number | null,
    rubriqueName: string,
  ) {
    const name = `${ROOTME_PREFIX}${rubriqueName}`;

    if (rubriqueId !== null) {
      const byId = await this.prisma.category.findUnique({
        where: { rootmeId: rubriqueId },
      });
      if (byId) {
        if (byId.name !== name) {
          return this.prisma.category.update({
            where: { id: byId.id },
            data: { name },
          });
        }
        return byId;
      }
    }

    const byName = await this.prisma.category.findFirst({ where: { name } });
    if (byName) {
      if (byName.rootmeId === null && rubriqueId !== null) {
        return this.prisma.category.update({
          where: { id: byName.id },
          data: { rootmeId: rubriqueId },
        });
      }
      return byName;
    }

    const slug = await this.uniqueCategorySlug(
      slugify(name) || `rootme-${rubriqueId ?? "autre"}`,
    );
    return this.prisma.category.create({
      data: {
        slug,
        name,
        description: "",
        exploitDescription: "",
        rootmeId: rubriqueId,
      },
    });
  }

  private async uniqueCategorySlug(base: string): Promise<string> {
    let slug = base || "rootme";
    let attempt = 1;
    while (await this.prisma.category.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${base}-${attempt}`;
      if (attempt > 100) throw new ConflictException("Slug collision");
    }
    return slug;
  }

  private async uniqueChallengeSlug(base: string): Promise<string> {
    let slug = base;
    let attempt = 1;
    while (await this.prisma.challenge.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${base}-${attempt}`;
      if (attempt > 100) throw new ConflictException("Slug collision");
    }
    return slug;
  }

  private async recomputeUserScore(userId: number) {
    const sum = await this.prisma.challengeSolve.aggregate({
      where: { userId },
      _sum: { scoreAwarded: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { score: sum._sum.scoreAwarded ?? 0 },
    });
  }

  private async recomputeUserEventScores(userId: number) {
    const memberships = await this.prisma.eventMember.findMany({
      where: { userId },
      select: { id: true, eventId: true },
    });
    for (const m of memberships) {
      const event = await this.prisma.event.findUnique({
        where: { id: m.eventId },
        select: {
          startsAt: true,
          endsAt: true,
          challenges: { select: { challengeId: true } },
        },
      });
      if (!event) continue;
      const chalIds = event.challenges.map((c) => c.challengeId);
      if (chalIds.length === 0) {
        await this.prisma.eventMember.update({
          where: { id: m.id },
          data: { score: 0 },
        });
        continue;
      }
      const sum = await this.prisma.challengeSolve.aggregate({
        where: {
          userId,
          challengeId: { in: chalIds },
          solvedAt: { gte: event.startsAt, lte: event.endsAt },
        },
        _sum: { scoreAwarded: true },
      });
      await this.prisma.eventMember.update({
        where: { id: m.id },
        data: { score: sum._sum.scoreAwarded ?? 0 },
      });
    }
  }

  // ─── HTTP plumbing ────────────────────────────────────────────────────
  //
  // Root-Me's API has a couple of quirks worth knowing:
  //  - Every successful GET returns HTTP 404 (looks like an anti-bot thing).
  //    We discriminate success vs. failure from the JSON body, NOT the status.
  //  - Errors come back as `[{"error":{"code":404,"message":"Error 404"}}]`.
  //  - Without a valid api_key cookie we get HTTP 401 + the same error envelope.

  private async fetchRootme<T>(path: string): Promise<T> {
    if (!env.ROOTME_API_KEY) {
      throw new InternalServerErrorException(
        "ROOTME_API_KEY n'est pas configuré dans le backend",
      );
    }
    const url = path.startsWith("http") ? path : `${ROOTME_API_BASE}${path}`;

    let attempt = 0;
    let backoff = 1500;
    while (true) {
      attempt += 1;
      await this.acquireSlot();
      const res = await fetch(url, {
        headers: {
          Cookie: `api_key=${env.ROOTME_API_KEY}`,
          Accept: "application/json",
        },
      });
      const body = await res.text();
      const ct = res.headers.get("content-type") ?? "";

      // Root-Me serves an HTML "too many requests" page on hard limit too.
      const isRateLimited =
        res.status === 429 ||
        body.toLowerCase().includes("too many requests") ||
        body.toLowerCase().includes("rate limit");

      if (isRateLimited) {
        if (attempt > MAX_RETRIES_ON_429) {
          throw new InternalServerErrorException(
            `Root-Me API: rate-limited après ${attempt} tentatives sur ${path}`,
          );
        }
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : backoff;
        this.logger.warn(
          `Root-Me 429 sur ${path}, retry dans ${wait}ms (tentative ${attempt}/${MAX_RETRIES_ON_429})`,
        );
        await new Promise((r) => setTimeout(r, wait));
        backoff = Math.min(backoff * 2, 30_000);
        continue;
      }

      if (!ct.includes("json") && body.trimStart().startsWith("<")) {
        throw new InternalServerErrorException(
          "Root-Me API a renvoyé du HTML — vérifie que ROOTME_API_KEY est valide",
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new InternalServerErrorException(
          `Root-Me API: réponse non-JSON sur ${path} (HTTP ${res.status})`,
        );
      }

      // Error envelope detection: `[{"error":{...}}]` or `{"error":{...}}`
      const errCandidate = Array.isArray(parsed) ? parsed[0] : parsed;
      if (
        errCandidate &&
        typeof errCandidate === "object" &&
        "error" in errCandidate
      ) {
        const err = (errCandidate as { error: unknown }).error;
        const code =
          err && typeof err === "object" && "code" in err
            ? (err as { code: unknown }).code
            : res.status;
        if (code === 401 || res.status === 401) {
          throw new InternalServerErrorException(
            "Root-Me API: clé invalide ou expirée (HTTP 401)",
          );
        }
        if (code === 429) {
          // Some Root-Me deployments encode the rate limit as a 429 error inside
          // the JSON body — handle it like a real 429.
          if (attempt > MAX_RETRIES_ON_429) {
            throw new InternalServerErrorException(
              `Root-Me API: rate-limited après ${attempt} tentatives sur ${path}`,
            );
          }
          await new Promise((r) => setTimeout(r, backoff));
          backoff = Math.min(backoff * 2, 30_000);
          continue;
        }
        if (code === 404 || res.status === 404) {
          throw new NotFoundException(`Root-Me: ressource introuvable (${path})`);
        }
        throw new InternalServerErrorException(
          `Root-Me API erreur ${String(code)} sur ${path}`,
        );
      }

      return parsed as T;
    }
  }

  private async fetchAuteur(id: number) {
    return AuteurDetail.parse(
      await this.fetchRootme<unknown>(`/auteurs/${id}?lang=fr`),
    );
  }
}

// "fr/Challenges/Web-Serveur/HTML" → "Web - Serveur"
// Also handles full URLs and leading slashes.
function parseRubriqueFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/Challenges\/([^/?#]+)/) ?? url.match(/Challenges\/([^/?#]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1])
      .replace(/-/g, " - ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return m[1].replace(/-/g, " - ");
  }
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  // Root-Me returns "YYYY-MM-DD HH:MM:SS" — replace the space so Date parses.
  const candidate = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d;
}
