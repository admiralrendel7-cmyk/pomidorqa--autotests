import { test, expect } from "@playwright/test";
import { HeaderPage } from "../pages/header-page";
import { ProfilePage } from "../pages/profile-page";
import { RegisterPage } from "../pages/register-page";
import { makeUser, registerUser, ROUTES } from "../helpers/user";

const LOGIN_URL = /\/pomidorqa\/auth\/login\/?$/;

test.describe("Регистрация, сессия и доступ гостя", () => {
  test("форма блокирует пустые обязательные поля и короткий пароль", async ({
    page,
  }) => {
    const registerPage = new RegisterPage(page);

    await test.step("Открываем регистрацию и отправляем пустую форму", async () => {
      await registerPage.goto();
      await registerPage.submit();
    });

    const required = await test.step(
      "Считываем browser validation обязательных полей",
      async () => ({
        name: await registerPage.nameInput.evaluate(
          (input: HTMLInputElement) => input.validity.valid,
        ),
        email: await registerPage.emailInput.evaluate(
          (input: HTMLInputElement) => input.validity.valid,
        ),
        password: await registerPage.passwordInput.evaluate(
          (input: HTMLInputElement) => input.validity.valid,
        ),
      }),
    );

    await test.step("Имя, email и пароль обязательны", async () => {
      expect(required).toEqual({
        name: false,
        email: false,
        password: false,
      });
    });

    await test.step("Короткий пароль тоже невалиден", async () => {
      await registerPage.nameInput.fill("Validation User");
      await registerPage.emailInput.fill(
        `short-pass-${Date.now()}@example.com`,
      );
      await registerPage.passwordInput.fill("short");
      await registerPage.submit();
      expect(
        await registerPage.passwordInput.evaluate(
          (input: HTMLInputElement) => input.validity.valid,
        ),
      ).toBe(false);
      await expect(page).toHaveURL(/\/pomidorqa\/auth\/register\/?$/);
    });
  });

  test("после регистрации профиль получает имя и Europe/Moscow", async ({
    page,
  }) => {
    const user = makeUser("default-profile", Date.now());
    const profile = new ProfilePage(page);

    await test.step("Регистрируемся через форму", async () => {
      await registerUser(page, user);
    });

    await test.step("Открываем профиль", async () => {
      await profile.goto();
    });

    await test.step("Имя из регистрации и пояс по умолчанию", async () => {
      await expect(profile.profileNameInput).toHaveValue(user.name);
      await expect(profile.profileTimezoneSelect).toHaveValue("Europe/Moscow");
    });
  });

  test("сессия сохраняется после reload, logout закрывает доступ к профилю", async ({
    page,
  }) => {
    const user = makeUser("session", Date.now());
    const profile = new ProfilePage(page);
    const header = new HeaderPage(page);

    await test.step("Регистрируемся", async () => {
      await registerUser(page, user);
    });

    await test.step("Профиль открыт, кнопка выхода видна", async () => {
      await profile.goto();
      await expect(profile.profileNameInput).toHaveValue(user.name);
      await expect(header.logoutButton).toBeVisible();
    });

    await test.step("После reload сессия жива", async () => {
      await page.reload();
      await expect(profile.profileNameInput).toHaveValue(user.name);
      await expect(header.logoutButton).toBeVisible();
    });

    await test.step("Выходим", async () => {
      await header.logout();
    });

    await test.step("Видна ссылка «Войти»", async () => {
      await expect(header.loginLink).toBeVisible();
    });

    await test.step("Прямой переход в профиль отправляет на login", async () => {
      await page.goto(ROUTES.profile);
      await expect(page).toHaveURL(LOGIN_URL);
    });
  });

  test("гость не открывает профиль, слоты и встречи без входа", async ({
    page,
  }) => {
    await test.step("Профиль без сессии", async () => {
      await page.goto(ROUTES.profile);
      await expect(page).toHaveURL(LOGIN_URL);
    });

    await test.step("Слоты без сессии", async () => {
      await page.goto(ROUTES.slots);
      await expect(page).toHaveURL(LOGIN_URL);
    });

    await test.step("Встречи без сессии", async () => {
      await page.goto(ROUTES.bookings);
      await expect(page).toHaveURL(LOGIN_URL);
    });
  });
});
