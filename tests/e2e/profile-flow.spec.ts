import { test, expect } from "@playwright/test";
import { makeUser, registerUser } from "../helpers/user";
import { ProfilePage } from "../pages/profile-page";

test.describe("Профиль: действия с полями", () => {
    let profilePage: ProfilePage;

  test.beforeEach(async ({ page }) => {
    const runId = Date.now() * 100 + test.info().workerIndex;
    const user = makeUser("hw8", runId);
    profilePage = new ProfilePage(page);
    await registerUser(page, user);
    await profilePage.goto();
  });

  test("имя: вводим новое и сохраняем", async ({ page }) => {
    const newName = `Тимур Тестович ${Date.now()}`;

    await test.step("Заполняем поле и сохраняем", async () => {
      await profilePage.fillProfileName(newName);
      await profilePage.saveProfile();
    });

    await test.step("После перезагрузки имя пришло с сервера", async () => {
      await page.reload();
      await expect(profilePage.profileNameInput).toHaveValue(newName);
    });
  });

  test("часовой пояс: выбираем из списка", async ({ page }) => {
    const timezone = "Asia/Yekaterinburg";

    await test.step("Выбираем часовой пояс и сохраняем", async () => {
      await expect(profilePage.profileTimezoneSelect).toHaveValue("Europe/Moscow");
      await profilePage.fillProfileTimezone(timezone);
      await profilePage.saveProfile();
    });

    await test.step("После перезагрузки выбран новый пояс", async () => {
      await page.reload();
      await expect(profilePage.profileTimezoneSelect).toHaveValue(timezone);
    });
  });

  test("telegram: заполняем пустое поле", async ({ page }) => {
    const telegram = `@qa_timur_cat${Date.now()}`;

    await test.step("Заполняем Telegram и сохраняем", async () => {
      await expect(profilePage.profileTelegramInput).toHaveValue("");
      await profilePage.fillProfileTelegram(telegram);
      await profilePage.saveProfile();
    });

    await test.step("После перезагрузки Telegram пришёл с сервера", async () => {
      await page.reload();
      await expect(profilePage.profileTelegramInput).toHaveValue(telegram);
    });
  });

  test("о себе: заполняем многострочное поле", async ({ page }) => {
    const bio = `QA-инженер, прогон ${Date.now()}. Пытаюсь разобраться в Playwright.`;

    await test.step("Заполняем «О себе» и сохраняем", async () => {
      await profilePage.fillProfileBio(bio);
      await profilePage.saveProfile();
    });

    await test.step("После перезагрузки текст пришёл с сервера", async () => {
      await page.reload();
      await expect(profilePage.profileBioInput).toHaveValue(bio);
    });
  });

  test("навык: заполняем, выбираем тип и добавляем", async ({ page }) => {
    const skillTag = `Playwright-demo-${Date.now()}`;

    await test.step("Добавляем навык «могу помочь»", async () => {
      await profilePage.addSkill(skillTag, "can_help");
    });

    await test.step("Навык появился в блоке «могу помочь»", async () => {
      await expect(profilePage.canHelpSkills).toContainText(skillTag);
    });
  });

  test("негатив: пустой навык не добавляется", async ({ page }) => {
    await test.step("Жмём «Добавить», не заполнив поле", async () => {
      await expect(profilePage.skillInput).toHaveValue("");
      await profilePage.addSkillButton.click();
    });

    await test.step("Ни одного навыка не появилось", async () => {
      await expect(profilePage.skillChips).toHaveCount(0);
      await expect(profilePage.canHelpSkills).not.toBeVisible();
    });
  });

  test("негатив: навык «хочу разобрать» не попадает в блок «могу помочь»", async ({ page }) => {
    const runId = Date.now();
    const canHelpTag = `CanHelp-${runId}`;
    const wantToLearnTag = `WantToLearn-${runId}`;

    await test.step("Добавляем навык «могу помочь»", async () => {
      await profilePage.addSkill(canHelpTag, "can_help");
      await expect(profilePage.skillChip(canHelpTag)).toBeVisible();
    });

    await test.step("Добавляем навык «хочу разобрать»", async () => {
      await profilePage.addSkill(wantToLearnTag, "want_to_learn");
      await expect(profilePage.skillChip(wantToLearnTag)).toBeVisible();
    });

    await test.step("Навыки разошлись по своим блокам", async () => {
      await expect(profilePage.skillChips).toHaveCount(2);
      await expect(profilePage.canHelpSkills).toContainText(canHelpTag);
      await expect(profilePage.canHelpSkills).not.toContainText(wantToLearnTag);
    });
  });

  test("форма профиля: три поля сохраняются за один раз", async ({ page }) => {
    const runId = Date.now();
    const name = `Тимур Тестовый ${runId}`;
    const telegram = `@qa_timur_${runId}`;
    const bio = `QA-инженер, прогон ${runId}. Проверяю форму профиля целиком.`;

    await test.step("Заполняем Имя, Telegram и «О себе», сохраняем разом", async () => {
      await profilePage.fillProfileName(name);
      await profilePage.fillProfileTelegram(telegram);
      await profilePage.fillProfileBio(bio);
      await profilePage.saveProfile();
    });

    await test.step("После перезагрузки все три значения пришли с сервера", async () => {
      await page.reload();
      await expect.soft(profilePage.profileNameInput).toHaveValue(name);
      await expect.soft(profilePage.profileTelegramInput).toHaveValue(telegram);
      await expect.soft(profilePage.profileBioInput).toHaveValue(bio);
    });
  });

  test("навык: удаляем добавленный чип", async ({ page }) => {
    const skillTag = `Delete-skill-${Date.now()}`;

    await test.step("Добавляем навык", async () => {
      await profilePage.addSkill(skillTag);
    });

    await test.step("Навык появился", async () => {
      await expect(profilePage.skillChip(skillTag)).toBeVisible();
    });

    await test.step("Удаляем навык", async () => {
      await profilePage.removeSkill(skillTag);
    });

    await test.step("После удаления чипа нет", async () => {
      await expect(profilePage.skillChip(skillTag)).toHaveCount(0);
    });

    await test.step("После перезагрузки навык не вернулся", async () => {
      await page.reload();
      await expect(profilePage.skillChip(skillTag)).toHaveCount(0);
    });
  });

  test("навык: повторно тот же тип не создаёт дубль", async ({ page }) => {
    const skillTag = `Duplicate-skill-${Date.now()}`;

    await test.step("Добавляем навык первый раз", async () => {
      await profilePage.addSkill(skillTag);
    });

    await test.step("Навык появился один раз", async () => {
      await expect(profilePage.skillChip(skillTag)).toHaveCount(1);
    });

    await test.step("Пробуем добавить тот же навык ещё раз", async () => {
      await profilePage.addSkill(skillTag);
    });

    await test.step("После перезагрузки дубля нет", async () => {
      await page.reload();
      await expect(profilePage.skillChip(skillTag)).toHaveCount(1);
      await expect(profilePage.canHelpSkills).toContainText(skillTag);
    });
  });

  test("имя обязательно — пустое поле форма не сохраняет", async ({ page }) => {
    await test.step("Очищаем имя и жмём «Сохранить»", async () => {
      await profilePage.profileNameInput.fill("");
      await profilePage.attemptSaveProfile();
    });

    await test.step("Браузерная валидация блокирует пустое имя", async () => {
      expect(
        await profilePage.profileNameInput.evaluate(
          (input: HTMLInputElement) => input.validity.valid,
        ),
      ).toBe(false);
    });
  });

  test("одинаковый текст навыка разрешён в двух разных типах", async ({
    page,
  }) => {
    const skillTag = `Both-types-${Date.now()}`;

    await test.step("Добавляем навык в «могу помочь»", async () => {
      await profilePage.addSkill(skillTag, "can_help");
      await expect(profilePage.canHelpSkills).toContainText(skillTag);
    });

    await test.step("Добавляем тот же текст в «хочу разобрать»", async () => {
      await profilePage.addSkill(skillTag, "want_to_learn");
      await expect(profilePage.wantToLearnSkills).toContainText(skillTag);
    });

    await test.step("После перезагрузки оба типа содержат навык", async () => {
      await page.reload();
      await expect(profilePage.canHelpSkills).toContainText(skillTag);
      await expect(profilePage.wantToLearnSkills).toContainText(skillTag);
      await expect(profilePage.skillChip(skillTag)).toHaveCount(2);
    });
  });
});
