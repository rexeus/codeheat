import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { makeTempRepository } from "../testing/temp-repository.js";
import { Git } from "./git.js";
import { readHead, readOldestCommitTime } from "./repository.js";

/** A repository whose commits are signed with a fresh ssh key and whose `log` prints each signature's verification. */
const makeSignedRepository = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const repo = yield* makeTempRepository;
  const keys = yield* fs.makeTempDirectoryScoped({ prefix: "codeheat-keys-" });
  const key = path.join(keys, "key");
  const exitCode = yield* spawner.exitCode(
    ChildProcess.make("ssh-keygen", [
      "-q",
      "-t",
      "ed25519",
      "-N",
      "",
      "-f",
      key,
    ]),
  );
  assert.strictEqual(exitCode, 0);
  yield* repo.git("config", "gpg.format", "ssh");
  yield* repo.git("config", "user.signingkey", `${key}.pub`);
  yield* repo.git("config", "commit.gpgsign", "true");
  yield* repo.git("config", "log.showSignature", "true");
  return repo;
});

layer(NodeServices.layer)("readHead of signed commits", (it) => {
  it.effect(
    "reads the commit and its time although log prints the signature first",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeSignedRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.txt": "a\n" });
        yield* repo.commit("2026-04-02T08:30:00Z", { "a.txt": "b\n" });
        const expected = (yield* repo.git("rev-parse", "HEAD")).trim();
        // the setting is in effect: plain `log` leads with the verification, not the commit
        const plain = yield* repo.git("log", "-1", "--format=%H");
        assert.notStrictEqual(plain.split("\n")[0], expected);

        const head = yield* readHead.pipe(
          Effect.provide(Git.layer(repo.directory)),
        );

        assert.deepStrictEqual(head, {
          commit: expected,
          committedAt: Date.parse("2026-04-02T08:30:00Z") / 1000,
        });
      }),
  );

  it.effect("reads the time of the oldest commit of signed commits", () =>
    Effect.gen(function* () {
      const repo = yield* makeSignedRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.txt": "a\n" });
      yield* repo.commit("2026-04-02T08:30:00Z", { "a.txt": "b\n" });

      const oldest = yield* readOldestCommitTime.pipe(
        Effect.provide(Git.layer(repo.directory)),
      );

      assert.strictEqual(oldest, Date.parse("2026-03-01T12:00:00Z") / 1000);
    }),
  );
});
