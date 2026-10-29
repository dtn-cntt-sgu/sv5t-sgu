import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(
  new URL("../../app/api/v1/admin/users/[id]/email/route.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const id = "00000000-0000-4000-8000-000000000001";

function setup(options = {}) {
  const calls = { auth: [], audits: [], availability: [], apiErrors: [] };
  const availability = [...(options.availability ?? [true])];
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: options.missing
              ? null
              : {
                  id,
                  role: options.role ?? "STUDENT",
                  email: "old@example.com",
                },
            error: null,
          }),
          single: async () => ({
            data: { email: options.profileEmail ?? "new@example.com" },
            error: null,
          }),
        }),
      }),
    }),
    rpc: async (name, args) => {
      if (name === "admin_email_sync_ready")
        return { data: options.ready ?? true, error: null };
      assert.equal(name, "admin_email_available");
      calls.availability.push(args);
      const next = availability.shift();
      return next && typeof next === "object"
        ? next
        : { data: next, error: null };
    },
    auth: {
      admin: {
        updateUserById: async (...args) => {
          calls.auth.push(args);
          return {
            data: { user: { email: options.authEmail ?? "new@example.com" } },
            error: options.authError ?? null,
          };
        },
      },
    },
  };
  const imports = {
    zod: require("zod"),
    "@/lib/auth/require-user": {
      requireUser: async () => {
        if (options.denied) throw new Error("FORBIDDEN");
        return {
          id: "00000000-0000-4000-8000-000000000009",
          role: "SUPER_ADMIN",
        };
      },
    },
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/admin/audit": {
      audit: async (...args) => {
        calls.audits.push(args);
        if (options.auditFailure) throw new Error("AUDIT_UNAVAILABLE");
      },
    },
    "@/lib/api/response": {
      ok: (data) => Response.json({ data }),
      apiError: (error, context) => {
        calls.apiErrors.push({ error, context });
        return Response.json(
          { error: { code: "INTERNAL_ERROR", requestId: context?.requestId } },
          { status: options.denied ? 403 : 500 },
        );
      },
    },
  };
  const mod = { exports: {} };
  new Function("require", "exports", "module", compiled)(
    (name) => {
      assert.ok(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    },
    mod.exports,
    mod,
  );
  return {
    calls,
    run: (input = { email: " NEW@EXAMPLE.COM ", emailChangeEnabled: true }) =>
      mod.exports.PUT(
        new Request("https://example.com/api/v1/admin/users/target/email", {
          method: "PUT",
          body: JSON.stringify(input),
        }),
        { params: Promise.resolve({ id }) },
      ),
  };
}

test("Auth-only duplicate returns 409 before mutation or audit", async () => {
  const { run, calls } = setup({ availability: [false] });
  const response = await run();
  assert.equal(response.status, 409);
  const { error } = await response.json();
  assert.equal(error.code, "EMAIL_EXISTS");
  assert.ok(error.requestId);
  assert.match(error.message, /chưa hoàn tất đăng ký/);
  assert.equal(calls.auth.length, 0);
  assert.equal(calls.audits.length, 0);
  assert.deepEqual(calls.availability, [
    { target_user_id: id, requested_email: "new@example.com" },
  ]);
});

test("a race returning Auth 500 without a code is reclassified as an email conflict", async () => {
  const { run, calls } = setup({
    availability: [true, false],
    authError: {
      name: "AuthRetryableFetchError",
      status: 500,
      message: "Error updating user",
    },
  });
  const response = await run();
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "EMAIL_EXISTS");
  assert.equal(calls.auth.length, 1);
  assert.equal(calls.audits.length, 1);
  assert.equal(calls.apiErrors.length, 0);
});

test("successful update confirms Auth and profile before reporting success", async () => {
  const { run, calls } = setup();
  const response = await run();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: { email: "new@example.com" },
  });
  assert.deepEqual(calls.auth, [
    [id, { email: "new@example.com", email_confirm: true }],
  ]);
  assert.equal(calls.audits.length, 2);
  assert.equal(calls.audits[0][3].requestId, calls.audits[1][3].requestId);
});

test("an unrelated Auth 500 stays a server error with sanitized diagnostics", async () => {
  const { run, calls } = setup({
    availability: [true, true],
    authError: {
      name: "AuthRetryableFetchError",
      status: 500,
      code: undefined,
      message: "Failure for private@example.com",
    },
  });
  assert.equal((await run()).status, 500);
  assert.equal(calls.apiErrors[0].error.code, "UNEXPECTED");
  assert.equal(calls.apiErrors[0].error.message, "Failure for [email]");
  assert.equal(calls.apiErrors[0].context.stage, "update_auth_email");
  assert.equal(calls.apiErrors[0].context.status, 500);
  assert.equal(calls.audits.length, 1);
});

test("missing availability migration fails closed with a 503 and request ID", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const { run, calls } = setup({
      availability: [
        {
          data: null,
          error: { code: "PGRST202", message: "Function missing" },
        },
      ],
    });
    const response = await run();
    assert.equal(response.status, 503);
    const { error } = await response.json();
    assert.equal(error.code, "EMAIL_DATABASE_UNAVAILABLE");
    assert.ok(error.requestId);
    assert.equal(calls.auth.length, 0);
  } finally {
    console.error = original;
  }
});

test("a failed recheck never converts an unrelated Auth failure to a conflict", async () => {
  const { run, calls } = setup({
    availability: [true, { data: null, error: { code: "08006" } }],
    authError: { status: 500, message: "Error updating user" },
  });
  assert.equal((await run()).status, 500);
  assert.equal(calls.apiErrors[0].context.stage, "update_auth_email");
});

test("profile sync mismatch does not report a successful change", async () => {
  const { run, calls } = setup({ profileEmail: "old@example.com" });
  assert.equal((await run()).status, 500);
  assert.equal(calls.apiErrors[0].error.message, "EMAIL_PROFILE_SYNC_FAILED");
  assert.equal(calls.audits.length, 1);
});

test("authorization, validation and target protection stop before Auth writes", async () => {
  for (const options of [
    { denied: true },
    { role: "SUPER_ADMIN" },
    { missing: true },
    { ready: false },
  ]) {
    const { run, calls } = setup(options);
    assert.ok((await run()).status >= 400);
    assert.equal(calls.auth.length, 0);
    assert.equal(calls.audits.length, 0);
  }
  const { run, calls } = setup();
  assert.ok(
    (await run({ email: "new@example.com", emailChangeEnabled: false }))
      .status >= 400,
  );
  assert.equal(calls.auth.length, 0);
});

test("the mandatory request audit must succeed before updating Auth", async () => {
  const { run, calls } = setup({ auditFailure: true });
  assert.equal((await run()).status, 500);
  assert.equal(calls.auth.length, 0);
  assert.equal(calls.apiErrors[0].context.stage, "audit_requested");
});
