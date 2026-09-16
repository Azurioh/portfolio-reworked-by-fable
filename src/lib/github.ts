import * as z from 'zod/mini';

const API = 'https://api.github.com';
const USER = 'azurioh';
const FETCH_TIMEOUT_MS = 6000;
const SHORT_SHA_LENGTH = 7;

const reposSchema = z.array(z.looseObject({ full_name: z.string(), name: z.string(), fork: z.boolean() }));

const commitsSchema = z
  .array(
    z.looseObject({
      sha: z.string(),
      commit: z.looseObject({
        message: z.string(),
        author: z.looseObject({ date: z.string() }),
      }),
    }),
  )
  .check(z.minLength(1));

export type LatestCommit = {
  repo: string;
  shortSha: string;
  subject: string;
  date: Date;
};

export type LatestCommitResult =
  | { status: 'ok'; commit: LatestCommit }
  | { status: 'none' }
  | { status: 'unavailable' };

const fetchJson = async (params: { url: string; signal: AbortSignal }): Promise<unknown> => {
  const res = await fetch(params.url, {
    signal: params.signal,
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    throw new GithubUnavailableError(res.status);
  }
  return res.json();
};

class GithubUnavailableError extends Error {
  readonly httpStatus: number;

  constructor(httpStatus: number) {
    super(`GitHub API responded with ${httpStatus}`);
    this.name = 'GithubUnavailableError';
    this.httpStatus = httpStatus;
  }
}

/**
 * Finds the most recent commit on the most recently pushed public repository of the account.
 * @returns `ok` with the commit, `none` when the account has no public repository,
 * `unavailable` when the API is unreachable, rate-limited or returns an unexpected shape.
 */
export async function findLatestCommit(): Promise<LatestCommitResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const repos = z.parse(
      reposSchema,
      await fetchJson({ url: `${API}/users/${USER}/repos?sort=pushed&per_page=5&type=owner`, signal: controller.signal }),
    );
    const repo = repos.find((r) => !r.fork) ?? repos[0];
    if (!repo) {
      return { status: 'none' };
    }
    const commits = z.parse(
      commitsSchema,
      await fetchJson({ url: `${API}/repos/${repo.full_name}/commits?per_page=1`, signal: controller.signal }),
    );
    const last = commits[0];
    return {
      status: 'ok',
      commit: {
        repo: repo.name,
        shortSha: last.sha.slice(0, SHORT_SHA_LENGTH),
        subject: last.commit.message.split('\n')[0],
        date: new Date(last.commit.author.date),
      },
    };
  } catch {
    return { status: 'unavailable' };
  } finally {
    window.clearTimeout(timer);
  }
}
