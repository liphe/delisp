import { Type } from "./types";

export class Typed {
  effect: Type;

  // Declared resulting type. If undefined, we'll just return the
  // expression type. This should speed up as we avoid operating on
  // double the amount of types.
  _resultingType: Type | undefined;
  expressionType: Type;

  constructor({
    expressionType,
    resultingType,
    effect
  }: {
    expressionType: Type;
    resultingType?: Type;
    effect: Type;
  }) {
    this.expressionType = expressionType;
    this._resultingType = resultingType;
    this.effect = effect;
  }

  // The `resultingType` is used as the resulting type in the parent
  // expression.
  //
  // Note that this type DOES NOT need to be equal to the type of the
  // expression itself. For instance, in the presence of multiple
  // values:
  //
  //   (+ 1 (values 1 2))
  //
  // (values 1 2) will have type `(values 1 2)`, however the type number
  // is returned to the parent expression.
  //
  // And the other way around, in:
  //
  //   (lambda (x) x)
  //
  // x as an expression has type `a`, but `(values a)` is returned to
  // the parent function.
  //
  get resultingType() {
    return this._resultingType || this.expressionType;
  }
}
