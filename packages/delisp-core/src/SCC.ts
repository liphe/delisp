//
// Compute the strongly connected components (and topological order)
// of a graph using Tarjan's algorithm.
//
// The main algorithm is implemented in the function `tarjan`.
//    https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
//
// However, the algorithm requires mutation, so a convenient and
// immutable `stronglyConnectedComponents` is exposed instead.

import { InvariantViolation } from "./invariant";

type Graph<T> = Array<Vertex<T>>;
type Component<T> = Array<Vertex<T>>;

class Vertex<T> {
  index?: number;
  lowlink?: number;
  edges: Array<Vertex<T>>;
  value: T;
  constructor(value: T) {
    this.value = value;
    this.edges = [];
  }
}

function tarjan<T>(graph: Graph<T>): Array<Component<T>> {
  // An array where we wil push strongly connected components
  let components: Array<Component<T>> = [];
  // The number of vertices we have discovered so far.
  let index = 0;
  // An stack of vertices whose strongly connected component detection
  // is in progress.
  let stack: Array<Vertex<T>> = [];

  function strongConnect(v: Vertex<T>) {
    v.lowlink = v.index = index++;
    stack.unshift(v);

    v.edges.forEach(w => {
      if (w.index === undefined) {
        // If the next vertex has not yet being found, we recurse into
        // it. The vertex will then be part of the spanning tree we
        // are geerating with our DFS (depth-first-search).
        strongConnect(w);
        // Therefore, we propagate (if necessary) the lowlink to the
        // current node.
        if (w.lowlink! < v.lowlink!) {
          v.lowlink = w.lowlink;
        }
      } else if (stack.includes(w)) {
        // If the next vertex has been found before, but it is part of
        // the stack, the vertex is an ancestor in the spanning tree
        // and this is a back-edge.
        //
        // So we want to our lowlink to be updated with the ancestor
        // index (no lowindex as it may point out to unreachable parts
        // of the spanning tree)
        if (w.index! < v.lowlink!) {
          v.lowlink = w.index;
        }
      }
    });

    if (v.index === v.lowlink) {
      // At this point, v is the root of the strongly connected
      // component. We can extract it from the stack and emit it.
      const stackIndex = stack.indexOf(v);
      const component = stack.splice(0, stackIndex + 1);
      components.push(component);
    }
  }

  graph.forEach(v => {
    if (v.index === undefined) {
      strongConnect(v);
    }
  });

  return components;
}

/** Compute strongly connected components of a graph.
 *
 * @description
 *
 * The graph consists of the array of `values`
 * provided. `getAdjacents` will be called for each value to determine
 * the edges.
 *
 * Note that the output of `getAdjacents` must be a value in the
 * values list.
 *
 * === is used to check values for equality.
 *
 * @returns
 *
 * An array of strongly connected components. Each one being an array
 * of values. The strongly connected components are in reverse
 * topological order.
 *
 */
export function stronglyConnectedComponents<T>(
  values: T[],
  getAdjacents: (v: T) => T[]
): T[][] {
  const verticesByValue = new Map<T, Vertex<T>>();

  values.forEach(value => {
    const v = new Vertex(value);
    verticesByValue.set(value, v);
  });

  const vertices = Array.from(verticesByValue.values());
  vertices.forEach(v => {
    getAdjacents(v.value).forEach(adjacentValue => {
      const adjacent = verticesByValue.get(adjacentValue);
      if (!adjacent) {
        throw new InvariantViolation(
          `A value depends on a value that does not belong to list of values`
        );
      }
      v.edges.push(adjacent);
    });
  });

  const components = tarjan(vertices);
  return components.map(c => c.map(v => v.value));
}
