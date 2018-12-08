// printer.ts -- A Delisp pretty printer
//
// Based on "A Prettier Printer" by Philip Wadler, which you can find
// at
// https://homepages.inf.ed.ac.uk/wadler/papers/prettier/prettier.pdf
//

import { last } from "./utils";

interface DocNil {
  type: "nil";
}

interface DocText {
  type: "text";
  content: string;
  doc: Doc;
}

interface DocLine {
  type: "line";
  level: number;
  doc: Doc;
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
}

export type Doc = DocNil | DocText | DocLine | DocUnion | DocAlign;

export const nil: Doc = { type: "nil" };

export function text(content: string): Doc {
  if (content.includes("\n")) {
    throw new Error(`Newline is not allowed in a call to 'text'`);
  }
  return { type: "text", content, doc: nil };
}

export const line: Doc = {
  type: "line",
  level: 0,
  doc: nil
};

function concat2(x: Doc, y: Doc): Doc {
  switch (x.type) {
    case "nil":
      return y;
    case "text":
      return {
        type: "text",
        content: x.content,
        doc: concat2(x.doc, y)
      };
    case "line":
      return {
        type: "line",
        level: x.level,
        doc: concat2(x.doc, y)
      };
    case "union":
      return {
        type: "union",
        x: concat2(x.x, y),
        y: concat2(x.y, y)
      };
    case "align":
      if (x.docs.length === 0) {
        return concat2(x.root, y);
      } else {
        const middle = x.docs.slice(0, -1);
        const lastdoc = last(x.docs)!;
        return {
          type: "align",
          root: x.root,
          docs: [...middle, concat2(lastdoc, y)]
        };
      }
  }
}

export function concat(...docs: Doc[]): Doc {
  return docs.reduce(concat2, nil);
}

export function join(docs: Doc[], sep: Doc) {
  return docs.reduce((a, d) => concat(a, sep, d));
}

export function nest(level: number, doc: Doc): Doc {
  switch (doc.type) {
    case "nil":
      return nil;
    case "text":
      return {
        type: "text",
        content: doc.content,
        doc: nest(level, doc.doc)
      };
    case "line":
      return {
        type: "line",
        level: doc.level + level,
        doc: nest(level, doc.doc)
      };
    case "union":
      return {
        type: "union",
        x: nest(level, doc.x),
        y: nest(level, doc.y)
      };
    case "align":
      return {
        type: "align",
        root: nest(level, doc.root),
        docs: doc.docs
      };
  }
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
        doc: flatten(doc.doc)
      };
    case "line":
      return {
        type: "text",
        content: " ",
        doc: flatten(doc.doc)
      };
    case "union":
      // All layouts in the set should flatten to the same document.
      return flatten(doc.x);
    case "align":
      return flatten(join([doc.root, ...doc.docs], text(" ")));
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
        doc: group(doc.doc)
      };
    case "line":
      return union(flatten(doc), doc);
    case "union":
      return union(group(doc.x), doc.y);
    case "align":
      return union(flatten(doc), doc);
  }
}

export function align(...all: Doc[]): Doc {
  const [root, ...docs] = all;
  return {
    type: "align",
    root,
    docs
  };
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
      return fits(doc.doc, w - doc.content.length);
    case "union":
      throw new Error(`Unsupported`);
    case "align":
      return fits(doc.root, w) && doc.docs.every(d => fits(d, w));
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
        doc: best(doc.doc, w, k + doc.content.length)
      };
    case "line":
      return {
        type: "line",
        level: doc.level,
        doc: best(doc.doc, w, doc.level)
      };
    case "union":
      return better(best(doc.x, w, k), best(doc.y, w, k), w, k);
    case "align":
      return {
        type: "align",
        root: best(doc.root, w, k),
        docs: doc.docs.map(d => best(d, w, k))
      };
  }
}

function repeatChar(ch: string, n: number): string {
  return Array(n)
    .fill(ch)
    .join("");
}

function layout(doc: Doc, k: number): string {
  switch (doc.type) {
    case "nil":
      return "";
    case "text":
      return doc.content + layout(doc.doc, k + doc.content.length);
    case "line":
      return "\n" + repeatChar(" ", doc.level) + layout(doc.doc, doc.level);
    case "union":
      throw new Error(`No unions for layout!`);
    case "align":
      return [
        layout(doc.root, k),
        ...doc.docs.map(d => repeatChar(" ", k) + layout(d, k))
      ].join("\n");
  }
}

export function pretty(doc: Doc, w: number): string {
  const d = best(doc, w, 0);
  return layout(d, 0);
}
