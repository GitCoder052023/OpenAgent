// Copyright 2026 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const InlinedProperties = ["fill", "fill-opacity", "stroke", "stroke-opacity", "stroke-width", "stroke-dasharray", "opacity", "font-size", "font-family", "font-weight", "text-anchor", "dominant-baseline"];

/**
 * Copies the resolved paint of every node onto the clone. The chart colours are
 * CSS variables, which a standalone SVG drawn into a canvas cannot resolve.
 */
function inlineStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const style = InlinedProperties.map((name) => `${name}:${computed.getPropertyValue(name)}`).join(";");
  target.setAttribute("style", style);
  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  sourceChildren.forEach((child, index) => {
    if (targetChildren[index]) {
      inlineStyles(child, targetChildren[index]);
    }
  });
}

/**
 * Renders the first chart SVG inside `container` to a PNG data URL on a white
 * page background, for documents that embed the chart as a figure.
 */
export async function chartToPngDataUrl(container: HTMLElement | null, pixelRatio = 2): Promise<string | null> {
  const svg = container?.querySelector("svg.recharts-surface") ?? container?.querySelector("svg");
  if (!svg) {
    return null;
  }
  const {width, height} = svg.getBoundingClientRect();
  if (width === 0 || height === 0) {
    return null;
  }

  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  // a document is printed on white, whatever theme the page was in
  clone.querySelectorAll("text").forEach((text) => {
    const fill = text.getAttribute("style") ?? "";
    text.setAttribute("style", fill.replace(/fill:[^;]*/, "fill:#1f1f1f"));
  });

  const markup = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const image = new Image();
  image.width = width;
  image.height = height;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("chart image"));
    image.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(pixelRatio, pixelRatio);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}
