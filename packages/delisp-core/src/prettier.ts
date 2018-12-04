// printer.ts -- A Delisp pretty printer
//
// Based on "A Prettier Printer" by Philip Wadler, which you can find
// at
// https://homepages.inf.ed.ac.uk/wadler/papers/prettier/prettier.pdf
//

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

export type Doc = DocNil | DocText | DocLine;

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
      return doc2;
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
  }
}

export function concat(...docs: Doc[]): Doc {
  return docs.reduce(concat2, nil);
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
        doc: doc
      };
  }
}

function repeatChar(ch: string, n: number): string {
  return Array(n)
    .fill(ch)
    .join("");
}

export function layout(doc: Doc): string {
  switch (doc.type) {
    case "nil":
      return "";
    case "text":
      return doc.content + layout(doc.doc);
    case "line":
      return "\n" + repeatChar(" ", doc.level) + layout(doc.doc);
  }
}
