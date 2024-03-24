#!/usr/bin/env ts-node

import yargs, { command } from "yargs";
import { hideBin } from "yargs/helpers";

import startCommand from "./commands/start";
import scriptRunCommand from "./commands/script-run";

import generatorCreateCommand from "./commands/generator/create";
import generatorCompleteCommand from "./commands/generator/complete";
import generatorTrackCommand from "./commands/generator/track";
import generatorPauseCommand from "./commands/generator/pause";
import generatorListCommand from "./commands/generator/list";

import taskCreateCommand from "./commands/task/create";

yargs(hideBin(process.argv))
  .command(startCommand)
  .command(scriptRunCommand)
  .command(taskCreateCommand)
  .command(generatorCreateCommand)
  .command(generatorCompleteCommand)
  .command(generatorTrackCommand)
  .command(generatorPauseCommand)
  .command(generatorListCommand)

  .help().argv;
