#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";

import { runCli } from "./cli.js";

NodeRuntime.runMain(
  runCli(process.argv.slice(2)).pipe(Effect.provide(NodeServices.layer)),
);
