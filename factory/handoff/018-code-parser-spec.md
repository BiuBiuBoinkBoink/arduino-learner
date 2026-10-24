# Code runner parser

> Feature: Code runner parser: tokenise and parse an Arduino C subset (setup and loop, int float bool long, const, arrays, if else, for, while, switch, functions, enum) into an AST, with clear error messages and line numbers, fully unit tested

## Requirements

1. **Lexer** `src/runner/lexer.js` `lex(source)`. It returns tokens
   `{ type, value, line, column }` (number tokens also carry `isFloat`),
   ending in `eof`. Token types are `number`, `string`, `char`, `ident`,
   `keyword`, `op` and `include`. It supports:
   - `//` and `/* */` comments;
   - decimal, hex, binary and float numbers, with `U`/`L` suffixes;
   - string and char escapes;
   - `#include <X.h>` (other `#` lines are errors).
2. **CodeError** (exported by the lexer): a message starting `Line N: `, plus
   `reason`, `line` and `column`.
3. **Parser** `src/runner/parser.js` `parse(source)` -> `Program { includes, body }`.
   - Top level: `VarDecl`, `Function`, `Prototype`, `Enum`.
   - Statements: `Block`, `VarDecl`, `ExprStmt`, `If`, `While`, `DoWhile`,
     `For`, `Switch` (cases with `test` or null for default), `Break`,
     `Continue`, `Return`, `Empty`.
   - Expressions: `Number`, `String`, `Char`, `Bool`, `Ident`, `Assign`,
     `Conditional`, `Binary` (C precedence), `Unary`, `Update`, `Call`,
     `Member`, `Index`, `Cast` (both `(int)x` and `int(x)`), `Sequence`,
     and `InitList` in declarations.
   - Types: `{ name, const }`, normalised (`unsigned` -> `unsigned int`,
     `boolean` -> `bool`). Enum names and `LIBRARY_CLASSES` (Servo) count as
     types.
   - Every node has `line`.
4. **Errors** are short and plain, like "expected ';' after the statement".
   A missing `;` or `)` is reported on the line where it belongs, not the
   next one.
5. **Tests**: the lexer, precedence, statements, errors with lines, and
   every lesson example and filled sketch parse.

## Out of scope

- Running the AST (job 019), type checking, pointers, structs, classes,
  `#define`, and templates.
