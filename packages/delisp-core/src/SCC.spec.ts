import { stronglyConnectedComponents } from "./SCC";

describe("SCC", () => {
  describe("stronglyConnectedComponents", () => {
    it("should be empty for an empty graph", () => {
      const components = stronglyConnectedComponents([], (_) => []);
      expect(components).toHaveLength(0);
    });

    it("should return a single components for a graph with just one node", () => {
      const components = stronglyConnectedComponents([1], (_) => []);
      expect(components).toHaveLength(1);
    });

    it("should return a single component if the full graph is a cycle", () => {
      const components = stronglyConnectedComponents([1, 2, 3, 4, 5], (x) => [
        x === 5 ? 1 : x + 1,
      ]);
      expect(components).toEqual([[5, 4, 3, 2, 1]]);
    });

    it("should return connected components correctly", () => {
      //    _______
      //   /        \
      //  v          \
      // 10 -> 11 -> 12
      //       |
      //       v
      // 20 -> 21 -> 22
      // ^           /
      //  \_________/
      //
      //
      const components = stronglyConnectedComponents(
        [10, 11, 12, 20, 21, 22],
        (x) => {
          const adjacency: { [key: number]: number[] } = {
            10: [11],
            11: [12, 21],
            12: [10],

            20: [21],
            21: [22],
            22: [20],
          };
          return adjacency[x];
        }
      );

      expect(components).toEqual([
        [20, 22, 21],
        [12, 11, 10],
      ]);
    });
  });
});
