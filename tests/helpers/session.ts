import { type Browser, type BrowserContext, type Page } from "@playwright/test";
import { BookingPage } from "../pages/booking-page";
import { ProfilePage } from "../pages/profile-page";
import {
  makeUser,
  registerUserViaApi,
  type RegisteredParticipant,
  type TestUser,
} from "./user";

export type LiveSession = {
  user: TestUser;
  registered?: RegisteredParticipant;
  context: BrowserContext;
  page: Page;
  profile: ProfilePage;
  booking: BookingPage;
};

export async function openSession(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  return {
    context,
    page,
    profile: new ProfilePage(page),
    booking: new BookingPage(page),
  };
}

export async function openRegisteredSession(
  browser: Browser,
  role: string,
  runId: number,
): Promise<LiveSession> {
  const user = makeUser(role, runId);
  const session = await openSession(browser);
  const registered = await registerUserViaApi(session.context.request, user);

  return { ...session, user, registered };
}

export async function publishSkillAndSlot(
  session: LiveSession,
  skillTag: string,
  slotOffsetMs?: number,
) {
  await session.profile.goto();
  await session.profile.saveProfile();
  await session.profile.goto();
  await session.profile.addSkill(skillTag);
  await session.profile.skillChip(skillTag).waitFor({ state: "visible" });
  await session.booking.gotoSlots();
  const slot = slotOffsetMs
    ? await session.booking.addSlotIn(slotOffsetMs)
    : await session.booking.addTomorrowSlot();
  await session.booking.slotCard.first().waitFor({ state: "visible" });
  const slotId =
    (await session.booking.slotCard.first().getAttribute("data-slot-id")) ?? "";

  return { slot, slotId };
}

export async function bookPublishedSlot(
  guest: LiveSession,
  hostName: string,
  skillTag: string,
  slotDate: string,
  slotId: string,
) {
  await guest.booking.search(skillTag);
  await guest.booking.openPerson(hostName);
  await guest.booking.openSlot(slotDate, slotId);
  await guest.booking.confirm();
}
