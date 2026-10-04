import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import type { DirectoryNode, TreeNode } from "../layout/hierarchy.js";
import { fileStats, territoryNode } from "../testing/reports.js";
import {
  initialView,
  treeOf,
  withDetail,
  withGrouping,
  zoomedOut,
  zoomedTo,
} from "./map-view.js";

// root > core > (core/src, core/lib), root > web; level 1 shows core and web, level 2 shows core/src, core/lib, and web.
const territories: Report["territories"] = {
  recommended: 1,
  details: [
    { level: 1, ids: ["t2", "t3"] },
    { level: 2, ids: ["t4", "t5", "t3"] },
  ],
  nodes: [
    territoryNode("t1", ".", { children: ["t2", "t3"], fit: null }),
    territoryNode("t2", "core", {
      parent: "t1",
      children: ["t4", "t5"],
    }),
    territoryNode("t3", "web", { parent: "t1" }),
    territoryNode("t4", "core/src", { parent: "t2" }),
    territoryNode("t5", "core/lib", { parent: "t2" }),
  ],
};

const files = [
  fileStats("core/src/a.ts", { territory: "t4" }),
  fileStats("core/lib/b.ts", { territory: "t5" }),
  fileStats("web/c.ts", { territory: "t3" }),
  fileStats("web/d.ts", { territory: "t3" }),
];

const noKeep: ReadonlySet<string> = new Set();

const namesOf = (nodes: readonly TreeNode[]): string[] =>
  nodes.map(({ name }) => name);

const directoryNamed = (
  nodes: readonly TreeNode[],
  name: string,
): DirectoryNode => {
  const node = nodes.find((candidate) => candidate.name === name);
  if (node?.kind !== "directory") {
    throw new Error(`no directory named ${name}`);
  }
  return node;
};

const leafPaths = (node: TreeNode): string[] => {
  if (node.kind === "file") {
    return [node.path];
  }
  return node.kind === "directory"
    ? node.children.flatMap(leafPaths)
    : [...node.paths];
};

describe("initialView", () => {
  it("groups by territory at the recommended detail", () => {
    expect(initialView(territories)).toStrictEqual({
      grouping: "territories",
      detail: 1,
      zoom: null,
    });
  });

  it("groups by folder when the report has no territories", () => {
    expect(
      initialView({ recommended: 0, details: [], nodes: [] }).grouping,
    ).toBe("folders");
  });
});

describe("treeOf by territory", () => {
  const { root } = treeOf(initialView(territories), territories, files, noKeep);

  it("groups the files by territory at the detail, each group named after its territory", () => {
    expect(namesOf(root.children)).toStrictEqual(["core", "web"]);
    expect(leafPaths(directoryNamed(root.children, "core"))).toStrictEqual([
      "core/src/a.ts",
      "core/lib/b.ts",
    ]);
    expect(leafPaths(directoryNamed(root.children, "web"))).toStrictEqual([
      "web/c.ts",
      "web/d.ts",
    ]);
  });

  it("does not repeat the path that leads to a territory inside its group", () => {
    expect(
      namesOf(directoryNamed(root.children, "core").children),
    ).toStrictEqual(["src", "lib"]);
  });

  it("groups at a finer detail with the territories that detail shows", () => {
    const view = withDetail(initialView(territories), 2, territories);

    expect(
      namesOf(treeOf(view, territories, files, noKeep).root.children),
    ).toStrictEqual(["core/src", "core/lib", "web"]);
  });

  it("drops a file whose territory the detail does not show", () => {
    const tree = treeOf(
      initialView(territories),
      territories,
      [...files, fileStats("loose.ts", { territory: "gone" })],
      noKeep,
    );

    expect(tree.contains("loose.ts")).toBe(false);
  });
});

describe("treeOf zoomed and by folder", () => {
  it("fills the map with one territory when zoomed, and knows which files it holds", () => {
    const view = zoomedTo(initialView(territories), "t3", territories);
    const tree = treeOf(view, territories, files, noKeep);

    expect(namesOf(tree.root.children)).toStrictEqual(["c.ts", "d.ts"]);
    expect(tree.zoomed?.territory.id).toBe("t3");
    expect(tree.contains("web/c.ts")).toBe(true);
    expect(tree.contains("core/src/a.ts")).toBe(false);
  });

  it("draws the folders of every file when grouped by folder", () => {
    const view = withGrouping(initialView(territories), "folders");
    const tree = treeOf(view, territories, files, noKeep);

    expect(namesOf(tree.root.children).toSorted()).toStrictEqual([
      "core",
      "web",
    ]);
    expect(tree.zoomed).toBeNull();
    expect(tree.contains("web/d.ts")).toBe(true);
  });
});

describe("zoomedTo", () => {
  const view = initialView(territories);

  it("keeps the detail that shows the territory", () => {
    const fine = withDetail(view, 2, territories);

    expect(zoomedTo(fine, "t5", territories)).toStrictEqual({
      grouping: "territories",
      detail: 2,
      zoom: "t5",
    });
  });

  it("moves to the recommended detail when the current one does not show it", () => {
    const fine = withDetail(view, 2, territories);

    expect(zoomedTo(fine, "t2", territories)).toStrictEqual({
      grouping: "territories",
      detail: 1,
      zoom: "t2",
    });
  });

  it("switches from folders to territories", () => {
    const folders = withGrouping(view, "folders");

    expect(zoomedTo(folders, "t3", territories).grouping).toBe("territories");
  });

  it("leaves the view as it is for a territory no detail shows", () => {
    expect(zoomedTo(view, "t1", territories)).toBe(view);
    expect(zoomedTo(view, "nope", territories)).toBe(view);
  });
});

describe("changing the view while zoomed", () => {
  const zoomed = zoomedTo(initialView(territories), "t2", territories);

  it("zooms out", () => {
    expect(zoomedOut(zoomed).zoom).toBeNull();
  });

  it("keeps the zoom at a detail that still shows the territory", () => {
    const web = zoomedTo(initialView(territories), "t3", territories);

    expect(withDetail(web, 2, territories).zoom).toBe("t3");
  });

  it("drops the zoom at a detail that no longer shows the territory", () => {
    expect(withDetail(zoomed, 2, territories).zoom).toBeNull();
  });

  it("drops the zoom when grouping by folder", () => {
    expect(withGrouping(zoomed, "folders").zoom).toBeNull();
  });
});
