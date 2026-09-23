import { test, expect } from "@playwright/test";
import {
  bookPublishedSlot,
  openRegisteredSession,
  publishSkillAndSlot,
} from "../helpers/session";
import { cleanupUsersViaApi, makeUser, registerUser } from "../helpers/user";
import { BookingPage } from "../pages/booking-page";
import { ProfilePage } from "../pages/profile-page";

test.describe("Отмена брони", () => {
  test("гость отменяет бронь — карточка в прошедших у обоих после reload", async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const runId = Date.now();
    const skillTag = `Playwright-demo-${runId}`;
    const host = makeUser("host", runId);
    const guest = makeUser("guest", runId);

    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    const hostProfile = new ProfilePage(hostPage);
    const guestProfile = new ProfilePage(guestPage);
    const hostBooking = new BookingPage(hostPage);
    const guestBooking = new BookingPage(guestPage);
    let slotDate = "";
    let slotId = "";

    try {
      await test.step("Хост: регистрируется в PomidorQA", async () => {
        await registerUser(hostPage, host);
      });

      await test.step("Хост: заполняет профиль и добавляет навык", async () => {
        await hostProfile.goto();
        await hostProfile.fillProfileName(host.name);
        await hostProfile.fillProfileTelegram(`@host_${runId}`);
        await hostProfile.fillProfileBio(`Хост, прогон ${runId}`);
        await hostProfile.saveProfile();
        await hostProfile.goto();
        await hostProfile.addSkill(skillTag);
      });

      await test.step("Хост видит добавленный навык", async () => {
        await expect(hostProfile.canHelpSkills).toContainText(skillTag);
      });

      await test.step("Хост: добавляет свободный слот", async () => {
        await hostBooking.gotoSlots();
        const slot = await hostBooking.addTomorrowSlot();
        slotDate = slot.date;
        await expect(hostBooking.slotCard).toHaveCount(1);
        slotId = (await hostBooking.slotCard.getAttribute("data-slot-id")) ?? "";
      });

      await test.step("Гость: регистрируется в PomidorQA", async () => {
        await registerUser(guestPage, guest);
      });

      await test.step("Гость: заполняет профиль", async () => {
        await guestProfile.goto();
        await guestProfile.fillProfileName(guest.name);
        await guestProfile.fillProfileTelegram(`@guest_${runId}`);
        await guestProfile.fillProfileBio(`Гость, прогон ${runId}`);
        await guestProfile.saveProfile();
      });

      await test.step("Гость: открывает карточку хоста", async () => {
        await guestBooking.search(skillTag);
        await guestBooking.openPerson(host.name);
      });

      await test.step("Открыта карточка хоста", async () => {
        await expect(guestBooking.personName).toHaveText(host.name);
      });

      await test.step("Слот хоста виден", async () => {
        await expect(guestBooking.slotDay(slotDate)).toBeVisible();
        await expect(guestBooking.slotById(slotId)).toBeVisible();
      });

      await test.step("Гость: открывает окно брони", async () => {
        await guestBooking.openSlot(slotDate, slotId);
      });

      await test.step("Окно брони открыто", async () => {
        await expect(guestBooking.bookingConfirmDialog).toBeVisible({
          timeout: 15_000,
        });
      });

      await test.step("Гость: подтверждает бронь", async () => {
        await guestBooking.confirm();
      });

      await test.step("Бронирование прошло успешно", async () => {
        await expect(guestBooking.bookingConfirmSuccess).toBeVisible({
          timeout: 15_000,
        });
        await expect(guestBooking.bookingConfirmError).toBeHidden();
      });

      await test.step("Гость: отменяет бронь", async () => {
        await guestBooking.cancelBooking();
      });

      await test.step("У гостя карточка в прошедших", async () => {
        await expect(guestBooking.upcomingEmpty).toBeVisible();
        await expect(guestBooking.pastHeading).toBeVisible();
        await expect(guestBooking.meetingByName(host.name)).toBeVisible();
        await expect(guestBooking.cancelledStatus).toBeVisible();
      });

      await test.step("После reload гость видит отмену", async () => {
        await guestPage.reload();
        await expect(guestBooking.upcomingEmpty).toBeVisible();
        await expect(guestBooking.meetingByName(host.name)).toBeVisible();
        await expect(guestBooking.cancelledStatus).toBeVisible();
      });

      await test.step("После reload хост видит отмену", async () => {
        await hostBooking.gotoBookings();
        await hostPage.reload();
        await expect(hostBooking.upcomingEmpty).toBeVisible();
        await expect(hostBooking.meetingByName(guest.name)).toBeVisible();
        await expect(hostBooking.cancelledStatus).toBeVisible();
      });

      await test.step("Из прошедших отменить нельзя", async () => {
        await expect(hostBooking.pastCancelButton()).toHaveCount(0);
      });
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("хост отменяет бронь — карточка в прошедших у обоих", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const runId = Date.now() * 100 + test.info().workerIndex;
    const skillTag = `Host-cancel-${runId}`;
    const host = await openRegisteredSession(browser, "host-cancel", runId);
    const guest = await openRegisteredSession(browser, "guest-cancel", runId);
    const created = [host.context, guest.context];

    try {
      const published = await test.step(
        "Хост: публикует навык и свободный слот",
        async () => publishSkillAndSlot(host, skillTag),
      );

      await test.step("Гость: бронирует слот хоста", async () => {
        await bookPublishedSlot(
          guest,
          host.user.name,
          skillTag,
          published.slot.date,
          published.slotId,
        );
      });

      await test.step("Бронирование прошло успешно", async () => {
        await expect(guest.booking.bookingConfirmSuccess).toBeVisible({
          timeout: 15_000,
        });
        await expect(guest.booking.bookingConfirmError).toBeHidden();
      });

      await test.step("Хост: отменяет бронь", async () => {
        await host.booking.cancelBooking();
      });

      await test.step("У хоста карточка в прошедших", async () => {
        await expect(host.booking.upcomingEmpty).toBeVisible();
        await expect(host.booking.meetingByName(guest.user.name)).toBeVisible();
        await expect(host.booking.cancelledStatus).toBeVisible();
      });

      await test.step("Гость: открывает свои встречи", async () => {
        await guest.booking.gotoBookings();
      });

      await test.step("У гостя тоже отмена в прошедших", async () => {
        await expect(guest.booking.upcomingEmpty).toBeVisible();
        await expect(guest.booking.meetingByName(host.user.name)).toBeVisible();
        await expect(guest.booking.cancelledStatus).toBeVisible();
      });
    } finally {
      try {
        await cleanupUsersViaApi(created);
      } finally {
        await host.context.close();
        await guest.context.close();
      }
    }
  });

  test("за час до начала встречу отменить нельзя", async ({ browser }) => {
    test.setTimeout(90_000);
    const runId = Date.now() * 100 + test.info().workerIndex;
    const skillTag = `Late-cancel-${runId}`;
    const host = await openRegisteredSession(browser, "host-late", runId);
    const guest = await openRegisteredSession(browser, "guest-late", runId);
    const created = [host.context, guest.context];

    try {
      const published = await test.step(
        "Хост: публикует слот через час",
        async () => publishSkillAndSlot(host, skillTag, 60 * 60 * 1000),
      );

      await test.step("Гость: бронирует слот", async () => {
        await bookPublishedSlot(
          guest,
          host.user.name,
          skillTag,
          published.slot.date,
          published.slotId,
        );
      });

      await test.step("Бронирование прошло успешно", async () => {
        await expect(guest.booking.bookingConfirmSuccess).toBeVisible({
          timeout: 15_000,
        });
        await expect(guest.booking.bookingConfirmError).toBeHidden();
      });

      await test.step("Гость: пытается отменить встречу", async () => {
        await guest.booking.cancelBooking();
      });

      await test.step("Поздняя отмена отклонена, встреча остаётся в ближайших", async () => {
        await expect(guest.booking.cancelError).toBeVisible();
        await expect(guest.booking.upcomingByName(host.user.name)).toBeVisible();
        await expect(guest.booking.upcomingEmpty).toBeHidden();
      });
    } finally {
      try {
        await cleanupUsersViaApi(created);
      } finally {
        await host.context.close();
        await guest.context.close();
      }
    }
  });

  test("после отмены слот снова бронирует другой гость", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const runId = Date.now() * 100 + test.info().workerIndex;
    const skillTag = `Rebook-${runId}`;
    const host = await openRegisteredSession(browser, "host-rebook", runId);
    const guest = await openRegisteredSession(browser, "guest-rebook", runId);
    const guest2 = await openRegisteredSession(browser, "guest2-rebook", runId);
    const created = [host.context, guest.context, guest2.context];

    try {
      const published = await test.step(
        "Хост: публикует навык и свободный слот",
        async () => publishSkillAndSlot(host, skillTag),
      );

      await test.step("Первый гость: бронирует слот", async () => {
        await bookPublishedSlot(
          guest,
          host.user.name,
          skillTag,
          published.slot.date,
          published.slotId,
        );
      });

      await test.step("Первая бронь подтверждена", async () => {
        await expect(guest.booking.bookingConfirmSuccess).toBeVisible({
          timeout: 15_000,
        });
      });

      await test.step("Первый гость: отменяет бронь", async () => {
        await guest.booking.cancelBooking();
      });

      await test.step("У первого гостя встреча в прошедших", async () => {
        await expect(guest.booking.upcomingEmpty).toBeVisible();
        await expect(guest.booking.cancelledStatus).toBeVisible();
      });

      await test.step("Второй гость: бронирует освобождённый слот", async () => {
        await bookPublishedSlot(
          guest2,
          host.user.name,
          skillTag,
          published.slot.date,
          published.slotId,
        );
      });

      await test.step("Вторая бронь подтверждена", async () => {
        await expect(guest2.booking.bookingConfirmSuccess).toBeVisible({
          timeout: 15_000,
        });
        await expect(guest2.booking.bookingConfirmError).toBeHidden();
      });

      await test.step("Второй гость видит встречу в ближайших", async () => {
        await guest2.booking.gotoBookings();
        await expect(guest2.booking.upcomingByName(host.user.name)).toBeVisible();
      });
    } finally {
      try {
        await cleanupUsersViaApi(created);
      } finally {
        await host.context.close();
        await guest.context.close();
        await guest2.context.close();
      }
    }
  });
});
