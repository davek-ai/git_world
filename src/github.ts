import { Octokit } from "octokit";
import type { RepoContext, CommitInfo } from "./types.js";

export class GitHubAnalyzer {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({ auth: token });
  }

  /**
   * Parse owner/repo from a GitHub URL.
   */
  private parseUrl(repoUrl: string): { owner: string; repo: string } {
    const match = repoUrl.match(
      /github\.com\/([^/]+)\/([^/.]+)/
    );
    if (!match) throw new Error(`Invalid GitHub URL: ${repoUrl}`);
    return { owner: match[1], repo: match[2] };
  }

  /**
   * Gather full repo context for Story Bible generation.
   */
  async analyzeRepo(repoUrl: string): Promise<RepoContext> {
    const { owner, repo: repoName } = this.parseUrl(repoUrl);

    const [repoData, languages, treeData, readme, pkg] = await Promise.all([
      this.octokit.rest.repos.get({ owner, repo: repoName }),
      this.octokit.rest.repos.listLanguages({ owner, repo: repoName }),
      this.getFullTree(owner, repoName),
      this.getReadmeExcerpt(owner, repoName),
      this.getPackageJson(owner, repoName),
    ]);

    const { summary: treeSummary, paths: filePaths, fileTree } = treeData;

    // Sample actual source code for personality/DNA
    const codeSamples = await this.sampleCode(owner, repoName, filePaths);

    const r = repoData.data;
    return {
      name: r.full_name,
      description: r.description,
      language: r.language,
      languages: languages.data as Record<string, number>,
      topics: r.topics ?? [],
      stars: r.stargazers_count,
      forks: r.forks_count,
      size: r.size,
      default_branch: r.default_branch,
      tree_summary: treeSummary,
      file_tree: fileTree,
      readme_excerpt: readme,
      package_json: pkg,
      code_samples: codeSamples,
    };
  }

  /**
   * Get recent commits with stats.
   */
  async getCommits(
    repoUrl: string,
    count = 50
  ): Promise<CommitInfo[]> {
    const { owner, repo } = this.parseUrl(repoUrl);
    const { data } = await this.octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: count,
    });

    return Promise.all(
      data.map(async (c) => {
        let files_changed = 0,
          additions = 0,
          deletions = 0;
        try {
          const detail = await this.octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: c.sha,
          });
          files_changed = detail.data.files?.length ?? 0;
          additions = detail.data.stats?.additions ?? 0;
          deletions = detail.data.stats?.deletions ?? 0;
        } catch {
          // rate limit or missing — skip stats
        }
        return {
          sha: c.sha,
          message: c.commit.message,
          author: c.commit.author?.name ?? "unknown",
          date: c.commit.author?.date ?? "",
          files_changed,
          additions,
          deletions,
        };
      })
    );
  }

  /**
   * Get the latest commit SHA.
   */
  async getLatestSha(repoUrl: string): Promise<string> {
    const { owner, repo } = this.parseUrl(repoUrl);
    const { data } = await this.octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 1,
    });
    return data[0]?.sha ?? "";
  }

  /**
   * Get diff between two commits.
   */
  async getDiff(
    repoUrl: string,
    baseSha: string,
    headSha: string
  ): Promise<string> {
    const { owner, repo } = this.parseUrl(repoUrl);
    const { data } = await this.octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: baseSha,
      head: headSha,
    });
    const summary = data.files?.map((f) =>
      `${f.status} ${f.filename} (+${f.additions}/-${f.deletions})`
    ).join("\n") ?? "";
    return `${data.total_commits} commits, ${data.files?.length ?? 0} files changed\n${summary}`;
  }

  private async getFullTree(
    owner: string,
    repo: string
  ): Promise<{ summary: string; paths: string[]; fileTree: string }> {
    try {
      const { data } = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: "HEAD",
        recursive: "true",
      });
      const paths = data.tree
        .filter((t) => t.type === "blob")
        .map((t) => t.path)
        .filter((p): p is string => !!p);

      // Summary: top-level dirs and file counts
      const dirs = new Map<string, number>();
      for (const p of paths) {
        const top = p.includes("/") ? p.split("/")[0] : "(root)";
        dirs.set(top, (dirs.get(top) ?? 0) + 1);
      }
      const summary = Array.from(dirs.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([d, n]) => `${d}/ (${n} files)`)
        .join("\n");

      // Full file tree (truncated to avoid token bloat)
      const fileTree = paths.slice(0, 150).join("\n");

      return { summary, paths, fileTree };
    } catch {
      return { summary: "(tree unavailable)", paths: [], fileTree: "" };
    }
  }

  /**
   * Sample actual source code from key files to extract the repo's "DNA" —
   * function names, class names, variable names, comments, domain language.
   */
  private async sampleCode(
    owner: string,
    repo: string,
    allPaths: string[]
  ): Promise<string> {
    // Pick interesting source files (not config, not vendor, not lock files)
    const sourceExts = /\.(ts|js|tsx|jsx|py|go|rs|rb|java|swift|kt|c|cpp|h|cs|ex|clj|scala|sol|move)$/;
    const skipPatterns = /node_modules|vendor|dist|build|\.min\.|\.lock|\.config\.|__pycache__|\.test\.|\.spec\./;

    const candidates = allPaths
      .filter((p) => sourceExts.test(p) && !skipPatterns.test(p))
      .sort((a, b) => {
        // Prioritize: main/index/app files, then shorter paths (closer to root)
        const aScore = /^(src\/)?(main|index|app|lib|core)/i.test(a) ? -10 : 0;
        const bScore = /^(src\/)?(main|index|app|lib|core)/i.test(b) ? -10 : 0;
        return (aScore + a.split("/").length) - (bScore + b.split("/").length);
      });

    // Sample up to 5 files, ~200 lines each
    const filesToSample = candidates.slice(0, 5);
    const samples: string[] = [];

    for (const filePath of filesToSample) {
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
        });
        if ("content" in data) {
          const content = Buffer.from(data.content, "base64").toString("utf-8");
          const lines = content.split("\n").slice(0, 200);
          samples.push(`── ${filePath} ──\n${lines.join("\n")}`);
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return samples.join("\n\n") || "(no source code sampled)";
  }

  private async getReadmeExcerpt(
    owner: string,
    repo: string
  ): Promise<string> {
    try {
      const { data } = await this.octokit.rest.repos.getReadme({
        owner,
        repo,
      });
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return content.slice(0, 2000);
    } catch {
      return "(no README)";
    }
  }

  private async getPackageJson(
    owner: string,
    repo: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: "package.json",
      });
      if ("content" in data) {
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        return JSON.parse(content);
      }
    } catch {
      // Not a JS project or no package.json
    }
    return null;
  }
}
