/**
 * Markdown Renderer
 *
 * Modular markdown rendering utility that can be easily swapped.
 * Change the implementation here to use a different markdown library.
 */

import React from "react";
import ReactMarkdown from "react-markdown";

import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

const useStyles = makeStyles({
  root: {
    // Prevent layout shifts during streaming
    "& > *:last-child": {
      marginBottom: 0,
    },
    "& h1, & h2, & h3, & h4, & h5, & h6": {
      marginTop: tokens.spacingVerticalM,
      marginBottom: tokens.spacingVerticalS,
      // Prevent flash of unstyled content during streaming
      minHeight: "1.2em",
    },
    "& p": {
      marginBottom: tokens.spacingVerticalS,
      // Ensure consistent line height during streaming
      lineHeight: tokens.lineHeightBase300,
    },
    "& code": {
      backgroundColor: tokens.colorNeutralBackground2,
      padding: "2px 4px",
      borderRadius: "3px",
      fontFamily: tokens.fontFamilyMonospace,
      fontSize: tokens.fontSizeBase200,
    },
    "& pre": {
      backgroundColor: tokens.colorNeutralBackground2,
      padding: tokens.spacingVerticalM,
      borderRadius: tokens.borderRadiusMedium,
      overflowX: "auto",
      marginBottom: tokens.spacingVerticalS,
    },
    "& pre code": {
      backgroundColor: "transparent",
      padding: 0,
    },
    "& ul, & ol": {
      marginLeft: tokens.spacingHorizontalL,
      marginBottom: tokens.spacingVerticalS,
    },
    "& blockquote": {
      borderLeft: `3px solid ${tokens.colorNeutralStroke1}`,
      paddingLeft: tokens.spacingHorizontalM,
      marginLeft: 0,
      color: tokens.colorNeutralForeground2,
    },
    "& hr": {
      border: "none",
      borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
      marginTop: tokens.spacingVerticalM,
      marginBottom: tokens.spacingVerticalM,
    },
    "& table": {
      borderCollapse: "collapse",
      width: "100%",
      marginTop: tokens.spacingVerticalM,
      marginBottom: tokens.spacingVerticalM,
      fontSize: tokens.fontSizeBase300,
    },
    "& thead": {
      borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
    },
    "& th": {
      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
      textAlign: "left",
      fontWeight: tokens.fontWeightSemibold,
      backgroundColor: tokens.colorNeutralBackground2,
      borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    "& td": {
      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
      borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    "& tbody tr:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
});

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** When true, optimizes for streaming (reduces re-renders) */
  isStreaming?: boolean;
}

/**
 * Renders markdown content to HTML.
 *
 * Current implementation: react-markdown with GFM and syntax highlighting
 * To swap: Replace the internals of this component with your preferred library
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ content, className, isStreaming }) => {
  const styles = useStyles();

  // During streaming, only parse markdown when content changes significantly
  // This reduces flickering from constant re-parsing
  const plugins = React.useMemo(() => ({
    remarkPlugins: [remarkGfm],
    // Disable syntax highlighting during streaming to reduce flicker
    rehypePlugins: isStreaming ? [] : [rehypeHighlight],
  }), [isStreaming]);

  return (
    <div className={mergeClasses(styles.root, className)}>
      <ReactMarkdown {...plugins}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
