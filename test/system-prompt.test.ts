import assert from "node:assert/strict";
import test from "node:test";
import { buildOstrichSystemPrompt } from "../src/system-prompt.js";

test("includes the configured source repository link", () => {
  const url = "https://github.com/example/ostrich";
  const prompt = buildOstrichSystemPrompt("npub1example", url);

  assert.match(prompt, new RegExp(url.replaceAll("/", "\\/")));
  assert.match(prompt, /asks for your source code/i);
});

test("does not invent a repository when none is configured", () => {
  const prompt = buildOstrichSystemPrompt("npub1example");

  assert.match(prompt, /never invent one/i);
});
