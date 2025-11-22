import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path/posix";

const nowISO = (): string => new Date().toISOString();

const run = (cmd: string): string =>
  execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();

const isBlogIndex = (f: string): boolean =>
  /^blog\/([^/]+)\/(index\.md|metadata\.json)$/.test(f);

const getStagedBlogIndexes = (): string[] =>
  run("git diff --cached --name-only --diff-filter=ACM")
    .split("\n")
    .filter(Boolean)
    .filter(isBlogIndex);

const isFileNew = (path: string): boolean => {
  const status = run(`git diff --cached --name-status "${path}"`);
  if (status.startsWith("A")) return true;

  const untracked = run("git ls-files --others --exclude-standard")
    .split("\n")
    .includes(path);
  return untracked;
};

const updateJSON = (file: string, isNew: boolean) => {
  const now = nowISO();
  const json = JSON.parse(readFileSync(file, "utf8"));

  if (isNew) {
    json.createdAt = now;
    delete json.updatedAt;
  } else {
    json.updatedAt = now;
  }

  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
};

const main = () => {
  const staged = getStagedBlogIndexes();
  if (staged.length === 0) {
    console.log("対象なし");
    return;
  }

  const dirs = [
    ...new Set(staged.map((f) => f.replace(/(index\.md|metadata\.json)$/, ""))),
  ];

  for (const dir of dirs) {
    const metadataFile = join(dir, "metadata.json");
    if (!existsSync(metadataFile)) continue;

    const isNew = isFileNew(metadataFile);
    updateJSON(metadataFile, isNew);

    run(`git add -- "${metadataFile}"`);
    console.log(`Updated: ${metadataFile} (new=${isNew ? "yes" : "no"})`);
  }
};

main();
