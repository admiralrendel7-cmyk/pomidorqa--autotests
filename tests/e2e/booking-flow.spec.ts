import { test, expect } from "@playwright/test";
import {
  bookPublishedSlot,
  openRegisteredSession,
  openSession,
  publishSkillAndSlot,
} from "../helpers/session";
import {
  cleanupUsersViaApi,
  makeUser,
  registerUser,
} from "../helpers/user";
import { BookingPage } from "../pages/booking-page";
import { ProfilePage } from "../pages/profile-page";

test.describe("Бронирование слота", () => {
  test("хост регистрируется и заполняет профиль", async ({ page }) => {
    const host = makeUser("host", Date.now());
    const profile = new ProfilePage(page);
    const telegram = `@host_${Date.now()}`;
    const bio = `Хост, прогон ${Date.now()}`;

    await test.step("Хост: регистрируется в PomidorQA", async () => {
      await registerUser(page, host);
    });

    await test.step("Хост: заполняет профиль", async () => {
      await profile.goto();
      await profile.fillProfileName(host.name);
      await profile.fillProfileTelegram(telegram);
      await profile.fillProfileBio(bio);
      await profile.saveProfile();
    });

    await test.step("После перезагрузки данные хоста сохранились", async () => {
      await page.reload();
      await expect(profile.profileNameInput).toHaveValue(host.name);
      await expect(profile.profileTelegramInput).toHaveValue(telegram);
      await expect(profile.profileBioInput).toHaveValue(bio);
    });
  });

  test("гость регистрируется и заполняет профиль", async ({ page }) => {
    const guest = makeUser("guest", Date.now());
    const profile = new ProfilePage(page);
    const telegram = `@guest_${Date.now()}`;
    const bio = `Гость, прогон ${Date.now()}`;

    await test.step("Гость: регистрируется в PomidorQA", async () => {
      await registerUser(page, guest);
    });

    await test.step("Гость: заполняет профиль", async () => {
      await profile.goto();
      await profile.fillProfileName(guest.name);
      await profile.fillProfileTelegram(telegram);
      await profile.fillProfileBio(bio);
      await profile.saveProfile();
    });

    await test.step("После перезагрузки данные гостя сохранились", async () => {
      await page.reload();
      await expect(profile.profileNameInput).toHaveValue(guest.name);
      await expect(profile.profileTelegramInput).toHaveValue(telegram);
      await expect(profile.profileBioInput).toHaveValue(bio);
    });
  });

  test("гость бронирует слот хоста", async ({ browser }) => {
    test.setTimeout(90_000);
    const runId = Date.now() * 100 + test.info().workerIndex;
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

      await test.step("Гость: находит хоста и выбирает бронь", async () => {
        await guestBooking.search(skillTag);
        await guestBooking.openPerson(host.name);
        await expect(guestBooking.personName).toHaveText(host.name);
        await expect(guestBooking.slotDay(slotDate)).toBeVisible();
        await expect(guestBooking.slotById(slotId)).toBeVisible();
        await guestBooking.openSlot(slotDate, slotId);
        await expect(guestBooking.bookingConfirmDialog).toBeVisible({
          timeout: 15_000,
        });
        await guestBooking.confirm();
        await expect(
          guestBooking.bookingConfirmSuccess.or(
            guestBooking.bookingConfirmError,
          ),
        ).toBeVisible({ timeout: 15_000 });
        await expect(guestBooking.bookingConfirmError).toBeHidden();
      });

      await test.step("Гость: открывает свои встречи", async () => {
        await guestBooking.gotoBookings();
      });

      await test.step("У гостя встреча в ближайших", async () => {
        await expect(guestBooking.upcomingByName(host.name)).toBeVisible();
        await expect(guestBooking.upcomingEmpty).toBeHidden();
      });

      await test.step("Хост: открывает свои встречи", async () => {
        await hostBooking.gotoBookings();
      });

      await test.step("У хоста встреча в ближайших", async () => {
        await expect(hostBooking.upcomingByName(guest.name)).toBeVisible();
        await expect(hostBooking.upcomingEmpty).toBeHidden();
      });
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("гость без входа видит слот, но забронировать не может", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const runId = Date.now() * 100 + test.info().workerIndex;
    const skillTag = `Guest-anon-${runId}`;
    const host = await openRegisteredSession(browser, "host-anon", runId);
    const guest = await openSession(browser);
    const created = [host.context];

    try {
      let slotDate = "";
      let slotId = "";

      await test.step("Хост: публикует навык и свободный слот", async () => {
        const published = await publishSkillAndSlot(host, skillTag);
        slotDate = published.slot.date;
        slotId = published.slotId;
      });

      await test.step("Гость без аккаунта находит хоста и открывает слот", async () => {
        await guest.booking.search(skillTag);
        await guest.booking.openPerson(host.user.name);
        await expect(guest.booking.personName).toHaveText(host.user.name);
        await guest.booking.openSlot(slotDate, slotId);
      });

      await test.step("Окно брони открыто", async () => {
        await expect(guest.booking.bookingConfirmDialog).toBeVisible({
          timeout: 15_000,
        });
      });

      await test.step("Гость: подтверждает бронь без входа", async () => {
        await guest.booking.confirm();
      });

      await test.step("Сервис требует войти в аккаунт", async () => {
        await expect(guest.booking.bookingConfirmError).toContainText(
          "Нужно войти в аккаунт PomidorQA",
        );
        await expect(guest.booking.bookingConfirmSuccess).toBeHidden();
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

  test("свой слот забронировать нельзя", async ({ browser }) => {
    test.setTimeout(90_000);
    const runId = Date.now() * 100 + test.info().workerIndex;
    const skillTag = `Own-slot-${runId}`;
    const host = await openRegisteredSession(browser, "host-own", runId);
    const created = [host.context];

    try {
      let slotDate = "";
      let slotId = "";

      await test.step("Хост: публикует навык и свободный слот", async () => {
        const published = await publishSkillAndSlot(host, skillTag);
        slotDate = published.slot.date;
        slotId = published.slotId;
      });

      await test.step("Хост: открывает свою публичную страницу", async () => {
        await host.booking.gotoPerson(host.registered?.id ?? "");
      });

      await test.step("Страница хоста открыта", async () => {
        await expect(host.booking.personName).toHaveText(host.user.name);
      });

      await test.step("Хост: пытается забронировать свой слот", async () => {
        await host.booking.openSlot(slotDate, slotId);
        await expect(host.booking.bookingConfirmDialog).toBeVisible({
          timeout: 15_000,
        });
        await host.booking.confirm();
      });

      await test.step("Бронь своего слота отклонена", async () => {
        await expect(host.booking.bookingConfirmError).toBeVisible({
          timeout: 15_000,
        });
        await expect(host.booking.bookingConfirmSuccess).toBeHidden();
      });
    } finally {
      try {
        await cleanupUsersViaApi(created);
      } finally {
        await host.context.close();
      }
    }
  });

  test("закрытие окна подтверждения не создаёт бронь", async ({ browser }) => {
    test.setTimeout(90_000);
    const runId = Date.now() * 100 + test.info().workerIndex;
    const skillTag = `Dismiss-${runId}`;
    const host = await openRegisteredSession(browser, "dismiss-host", runId);
    const guest = await openRegisteredSession(browser, "dismiss-guest", runId);
    const created = [host.context, guest.context];

    try {
      const published = await test.step(
        "Хост публикует слот",
        async () => publishSkillAndSlot(host, skillTag),
      );

      await test.step("Гость открывает окно брони", async () => {
        await guest.booking.search(skillTag);
        await guest.booking.openPerson(host.user.name);
        await guest.booking.openSlot(published.slot.date, published.slotId);
      });

      await test.step("Окно брони открыто", async () => {
        await expect(guest.booking.bookingConfirmDialog).toBeVisible({
          timeout: 15_000,
        });
      });

      await test.step("Гость закрывает окно без подтверждения", async () => {
        await guest.booking.dismiss();
      });

      await test.step("Диалог закрыт, встречи нет", async () => {
        await expect(guest.booking.bookingConfirmDialog).toBeHidden();
        await guest.booking.gotoBookings();
        await expect(guest.booking.upcomingByName(host.user.name)).toHaveCount(0);
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

  test("после брони слот исчезает со страницы участника", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const runId = Date.now() * 100 + test.info().workerIndex;
    const skillTag = `Gone-slot-${runId}`;
    const host = await openRegisteredSession(browser, "gone-host", runId);
    const guest = await openRegisteredSession(browser, "gone-guest", runId);
    const created = [host.context, guest.context];

    try {
      const published = await test.step(
        "Хост публикует слот",
        async () => publishSkillAndSlot(host, skillTag),
      );

      await test.step("Гость бронирует слот", async () => {
        await bookPublishedSlot(
          guest,
          host.user.name,
          skillTag,
          published.slot.date,
          published.slotId,
        );
        await expect(guest.booking.bookingConfirmSuccess).toBeVisible({
          timeout: 15_000,
        });
      });

      await test.step("Гость обновляет страницу участника", async () => {
        await guest.page.reload();
      });

      await test.step("Забронированный слот больше не доступен", async () => {
        await expect(guest.booking.slotById(published.slotId)).toHaveCount(0);
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
});
