import { Monotype, Type } from "./types";
import { generalize, instantiate, transformRecurType } from "./type-utils";
import { generateUniqueTVar } from "./type-generate";
import { printType } from "./type-printer";

/** A template for a type, but it can contain the wildcard _
 *
 * @description
 *
 * Note this is not just a type, because it can't be genralized. For
 * instance,
 *
 * (-> _ _)
 *
 * The variable `_` can take different types. So when generalized, it
 * will return a type like
 *
 * (-> __t1 __t2)
 *
 * which can be then instantiated.
 *
 **/
export class TypeWithWildcards {
  private body: Monotype;
  constructor(body: Monotype) {
    this.body = body;
  }

  generalize(): Type {
    const nowildcards = transformRecurType(this.body, t1 => {
      if (t1.tag === "type-variable" && t1.name === "_") {
        return generateUniqueTVar(false, "__t");
      } else {
        return t1;
      }
    });
    return generalize(nowildcards, []);
  }

  instantiate(): Monotype {
    return instantiate(this.generalize(), true);
  }

  print(): string {
    return printType(this.body, false);
  }
}
