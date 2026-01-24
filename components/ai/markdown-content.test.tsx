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
});
