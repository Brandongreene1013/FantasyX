import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopDirectory = path.resolve(scriptDirectory, "..");
const iconSource = path.resolve(desktopDirectory, "../public/icons/icon.svg");
const buildDirectory = path.join(desktopDirectory, "build");
const pngPath = path.join(buildDirectory, "icon.png");
const icoPath = path.join(buildDirectory, "icon.ico");

await mkdir(buildDirectory, { recursive: true });
await sharp(iconSource).resize(512, 512).png().toFile(pngPath);
const pngBuffer = await readFile(pngPath);
await sharp(pngBuffer).resize(256, 256).png().toFile(pngPath);
await writeFile(icoPath, await pngToIco(pngPath));
