// very loosely based on https://github.com/ianstormtaylor/slate/blob/d22c76ae1313fe82111317417912a2670e73f5c9/site/examples/paste-html.tsx
import { Descendant, Node } from 'slate';
import { isNonEmptyArray } from 'emery/guards';
import { Block, isBlock } from '..';
import { Mark } from '../utils';
import {
  addMarksToChildren,
  getInlineNodes,
  forceDisableMarkForChildren,
  setLinkForChildren,
  InlineFromExternalPaste,
  onlyWhitespacePattern,
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

const headings: Record<string, (Node & { type: 'heading' })['level'] | undefined> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6,
};

const TEXT_TAGS: Record<string, Mark | undefined> = {
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

type Inlines = [InlineFromExternalPaste, ...InlineFromExternalPaste[]];

function deserializeLeafHTMLNodeToInline(el: globalThis.Node): Inlines | undefined {
  if (el instanceof globalThis.Text) {
    const text = el.data;
    if (!text) {
      return [{ text: '' }];
    }
    return getInlineNodes(text);
  }
  if (el.nodeName === 'BR') {
    return getInlineNodes('\n');
  }
}

function hasNonWhitespaceContent(node: Descendant) {
  if (node.type === undefined) {
    return !onlyWhitespacePattern.test(node.text);
  }
  return node.children.some(hasNonWhitespaceContent);
}

function deserializeNodesToInline(nodes: Iterable<globalThis.Node>): Inlines {
  const output: InlineFromExternalPaste[] = [];
  let nextShouldHaveNewline = false;
  for (const child of nodes) {
    if (blockNodeNames.has(child.nodeName)) {
      nextShouldHaveNewline = true;
    }
    const content = deserializeToInline(child);
    if (nextShouldHaveNewline && content.some(hasNonWhitespaceContent)) {
      output.push(...getInlineNodes('\n'));
      nextShouldHaveNewline = false;
    }
    output.push(...content);
  }
  if (isNonEmptyArray(output)) {
    return output;
  }
  return [{ text: '' }];
}

const blockNodeNames = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'DIV', 'BLOCKQUOTE']);

function deserializeToInline(el: globalThis.Node): Inlines {
  const leaf = deserializeLeafHTMLNodeToInline(el);
  if (leaf !== undefined) {
    return leaf;
  }
  if (el instanceof globalThis.Element && el.nodeName === 'A') {
    const href = el.getAttribute('href');
    if (href) {
      return setLinkForChildren(href, () =>
        forceDisableMarkForChildren('underline', () => deserializeNodesToInline(el.childNodes))
      );
    }
  }

  if (el.nodeName === 'PRE' && el.textContent) {
    return [{ text: el.textContent }];
  }
  const marks = marksFromElementAttributes(el);
  return addMarksToChildren(marks, () => deserializeNodesToInline(el.childNodes));
}

type DeserializedNode = InlineFromExternalPaste | Block;

type DeserializedNodes = [DeserializedNode, ...DeserializedNode[]];

export function deserializeHTMLNode(el: globalThis.Node): DeserializedNode[] {
  const leaf = deserializeLeafHTMLNodeToInline(el);
  if (leaf !== undefined) {
    return leaf;
  }
  if (!(el instanceof globalThis.Element)) {
    return [];
  }

  if (el.nodeName === 'HR') {
    return [{ type: 'divider', children: [{ text: '' }] }];
  }

  const marks = marksFromElementAttributes(el);

  // Dropbox Paper displays blockquotes as lists for some reason
  if (el.classList.contains('listtype-quote')) {
    marks.delete('italic');
    return addMarksToChildren(marks, () => [
      { type: 'blockquote', children: deserializeChildren(el.childNodes) },
    ]);
  }

  return addMarksToChildren(marks, (): DeserializedNodes => {
    const { nodeName } = el;

    if (nodeName === 'A') {
      const href = el.getAttribute('href');
      if (href) {
        return setLinkForChildren(href, () =>
          forceDisableMarkForChildren('underline', () => deserializeChildren(el.childNodes))
        );
      }
    }

    if (nodeName === 'LI') {
      const listItemContent: (InlineFromExternalPaste | Block)[] = [];

      let nestedList: DeserializedNode[] = [];
      for (const node of el.childNodes) {
        if (node.nodeName === 'UL' || node.nodeName === 'OL') {
          nestedList = deserializeHTMLNode(node);
          continue;
        }
        listItemContent.push(...deserializeToInline(node));
      }
      const children = isNonEmptyArray(listItemContent) ? listItemContent : [{ text: '' }];

      return [
        { type: 'list-item', children: [{ type: 'list-item-content', children }, ...nestedList] },
      ];
    }

    const children = deserializeChildren(el.childNodes);

    if (nodeName === 'P') {
      return [{ type: 'paragraph', textAlign: getAlignmentFromElement(el), children }];
    }

    const headingLevel = headings[nodeName];

    if (typeof headingLevel === 'number') {
      return [
        { type: 'heading', level: headingLevel, textAlign: getAlignmentFromElement(el), children },
      ];
    }
    if (nodeName === 'PRE' && el.textContent) {
      return [{ type: 'code', children: [{ text: el.textContent || '' }] }];
    }
    if (nodeName === 'BLOCKQUOTE') {
      return [{ type: 'blockquote', children }];
    }
    if (nodeName === 'OL') {
      return [{ type: 'ordered-list', children }];
    }
    if (nodeName === 'UL') {
      return [{ type: 'unordered-list', children }];
    }
    return children;
  });
}

function deserializeChildren(nodes: Iterable<globalThis.Node>): DeserializedNodes {
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
    return outputNodes.filter(
      node => isBlock(node) || Node.string(node).trim() !== ''
    ) as DeserializedNodes;
  }
  return outputNodes as DeserializedNodes;
}
