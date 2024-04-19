#!/usr/bin/env ts-node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import startCommand from "./commands/start";
import scriptRunCommand from "./commands/script-run";

import generatorCreateCommand from "./commands/generator/create";
import generatorCompleteCommand from "./commands/generator/complete";
import generatorTrackCommand from "./commands/generator/track";
import generatorPauseCommand from "./commands/generator/pause";
import generatorActivateCommand from "./commands/generator/activate";
import generatorListCommand from "./commands/generator/list";

import taskCreateCommand from "./commands/task/create";
import taskCompleteCommand from "./commands/task/complete";
import taskTrackCommand from "./commands/task/track";
import taskPauseCommand from "./commands/task/pause";
import taskListCommand from "./commands/task/list";

yargs(hideBin(process.argv))
  .command(startCommand)
  .command(scriptRunCommand)
  .command(taskCreateCommand)
  .command(taskCompleteCommand)
  .command(taskTrackCommand)
  .command(taskPauseCommand)
  .command(taskListCommand)
  .command(generatorCreateCommand)
  .command(generatorCompleteCommand)
  .command(generatorTrackCommand)
  .command(generatorPauseCommand)
  .command(generatorActivateCommand)
  .command(generatorListCommand)

  .help().argv;
