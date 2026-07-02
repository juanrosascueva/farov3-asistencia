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
import type * as auditLog from "../auditLog.js";
import type * as authHelper from "../authHelper.js";
import type * as authz from "../authz.js";
import type * as campus from "../campus.js";
import type * as chat from "../chat.js";
import type * as contacts from "../contacts.js";
import type * as crisis from "../crisis.js";
import type * as crons from "../crons.js";
import type * as customRoles from "../customRoles.js";
import type * as dashboard from "../dashboard.js";
import type * as group from "../group.js";
import type * as images from "../images.js";
import type * as journal from "../journal.js";
import type * as migration from "../migration.js";
import type * as ministry from "../ministry.js";
import type * as pastoralPlans from "../pastoralPlans.js";
import type * as pastoralTasks from "../pastoralTasks.js";
import type * as ppp from "../ppp.js";
import type * as seed from "../seed.js";
import type * as teens from "../teens.js";
import type * as userScopes from "../userScopes.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  attendance: typeof attendance;
  auditLog: typeof auditLog;
  authHelper: typeof authHelper;
  authz: typeof authz;
  campus: typeof campus;
  chat: typeof chat;
  contacts: typeof contacts;
  crisis: typeof crisis;
  crons: typeof crons;
  customRoles: typeof customRoles;
  dashboard: typeof dashboard;
  group: typeof group;
  images: typeof images;
  journal: typeof journal;
  migration: typeof migration;
  ministry: typeof ministry;
  pastoralPlans: typeof pastoralPlans;
  pastoralTasks: typeof pastoralTasks;
  ppp: typeof ppp;
  seed: typeof seed;
  teens: typeof teens;
  userScopes: typeof userScopes;
  users: typeof users;
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
