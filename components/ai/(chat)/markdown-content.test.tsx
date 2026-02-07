import React from "react";
import { render, screen } from "@testing-library/react";
import { MarkdownContent } from "@/components/ai/markdown-content";

jest.mock("react-markdown", () => {
  return function MockReactMarkdown({
    children,
  }: {
    children?: React.ReactNode;
  }) {
    return <div data-testid="react-markdown">{children}</div>;
  };
});

jest.mock("remark-gfm", () => () => ({}));

describe("MarkdownContent", () => {
  it("renders plain text", () => {
    render(<MarkdownContent content="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("passes content to markdown renderer", () => {
    render(<MarkdownContent content="# Title" />);
    expect(screen.getByTestId("react-markdown")).toHaveTextContent("# Title");
  });

  it("replaces [[1]] with document name when citations provided", () => {
    render(
      <MarkdownContent
        content="See [[1]] for details."
        citations={{ "1": { name: "policy.pdf" } }}
      />,
    );
    expect(screen.getByText(/\(Source: policy\.pdf\)/)).toBeInTheDocument();
    expect(screen.getByText(/See .*Source: policy\.pdf.* for details/)).toBeInTheDocument();
  });

  it("replaces [[1]][[2]] adjacent refs with both document names", () => {
    render(
      <MarkdownContent
        content="Sources: [[1]][[2]]"
        citations={{
          "1": { name: "a.pdf" },
          "2": { name: "b.pdf" },
        }}
      />,
    );
    expect(screen.getByText(/\(Source: a\.pdf\)/)).toBeInTheDocument();
    expect(screen.getByText(/\(Source: b\.pdf\)/)).toBeInTheDocument();
  });

  it("replaces [[ 1 ]] with spaces", () => {
    render(
      <MarkdownContent
        content="Ref [[ 1 ]]"
        citations={{ "1": { name: "x.pdf" } }}
      />,
    );
    expect(screen.getByText(/\(Source: x\.pdf\)/)).toBeInTheDocument();
  });

  it("uses fallback when citation index missing", () => {
    render(
      <MarkdownContent
        content="See [[99]]"
        citations={{ "1": { name: "a.pdf" } }}
      />,
    );
    expect(screen.getByText(/\(Source: Document 99\)/)).toBeInTheDocument();
  });

  it("leaves [[n]] unchanged when citations is empty", () => {
    render(<MarkdownContent content="See [[1]]" citations={{}} />);
    expect(screen.getByText(/\[\[1\]\]/)).toBeInTheDocument();
  });

  it("leaves [[n]] unchanged when citations is undefined", () => {
    render(<MarkdownContent content="See [[1]]" />);
    expect(screen.getByText(/\[\[1\]\]/)).toBeInTheDocument();
  });

  it("normalizes 4+ consecutive newlines to at most one blank line", () => {
    render(<MarkdownContent content="a\n\n\n\nb" />);
    const markdownEl = screen.getByTestId("react-markdown");
    expect(markdownEl.textContent).not.toMatch(/\n\n\n/);
    expect(markdownEl.textContent).toContain("a");
    expect(markdownEl.textContent).toContain("b");
  });

  it("collapses excessive newlines around citation lines", () => {
    render(
      <MarkdownContent
        content={"p\n\n\n\n[[1]]\n\n\n\nq"}
        citations={{ "1": { name: "doc.pdf" } }}
      />
    );
    const markdownEl = screen.getByTestId("react-markdown");
    const text = markdownEl.textContent ?? "";
    expect(text).toContain("(Source: doc.pdf)");
    expect(text).not.toMatch(/\n\n\n.*\(Source:/);
    expect(text).not.toMatch(/\(Source:[^)]+\)\s*\n\n\n/);
  });

  it("passes list content through without corruption", () => {
    render(<MarkdownContent content="- a\n- b" />);
    expect(screen.getByTestId("react-markdown")).toHaveTextContent(/- a/);
    expect(screen.getByTestId("react-markdown")).toHaveTextContent(/- b/);
  });

  it("passes fenced code block content through without corruption", () => {
    const code = "const x = 1;";
    render(<MarkdownContent content={`\`\`\`js\n${code}\n\`\`\``} />);
    expect(screen.getByTestId("react-markdown")).toHaveTextContent(code);
  });
});
