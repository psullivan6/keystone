// very loosely based on https://github.com/ianstormtaylor/slate/blob/d22c76ae1313fe82111317417912a2670e73f5c9/site/examples/paste-html.tsx
import { Node } from 'slate';
import { Block, isBlock } from '..';
import { Mark } from '../utils';
import {
  addMarksToChildren,
  getInlineNodes,
  forceDisableMarkForChildren,
  setLinkForChildren,
  InlineFromExternalPaste,
} from './utils';

function getAlignmentFromElement(element: globalThis.Element): 'center' | 'end' | undefined {
  const parent = element.parentElement;
  // confluence
  const attribute = parent?.getAttribute('data-align');
  // note: we don't show html that confluence would parse as alignment
  // we could change that but meh
  // (they match on div.fabric-editor-block-mark with data-align)
  if (attribute === 'center' || attribute === 'end') {
    return attribute;
  }
  if (element instanceof HTMLElement) {
    // Google docs
    const textAlign = element.style.textAlign;
    if (textAlign === 'center') {
      return 'center';
    }
    // TODO: RTL things?
    if (textAlign === 'right' || textAlign === 'end') {
      return 'end';
    }
  }
}

// See https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html#distributive-conditional-types
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

const BLOCK_TAGS: Record<
  string,
  (element: globalThis.Element) => DistributiveOmit<Block, 'children'> & { children?: undefined }
> = {
  BLOCKQUOTE: () => ({ type: 'blockquote' }),
  H1: el => ({ type: 'heading', level: 1, textAlign: getAlignmentFromElement(el) }),
  H2: el => ({ type: 'heading', level: 2, textAlign: getAlignmentFromElement(el) }),
  H3: el => ({ type: 'heading', level: 3, textAlign: getAlignmentFromElement(el) }),
  H4: el => ({ type: 'heading', level: 4, textAlign: getAlignmentFromElement(el) }),
  H5: el => ({ type: 'heading', level: 5, textAlign: getAlignmentFromElement(el) }),
  H6: el => ({ type: 'heading', level: 6, textAlign: getAlignmentFromElement(el) }),
  LI: () => ({ type: 'list-item' }),
  OL: () => ({ type: 'ordered-list' }),
  P: el => ({ type: 'paragraph', textAlign: getAlignmentFromElement(el) }),
  PRE: () => ({ type: 'code' }),
  UL: () => ({ type: 'unordered-list' }),
};

const TEXT_TAGS: Record<string, Mark> = {
  CODE: 'code',
  DEL: 'strikethrough',
  S: 'strikethrough',
  STRIKE: 'strikethrough',
  EM: 'italic',
  I: 'italic',
  STRONG: 'bold',
  U: 'underline',
  SUP: 'superscript',
  SUB: 'subscript',
  KBD: 'keyboard',
};

function marksFromElementAttributes(element: globalThis.Node) {
  const marks = new Set<Mark>();
  if (element instanceof HTMLElement) {
    const style = element.style;
    const { nodeName } = element;
    const markFromNodeName = TEXT_TAGS[nodeName];
    if (markFromNodeName) {
      marks.add(markFromNodeName);
    }
    const { fontWeight, textDecoration, verticalAlign } = style;

    if (textDecoration === 'underline') {
      marks.add('underline');
    } else if (textDecoration === 'line-through') {
      marks.add('strikethrough');
    }
    // confluence
    if (nodeName === 'SPAN' && element.classList.contains('code')) {
      marks.add('code');
    }
    // Google Docs does weird things with <b>
    if (nodeName === 'B' && fontWeight !== 'normal') {
      marks.add('bold');
    } else if (
      typeof fontWeight === 'string' &&
      (fontWeight === 'bold' ||
        fontWeight === 'bolder' ||
        fontWeight === '1000' ||
        /^[5-9]\d{2}$/.test(fontWeight))
    ) {
      marks.add('bold');
    }
    if (style.fontStyle === 'italic') {
      marks.add('italic');
    }
    // Google Docs uses vertical align for subscript and superscript instead of <sup> and <sub>
    if (verticalAlign === 'super') {
      marks.add('superscript');
    } else if (verticalAlign === 'sub') {
      marks.add('subscript');
    }
  }
  return marks;
}

export function deserializeHTML(html: string) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  return deserializeHTMLNode(parsed.body);
}

export function deserializeHTMLNode(el: globalThis.Node): (InlineFromExternalPaste | Block)[] {
  if (el instanceof globalThis.Text) {
    const text = el.textContent;
    if (!text) {
      return [];
    }
    return getInlineNodes(text);
  }
  if (!(el instanceof globalThis.Element)) {
    return [];
  }
  let { nodeName } = el;
  if (nodeName === 'BR') {
    return getInlineNodes('\n');
  }

  const marks = marksFromElementAttributes(el);

  // Dropbox Paper displays blockquotes as lists for some reason
  if (el.classList.contains('listtype-quote')) {
    marks.delete('italic');
    nodeName = 'BLOCKQUOTE';
  }

  return addMarksToChildren(marks, () => {
    if (nodeName === 'A') {
      const href = el.getAttribute('href');
      if (href) {
        return setLinkForChildren(href, () =>
          forceDisableMarkForChildren('underline', () => deserializeChildren(el.childNodes))
        );
      }
    }

    if (nodeName === 'HR') {
      return [{ type: 'divider', children: [{ text: '' }] }];
    }

    if (BLOCK_TAGS[nodeName]) {
      const node = BLOCK_TAGS[nodeName](el);
      return [{ ...node, children: deserializeChildren(el.childNodes) }];
    }
    return deserializeChildren(el.childNodes);
  });
}

function deserializeChildren(nodes: Iterable<globalThis.Node>) {
  const outputNodes: (InlineFromExternalPaste | Block)[] = [];
  for (const node of nodes) {
    outputNodes.push(...deserializeHTMLNode(node));
  }
  if (!outputNodes.length) {
    // Slate also gets unhappy if an element has no children
    // the empty text nodes will get normalized away if they're not needed
    return [{ text: '' }];
  }
  if (outputNodes.some(isBlock)) {
    // we want to ignore whitespace between block level elements
    // useful info about whitespace in html:
    // https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace
    return outputNodes.filter(node => isBlock(node) || Node.string(node).trim() !== '');
  }
  return outputNodes;
}
