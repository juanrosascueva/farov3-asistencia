/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as attendance from "../attendance.js";
import type * as chat from "../chat.js";
import type * as contacts from "../contacts.js";
import type * as crisis from "../crisis.js";
import type * as journal from "../journal.js";
import type * as ppp from "../ppp.js";
import type * as seed from "../seed.js";
import type * as teens from "../teens.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  attendance: typeof attendance;
  chat: typeof chat;
  contacts: typeof contacts;
  crisis: typeof crisis;
  journal: typeof journal;
  ppp: typeof ppp;
  seed: typeof seed;
  teens: typeof teens;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
