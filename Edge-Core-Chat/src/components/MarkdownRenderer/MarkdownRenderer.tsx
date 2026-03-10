/**
 * Markdown Renderer
 *
 * Modular markdown rendering utility that can be easily swapped.
 * Change the implementation here to use a different markdown library.
 */

import React from "react";
import ReactMarkdown, { Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";

import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import "katex/dist/katex.min.css";

// Reset to browser defaults for markdown content (override global CSS reset)
const useStyles = makeStyles({
  root: {
    "& *": {
      margin: "revert",
      padding: "revert",
    },
    // Remove extra spacing at start/end of rendered content
    "& > *:first-child": {
      marginTop: 0,
    },
    "& > *:last-child": {
      marginBottom: 0,
    },
    // Table styles (browser defaults don't include borders)
    "& table": {
      borderCollapse: "collapse",
      width: "100%",
    },
    "& th, & td": {
      border: "1px solid #ddd",
      padding: "8px",
      textAlign: "left",
    },
    "& th": {
      backgroundColor: "#f5f5f5",
    },
  },
  codeBlock: {
    display: "flex",
    backgroundColor: tokens.colorNeutralBackground1,
    height: "fit-content",
    boxShadow: tokens.shadow4,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    outline: `1px solid ${tokens.colorTransparentStroke}`,
    borderRadius: tokens.borderRadiusXLarge,
  },
});

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

/**
 * Renders markdown content to HTML.
 *
 * Current implementation: react-markdown with GFM and syntax highlighting
 * To swap: Replace the internals of this component with your preferred library
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ content, className }) => {
  const styles = useStyles();

  const components: Components = {
    code(props) {
      const { children, className: codeClassName, ...rest } = props;
      const match = /language-(\w+)/.exec(codeClassName || "");
      return match ? (
        <div className={styles.codeBlock}>
          {/* @ts-expect-error - 'ref' type is incorrect */}
          <SyntaxHighlighter
            {...rest}
            language={match[1]}
            PreTag="div"
            customStyle={{ margin: 0, backgroundColor: tokens.colorNeutralBackground1, padding: 0 }}
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code {...rest}>{children}</code>
      );
    },
  };

  return (
    <div className={mergeClasses(styles.root, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
