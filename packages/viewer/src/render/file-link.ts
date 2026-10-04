import { h } from "./dom.js";
import { splitPath } from "./format.js";

/** What a link to a file needs from the page: which files the map knows, and how to show one there. */
export type FileLinkContext = {
  readonly knownFiles: ReadonlySet<string>;
  readonly showFile: (path: string) => void;
};

/**
 * A file's name as a button that shows the file in the map. A file the
 * report does not list is a plain, dashed label instead.
 */
export const fileLink = (
  path: string,
  { knownFiles, showFile }: FileLinkContext,
): HTMLElement => {
  const { name } = splitPath(path);
  if (!knownFiles.has(path)) {
    return h("span", "file-link unknown", name);
  }
  const button = h("button", "file-link", name);
  button.type = "button";
  button.title = `Show ${path} in the map`;
  button.addEventListener("click", () => {
    showFile(path);
  });
  return button;
};
