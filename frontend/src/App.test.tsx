import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { login } from "./api/auth";
import { fetchMe } from "./api/profile";
import { ApiError } from "./api/client";

vi.mock("./api/auth", () => ({
  login: vi.fn(), logout: vi.fn(), logoutAllRequest: vi.fn(), logoutLocal: vi.fn(),
}));
vi.mock("./api/profile", () => ({ fetchMe: vi.fn() }));
vi.mock("./api/notifications", () => ({ fetchNotifications: vi.fn().mockResolvedValue({ unread_count: 0 }) }));
vi.mock("./onboarding/OnboardingOverlay", () => ({ default: () => null }));
vi.mock("./screens/HomeScreen", () => ({ default: () => <div>Home ready</div> }));
vi.mock("./screens/SearchScreen", () => ({ default: () => <div>Search ready</div> }));
vi.mock("./screens/CartScreen", () => ({ default: () => <div>Cart ready</div> }));
vi.mock("./screens/ProfileScreen", () => ({ default: () => <div>Profile ready</div> }));
vi.mock("./screens/SupplierScreen", () => ({ default: () => <div>Supplier ready</div> }));
vi.mock("./screens/OrdersScreen", () => ({ default: () => <div>Orders ready</div> }));
vi.mock("./screens/AnalyticsScreen", () => ({ default: () => <div>Analytics ready</div> }));
vi.mock("./screens/CompanyPickerScreen", () => ({ default: () => <div>CompanyPicker ready</div> }));
vi.mock("./screens/PublicationsScreen", () => ({ default: () => <div>Publications ready</div> }));
vi.mock("./screens/ProfileEditScreen", () => ({ default: () => <div>ProfileEdit ready</div> }));
vi.mock("./screens/NotificationsScreen", () => ({ default: () => <div>Notifications ready</div> }));
vi.mock("./screens/DeliveriesScreen", () => ({ default: () => <div>Deliveries ready</div> }));
vi.mock("./screens/AboutScreen", () => ({ default: () => <div>About ready</div> }));
vi.mock("./screens/HelpScreen", () => ({ default: () => <div>Help ready</div> }));
vi.mock("./screens/FaqScreen", () => ({ default: () => <div>Faq ready</div> }));
vi.mock("./screens/AIChatScreen", () => ({ default: () => <div>AIChat ready</div> }));

describe("startup in StrictMode", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(fetchMe).mockResolvedValue({
      id: 1, email: "buyer1@usc.demo", first_name: "Demo", last_name: "Buyer",
      phone: "", role: "buyer",
      companies: [{ company_id: 1, name: "Demo", company_type: "BUYER", role: "OWNER" }],
    });
  });

  it("finishes a pending login after effect replay without a duplicate request", async () => {
    let finish!: () => void;
    vi.mocked(login).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<StrictMode><App /></StrictMode>);
    expect(login).toHaveBeenCalledTimes(1);
    finish();
    expect(await screen.findByText("Home ready")).toBeInTheDocument();
    await waitFor(() => expect(fetchMe).toHaveBeenCalled());
    expect(screen.queryByText("Выполняется автовход...")).not.toBeInTheDocument();
  });

  it("shows a retry after failed login, without inventing credentials, and recovers", async () => {
    vi.mocked(login).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    render(<StrictMode><App /></StrictMode>);
    const retry = await screen.findByRole("button", { name: "Повторить вход" });
    expect(localStorage.getItem("usc_access_token")).toBeNull();
    expect(localStorage.getItem("usc_refresh_token")).toBeNull();
    expect(fetchMe).not.toHaveBeenCalled();
    fireEvent.click(retry);
    expect(await screen.findByText("Home ready")).toBeInTheDocument();
    expect(login).toHaveBeenCalledTimes(2);
  });

  it("explains a server rate limit instead of presenting an endless spinner", async () => {
    vi.mocked(login).mockRejectedValue(new ApiError(429, "POST", "/auth/login/", '{"retry_after":120}'));
    render(<StrictMode><App /></StrictMode>);
    expect(await screen.findByText("Слишком много попыток входа. Повторите через 120 сек.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить вход" })).toBeEnabled();
    expect(login).toHaveBeenCalledTimes(1);
  });
});
