import { List, Syntax } from "./syntax";

class Input {
  input: string;
  offset: number;

  constructor(input: string, offset: number = 0) {
    this.input = input;
    this.offset = offset;
  }

  readChar() : [string, Input] {
    return [this.input[this.offset], new Input(this.input, this.offset + 1)]
  }

  consume (n: number) {
    return new Input(this.input, this.offset + n)
  }

  toString () {
    return this.input.slice(this.offset)
  }
}

type ParserResult = [Syntax, Input];

class Parser {
  run: (input: Input) => ParserResult
 
  constructor(fn: (input: Input) => ParserResult) {
    this.run = fn
  }

  parse (input: string) {
    return this.run(new Input(input, 0))
  }
}

const Atom = new Parser((input) => {

  // console.log(input.toString())
  const matches = input.toString().match(/^([^)\s]*)/)
  if (matches === null){
    throw new Error('Unexpected')
  }
  const token = matches[1]
  const rest = input.consume(token.length)

  if (token.match(/[0-9]+/)) {
    const value = parseInt(token, 10)
    return [{type: 'LiteralNumber', value }, rest]
  } else {
    return [{type: 'LiteralSymbol', value: token}, rest]
  }
  
}) 

const ListExpr = new Parser((input): [List, Input] => {

 // const [,input] = skipSpaces.run(input_);

  const [char, rest] = input.readChar()
  if (char === ")") {
    return [{type: 'List', value: []}, rest]
  }

  const [atom, rest2] = Expr.run(input)
  const [restA, rest3] = ListExpr.run(rest2)

  return [{
      type: 'List', 
      value: [
        atom,
        ...((restA as List).value)
      ]
    },
     rest3
    ]
})


const skipSpaces = (parser: Parser) => new Parser((input: Input): ParserResult => {
    const [char, rest] = input.readChar()
    if (char === ' ') {
      return skipSpaces(parser).run(rest);
    } else {
      return parser.run(input)
    }
})


const Expr = skipSpaces(new Parser(input => {
  const [first, rest] = input.readChar()
  if (first === '('){
    return ListExpr.run(rest)
  } else {
    return Atom.run(input)
  }
}))

console.dir(Expr.parse('(1 (x 2)  3)'), {depth: null})

//  ListExpr.parse('1 2 3)')
