import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyReturn = any;

function q(ref: string) {
  return makeFunctionReference<"query", AnyArgs, AnyReturn>(ref);
}
function m(ref: string) {
  return makeFunctionReference<"mutation", AnyArgs, AnyReturn>(ref);
}

export const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

export const api = {
  users: {
    getByClerkId: q("users:getByClerkId"),
    getOrCreate: m("users:getOrCreate"),
  },
  units: {
    listByUser: q("units:listByUser"),
    getById: q("units:getById"),
    create: m("units:create"),
    update: m("units:update"),
    remove: m("units:remove"),
  },
  listings: {
    getDueListings: q("listings:getDueListings"),
    upsertByExternalId: m("listings:upsertByExternalId"),
    updateById: m("listings:updateById"),
  },
  expenses: {
    listByUser: q("expenses:listByUser"),
    getById: q("expenses:getById"),
    create: m("expenses:create"),
    update: m("expenses:update"),
    remove: m("expenses:remove"),
  },
  maintenance: {
    listByUser: q("maintenance:listByUser"),
    getById: q("maintenance:getById"),
    create: m("maintenance:create"),
    update: m("maintenance:update"),
    remove: m("maintenance:remove"),
  },
  fbAccounts: {
    getByClerkId: q("fbAccounts:getByClerkId"),
    listAllWithSession: q("fbAccounts:listAllWithSession"),
    upsert: m("fbAccounts:upsert"),
    updateGroups: m("fbAccounts:updateGroups"),
    updateSession: m("fbAccounts:updateSession"),
    remove: m("fbAccounts:remove"),
  },
};
