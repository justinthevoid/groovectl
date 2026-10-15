import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { sveltePlugin } from "./svelte-build.mjs";

const folder = process.argv[2];
if (!folder) throw new Error("Pass an isolated output directory for the account-free component gallery.");
await mkdir(folder, { recursive: true });
const result = await build({ entryPoints: ["ui/gallery.ts"], outfile: "gallery.js", bundle: true, write: false, format: "esm", target: "es2022", minify: true, loader: { ".png": "dataurl" }, conditions: ["svelte", "browser"], plugins: [sveltePlugin] });
const script = result.outputFiles.find(f => f.path.endsWith(".js")).text.replaceAll("</script", "<\\/script");
const css = result.outputFiles.find(f => f.path.endsWith(".css"))?.text ?? "";
const theme = await readFile("ui/theme.css", "utf8");
const base = await readFile("ui/gallery.html", "utf8");
await writeFile(`${folder}/gallery.html`, base.replace("__THEME_CSS__", () => theme).replace("__CSS__", () => css).replace("__SCRIPT__", () => script));
console.log("Built account-free Groovectl component gallery.");
