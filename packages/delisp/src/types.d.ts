import "yargs";

declare module "yargs" {
  interface Argv<T = {}> {
    parserConfiguration(x: unknown): Argv<T>;
  }
}
