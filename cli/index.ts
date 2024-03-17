#!/usr/bin/env ts-node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import startCommand from "./commands/start";
import scriptRunCommand from "./commands/script-run";
import generatorCreateCommand from "./commands/generator/create";
import taskCreateCommand from "./commands/task/create";

yargs(hideBin(process.argv)).command(startCommand).command(scriptRunCommand).command(generatorCreateCommand).command(taskCreateCommand).help().argv;
