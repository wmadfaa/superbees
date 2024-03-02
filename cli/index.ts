#!/usr/bin/env ts-node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import startCommand from "./commands/start";
import scriptRunCommand from "./commands/script-run";

yargs(hideBin(process.argv)).command(startCommand).command(scriptRunCommand).help().argv;
