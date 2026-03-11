import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal';
import { gfmAutolinkLiteralFromMarkdown } from 'mdast-util-gfm-autolink-literal';
import type { Node } from 'unist';
import type { Parent, Text, Element, RootContent } from 'hast';
import { getDiscordUser, getDiscordChannel, getRole } from './discord';

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

const ENTITY_PREFIX_MAP: Record<string, 'user' | 'channel' | 'role'> = {
	'@': 'user',
	'@!': 'user',
	'#': 'channel',
	'@&': 'role'
};

type Mention =
	| { type: 'user' | 'role' | 'channel'; id: string }
	| { type: 'emoji'; animated: boolean; name: string; id: string }
	| { type: 'timestamp'; epochSeconds: number };

async function hydrateMention(element: Element, mention: Mention) {
	if (mention.type === 'user') {
		const user = await getDiscordUser(mention.id);
		const name = user?.global_name ?? user?.username ?? 'user';
		element.tagName = 'span';
		element.properties = { className: ['mention', 'mention-user'] };
		element.children = [{ type: 'text', value: `@${name}` }];
	} else if (mention.type === 'channel') {
		const channel = await getDiscordChannel(mention.id);
		const name = channel?.name ?? 'channel';
		element.tagName = 'span';
		element.properties = { className: ['mention', 'mention-channel'] };
		element.children = [{ type: 'text', value: `#${name}` }];
	} else if (mention.type === 'role') {
		const role = await getRole(mention.id);
		const name = role?.name || 'role';
		const color = role?.color ? `#${role.color.toString(16).padStart(6, '0')}` : null;
		const style = color && color !== '#000000' ? `color: ${color}; background: ${color}20;` : '';
		element.tagName = 'span';
		element.properties = { className: ['mention', 'mention-role'], style };
		element.children = [{ type: 'text', value: `@${name}` }];
	} else if (mention.type === 'emoji') {
		const extension = mention.animated ? 'gif' : 'png';
		element.tagName = 'img';
		element.properties = {
			src: `https://cdn.discordapp.com/emojis/${mention.id}.${extension}`,
			alt: `:${mention.name}:`,
			className: ['discord-emoji']
		};
	} else if (mention.type === 'timestamp') {
		const date = new Date(mention.epochSeconds * 1000);
		element.tagName = 'time';
		element.children = [{ type: 'text', value: date.toLocaleString() }];
	}
}

/** Rehype plugin: converts Discord syntax (mentions, emojis, timestamps) to HTML */
function rehypeDiscord() {
	return async (tree: Node) => {
		const promises: Promise<unknown>[] = [];
		visit(tree, 'text', (node: Text, index: number, parent: Parent) => {
			const origText = node.value;
			const entityMatches = [...origText.matchAll(/<(@!?|#|@&)(\d+)>/g)].map((match) => ({
				match,
				type: 'entity' as const
			}));
			const emojiMatches = [...origText.matchAll(/<(a?):(\w+):(\d+)>/g)].map((match) => ({
				match,
				type: 'emoji' as const
			}));
			const timestampMatches = [...origText.matchAll(/<t:(\d+)(?::[tTdDfFR])?>/g)].map((match) => ({
				match,
				type: 'timestamp' as const
			}));
			const allMatches = [...entityMatches, ...emojiMatches, ...timestampMatches];
			if (allMatches.length === 0) return;
			allMatches.sort((a, b) => a.match.index! - b.match.index!);

			let lastMatchEnd = 0;
			const components: RootContent[] = [];
			for (const { match, type } of allMatches) {
				if (match.index! > lastMatchEnd) {
					components.push({
						type: 'text',
						value: origText.slice(lastMatchEnd, match.index!)
					} satisfies Text);
				}

				let mention: Mention;
				if (type === 'entity') {
					mention = { type: ENTITY_PREFIX_MAP[match[1]], id: match[2]! };
				} else if (type === 'emoji') {
					mention = {
						type: 'emoji',
						animated: match[1] === 'a',
						name: match[2]!,
						id: match[3]!
					};
				} else {
					mention = { type: 'timestamp', epochSeconds: parseInt(match[1]!) };
				}

				const element = { type: 'element' } as Element;
				components.push(element);
				promises.push(hydrateMention(element, mention));

				lastMatchEnd = match.index! + match[0].length;
			}
			if (lastMatchEnd < origText.length) {
				components.push({
					type: 'text',
					value: origText.slice(lastMatchEnd)
				} satisfies Text);
			}
			parent.children.splice(index!, 1, ...components);
		});
		await Promise.all(promises);
	};
}

