import { test, expect } from "@playwright/test";
import {
  slotsOverlap,
  isPasswordValid,
  isRegistrationFormComplete,
  formatSlotTime,
  PROFILE_TIMEZONES,
  type TimeRange,
} from "../../src/pyramid/slots";

test.describe("Unit: пересечение слотов по времени", () => {
  test("пересекающиеся слоты — overlap === true", () => {
    const slotA: TimeRange = { start: new Date("2026-08-01T10:00:00"), end: new Date("2026-08-01T10:25:00") };
    const slotB: TimeRange = { start: new Date("2026-08-01T10:10:00"), end: new Date("2026-08-01T10:35:00") };

    expect(slotsOverlap(slotA, slotB)).toBe(true);
  });

  test("слоты впритык друг к другу (конец первого = начало второго) — overlap === false", () => {
    const slotA: TimeRange = { start: new Date("2026-08-01T10:00:00"), end: new Date("2026-08-01T10:25:00") };
    const slotB: TimeRange = { start: new Date("2026-08-01T10:25:00"), end: new Date("2026-08-01T10:50:00") };

    expect(slotsOverlap(slotA, slotB)).toBe(false);
  });

  test("слоты в разное время суток — overlap === false", () => {
    const slotA: TimeRange = { start: new Date("2026-08-01T10:00:00"), end: new Date("2026-08-01T10:25:00") };
    const slotB: TimeRange = { start: new Date("2026-08-01T14:00:00"), end: new Date("2026-08-01T14:25:00") };

    expect(slotsOverlap(slotA, slotB)).toBe(false);
  });

  test("слот A целиком позже слота B — overlap === false", () => {
    const slotA: TimeRange = { start: new Date("2026-08-01T14:00:00"), end: new Date("2026-08-01T14:25:00") };
    const slotB: TimeRange = { start: new Date("2026-08-01T10:00:00"), end: new Date("2026-08-01T10:25:00") };

    expect(slotsOverlap(slotA, slotB)).toBe(false);
  });

  test("слот B целиком внутри слота A (вложенность) — overlap === true", () => {
    const slotA: TimeRange = { start: new Date("2026-08-01T10:00:00"), end: new Date("2026-08-01T11:00:00") };
    const slotB: TimeRange = { start: new Date("2026-08-01T10:15:00"), end: new Date("2026-08-01T10:45:00") };

    expect(slotsOverlap(slotA, slotB)).toBe(true);
  });

  test("полностью совпадающие диапазоны — overlap === true", () => {
    const slotA: TimeRange = { start: new Date("2026-08-01T10:00:00"), end: new Date("2026-08-01T10:25:00") };
    const slotB: TimeRange = { start: new Date("2026-08-01T10:00:00"), end: new Date("2026-08-01T10:25:00") };

    expect(slotsOverlap(slotA, slotB)).toBe(true);
  });
});

test.describe("Unit: отображение времени слота в часовом поясе участника ", () => {
  const slotStart = new Date("2026-08-01T07:00:00Z");

  test("один и тот же момент времени показывается по-разному в разных поясах", () => {
    expect(formatSlotTime(slotStart, "Europe/Moscow")).toBe("10:00");
    expect(formatSlotTime(slotStart, "Asia/Yekaterinburg")).toBe("12:00");
  });

  test("формат — только часы и минуты, без даты и секунд", () => {
    expect(formatSlotTime(slotStart, "Europe/Moscow")).toMatch(/^\d{2}:\d{2}$/);
  });
});

test.describe("Валидация пароля при регистрации ", () => {
  test("пароль короче 8 символов — невалиден", () => {
    expect(isPasswordValid("1234567")).toBe(false);
  });

  test("пароль ровно 8 символов — валиден", () => {
    expect(isPasswordValid("12345678")).toBe(true);
  });

  test("пустой пароль — невалиден", () => {
    expect(isPasswordValid("")).toBe(false);
  });

  test("пароль длиннее 8 символов — валиден", () => {
    expect(isPasswordValid("testpass123")).toBe(true);
  });
});

test.describe("Регистрация: обязательные поля", () => {
  test("без имени форма неполная", () => {
    expect(isRegistrationFormComplete("", "a@example.com", "testpass123")).toBe(
      false,
    );
  });

  test("без email форма неполная", () => {
    expect(isRegistrationFormComplete("Тимур", "", "testpass123")).toBe(false);
  });

  test("короткий пароль делает форму неполной", () => {
    expect(isRegistrationFormComplete("Тимур", "a@example.com", "short")).toBe(
      false,
    );
  });

  test("имя, email и пароль ≥ 8 — форма полная", () => {
    expect(
      isRegistrationFormComplete("Тимур", "a@example.com", "testpass123"),
    ).toBe(true);
  });
});

test.describe("Часовые пояса профиля из requirements.md", () => {
  const slotStart = new Date("2026-08-01T07:00:00Z");

  test("все пояса из спецификации форматируют время как ЧЧ:ММ", () => {
    for (const timeZone of PROFILE_TIMEZONES) {
      expect(formatSlotTime(slotStart, timeZone)).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  test("Калининград и Владивосток показывают разное время одного слота", () => {
    expect(formatSlotTime(slotStart, "Europe/Kaliningrad")).toBe("09:00");
    expect(formatSlotTime(slotStart, "Asia/Vladivostok")).toBe("17:00");
  });
});
