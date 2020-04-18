import { generateUniqueTVar } from "./type-generate";
import { printType } from "./type-printer";
import { generalize, instantiate, transformRecurType } from "./type-utils";
import { Type, TypeSchema } from "./types";

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
  private body: Type;
  constructor(body: Type) {
    this.body = body;
  }

  generalize(): TypeSchema {
    const nowildcards = transformRecurType(this.body, (t1) => {
      if (t1.node.tag === "type-variable" && t1.node.name === "_") {
        return generateUniqueTVar(false, "__t");
      } else {
        return t1;
      }
    });
    return generalize(nowildcards, []);
  }

  instantiate(): Type {
    return instantiate(this.generalize(), true);
  }

  noWildcards(): Type {
    // TODO: Note that type definitions should not contain wildcards. We
    // are instantiating here in order to just get the underlying
    // type. But we should instead extend TypeWithWildcards with method
    // to find wildcards
    return this.body;
  }

  print(): string {
    return printType(this.body, false);
  }

  asRawType(): Type {
    return this.body;
  }
}
