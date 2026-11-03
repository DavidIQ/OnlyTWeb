import { ReportImage } from '../services/api.service';

export interface BuiltReport {
  html: string;
  images: ReportImage[];
}

const TEXT_PROPS = [
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'text-transform',
  'text-align',
  'white-space',
  'opacity',
];
const BOX_PROPS = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'];
const SIDES = ['top', 'right', 'bottom', 'left'];

function inlineStyle(source: HTMLElement): string {
  const computed = getComputedStyle(source);
  const rules: string[] = [];
  for (const prop of TEXT_PROPS) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== 'normal' && !(prop === 'opacity' && value === '1')) {
      rules.push(`${prop}:${value}`);
    }
  }
  for (const prop of BOX_PROPS) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== '0px') {
      rules.push(`${prop}:${value}`);
    }
  }
  for (const side of SIDES) {
    if (parseFloat(computed.getPropertyValue(`border-${side}-width`)) > 0 && computed.getPropertyValue(`border-${side}-style`) !== 'none') {
      rules.push(
        `border-${side}:${computed.getPropertyValue(`border-${side}-width`)} ${computed.getPropertyValue(`border-${side}-style`)} ${computed.getPropertyValue(`border-${side}-color`)}`,
      );
    }
  }
  const background = computed.backgroundColor;
  if (background && background !== 'rgba(0, 0, 0, 0)') {
    rules.push(`background-color:${background}`);
  }
  if (computed.listStyleType === 'none') {
    rules.push('list-style:none');
  }
  if (computed.display === 'none') {
    rules.push('display:none');
  }
  return rules.join(';');
}

// Email clients drop inline SVG, so each badge becomes a PNG sent as an inline (cid:) image.
async function renderBadge(badge: HTMLElement): Promise<string | null> {
  const svg = badge.querySelector('svg');
  if (!svg) {
    return null;
  }
  const badgeStyle = getComputedStyle(badge);
  const size = parseFloat(badgeStyle.width) || 24;
  const iconSize = parseFloat(getComputedStyle(svg).width) || 16;
  const scale = 3;

  const sourceNodes = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const copy = svg.cloneNode(true) as SVGElement;
  const copyNodes = [copy, ...Array.from(copy.querySelectorAll('*'))];
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(iconSize));
  copy.setAttribute('height', String(iconSize));
  sourceNodes.forEach((node, index) => {
    const style = getComputedStyle(node);
    copyNodes[index].setAttribute('fill', style.fill);
    if (style.stroke && style.stroke !== 'none') {
      copyNodes[index].setAttribute('stroke', style.stroke);
    }
  });

  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('badge'));
  });
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
  await loaded;

  const canvas = document.createElement('canvas');
  canvas.width = size * scale;
  canvas.height = size * scale;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  const radius = (parseFloat(badgeStyle.borderTopLeftRadius) || 0) * scale;
  context.fillStyle = badgeStyle.backgroundColor;
  context.beginPath();
  context.roundRect(0, 0, size * scale, size * scale, radius);
  context.fill();
  const offset = ((size - iconSize) / 2) * scale;
  context.drawImage(image, offset, offset, iconSize * scale, iconSize * scale);
  return canvas.toDataURL('image/png').split(',')[1];
}

