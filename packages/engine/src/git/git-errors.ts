// Owns the failures of talking to git; the CLI maps each tag to an exit code.
// Only conditions a caller must react to differently get their own tag.
import { Schema } from "effect";

/** No `git` executable on PATH. */
export class GitNotFound extends Schema.TaggedError<GitNotFound>()(
  "GitNotFound",
  {},
) {}

/** The analyzed path is not inside a git work tree. */
export class NotAGitRepository extends Schema.TaggedError<NotAGitRepository>()(
  "NotAGitRepository",
  { path: Schema.String },
) {}

/** A git command exited non-zero for another reason. */
export class GitCommandFailed extends Schema.TaggedError<GitCommandFailed>()(
  "GitCommandFailed",
  {
    args: Schema.Array(Schema.String),
    exitCode: Schema.Int,
    stderr: Schema.String,
  },
) {}

export type GitError = GitNotFound | NotAGitRepository | GitCommandFailed;
