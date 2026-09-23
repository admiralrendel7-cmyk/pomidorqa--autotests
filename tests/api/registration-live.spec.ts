import { test, expect, request, type APIRequestContext } from "@playwright/test";
import {
  deleteUserViaApi,
  makeUser,
  registerUserViaApi,
} from "../helpers/user";

test.describe("API: регистрация на live PomidorQA", () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await request.newContext({
      baseURL: process.env.POMIDORQA_BASE_URL ?? "https://aiqa.su",
    });
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("новый участник создаётся с переданными данными", async () => {
    const user = makeUser("api-live", Date.now());

    try {
      const participant = await registerUserViaApi(api, user);

      expect(participant.name).toBe(user.name);
      expect(participant.email).toBe(user.email);
      expect(participant.id).toBeTruthy();
    } finally {
      await deleteUserViaApi(api);
    }
  });

  test("повторный email возвращает 409 email_taken", async () => {
    const user = makeUser("api-dup", Date.now());

    try {
      await registerUserViaApi(api, user);

      const response = await api.post("/api/pomidorqa/test/accounts", {
        data: user,
      });

      expect(response.status()).toBe(409);
      expect(await response.json()).toMatchObject({ error: "email_taken" });
    } finally {
      await deleteUserViaApi(api);
    }
  });

  test("короткий пароль отклоняется сервером", async () => {
    const user = {
      ...makeUser("api-short", Date.now()),
      password: "short",
    };

    const response = await api.post("/api/pomidorqa/test/accounts", {
      data: user,
    });

    expect(response.status()).toBe(400);
  });
});
