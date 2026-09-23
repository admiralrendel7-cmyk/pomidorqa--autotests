// Чистые функции без сервера, без БД, без браузера — материал для Unit-уровня пирамиды.

export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Пересекаются ли два временных окна.
 */
export function slotsOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Валидация пароля при регистрации.
 * правило: requirements.md, п.4 — пароль не короче 8 символов.
 */
export function isPasswordValid(password: string): boolean {
  return password.length >= 8;
}

/** Часовые пояса профиля из requirements.md, п.14. */
export const PROFILE_TIMEZONES = [
  "Europe/Kaliningrad",
  "Europe/Moscow",
  "Europe/Samara",
  "Asia/Yekaterinburg",
  "Asia/Omsk",
  "Asia/Novosibirsk",
  "Asia/Krasnoyarsk",
  "Asia/Irkutsk",
  "Asia/Yakutsk",
  "Asia/Vladivostok",
] as const;

export function isRegistrationFormComplete(
  name: string,
  email: string,
  password: string,
): boolean {
  return name.trim().length > 0 && email.trim().length > 0 && isPasswordValid(password);
}

/**
 * Отображаемое время слота в часовом поясе участника (сценарий 3 из списка ДЗ).
 * Слот хранится как абсолютный момент времени (UTC), а видеть его участник должен
 * в своём локальном времени — иначе два человека в разных поясах прочитают разное время встречи.
 */
export function formatSlotTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}
