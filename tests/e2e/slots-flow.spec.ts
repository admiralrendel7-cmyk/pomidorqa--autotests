import { test, expect } from "@playwright/test";
import {
  bookPublishedSlot,
  openRegisteredSession,
  publishSkillAndSlot,
} from "../helpers/session";
import {
  cleanupUsersViaApi,
  makeUser,
  registerUserViaApi,
} from "../helpers/user";
import { BookingPage } from "../pages/booking-page";

test.describe("Слоты: правила MVP", () => {
  test("дату в прошлом форма не отправляет", async ({ page, context }) => {
    const runId = Date.now() * 100 + test.info().workerIndex;
    const user = makeUser("slot-past", runId);
    const booking = new BookingPage(page);

    await registerUserViaApi(context.request, user);
    await booking.gotoSlots();

    const past = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(Date.now() - 48 * 60 * 60 * 1000));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      past.find((part) => part.type === type)?.value ?? "";
    const pastDate = `${value("year")}-${value("month")}-${value("day")}`;

    await test.step("Пытаемся добавить слот на прошедшую дату", async () => {
      await booking.slotsDateInput.fill(pastDate);
      await booking.slotsTimeInput.fill("12:00");
      await booking.addSlotButton.click();
    });

    await test.step("Форма блокирует прошлую дату, слота нет", async () => {
      expect(
        await booking.slotsDateInput.evaluate(
          (input: HTMLInputElement) => input.validity.valid,
        ),
      ).toBe(false);
      await expect(booking.slotCard).toHaveCount(0);
    });
  });

  test("свободный слот можно удалить, соседний остаётся", async ({
    page,
    context,
  }) => {
    const runId = Date.now() * 100 + test.info().workerIndex;
    const user = makeUser("slot-del", runId);
    const booking = new BookingPage(page);

    await registerUserViaApi(context.request, user);
    await booking.gotoSlots();
    await booking.addTomorrowSlot("09:00");
    await expect(booking.slotCard).toHaveCount(1);
    await booking.addTomorrowSlot("15:00");
    await expect(booking.slotCard).toHaveCount(2);

    await test.step("Оба слота видны", async () => {
      await expect(booking.slotCardByTime("09:00")).toBeVisible();
      await expect(booking.slotCardByTime("15:00")).toBeVisible();
    });

    await test.step("Удаляем первый слот", async () => {
      await booking.deleteSlot("09:00");
      await page.reload();
    });

    await test.step("Удалённый слот исчез, соседний остался", async () => {
      await expect(booking.slotCardByTime("09:00")).toHaveCount(0);
      await expect(booking.slotCardByTime("15:00")).toBeVisible();
    });
  });

  test("забронированный слот имеет status booked и не удаляется", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const runId = Date.now() * 100 + test.info().workerIndex;
    const skillTag = `Booked-slot-${runId}`;
    const host = await openRegisteredSession(browser, "booked-host", runId);
    const guest = await openRegisteredSession(browser, "booked-guest", runId);
    const created = [host.context, guest.context];

    try {
      const published = await test.step(
        "Хост публикует слот",
        async () => publishSkillAndSlot(host, skillTag),
      );

      await test.step("До брони слот free", async () => {
        await host.booking.gotoSlots();
        await expect(host.booking.slotCard.first()).toHaveAttribute(
          "data-slot-status",
          "free",
        );
      });

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

      await test.step("У хоста слот booked и без кнопки «Удалить»", async () => {
        await host.booking.gotoSlots();
        await expect(host.booking.slotCard.first()).toHaveAttribute(
          "data-slot-status",
          "booked",
          { timeout: 15_000 },
        );
        await expect(
          host.booking.slotDeleteButton(published.slot.time),
        ).toHaveCount(0);
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

  test("гость видит слот во времени и поясе владельца", async ({ browser }) => {
    test.setTimeout(90_000);
    const runId = Date.now() * 100 + test.info().workerIndex;
    const skillTag = `Tz-${runId}`;
    const host = await openRegisteredSession(browser, "tz-host", runId);
    const guest = await openRegisteredSession(browser, "tz-guest", runId);
    const created = [host.context, guest.context];

    try {
      await test.step("Хост публикует слот", async () => {
        await publishSkillAndSlot(host, skillTag);
      });

      await test.step("Гость открывает страницу хоста", async () => {
        await guest.booking.search(skillTag);
        await guest.booking.openPerson(host.user.name);
      });

      await test.step("Календарь показывает пояс владельца и время слота", async () => {
        await expect(guest.booking.calendarTimezoneHint).toContainText(
          "Europe/Moscow",
        );
        await expect(guest.booking.slotTime("12:00")).toBeVisible();
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
