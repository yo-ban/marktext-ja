import githubMarkdownCss from 'github-markdown-css/github-markdown-light.css?inline';
import katexCss from 'katex/dist/katex.css?inline';
import prismCss from 'prismjs/themes/prism.css?inline';
import { embedKatexFonts } from './embedKatexFonts';

/**
 * The core stylesheets an exported document carries inline so it renders
 * offline. Kept out of `markdownToHtml` itself, and imported dynamically from
 * there, so the editor bundle does not carry the stylesheet text (and, through
 * `embedKatexFonts`, the base64 font payload) for a path only export takes.
 */
export function getInlineBaseStyles(): string[] {
    return [githubMarkdownCss, embedKatexFonts(katexCss), prismCss];
}
