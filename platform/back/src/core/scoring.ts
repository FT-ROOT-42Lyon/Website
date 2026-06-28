import { PrismaService } from "./prisma/prisma.service";

// Returns the ids of events for which a (user, challenge, solvedAt) triple
// should also award/revoke event-bracket score. An event is eligible when:
//  - `solvedAt` is within the event window, AND
//  - the user is a member of the event, AND
//  - the challenge is in the event's challenge list.
//
// Kept as a free function so it can be composed into the `$transaction([...])`
// array used by both ChallengesService.submitFlag and UsersService.addSolve.
export async function findScoringEventIds(
  prisma: PrismaService,
  userId: number,
  challengeId: number,
  solvedAt: Date,
): Promise<number[]> {
  const rows = await prisma.event.findMany({
    where: {
      startsAt: { lte: solvedAt },
      endsAt: { gte: solvedAt },
      members: { some: { userId } },
      challenges: { some: { challengeId } },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
