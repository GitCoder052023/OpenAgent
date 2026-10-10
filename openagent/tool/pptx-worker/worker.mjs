import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as solidIcons from '@fortawesome/free-solid-svg-icons';
import PptxGenJS from 'pptxgenjs';

function text(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') {
    return 'image/jpeg';
  }
  if (ext === '.gif') {
    return 'image/gif';
  }
  if (ext === '.svg') {
    return 'image/svg+xml';
  }
  if (ext === '.webp') {
    return 'image/webp';
  }
  return 'image/png';
}

function resolveAssetPath(assetsDir, value) {
  const raw = text(value).trim();
  if (!raw) {
    throw new Error('asset path is required');
  }
  return path.isAbsolute(raw) ? raw : path.resolve(assetsDir, raw);
}

function imageData(filePath, assetsDir) {
  const resolved = resolveAssetPath(assetsDir, filePath);
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    throw new Error(`asset is not a file: ${resolved}`);
  }
  const data = fs.readFileSync(resolved).toString('base64');
  return `data:${mimeType(resolved)};base64,${data}`;
}

function iconExportName(iconName) {
  const raw = text(iconName).trim();
  if (!raw) {
    throw new Error('icon name is required');
  }
  if (solidIcons[raw]) {
    return raw;
  }

  const stripped = raw
    .replace(/^fa[-_]?/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
  return `fa${stripped.split('-').filter(Boolean).map((part) => (
    `${part[0].toUpperCase()}${part.slice(1)}`
  )).join('')}`;
}

function escapeXml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function iconSvgData(iconName, color = '000000') {
  const exportName = iconExportName(iconName);
  const icon = solidIcons[exportName];
  if (!icon || !icon.icon) {
    throw new Error(`Font Awesome icon not found: ${iconName}`);
  }

  const [width, height, , , svgPathData] = icon.icon;
  const fill = text(color).trim().replace(/^#/, '') || '000000';
  const paths = Array.isArray(svgPathData) ? svgPathData : [svgPathData];
  const pathXml = paths.map((data) => (
    `<path fill="#${escapeXml(fill)}" d="${escapeXml(data)}"/>`
  )).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${pathXml}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function createContext(spec) {
  const assetsDir = path.resolve(spec.assets_dir || path.dirname(spec.script_path));
  return {
    data: spec.data,
    assetsDir,
    outPath: spec.path,
    resolveAsset(value) {
      return resolveAssetPath(assetsDir, value);
    },
    imageData(value) {
      return imageData(value, assetsDir);
    },
    iconSvgData,
  };
}

async function loadBuildFunction(scriptPath) {
  const moduleUrl = pathToFileURL(scriptPath).href;
  const mod = await import(moduleUrl);
  const build = mod.default || mod.build;
  if (typeof build !== 'function') {
    throw new Error('script must export default function build(pptx, ctx) or named function build(pptx, ctx)');
  }
  return build;
}

function createPresentation() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'OpenAgent';
  pptx.company = 'OpenAgent';
  pptx.subject = 'Generated with OpenAgent';
  return pptx;
}

async function generateDeck(spec) {
  if (!spec.path) {
    throw new Error('path is required');
  }
  if (!spec.script_path) {
    throw new Error('script_path is required');
  }

  spec.path = path.resolve(spec.path);
  spec.script_path = path.resolve(spec.script_path);

  fs.mkdirSync(path.dirname(spec.path), { recursive: true });

  const pptx = createPresentation();
  let slideCount = 0;
  const originalAddSlide = pptx.addSlide.bind(pptx);
  pptx.addSlide = (...args) => {
    slideCount += 1;
    return originalAddSlide(...args);
  };

  const ctx = createContext(spec);
  const build = await loadBuildFunction(spec.script_path);
  await build(pptx, ctx);

  await pptx.writeFile({ fileName: spec.path });
  return {
    ok: true,
    path: spec.path,
    slideCount,
    mode: 'pptxgenjs',
  };
}

async function main() {
  const specPath = process.argv[2];
  if (!specPath) {
    throw new Error('usage: node worker.mjs <spec.json>');
  }

  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  return generateDeck(spec);
}

main()
  .then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  })
  .catch((error) => {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      path: '',
      slideCount: 0,
      mode: 'pptxgenjs',
      error: error && error.stack ? error.stack : text(error),
    })}\n`);
    process.exitCode = 1;
  });
