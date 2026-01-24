import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("is clickable", async () => {
    const fn = jest.fn();
    render(<Button onClick={fn}>Ok</Button>);
    await userEvent.click(screen.getByRole("button", { name: /ok/i }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("can be disabled", () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("applies variant classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole("button", { name: /delete/i });
    expect(btn.className).toMatch(/destructive/);
  });

  it("forwards extra props", () => {
    render(<Button data-testid="custom" aria-label="Custom">X</Button>);
    expect(screen.getByTestId("custom")).toHaveAttribute("aria-label", "Custom");
  });
});
