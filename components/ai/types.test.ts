import { toChatMessage } from "@/components/ai/types";

describe("toChatMessage", () => {
  it("converts minimal stored message to chat message", () => {
    const stored = {
      id: "msg-1",
      role: "user",
      content: "Hello",
    };
    const result = toChatMessage(stored);
    expect(result.id).toBe("msg-1");
    expect(result.role).toBe("user");
    expect(result.parts).toEqual([{ type: "text", text: "Hello" }]);
    expect(result.metadata).toBeUndefined();
  });

  it("uses parts when provided", () => {
    const stored = {
      id: "m2",
      role: "assistant",
      content: "Hi",
      parts: [{ type: "text", text: "Hi" }],
    };
    const result = toChatMessage(stored);
    expect(result.parts).toEqual([{ type: "text", text: "Hi" }]);
  });

  it("puts createdAt into metadata when present", () => {
    const stored = {
      id: "m3",
      role: "assistant",
      content: "Ok",
      createdAt: "2025-01-01T00:00:00Z",
    };
    const result = toChatMessage(stored);
    expect(result.metadata).toEqual({ createdAt: "2025-01-01T00:00:00Z" });
  });

  it("extracts citations from parts and puts in metadata", () => {
    const stored = {
      id: "m4",
      role: "assistant",
      content: "See [[1]].",
      parts: [
        { type: "text", text: "See [[1]].", state: "done" },
        { type: "citations", citations: { "1": { name: "doc.pdf" } } },
      ],
    };
    const result = toChatMessage(stored);
    expect(result.metadata?.citations).toEqual({ "1": { name: "doc.pdf" } });
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0]).toEqual({ type: "text", text: "See [[1]].", state: "done" });
  });

  it("filters out non-object or non-type parts", () => {
    const stored = {
      id: "m5",
      role: "assistant",
      content: "X",
      parts: [null, { type: "text", text: "X" }, undefined, 1],
    };
    const result = toChatMessage(stored);
    expect(result.parts).toHaveLength(1);
  });
});
