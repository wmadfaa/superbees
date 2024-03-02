#!/usr/bin/env ts-node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import startCommand from "./commands/start";

yargs(hideBin(process.argv)).command(startCommand).help().argv;
