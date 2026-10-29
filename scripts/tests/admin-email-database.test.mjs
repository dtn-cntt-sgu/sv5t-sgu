import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const target = "00000000-0000-4000-8000-000000000001";
const orphan = "00000000-0000-4000-8000-000000000002";
const profileOnly = "00000000-0000-4000-8000-000000000003";

test("email availability includes Auth-only accounts and preserves atomic email updates", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email text);
      create unique index users_email_partial_key on auth.users(lower(email)) where email is not null;
      create table public.users(id uuid primary key, email text unique not null);
      insert into auth.users values
        ('${target}', 'old@example.com'), ('${orphan}', 'taken@example.com');
      insert into public.users values
        ('${target}', 'old@example.com'), ('${profileOnly}', 'profile@example.com');
    `);
    for (const filename of [
      "202609220018_sync_auth_email.sql",
      "202610290024_admin_email_availability.sql",
      "202610290024_admin_email_availability.sql",
    ]) {
      await db.exec(
        await readFile(
          new URL(`../../supabase/migrations/${filename}`, import.meta.url),
          "utf8",
        ),
      );
    }
    const available = async (email, user = target) =>
      (
        await db.query(
          "select public.admin_email_available($1, $2) as available",
          [user, email],
        )
      ).rows[0].available;
    assert.equal(await available("taken@example.com"), false);
    assert.equal(await available(" TAKEN@EXAMPLE.COM "), false);
    assert.equal(await available("profile@example.com"), false);
    assert.equal(await available("old@example.com"), true);
    assert.equal(await available("new@example.com"), true);
    assert.equal(await available(""), false);
    assert.equal(await available(null), false);
    assert.equal(await available("new@example.com", null), false);

    // Reproduce production: Auth's unique index rejects an Auth-only duplicate.
    await assert.rejects(
      db.query("update auth.users set email = $1 where id = $2", [
        "taken@example.com",
        target,
      ]),
      (error) =>
        error.code === "23505" &&
        error.message.includes("users_email_partial_key"),
    );
    assert.deepEqual(
      (
        await db.query(
          "select email from auth.users where id = $1 union all select email from public.users where id = $1",
          [target],
        )
      ).rows,
      [{ email: "old@example.com" }, { email: "old@example.com" }],
    );

    // Profile-side failure must roll back the Auth email in the same transaction.
    await assert.rejects(
      db.query("update auth.users set email = $1 where id = $2", [
        "profile@example.com",
        target,
      ]),
      (error) => error.code === "23505",
    );
    assert.equal(
      (await db.query("select email from auth.users where id = $1", [target]))
        .rows[0].email,
      "old@example.com",
    );
    await db.query("update auth.users set email = $1 where id = $2", [
      "new@example.com",
      target,
    ]);
    assert.deepEqual(
      (
        await db.query(
          "select email from auth.users where id = $1 union all select email from public.users where id = $1",
          [target],
        )
      ).rows,
      [{ email: "new@example.com" }, { email: "new@example.com" }],
    );

    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        () => available("taken@example.com"),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    assert.equal(await available("taken@example.com"), false);
    await assert.rejects(
      () => db.query("select * from auth.users"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