const COMMIT_PATTERN =
	/^https?:\/\/(?<domain>[^/]+)\/(?<user>[^/]+)\/(?<repo>[^/]+)\/commit\/(?<sha>[a-f0-9]+)$/i;
const DIFF_PATTERN =
	/^https?:\/\/(?<domain>[^/]+)\/(?<user>[^/]+)\/(?<repo>[^/]+)\/compare\/(?<from>.+)(?<dots>\.\.\.?)(?<to>.+)$/i;
const ISSUE_PULL_PATTERN =
	/^https?:\/\/(?<domain>[^/]+)\/(?<user>[^/]+)\/(?<repo>[^/]+)\/(?:pull|issues)\/(?<num>\d+)$/i;
const FILE_PATTERN =
	/^https?:\/\/(?<domain>[^/]+)\/(?<user>[^/]+)\/(?<repo>[^/]+)\/(?:tree|blob)\/(?<rev>[^/]+)\/(?<path>.*)$/;
const REPO_PATTERN = /^https?:\/\/(?<domain>[^/]+)\/(?<user>[^/]+)\/(?<repo>[^/]+)$/i;

function abbreviateRev(rev: string): string {
	if (rev.match(/[0-9a-f]{40}/i)) return rev.slice(0, 7);
	return rev;
}

const GIT_HOSTS = new Set([
	'github.com',
	'gitlab.com',
	'bitbucket.org',
	'codeberg.org',
	'sr.ht',
	'gitea.com',
	'git.inx.moe',
	'gist.github.com'
]);

/** Rehype plugin: shorten GitHub/Git URLs into pretty references */
function rehypeGitLinks() {
	return (tree: Node) => {
		visit(tree, 'element', (link: Element) => {
			if (link.tagName !== 'a') return;
			const href = link.properties.href;
			if (!href || typeof href !== 'string') return;
			if (link.children.length !== 1 || link.children[0].type !== 'text') return;

			try {
				const url = new URL(href);
				if (!GIT_HOSTS.has(url.hostname)) return;
			} catch {
				return;
			}
			const text = (link.children[0] as Text).value;
			if (text !== href) return;

			const repoName = (domain: string, user: string, repo: string) =>
				domain === 'github.com' ? `${user}/${repo}` : `${domain}:${user}/${repo}`;

			let match;
			let newContent: [string, string][];
			if ((match = href.match(COMMIT_PATTERN))) {
				const { domain, user, repo, sha } = match.groups!;
				newContent = [
					['github-repo', repoName(domain, user, repo)],
					['github-sha', abbreviateRev(sha)]
				];
			} else if ((match = href.match(DIFF_PATTERN))) {
				const { domain, user, repo, from, to, dots } = match.groups!;
				newContent = [
					['github-repo', repoName(domain, user, repo)],
					['github-sha', `${abbreviateRev(from)}${dots}${abbreviateRev(to)}`]
				];
			} else if ((match = href.match(ISSUE_PULL_PATTERN))) {
				const { domain, user, repo, num } = match.groups!;
				newContent = [
					['github-repo', repoName(domain, user, repo)],
					['github-num', `#${num}`]
				];
			} else if ((match = href.match(FILE_PATTERN))) {
				const { domain, user, repo, rev, path } = match.groups!;
				newContent = [
					['github-repo', repoName(domain, user, repo)],
					['github-file', `${path}`],
					['github-sha', abbreviateRev(rev)]
				];
			} else if ((match = href.match(REPO_PATTERN))) {
				const { domain, user, repo } = match.groups!;
				newContent = [['github-repo', repoName(domain, user, repo)]];
			} else {
				return;
			}

			link.properties.className = ['github-commit'];
			link.children = newContent.map(([clazz, text]) => ({
				type: 'element',
				tagName: 'span',
				properties: { className: [clazz] },
				children: [{ type: 'text', value: text }]
			}));
		});
	};
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

// Extend the default sanitize schema to allow Discord elements
const sanitizeSchema = {
	...defaultSchema,
	tagNames: [...(defaultSchema.tagNames ?? []), 'time', 'img', 'span'],
	attributes: {
		...defaultSchema.attributes,
		span: [...(defaultSchema.attributes?.span ?? []), 'className', 'style'],
		img: [...(defaultSchema.attributes?.img ?? []), 'src', 'alt', 'className'],
		time: [...(defaultSchema.attributes?.time ?? []), 'dateTime'],
		a: [...(defaultSchema.attributes?.a ?? []), 'className', 'target', 'rel']
	}
};

const processor = unified()
	.use(remarkParse)
	.use(remarkAutolink)
	.use(remarkRehype)
	.use(rehypeSanitize, sanitizeSchema)
	.use(rehypeDiscord)
	.use(rehypeGitLinks)
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
