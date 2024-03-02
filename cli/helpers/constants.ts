import dotenv from "@superbees/dotenv";
export const BACKGROUND_PROCESS_NAME = ["@superbees/background", dotenv.PROCESS_ID].filter(Boolean).join(":");
