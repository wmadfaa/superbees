import pino from "pino";
import pretty from "pino-pretty";

const logger = pino(pretty({ colorize: true }));

export type * from "pino";
export default logger;
