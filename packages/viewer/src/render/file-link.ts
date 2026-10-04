import { h } from "./dom.js";
import { splitPath } from "./format.js";

/** What a link to a file needs from the page: which files the map knows, and how to show one there. */
export type FileLinkContext = {
  readonly knownFiles: ReadonlySet<string>;
  readonly showFile: (path: string) => void;
};

/**
 * A file as a button that shows the file in the map, labelled with its name
 * unless `label` says otherwise. A file the report does not list is a plain,
 * dashed label instead.
 */
export const fileLink = (
  path: string,
  { knownFiles, showFile }: FileLinkContext,
  label: string = splitPath(path).name,
): HTMLElement => {
  if (!knownFiles.has(path)) {
    const unknown = h("span", "file-link unknown", label);
    unknown.title = path;
    return unknown;
  }
  const button = h("button", "file-link", label);
  button.type = "button";
  button.title = `Show ${path} in the map`;
  button.addEventListener("click", () => {
    showFile(path);
  });
  return button;
};
