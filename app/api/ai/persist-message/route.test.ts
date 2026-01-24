/**
 * @jest-environment node
 */

import { POST } from "./route";

const mockGetSession = jest.fn();
const mockMemberFindFirst = jest.fn();
const mockConversationFindFirst = jest.fn();
const mockMessageCreate = jest.fn();
const mockHeaders = jest.fn();

jest.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

jest.mock("@/lib/auth", () => ({
  auth: { api: { getSession: (opts: unknown) => mockGetSession(opts) } },
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    member: { findFirst: (opts: unknown) => mockMemberFindFirst(opts) },
    conversation: { findFirst: (opts: unknown) => mockConversationFindFirst(opts) },
    message: { create: (opts: unknown) => mockMessageCreate(opts) },
  },
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/persist-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHeaders.mockResolvedValue(new Headers());
  mockGetSession.mockResolvedValue({
    user: { id: "user-1", role: "user" },
    session: { activeOrganizationId: "org-1" },
  });
  mockMemberFindFirst.mockResolvedValue({ id: "mem-1" });
  mockConversationFindFirst.mockResolvedValue({ id: "conv-1" });
  mockMessageCreate.mockResolvedValue({});
});

describe("POST /api/ai/persist-message", () => {
  it("returns 400 when conversationId is missing", async () => {
    const res = await POST(
      jsonRequest({ role: "assistant", content: "Hi" }),
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Conversation ID");
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when role is invalid", async () => {
    const res = await POST(
      jsonRequest({
        conversationId: "c1",
        role: "system",
        content: "Hi",
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Invalid role");
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when content is missing", async () => {
    const res = await POST(
      jsonRequest({ conversationId: "c1", role: "assistant" }),
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Content is required");
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(
      jsonRequest({
        conversationId: "c1",
        role: "assistant",
        content: "Hi",
      }),
    );
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("Unauthorized");
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when activeOrganizationId is missing", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "u1", role: "user" },
      session: { activeOrganizationId: null },
    });
    const res = await POST(
      jsonRequest({
        conversationId: "c1",
        role: "assistant",
        content: "Hi",
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("No active organization");
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("returns 403 when user has no membership", async () => {
    mockMemberFindFirst.mockResolvedValue(null);
    const res = await POST(
      jsonRequest({
        conversationId: "c1",
        role: "assistant",
        content: "Hi",
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("Unauthorized");
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when conversation is not found", async () => {
    mockConversationFindFirst.mockResolvedValue(null);
    const res = await POST(
      jsonRequest({
        conversationId: "c1",
        role: "assistant",
        content: "Hi",
      }),
    );
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("not found");
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("returns 200 and creates message with provided parts", async () => {
    const res = await POST(
      jsonRequest({
        conversationId: "c1",
        role: "assistant",
        content: "Hello",
        parts: [
          { type: "text", text: "Hello", state: "done" },
          { type: "citations", citations: { "1": { name: "a.pdf" } } },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("persisted");
    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: {
        conversationId: "c1",
        role: "assistant",
        content: "Hello",
        parts: [
          { type: "text", text: "Hello", state: "done" },
          { type: "citations", citations: { "1": { name: "a.pdf" } } },
        ],
      },
    });
  });

  it("returns 200 and uses default parts when parts not provided", async () => {
    const res = await POST(
      jsonRequest({
        conversationId: "c1",
        role: "assistant",
        content: "Hi",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: {
        conversationId: "c1",
        role: "assistant",
        content: "Hi",
        parts: [{ type: "text", text: "Hi", state: "done" }],
      },
    });
  });

  it("skips membership check for admin users", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
      session: { activeOrganizationId: "org-1" },
    });
    mockMemberFindFirst.mockResolvedValue(null);
    const res = await POST(
      jsonRequest({
        conversationId: "c1",
        role: "assistant",
        content: "Hi",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockMessageCreate).toHaveBeenCalled();
  });
});
