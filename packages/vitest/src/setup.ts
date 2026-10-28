import { expect } from "vitest";
import { replayGuardMatchers } from "./matchers.js";
import "./types.js";

expect.extend(replayGuardMatchers);
