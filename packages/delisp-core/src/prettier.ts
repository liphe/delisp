// printer.ts -- A Delisp pretty printer
//
// Based on "A Prettier Printer" by Philip Wadler, which you can find
// at
// https://homepages.inf.ed.ac.uk/wadler/papers/prettier/prettier.pdf
//
// The paper is a great starting point, but I had to extend this
// with some extra operations, as the expressive power of the original
// operators is not enough.
//

import { InvariantViolation } from "./invariant";

interface DocNil {
  tag: "nil";
}
interface DocText {
  tag: "text";
  content: string;
  next: Doc;
}
interface DocLine {
  tag: "line";
  next: Doc;
}
interface DocUnion {
  tag: "union";
  x: Doc;
  y: Doc;
  width?: number;
}
interface DocAlign {
  tag: "align";
  root: Doc;
  docs: Doc[];
  next: Doc;
}
interface DocIndent {
  tag: "indent";
  doc: Doc;
  level: number;
  next: Doc;
}
/** A document with potentially multiple layouts. */
export type Doc = DocNil | DocText | DocLine | DocUnion | DocAlign | DocIndent;

/** Empty document. */
export const nil: Doc = { tag: "nil" };

//
// Primitive document builders
//

/** A document consisting of a literal string. */
export function text(content: string): Doc {
  if (content.includes("\n")) {
    throw new Error(`Newline is not allowed in a call to 'text'`);
  }
  if (content.length === 0) {
    return nil;
  } else {
    return { tag: "text", content, next: nil };
  }
}

/** A new line.
 * @description
 * A new line. The rest of the document will be indented to the
 * current indentation level.
 */
export const line: Doc = {
  tag: "line",
  next: nil
};

/** Indent a document by a number of levels. */
export function indent(doc: Doc, level: number): Doc {
  if (doc === nil) {
    return nil;
  } else {
    return { tag: "indent", doc, next: nil, level };
  }
}

function union(x: Doc, y: Doc, width?: number): Doc {
  if (x === nil) return y;
  if (y === nil) return x;
  // invariant: every first line of x must be longer than than first
  // line of y
  return {
    tag: "union",
    x,
    y,
    width
  };
}

/** Pretty print docs vertically aligned with the first one. */
export function align(...docs: Doc[]): Doc {
  const nonEmptyDocs = docs.filter(x => x !== nil);
  if (nonEmptyDocs.length === 0) {
    return nil;
  }
  const [root, ...rest] = nonEmptyDocs;
  return {
    tag: "align",
    root,
    docs: rest,
    next: nil
  };
}

//
// Operations
//

/**
 * Concatenate two documents, or break them apart in an aligned way
 * if they do not fit.
 */
export function groupalign(x: Doc, y: Doc): Doc {
  return union(join([x, y], space), align(x, y));
}

function concat2(x: Doc, y: Doc): Doc {
  switch (x.tag) {
    case "nil":
      return y;
    case "text":
      return {
        tag: "text",
        content: x.content,
        next: concat2(x.next, y)
      };
    case "line":
      return {
        tag: "line",
        next: concat2(x.next, y)
      };
    case "union":
      return {
        tag: "union",
        x: concat2(x.x, y),
        y: concat2(x.y, y)
      };
    case "align":
      return {
        tag: "align",
        root: x.root,
        docs: x.docs,
        next: concat2(x.next, y)
      };
    case "indent":
      return {
        tag: "indent",
        doc: x.doc,
        next: concat2(x.next, y),
        level: x.level
      };
  }
}

/** Concatenate a sequence of documents. */
export function concat(...docs: Doc[]): Doc {
  return docs.reduce(concat2, nil);
}

function flatten(doc: Doc): Doc {
  switch (doc.tag) {
    case "nil":
      return nil;
    case "text":
      return {
        tag: "text",
        content: doc.content,
        next: flatten(doc.next)
      };
    case "line":
      return {
        tag: "text",
        content: " ",
        next: flatten(doc.next)
      };
    case "union":
      // Note that we can just flatten one of the layouts,
      // as a union should represent different layouts, they should
      // all flatten to the same document.
      return flatten(doc.x);
    case "align":
      return concat(
        flatten(join([doc.root, ...doc.docs], space)),
        flatten(doc.next)
      );
    case "indent":
      return {
        tag: "indent",
        level: doc.level,
        doc: flatten(doc.doc),
        next: flatten(doc.next)
      };
  }
}

