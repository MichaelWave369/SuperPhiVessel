import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const source=fileURLToPath(new URL("../site/index.html",import.meta.url));
const html=readFileSync(source,"utf8");

test("landing navigation and call-to-action contain no escaped newline debris",()=>{
 assert.ok(html.includes('<nav aria-label="Primary">'));
 assert.ok(html.includes('<div class="actions">'));
 assert.doesNotMatch(html,/\\n/,"Backslash-n escape was rendered as visible text on the public homepage");
 assert.match(html,/<a href="\.\/manual\/">Manual<\/a>\s*<a href="#architecture">Architecture<\/a>/);
 assert.match(html,/<a class="button" href="https:\/\/superphivessel\.netlify\.app\/">Launch classic Vessie<\/a>\s*<a class="button" href="\.\/manual\/">Search user manual<\/a>/);
});
