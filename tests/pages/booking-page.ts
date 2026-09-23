import { type Locator, type Page } from "@playwright/test";

export class BookingPage {
  page: Page;
  slotsDateInput: Locator;
  slotsTimeInput: Locator;
  addSlotButton: Locator;
  slotCard: Locator;
  catalogFilterInput: Locator;
  catalogSearchButton: Locator;
  personCard: Locator;
  personName: Locator;
  bookingConfirmDialog: Locator;
  bookingConfirmButton: Locator;
  bookingConfirmSuccess: Locator;
  bookingConfirmError: Locator;
  upcomingHeading: Locator;
  pastHeading: Locator;
  upcomingMeetings: Locator;
  upcomingEmpty: Locator;
  cancelledStatus: Locator;
  bookingCancelButton: Locator;
  catalogEmpty: Locator;
  cancelError: Locator;
  bookingDismissButton: Locator;
  calendarTimezoneHint: Locator;
  personContent: Locator;

  constructor(page: Page) {
    this.page = page;
    this.slotsDateInput = page.locator("#pomidorqa-slots-date");
    this.slotsTimeInput = page.locator("#pomidorqa-slots-time");
    this.addSlotButton = page.getByRole("button", { name: "Добавить слот" });
    this.slotCard = page.locator("[data-slot-id]");
    this.catalogFilterInput = page.locator("#pomidorqa-catalog-skill-filter");
    this.catalogSearchButton = page.getByRole("button", { name: "Найти" });
    this.personCard = page.getByTestId("person-card");
    this.personName = page.getByRole("heading", { level: 1 });
    this.bookingConfirmDialog = page.getByRole("dialog");
    this.bookingConfirmButton = page
      .getByRole("dialog")
      .getByRole("button", { name: "Подтвердить" });
    this.bookingConfirmSuccess = page.getByRole("dialog").getByRole("status");
    this.bookingConfirmError = page.getByRole("dialog").getByRole("alert");
    this.upcomingHeading = page.getByRole("heading", { name: "Ближайшие" });
    this.pastHeading = page.getByRole("heading", {
      name: "Прошедшие и отменённые",
    });
    this.upcomingMeetings = page.getByTestId("upcoming-meetings");
    this.upcomingEmpty = this.upcomingMeetings.getByText("Пока пусто");
    this.cancelledStatus = page.getByText(/отменено/i);
    this.bookingCancelButton = page.getByRole("button", { name: "Отменить" });
    this.catalogEmpty = page.getByText("Пока никого не нашли по этому фильтру");
    this.cancelError = page.getByTestId("cancel-error");
    this.bookingDismissButton = page
      .getByRole("dialog")
      .getByRole("button", { name: "Отмена" });
    this.calendarTimezoneHint = page.getByTestId("slots-timezone");
    this.personContent = page.locator("main");
  }

  meetingByName(name: string) {
    return this.page.getByText(name, { exact: true });
  }

  upcomingByName(name: string) {
    return this.upcomingMeetings.filter({ hasText: name });
  }

  pastSection() {
    return this.page
      .locator("section")
      .filter({ hasText: "Прошедшие и отменённые" });
  }

  pastCancelButton() {
    return this.pastSection().getByRole("button", { name: "Отменить" });
  }

  slotCardByTime(time: string) {
    return this.slotCard.filter({ hasText: time });
  }

  slotDeleteButton(time: string) {
    return this.slotCardByTime(time).getByRole("button", { name: "Удалить" });
  }

  async deleteSlot(time: string) {
    const card = this.slotCardByTime(time);
    const deleted = this.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/pomidorqa/profile/slots" &&
        response.request().method() === "POST",
      { timeout: 15_000 },
    );
    await this.slotDeleteButton(time).click();
    await deleted;
    await card.waitFor({ state: "hidden", timeout: 10_000 });
  }

  async dismiss() {
    await this.bookingDismissButton.click();
  }

  canHelpOnPerson() {
    return this.page.getByText(/может помочь с/i).locator("..");
  }

  wantToLearnOnPerson() {
    return this.page.getByText(/хочет разобрать/i).locator("..");
  }

  cardByName(name: string) {
    return this.personCard.filter({ hasText: name });
  }

  async gotoSlots() {
    await this.page.goto("/pomidorqa/profile/slots");
  }

  async addTomorrowSlot(time = "12:00") {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const date = tomorrow.toISOString().slice(0, 10);
    const slotsBefore = await this.slotCard.count();
    await this.slotsDateInput.fill(date);
    await this.slotsTimeInput.fill(time);
    const created = this.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/pomidorqa/profile/slots" &&
        response.request().method() === "POST",
      { timeout: 15_000 },
    );
    await this.addSlotButton.click();
    await created;
    await this.slotCard.nth(slotsBefore).waitFor({ state: "visible" });
    return { date, time };
  }

  async addSlotIn(msFromNow: number) {
    const instant = new Date(Date.now() + msFromNow);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(instant);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";
    const date = `${value("year")}-${value("month")}-${value("day")}`;
    const hour = String(Number(value("hour")) % 24).padStart(2, "0");
    const time = `${hour}:${value("minute")}`;
    await this.slotsDateInput.fill(date);
    await this.slotsTimeInput.fill(time);
    const created = this.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/pomidorqa/profile/slots" &&
        response.request().method() === "POST",
      { timeout: 15_000 },
    );
    await this.addSlotButton.click();
    await created;
    return { date, time };
  }

  async gotoPerson(id: string) {
    await this.page.goto(`/pomidorqa/people/${id}`);
  }

  async search(skillTag: string) {
    await this.page.goto("/pomidorqa");
    await this.catalogFilterInput.fill(skillTag);
    await this.catalogSearchButton.click();
  }

  async openPerson(name: string) {
    await this.cardByName(name).click();
  }

  slotById(slotId: string) {
    return this.page
      .getByRole("group", { name: "Время слотов" })
      .locator(`[data-slot-id="${slotId}"]`);
  }

  slotDay(date: string) {
    return this.page.locator(`[data-date="${date}"]`);
  }

  slotTime(time?: string) {
    const group = this.page.getByRole("group", { name: "Время слотов" });
    return time
      ? group.getByRole("button", { name: time, exact: true })
      : group.getByRole("button");
  }

  async openSlot(date: string, slotId: string) {
    const day = this.slotDay(date);
    const slot = this.slotById(slotId);
    await slot.waitFor({ state: "visible" });
    await this.page.waitForFunction((id) => {
      const button = document.querySelector(
        `[aria-label="Время слотов"] [data-slot-id="${id}"]`,
      );
      return Boolean(
        button && Object.keys(button).some((key) => key.startsWith("__react")),
      );
    }, slotId);
    if ((await day.getAttribute("aria-pressed")) !== "true") {
      await day.click();
    }
    await slot.click();
  }

  async confirm() {
    await this.bookingConfirmButton.click();
  }

  async gotoBookings() {
    await this.page.goto("/pomidorqa/bookings");
  }

  async cancelBooking() {
    await this.gotoBookings();
    await this.bookingCancelButton.click();
  }
}