/** Mark a document as potentially collapsable in a single line.
 * @description
 * A group tells the pretty printer that it should try to collapse into
 * a single line if it fits.
 *
 * If it does not fit, the group will printed as it is, trying to collapse
 * nested groups.
 */
export function group(doc: Doc, width?: number): Doc {
  switch (doc.tag) {
    case "nil":
      return nil;
    case "text":
      return {
        tag: "text",
        content: doc.content,
        next: group(doc.next, width)
      };
    case "line":
      return union(flatten(doc), doc, width);
    case "union":
      if (width) {
        return union(
          group(doc.x, width),
          doc.y,
          Math.min(doc.width || -Infinity, width)
        );
      } else {
        return union(group(doc.x, width), doc.y, width);
      }
    case "align":
      return union(flatten(doc), doc, width);
    case "indent":
      return {
        tag: "indent",
        level: doc.level,
        doc: group(doc.doc, width),
        next: group(doc.next, width)
      };
  }
}

// Utilities
//

/** A space. */
export const space = text(" ");

/** Concatenate a sequence of documents with a separator.
 * @description
 * Insert `sep` in between each of the non-nil documents.
 */
export function join(docs: Doc[], sep: Doc) {
  if (docs.length > 0) {
    return docs.reduce((a, d) => {
      // Note that we don't insert a separator if the document is nil,
      // as it would introduce duplicated separators.
      if (a.tag === "nil") {
        return d;
      }
      if (d.tag === "nil") {
        return a;
      }
      return concat(a, sep, d);
    });
  } else {
    return nil;
  }
}

// Pretty printing documents
//

function fits(doc: Doc, w: number): boolean {
  if (w < 0) {
    return false;
  }
  switch (doc.tag) {
    case "nil":
      return true;
    case "line":
      return true;
    case "text":
      return fits(doc.next, w - doc.content.length);
    case "union":
      throw new InvariantViolation(
        `unions should be removed before checking if it fits.`
      );
    case "align":
      return fits(doc.root, w) && doc.docs.every(d => fits(d, w));
    case "indent":
      return fits(doc.doc, w - doc.level);
  }
}

function better(x: Doc, y: Doc, w: number, k: number): Doc {
  return fits(x, w - k) ? x : y;
}

function best(doc: Doc, w: number, k: number): Doc {
  switch (doc.tag) {
    case "nil":
      return nil;
    case "text":
      return {
        tag: "text",
        content: doc.content,
        next: best(doc.next, w, k + doc.content.length)
      };
    case "line":
      return {
        tag: "line",
        next: best(doc.next, w, 0)
      };
    case "union":
      if (doc.width) {
        return better(
          best(doc.x, w, k),
          best(doc.y, w, k),
          Math.min(k + doc.width, w),
          k
        );
      } else {
        return better(best(doc.x, w, k), best(doc.y, w, k), w, k);
      }

    case "align":
      return {
        tag: "align",
        root: best(doc.root, w, k),
        docs: doc.docs.map(d => best(d, w, k)),
        next: best(doc.next, w, k)
      };
    case "indent":
      return {
        tag: "indent",
        doc: best(doc.doc, w - doc.level, k),
        level: doc.level,
        next: best(doc.next, w, k)
      };
  }
}

function repeatChar(ch: string, n: number): string {
  return Array(n)
    .fill(ch)
    .join("");
}

function layout(doc: Doc, indentation: number, alignment: number): string {
  switch (doc.tag) {
    case "nil":
      return "";
    case "text":
      return (
        doc.content +
        layout(doc.next, indentation, alignment + doc.content.length)
      );
    case "line":
      return (
        "\n" + repeatChar(" ", indentation) + layout(doc.next, indentation, 0)
      );
    case "union":
      throw new InvariantViolation(`No layout for unions!`);
    case "align":
      return (
        [
          layout(doc.root, indentation + alignment, 0),
          ...doc.docs.map(
            d =>
              repeatChar(" ", indentation + alignment) +
              layout(d, indentation + alignment, 0)
          )
        ].join("\n") + layout(doc.next, indentation, alignment)
      );
    case "indent":
      return (
        layout(doc.doc, indentation + doc.level, alignment) +
        layout(doc.next, indentation, alignment)
      );
  }
}

/** Pretty print a document
 * @param doc The document to pretty print
 * @param w The width of the line we want to adjust it to
 */
export function pretty(doc: Doc, w: number): string {
  const d = best(doc, w, 0);
  return layout(d, 0, 0);
}
