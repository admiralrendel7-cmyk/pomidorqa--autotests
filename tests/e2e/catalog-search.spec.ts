import { test, expect, type BrowserContext } from "@playwright/test";
import {
  openRegisteredSession,
  publishSkillAndSlot,
} from "../helpers/session";
import {
  cleanupUsersViaApi,
  makeUser,
  registerUserViaApi,
} from "../helpers/user";
import { BookingPage } from "../pages/booking-page";
import { ProfilePage } from "../pages/profile-page";

test.describe("Каталог", () => {
  test("гость находит хоста по навыку — хост свою карточку не видит", async ({
    browser,
  }) => {
    const runId = Date.now() * 100 + test.info().workerIndex;
    const skillTag = `Catalog-search-${runId}`;
    const host = makeUser("host", runId);
    const guest = makeUser("guest", runId);

    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    const created: BrowserContext[] = [];

    const hostProfile = new ProfilePage(hostPage);
    const hostBooking = new BookingPage(hostPage);
    const guestBooking = new BookingPage(guestPage);

    try {
      await test.step("Хост: создаётся через API", async () => {
        await registerUserViaApi(hostContext.request, host);
        created.push(hostContext);
      });

      await test.step("Гость: создаётся через API", async () => {
        await registerUserViaApi(guestContext.request, guest);
        created.push(guestContext);
      });

      await test.step("Хост: добавляет навык", async () => {
        await hostProfile.goto();
        await hostProfile.saveProfile();
        await hostProfile.goto();
        await hostProfile.addSkill(skillTag);
      });

      await test.step("Хост видит добавленный навык", async () => {
        await expect(hostProfile.canHelpSkills).toContainText(skillTag);
      });

      await test.step("Хост: добавляет свободный слот на завтра", async () => {
        await hostBooking.gotoSlots();
        await hostBooking.addTomorrowSlot();
      });

      await test.step("Слот хоста виден", async () => {
        await expect(hostBooking.slotCard).toHaveCount(1);
      });

      await test.step("Хост: ищет свой навык", async () => {
        await hostBooking.search(skillTag);
      });

      await test.step("В выдаче нет своей карточки", async () => {
        await expect(hostBooking.catalogEmpty).toBeVisible();
        await expect(hostBooking.cardByName(host.name)).toBeHidden();
      });

      await test.step("Гость: ищет хоста по навыку", async () => {
        await guestBooking.search(skillTag);
      });

      await test.step("В выдаче карточка хоста по имени", async () => {
        await expect(guestBooking.cardByName(host.name)).toBeVisible();
        await expect(guestBooking.catalogEmpty).toBeHidden();
      });
    } finally {
      try {
        await cleanupUsersViaApi(created);
      } finally {
        await hostContext.close();
        await guestContext.close();
      }
    }
  });

  test("без свободного слота участник не попадает в каталог", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const runId = Date.now() * 100 + test.info().workerIndex;
    const skillTag = `No-slot-${runId}`;
    const withSlot = await openRegisteredSession(browser, "host-slot", runId);
    const noSlot = await openRegisteredSession(browser, "host-noslot", runId);
    const guest = await openRegisteredSession(browser, "guest-noslot", runId);
    const created = [withSlot.context, noSlot.context, guest.context];

    try {
      await test.step("Участник со слотом: публикует навык и слот", async () => {
        await publishSkillAndSlot(withSlot, skillTag);
      });

      await test.step("Участник без слота: публикует только навык", async () => {
        await noSlot.profile.goto();
        await noSlot.profile.saveProfile();
        await noSlot.profile.goto();
        await noSlot.profile.addSkill(skillTag);
      });

      await test.step("Навык без слота сохранён", async () => {
        await expect(noSlot.profile.canHelpSkills).toContainText(skillTag);
      });

      await test.step("Гость: ищет общий навык", async () => {
        await guest.booking.search(skillTag);
      });

      await test.step("В выдаче только участник со слотом", async () => {
        await expect(guest.booking.cardByName(withSlot.user.name)).toBeVisible();
        await expect(guest.booking.cardByName(noSlot.user.name)).toHaveCount(0);
        await expect(guest.booking.catalogEmpty).toBeHidden();
      });
    } finally {
      try {
        await cleanupUsersViaApi(created);
      } finally {
        await withSlot.context.close();
        await noSlot.context.close();
        await guest.context.close();
      }
    }
  });

  test("поиск по «хочу разобрать» не показывает участника", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    test.fail(
      true,
      "R8.3: каталог сейчас находит участника и по навыку «хочу разобрать»",
    );
    const runId = Date.now() * 100 + test.info().workerIndex;
    const canHelpTag = `Can-help-${runId}`;
    const wantToLearnTag = `Want-learn-${runId}`;
    const host = await openRegisteredSession(browser, "host-learn", runId);
    const guest = await openRegisteredSession(browser, "guest-learn", runId);
    const created = [host.context, guest.context];

    try {
      await test.step("Хост: публикует «могу помочь», «хочу разобрать» и слот", async () => {
        await publishSkillAndSlot(host, canHelpTag);
        await host.profile.goto();
        await host.profile.addSkill(wantToLearnTag, "want_to_learn");
      });

      await test.step("Навык «хочу разобрать» сохранён", async () => {
        await expect(host.profile.wantToLearnSkills).toContainText(
          wantToLearnTag,
        );
      });

      await test.step("Гость: ищет по навыку «хочу разобрать»", async () => {
        await guest.booking.search(wantToLearnTag);
      });

      await test.step("В выдаче хоста нет — поиск смотрит только «могу помочь»", async () => {
        await expect(guest.booking.catalogEmpty).toBeVisible();
        await expect(guest.booking.cardByName(host.user.name)).toHaveCount(0);
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

  test("несуществующий навык возвращает пустую выдачу", async ({ page }) => {
    const booking = new BookingPage(page);
    const skillTag = `No-such-skill-${Date.now()}`;

    await test.step("Ищем заведомо уникальный навык", async () => {
      await booking.search(skillTag);
    });

    await test.step("Выдача пустая", async () => {
      await expect(booking.catalogEmpty).toBeVisible();
      await expect(booking.personCard).toHaveCount(0);
    });
  });

  test("публичный профиль показывает имя, описание и оба типа навыков", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const runId = Date.now() * 100 + test.info().workerIndex;
    const canHelpTag = `Public-help-${runId}`;
    const wantToLearnTag = `Public-learn-${runId}`;
    const bio = `Публичное описание ${runId}`;
    const host = await openRegisteredSession(browser, "public-host", runId);
    const guest = await openRegisteredSession(browser, "public-guest", runId);
    const created = [host.context, guest.context];

    try {
      await test.step("Хост заполняет профиль, навыки и слот", async () => {
        await host.profile.goto();
        await host.profile.fillProfileName(host.user.name);
        await host.profile.fillProfileBio(bio);
        await host.profile.saveProfile();
        await host.profile.goto();
        await host.profile.addSkill(canHelpTag, "can_help");
        await host.profile.addSkill(wantToLearnTag, "want_to_learn");
        await host.booking.gotoSlots();
        await host.booking.addTomorrowSlot();
      });

      await test.step("Гость открывает карточку из каталога", async () => {
        await guest.booking.search(canHelpTag);
        await guest.booking.openPerson(host.user.name);
      });

      await test.step("На странице имя, «о себе» и оба навыка", async () => {
        await expect(guest.booking.personName).toHaveText(host.user.name);
        await expect(guest.booking.personContent).toContainText(bio);
        await expect(guest.booking.canHelpOnPerson()).toContainText(canHelpTag);
        await expect(guest.booking.wantToLearnOnPerson()).toContainText(
          wantToLearnTag,
        );
        await expect(guest.booking.slotTime()).toHaveCount(1);
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
