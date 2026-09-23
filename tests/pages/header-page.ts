import { type Locator, type Page } from "@playwright/test";

export class HeaderPage {
  page: Page;
  logoutButton: Locator;
  loginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logoutButton = page.getByTestId("PomidorqaHeader-logout-button");
    this.loginLink = page.getByTestId("PomidorqaHeader-login-link");
  }

  async logout() {
    await this.logoutButton.click();
  }
}
