# Seat-Based Billing + Team Workspace — Execution Plan

> **Agent resume guide**: All phases COMPLETE. Typecheck passes with 0 errors.
> If re-opening: verify the file index below, then run npx tsc --noEmit to confirm.

---

## Decisions (Final, Locked)

| # | Topic | Decision |
|---|---|---|
| 1 | Billing strategy | Pure per-seat: $0 base plan + $8/seat Dodo add-on |
| 2 | Credits per member | Separate wallets — each invitee gets their OWN wallet seeded with 20 plan credits |
| 3 | Credit refresh | Member credits refresh on the owner subscription.renewed webhook |
| 4 | Invite delivery | Copyable invite links — no email transport needed |
| 5 | Invite quantity | Buying N seats = N single-use invite links (cumulative on upgrades) |
| 6 | Invite accept page | Dedicated /invite/[token] with sign-up/sign-in inline + workspace branding |
| 7 | Switch account | Same UI; member sees own 20-credit wallet + team badge in nav |
| 8 | Member removal | Credits zeroed immediately, studio access revoked |
| 9 | Link reuse | Single-use — token expires the moment it is accepted |

---

## Dodo Dashboard Setup (Manual, do once before going live)

1. Products > Create Product > Subscription > Name: "Team Workspace" > Price: $0/month > Save > copy pdt_xxx
2. Products > Add-Ons > Create Add-On > Name: "Extra Seat" > Price: $8/month > Save > copy addon_xxx
3. Edit "Team Workspace" > Add-Ons section > attach "Extra Seat" > Save
4. Add to .env:
   DODO_TEAM_BASE_PRODUCT_ID=pdt_xxx
   DODO_SEAT_ADDON_ID=addon_xxx

(Leave blank to run in simulate mode — works fully offline.)

---

## File Index (ALL DONE)

| File | Status | Notes |
|---|---|---|
| .env | DONE | Placeholder vars added |
| .env.example | DONE | Placeholder vars + setup docs added |
| shared/catalog.ts | DONE | TEAM_BASE_PRODUCT_ID + SEAT_ADDON_ID exports, addonId field, updated team-workspace product |
| src/lib/db.ts | DONE | TeamDoc, TeamMemberDoc types, collections, all indexes |
| src/lib/services/teams.ts | DONE | Full team CRUD service: createTeam, generateInviteLinks, acceptInvite, removeMember, cancelTeam, refreshMemberCredits |
| src/lib/services/webhook-handlers.ts | DONE | seat_based branches in 4 handlers (active, renewed, plan_changed, cancelled) |
| src/app/api/checkout/route.ts | DONE | quantity param + add-on checkout path + simulate team creation |
| src/app/api/teams/route.ts | DONE | GET /api/teams - owned + memberOf snapshots |
| src/app/api/teams/members/[memberId]/route.ts | DONE | DELETE /api/teams/members/[id] |
| src/app/api/teams/invite/accept/route.ts | DONE | POST /api/teams/invite/accept |
| src/lib/api.ts | DONE | getTeam, acceptInvite, removeMember, createSeatsCheckout + types |
| src/app/invite/[token]/page.tsx | DONE | Server component - looks up token, owner name via MongoDB |
| src/app/invite/[token]/InviteAcceptClient.tsx | DONE | Client - invalid/already-member/accepted states, inline sign-up/sign-in |
| src/app/invite/[token]/loading.tsx | DONE | Skeleton |
| src/app/team/page.tsx | DONE | Owner: seat bar, members list, invite links, buy-more stepper. Member: read-only view |
| src/app/team/loading.tsx | DONE | Skeleton |
| src/components/TeamSwitcher.tsx | DONE | Personal/Team dropdown, fetches membership, stores in localStorage |
| src/components/Navbar.tsx | DONE | TeamSwitcher + /team nav link added |
| src/app/profile/page.tsx | DONE | Team card: owns/member-of/buy-seats CTA |
| src/app/pricing/page.tsx | DONE | Seat quantity stepper section with live price + checkout |

---

## Verification (simulate mode — no Dodo keys needed)

1. Go to /pricing > scroll to "Seat-based pricing" > set qty to 3 > "Get 3 seats"
   ? Team created, redirected to /team
2. /team shows "0 of 3 seats filled" + 3 invite links
3. Copy link > open in incognito > sign up > auto-joined > credits = 20
4. Team switcher dropdown appears in nav (Personal | [Team Name])
5. Switch to team context > nav badge updates
6. Owner removes member > /team updates immediately
7. Profile page > Team card shows "You own [Team Name]"
