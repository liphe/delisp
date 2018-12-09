// printer.ts -- A Delisp pretty printer
//
// Based on "A Prettier Printer" by Philip Wadler, which you can find
// at
// https://homepages.inf.ed.ac.uk/wadler/papers/prettier/prettier.pdf
//
// The paper is a great starting point, but I start to extend this
// with some extra operations, as the expressive power of the original
// operators is not enough.
//

import { last } from "./utils";

interface DocNil {
  type: "nil";
}

interface DocText {
  type: "text";
  content: string;
  next: Doc;
}

interface DocLine {
  type: "line";
  next: Doc;
}

interface DocUnion {
  type: "union";
  x: Doc;
  y: Doc;
}

interface DocAlign {
  type: "align";
  root: Doc;
  docs: Doc[];
  next: Doc;
}

interface DocIndent {
  type: "indent";
  doc: Doc;
  level: number;
  next: Doc;
}

export type Doc = DocNil | DocText | DocLine | DocUnion | DocAlign | DocIndent;

export const nil: Doc = { type: "nil" };

export function text(content: string): Doc {
  if (content.includes("\n")) {
    throw new Error(`Newline is not allowed in a call to 'text'`);
  }
  return { type: "text", content, next: nil };
}

export const line: Doc = {
  type: "line",
  next: nil
};

function concat2(x: Doc, y: Doc): Doc {
  switch (x.type) {
    case "nil":
      return y;
    case "text":
      return {
        type: "text",
        content: x.content,
        next: concat2(x.next, y)
      };
    case "line":
      return {
        type: "line",
        next: concat2(x.next, y)
      };
    case "union":
      return {
        type: "union",
        x: concat2(x.x, y),
        y: concat2(x.y, y)
      };
    case "align":
      return {
        type: "align",
        root: x.root,
        docs: x.docs,
        next: concat2(x.next, y)
      };
    case "indent":
      return {
        type: "indent",
        doc: x.doc,
        next: concat2(x.next, y),
        level: x.level
      };
  }
}

export function concat(...docs: Doc[]): Doc {
  return docs.reduce(concat2, nil);
}

export function join(docs: Doc[], sep: Doc) {
  return docs.reduce((a, d) => concat(a, sep, d));
}

export function indent(doc: Doc, level: number): Doc {
  return { type: "indent", doc, next: nil, level };
}

function union(x: Doc, y: Doc): Doc {
  // invariant: every first line of x must be longer than than first
  // line of y
  return {
    type: "union",
    x,
    y
  };
}

function flatten(doc: Doc): Doc {
  switch (doc.type) {
    case "nil":
      return nil;
    case "text":
      return {
        type: "text",
        content: doc.content,
        next: flatten(doc.next)
      };
    case "line":
      return {
        type: "text",
        content: " ",
        next: flatten(doc.next)
      };
    case "union":
      // All layouts in the set should flatten to the same document.
      return flatten(doc.x);
    case "align":
      return concat(
        flatten(join([doc.root, ...doc.docs], text(" "))),
        flatten(doc.next)
      );
    case "indent":
      return {
        type: "indent",
        level: doc.level,
        doc: flatten(doc.doc),
        next: flatten(doc.next)
      };
  }
}

export function group(doc: Doc): Doc {
  switch (doc.type) {
    case "nil":
      return nil;
    case "text":
      return {
        type: "text",
        content: doc.content,
        next: group(doc.next)
      };
    case "line":
      return union(flatten(doc), doc);
    case "union":
      return union(group(doc.x), doc.y);
    case "align":
      return union(flatten(doc), doc);
    case "indent":
      return {
        type: "indent",
        level: doc.level,
        doc: group(doc.doc),
        next: doc.next
      };
  }
}

export function align(...all: Doc[]): Doc {
  if (all.length === 0) {
    return nil;
  } else {
    const [root, ...docs] = all;
    return {
      type: "align",
      root,
      docs,
      next: nil
    };
  }
}

/** Concatenate two documents, or break them apart in an aligned way
 * if they do not fit.  */
export function groupalign(x: Doc, y: Doc): Doc {
  return union(join([x, y], text(" ")), align(x, y));
}

function fits(doc: Doc, w: number): boolean {
  if (w < 0) {
    return false;
  }
  switch (doc.type) {
    case "nil":
      return true;
    case "line":
      return true;
    case "text":
      return fits(doc.next, w - doc.content.length);
    case "union":
      throw new Error(`Unsupported`);
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
  switch (doc.type) {
    case "nil":
      return nil;
    case "text":
      return {
        type: "text",
        content: doc.content,
        next: best(doc.next, w, k + doc.content.length)
      };
    case "line":
      return {
        type: "line",
        next: best(doc.next, w, k)
      };
    case "union":
      return better(best(doc.x, w, k), best(doc.y, w, k), w, k);
    case "align":
      return {
        type: "align",
        root: best(doc.root, w, k),
        docs: doc.docs.map(d => best(d, w, k)),
        next: best(doc.next, w, k)
      };
    case "indent":
      return {
        type: "indent",
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
  switch (doc.type) {
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
      throw new Error(`No unions for layout!`);
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

export function pretty(doc: Doc, w: number): string {
  const d = best(doc, w, 0);
  return layout(d, 0, 0);
}
