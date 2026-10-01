import { describe, expect, it } from "vitest";

import { coupling, fileStats, reportOf } from "../testing/reports.js";
import { renderReportHtml } from "./template.js";

const hostileName = "</script><img onerror=alert(1)>.ts";

const embeddedReport = (html: string): unknown => {
  const match =
    /<script type="application\/json" id="report">(.*?)<\/script>/su.exec(html);
  if (match?.[1] === undefined) {
    throw new Error("the document embeds no report");
  }
  return JSON.parse(match[1]);
};

describe("renderReportHtml", () => {
  const report = reportOf(
    [
      fileStats("src/a.ts", { reasons: ["changed in 10 commits (#1 of 2)"] }),
      fileStats("src/b.ts"),
    ],
    [coupling("src/a.ts", "src/b.ts", { degree: 0.75 })],
  );

  it("returns a complete HTML document", () => {
    const html = renderReportHtml(report);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<div id="stage"');
    expect(html).toContain("</html>");
  });

  it("offers the heat, cohesion, and change color modes as radio buttons, heat first", () => {
    const html = renderReportHtml(report);

    expect(html).toMatch(
      /name="color-mode" value="heat" checked>.*value="cohesion">.*value="change">/su,
    );
  });

  it("embeds the whole report so it round-trips through JSON", () => {
    expect(embeddedReport(renderReportHtml(report))).toEqual(report);
  });

  it("cannot be broken out of by a crafted file name", () => {
    const html = renderReportHtml(
      reportOf(
        [fileStats(hostileName), fileStats("src/ok.ts")],
        [coupling(hostileName, "src/ok.ts")],
      ),
    );

    expect(html).not.toContain(hostileName);
    expect(html).not.toContain("</script><img");
    expect(html.match(/<script/gu)).toHaveLength(2);
    expect(html).not.toContain("<img");
  });

  it("still restores a crafted file name exactly when the page parses the report", () => {
    const hostile = reportOf([fileStats(hostileName)]);

    expect(embeddedReport(renderReportHtml(hostile))).toEqual(hostile);
  });

  it("escapes the repository name in the page title", () => {
    const named = {
      ...report,
      repository: { ...report.repository, name: "<b>&co" },
    };

    const html = renderReportHtml(named);

    expect(html).toContain("<title>codeheat · &lt;b&gt;&amp;co</title>");
  });

  it("loads nothing from the network", () => {
    const html = renderReportHtml(report);

    expect(html).not.toMatch(/https?:\/\//u);
    expect(html).not.toMatch(/\s(?:src|href)="(?!data:)/u);
    expect(html).not.toContain("@import");
  });
});

describe("renderReportHtml with a comparison", () => {
  it("embeds the comparison and the trends of a report made with --compare", () => {
    const compared = reportOf(
      [
        fileStats("src/a.ts", {
          trend: { previousScore: 0.2, scoreDelta: 0.3, newlyActive: false },
        }),
      ],
      [],
      [],
      {
        previousSince: "2025-03-29T12:00:00.000Z",
        previousUntil: "2025-09-29T12:00:00.000Z",
      },
    );

    expect(embeddedReport(renderReportHtml(compared))).toEqual(compared);
  });
});