function flexToTable(destination: HTMLElement, source: HTMLElement, sources: Map<HTMLElement, HTMLElement>): void {
  const computed = getComputedStyle(source);
  const gap = parseFloat(computed.columnGap) || 0;
  const align = computed.alignItems === 'center' ? 'middle' : 'baseline';

  const table = document.createElement('table');
  table.setAttribute('role', 'presentation');
  table.setAttribute('width', '100%');
  table.setAttribute('cellpadding', '0');
  table.setAttribute('cellspacing', '0');
  table.setAttribute('border', '0');
  table.style.cssText = `${destination.style.cssText};width:100%;border-collapse:collapse`;
  const row = table.appendChild(document.createElement('tbody')).appendChild(document.createElement('tr'));

  const children = Array.from(destination.children) as HTMLElement[];
  const growsAt = children.map((child) => {
    const childSource = sources.get(child);
    return childSource ? parseFloat(getComputedStyle(childSource).flexGrow) > 0 : false;
  });
  // Without a growing child, the last cell takes the spare width so the others stay packed to the left.
  const fillIndex = growsAt.includes(true) ? -1 : children.length - 1;
  children.forEach((child, index) => {
    const cell = row.appendChild(document.createElement('td'));
    cell.style.verticalAlign = align;
    if (index < children.length - 1 && gap) {
      cell.style.paddingRight = `${gap}px`;
    }
    if (growsAt[index] && child.childNodes.length === 0) {
      // The dotted leader: a growing empty box becomes a full-width cell with the same bottom border.
      cell.style.cssText = `${child.style.cssText};width:100%;vertical-align:${align}`;
    } else {
      cell.appendChild(child);
      if (index === fillIndex) {
        cell.style.width = '100%';
      } else {
        cell.style.width = '1%';
        cell.style.whiteSpace = 'nowrap';
      }
    }
  });
  destination.replaceWith(table);
}

export async function buildReportEmail(source: HTMLElement): Promise<BuiltReport> {
  const root = source.cloneNode(true) as HTMLElement;
  const sourceNodes = [source, ...Array.from(source.querySelectorAll<HTMLElement>('*'))];
  const copyNodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  const sources = new Map<HTMLElement, HTMLElement>();
  const images: ReportImage[] = [];

  const pairs: [HTMLElement, HTMLElement][] = [];
  sourceNodes.forEach((node, index) => {
    if (!node.closest('svg')) {
      pairs.push([node, copyNodes[index]]);
      sources.set(copyNodes[index], node);
    }
  });

  for (const [from, to] of pairs) {
    to.style.cssText = inlineStyle(from);
    if (from.matches('.progress-list')) {
      // The centred list leaves a wide left margin on screen; in the email it should sit flush left.
      to.style.margin = '0';
      to.style.maxWidth = 'none';
    }
    if (from.matches('.progress-remaining')) {
      // Non-breaking spaces keep the sign and the amount on one line.
      to.textContent = (to.textContent ?? '').replace(/\s/g, '\u00a0');
    }
    if (from.matches('.progress-row.running .progress-title')) {
      const marker = document.createElement('span');
      marker.textContent = ' ●';
      marker.style.color = '#008000';
      (to.lastElementChild ?? to).appendChild(marker);
    }
  }

  for (const [from, to] of pairs) {
    if (!from.classList.contains('section-badge')) {
      continue;
    }
    const data = await renderBadge(from);
    if (data) {
      const cid = `badge${images.length}`;
      images.push({ cid, data });
      const size = parseFloat(getComputedStyle(from).width) || 24;
      const image = document.createElement('img');
      image.setAttribute('data-cid', cid);
      image.setAttribute('alt', '');
      image.setAttribute('width', String(size));
      image.setAttribute('height', String(size));
      image.style.display = 'block';
      sources.set(image, from);
      to.replaceWith(image);
    }
  }

  const flexPairs = pairs.filter(([from]) => /flex/.test(getComputedStyle(from).display)).reverse();
  for (const [from, to] of flexPairs) {
    flexToTable(to, from, sources);
  }

  const everything = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  for (const element of everything) {
    for (const name of element.getAttributeNames()) {
      if (name === 'class' || name.startsWith('_ng') || name.startsWith('ng-') || name === 'aria-hidden') {
        element.removeAttribute(name);
      }
    }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) {
    comments.push(walker.currentNode);
  }
  comments.forEach((comment) => comment.parentNode?.removeChild(comment));

  root.style.maxWidth = '820px';
  root.style.margin = '0 auto';
  root.style.padding = '24px';
  root.style.minHeight = '0';
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    `<body style="margin:0;background:#fff">${root.outerHTML}</body></html>`.replace(/ data-cid="(\w+)"/g, ' src="cid:$1"');
  return { html, images };
}
