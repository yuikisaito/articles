import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path/posix";

const BLOG_DIR = "blog";

const run = (cmd: string): string =>
  execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();

const getCommitDate = (file: string, first: boolean): string | null => {
  const cmd = first
    ? `git log --diff-filter=A --format=%cI -- "${file}" | tail -n 1`
    : `git log --format=%cI -n 1 -- "${file}"`;

  const out = run(cmd);
  return out === "" ? null : out;
};

const getArticleDates = (dir: string) => {
  const metadata = join(dir, "metadata.json");
  const markdown = join(dir, "index.md");

  const createdMeta = getCommitDate(metadata, true);
  const createdMarkdown = getCommitDate(markdown, true);
  const updatedMeta = getCommitDate(metadata, false);
  const updatedMarkdown = getCommitDate(markdown, false);

  const createdCandidates = [createdMeta, createdMarkdown].filter(Boolean);
  const updatedCandidates = [updatedMeta, updatedMarkdown].filter(Boolean);

  if (createdCandidates.length === 0 || updatedCandidates.length === 0) return null;

  const created = createdCandidates.sort()[0];
  const updated = updatedCandidates.sort().slice(-1)[0];

  return { created, updated };
};

const updateMetadata = (dir: string): boolean => {
  const metadataFile = join(dir, "metadata.json");
  if (!existsSync(metadataFile)) return false;

  const dates = getArticleDates(dir);
  if (!dates) return false;

  const json = JSON.parse(readFileSync(metadataFile, "utf8"));

  json.createdAt = dates.created;

  if (dates.created !== dates.updated) {
    json.updatedAt = dates.updated;
  } else {
    delete json.updatedAt;
  }

  const serialized = `${JSON.stringify(json, null, 2)}\n`;
  writeFileSync(metadataFile, serialized);

  run(`biome format --write "${metadataFile}"`);

  return true;
};

const main = () => {
  const dirs = readdirSync(BLOG_DIR)
    .map((d) => join(BLOG_DIR, d))
    .filter((d) => statSync(d).isDirectory());

  let changed = false;

  for (const dir of dirs) {
    const ok = updateMetadata(dir);
    const metadataJson = join(dir, "metadata.json");
    if (ok) {
      run(`git add -- "${metadataJson}"`);
      changed = true;
      console.log(`更新: ${metadataJson}`);
    }
  }

  if (changed) {
    run(`git commit -m "メタデータを更新"`);
  } else {
    console.log("変更なし");
  }
};

main();
