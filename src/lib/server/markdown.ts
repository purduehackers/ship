import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Node } from 'unist';
import type { Text, Element } from 'hast';
import { getDiscordUser, getDiscordChannel, getRole } from './discord';
import remarkDiscord, {
	discordRemarkRehypeHandlers,
	type Resolver
} from '@purduehackers/discord-markdown-utils';

const resolver: Resolver = {
	async user({ id }) {
		const user = await getDiscordUser(id);
		const name = user?.global_name ?? user?.username;
		return name ? '@' + name : null;
	},

	async role({ id }) {
		const role = await getRole(id);
		if (!role) return null;
		return {
			name: '@' + role.name,
			color: role?.color ? `#${role.color.toString(16).padStart(6, '0')}` : undefined
		};
	},

	async channel({ id }) {
		const channel = await getDiscordChannel(id);
		return channel?.name ? '#' + channel.name : null;
	},

	async emoji({ id, animated }) {
		const animatedSuffix = animated ? '&animated=true' : '';
		return `https://cdn.discordapp.com/emojis/${id}.webp?size=64${animatedSuffix}`;
	},

	async timestamp({ date }) {
		return date.toLocaleString();
	}
};

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
	.use(remarkDiscord, { resolver })
	.use(remarkRehype, { handlers: discordRemarkRehypeHandlers })
	.use(rehypeSanitize, sanitizeSchema)
	.use(rehypeGitLinks)
	.use(rehypeLinkAttributes)
	.use(rehypeStringify);

export async function renderContent(content: string): Promise<string> {
	const result = await processor.process(content);
	return result.toString();
}
