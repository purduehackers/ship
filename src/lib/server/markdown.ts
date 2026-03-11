import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal';
import { gfmAutolinkLiteralFromMarkdown } from 'mdast-util-gfm-autolink-literal';
import type { Node } from 'unist';
import type { Element } from 'hast';

/** Remark plugin: auto-link bare URLs using GFM autolink literal extension */
function remarkAutolink(this: any) {
	const data = this.data();
	add('micromarkExtensions', gfmAutolinkLiteral());
	add('fromMarkdownExtensions', gfmAutolinkLiteralFromMarkdown());

	function add(field: string, value: any) {
		const list = data[field] ? data[field] : (data[field] = []);
		list.push(value);
	}
}

/** Rehype plugin: add target=_blank and rel=noopener to all links */
function rehypeLinkAttributes() {
	return (tree: Node) => {
		visit(tree, 'element', (el: Element) => {
			if (el.tagName !== 'a') return;
			el.properties.target = '_blank';
			el.properties.rel = ['nofollow', 'noopener', 'noreferrer'];
		});
	};
}

const processor = unified()
	.use(remarkParse)
	.use(remarkAutolink)
	.use(remarkRehype)
	.use(rehypeSanitize)
	.use(rehypeLinkAttributes)
	.use(rehypeStringify);

/** Strip Discord's embed-silencing angle brackets: <URL> → URL */
function stripAngleBracketLinks(text: string): string {
	return text.replace(/<(https?:\/\/[^\s>]+)>/g, '$1');
}

export async function renderContent(content: string): Promise<string> {
	const cleaned = stripAngleBracketLinks(content);
	const result = await processor.process(cleaned);
	return result.toString();
}
