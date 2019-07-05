import { Module } from "./syntax";
import { TypeSchema } from "./types";
import { moduleImports } from "./module";
import { ExternalEnvironment } from "./infer-environment";
import { flatMap, unique, fromEntries } from "./utils";

type Resolver = (file: string) => Promise<ExternalEnvironment>;

async function resolveDependencySources(
  sources: string[],
  resolve: Resolver
): Promise<Record<string, ExternalEnvironment>> {
  return fromEntries(
    await Promise.all(
      sources.map(
        async (source): Promise<[string, ExternalEnvironment]> => [
          source,
          await resolve(source)
        ]
      )
    )
  );
}

/** Resolve the imports of a module into a ExternalEnvironment.
 *
 * @description
 *
 * The resulting object can be used for type inferencing the external
 * references of the module. */
export async function resolveModuleDependencies(
  m: Module,
  resolve: Resolver
): Promise<ExternalEnvironment> {
  const importDeclarations = moduleImports(m);
  const importSources = unique(importDeclarations.map(i => i.node.source));
  const resolvedSources = await resolveDependencySources(
    importSources,
    resolve
  );

  const environmentEntries = flatMap((i): [[string, TypeSchema]] => {
    const name = i.node.variable.name;
    const source = i.node.source;
    const type = resolvedSources[source].variables[name];
    return [[name, type]];
  }, importDeclarations);

  return {
    variables: fromEntries(environmentEntries),
    types: {}
  };
}
