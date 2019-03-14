## Setup

You can use **npx** to try the Delisp REPL directly:

```sh
npx delisp
```

Or install the Delisp CLI with **yarn**:

```sh
yarn global add delisp
```

After installing, you can start the REPL by running `delisp`. Compile files with `delisp compile <file.dl>`.

## Features

- Full type inference
- Optional type annotations
- Extensible records
- Pretty printer
- Compilation to JavaScript
- REPL with type information

## Example code

```cl
(print "Hello World!")

(define numbers [1 2 3 4 5])
(define total (fold + numbers 0))

(define create-user
  (lambda (name age)
    {:name name :age age}))

(define print-name
  (lambda (user) (print (:name user))))

(define factorial
  (lambda (n)
    (if (zero? n)
        1
        (* n (factorial (- n 1))))))

(export factorial)
```
