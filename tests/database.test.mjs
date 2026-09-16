import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("migrations, RLS, submit, review, resubmit and archive", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create role supabase_admin;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb,raw_app_meta_data jsonb default '{}'::jsonb);grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const name of (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = (await readFile(`supabase/migrations/${name}`, "utf8")).replace(
      "create extension if not exists pgcrypto;",
      "",
    );
    await db.exec(sql);
  }
  await db.exec(
    `insert into public.faculties(id,code,name) values('${id(1)}','A','Khoa A'),('${id(2)}','B','Khoa B');insert into public.majors(id,faculty_id,code,name) values('${id(3)}','${id(1)}','MA','Ngành A'),('${id(4)}','${id(2)}','MB','Ngành B');`,
  );
  async function user(n, role, faculty, major) {
    await db.query(
      `insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values($1,$2,$3,$4)`,
      [
        id(n),
        `test${n}@example.test`,
        JSON.stringify({ role }),
        JSON.stringify({
          full_name: `Tài khoản ${n}`,
          faculty_id: faculty ? id(faculty) : null,
          major_id: major ? id(major) : null,
          mssv: role === "STUDENT" ? `SV000${n}` : null,
          class_name: role === "STUDENT" ? "DCT01" : null,
        }),
      ],
    );
  }
  await user(10, "STUDENT", 1, 3);
  await user(11, "FACULTY_SECRETARY", 1);
  await user(12, "FACULTY_SECRETARY", 2);
  await user(13, "SCHOOL_PRESIDENT");
  await db.exec(
    `insert into public.campaigns(id,name,academic_year,start_date,end_date,is_active) values('${id(20)}','Đợt thử nghiệm','2026-2027',now()-interval '1 day',now()+interval '1 day',true);insert into public.applications(id,campaign_id,user_id,type) values('${id(30)}','${id(20)}','${id(10)}','INDIVIDUAL');`,
  );
  await t.test(
    "migration 013 restores manager RPCs and execution permissions",
    async () => {
      await db.exec(`drop function public.finalize_review(uuid,uuid,jsonb);
      drop function public.review_application_file(uuid,uuid,public.review_action,text);
      drop function public.application_summary(uuid,uuid,uuid);`);
      const migration = await readFile(
        "supabase/migrations/202609160013_restore_manager_review_and_summary.sql",
        "utf8",
      );
      await db.exec(migration);
      await db.exec(migration);
      for (const signature of [
        "public.finalize_review(uuid,uuid,jsonb)",
        "public.review_application_file(uuid,uuid,public.review_action,text)",
        "public.application_summary(uuid,uuid,uuid)",
      ]) {
        const {
          rows: [permissions],
        } = await db.query(
          `select
        has_function_privilege('anon',$1,'EXECUTE') anon,
        has_function_privilege('authenticated',$1,'EXECUTE') authenticated,
        has_function_privilege('service_role',$1,'EXECUTE') service_role`,
          [signature],
        );
        assert.deepEqual(permissions, {
          anon: false,
          authenticated: false,
          service_role: true,
        });
      }
    },
  );
  const rpc = async (sql, args = []) => (await db.query(sql, args)).rows;
  await t.test(
    "migration 012 restores a missing submit RPC and restricts execution",
    async () => {
      await db.exec("drop function public.submit_application(uuid, uuid)");
      await assert.rejects(
        rpc("select public.submit_application($1,$2)", [id(30), id(10)]),
        (error) => error.code === "42883",
      );
      const migration = await readFile(
        "supabase/migrations/202609160012_restore_submit_application.sql",
        "utf8",
      );
      await db.exec(migration);
      await db.exec(migration); // Safe to reapply from SQL Editor.
      const [permissions] = await rpc(`select
      has_function_privilege('anon','public.submit_application(uuid,uuid)','EXECUTE') anon,
      has_function_privilege('authenticated','public.submit_application(uuid,uuid)','EXECUTE') authenticated,
      has_function_privilege('service_role','public.submit_application(uuid,uuid)','EXECUTE') service_role`);
      assert.deepEqual(permissions, {
        anon: false,
        authenticated: false,
        service_role: true,
      });
      await assert.rejects(
        rpc("select public.submit_application($1,$2)", [id(30), id(12)]),
        /APPLICATION_NOT_FOUND/,
      );
    },
  );
  await t.test("incomplete application cannot submit", () =>
    assert.rejects(
      rpc("select public.submit_application($1,$2)", [id(30), id(10)]),
      /REQUIRED_FILES_MISSING/,
    ),
  );
  await t.test(
    "legacy first-upload failure is repaired by migration 011",
    async () => {
      const legacySql = await readFile(
        "supabase/migrations/202609150004_upload_transactions.sql",
        "utf8",
      );
      await db.exec(
        legacySql.split(
          "create or replace function public.complete_upload(",
        )[0],
      );
      await assert.rejects(
        rpc(
          "select public.reserve_upload($1,$2,'EVIDENCE_DOC','test/evidence','test.docx','application/wps-office.docx',13744)",
          [id(30), id(10)],
        ),
        (error) =>
          error.code === "23502" &&
          error.message.includes("replaced_size_bytes"),
      );
      await db.exec(
        await readFile(
          "supabase/migrations/202609160011_fix_first_upload_reservation.sql",
          "utf8",
        ),
      );
      const [{ reservation }] = await rpc(
        "select public.reserve_upload($1,$2,'EVIDENCE_DOC','test/evidence','test.docx','application/wps-office.docx',13744) reservation",
        [id(30), id(10)],
      );
      const [row] = await rpc(
        "select replaced_size_bytes, expected_size_bytes from public.upload_reservations where id=$1",
        [reservation],
      );
      assert.equal(row.replaced_size_bytes, 0);
      assert.equal(row.expected_size_bytes, 13744);
      await assert.rejects(
        rpc(
          "select public.reserve_upload($1,$2,'EVIDENCE_DOC','test/evidence','test.docx','application/wps-office.docx',13744)",
          [id(30), id(10)],
        ),
        /UPLOAD_IN_PROGRESS/,
      );
      await db.query("delete from public.upload_reservations where id=$1", [
        reservation,
      ]);
    },
  );
  let firstFile;
  async function upload(category) {
    const [{ reservation }] = await rpc(
      `select public.reserve_upload($1,$2,$3,$4,'test.docx','test/type',1000) reservation`,
      [id(30), id(10), category, `test/${category}`],
    );
    const rows = await rpc(
      `select * from public.complete_upload($1,$2,1000,'test/type','etag')`,
      [reservation, id(10)],
    );
    return rows[0];
  }
  await t.test("first upload reserves zero previous bytes", async () => {
    firstFile = await upload("DECLARATION_DOC");
    assert.equal(firstFile.file_size_bytes, 1000);
  });
  await t.test("draft cannot be reviewed", () =>
    assert.rejects(
      rpc(`select public.review_application_file($1,$2,'ACCEPT','')`, [
        firstFile.id,
        id(11),
      ]),
      /REVIEW_NOT_ALLOWED/,
    ),
  );
  const evidence = await upload("EVIDENCE_DOC");
  const portrait = await upload("PORTRAIT_IMG");
  await t.test("submission becomes SUBMITTED", async () => {
    const [{ status }] = await rpc(
      "select (public.submit_application($1,$2)).status",
      [id(30), id(10)],
    );
    assert.equal(status, "SUBMITTED");
  });
  await t.test("cross faculty review is denied", () =>
    assert.rejects(
      rpc(`select public.review_application_file($1,$2,'ACCEPT','')`, [
        firstFile.id,
        id(12),
      ]),
      /CROSS_FACULTY_REVIEW_DENIED/,
    ),
  );
  await t.test("batch review is atomic on missing reason", async () => {
    await assert.rejects(
      rpc(`select public.finalize_review($1,$2,$3)`, [
        id(30),
        id(11),
        JSON.stringify([
          { fileId: firstFile.id, action: "ACCEPT", note: "" },
          { fileId: evidence.id, action: "REJECT", note: "" },
          { fileId: portrait.id, action: "ACCEPT", note: "" },
        ]),
      ]),
      /REVIEW_NOTE_REQUIRED/,
    );
    assert.equal(
      (
        await rpc(
          "select review_status from public.application_files where id=$1",
          [firstFile.id],
        )
      )[0].review_status,
      "PENDING",
    );
  });
  await rpc(`select public.finalize_review($1,$2,$3)`, [
    id(30),
    id(11),
    JSON.stringify([
      { fileId: firstFile.id, action: "ACCEPT", note: "" },
      {
        fileId: evidence.id,
        action: "REQUEST_RESUBMISSION",
        note: "Thiếu minh chứng",
      },
      { fileId: portrait.id, action: "ACCEPT", note: "" },
    ]),
  ]);
  await t.test("accepted file cannot be replaced during resubmission", () =>
    assert.rejects(upload("DECLARATION_DOC"), /FILE_NOT_REQUESTED/),
  );
  await t.test("all requested files must be replaced", () =>
    assert.rejects(
      rpc("select public.submit_application($1,$2)", [id(30), id(10)]),
      /REQUIRED_FILES_MISSING/,
    ),
  );
  await upload("EVIDENCE_DOC");
  await t.test(
    "upload preserves resubmit state until explicit submit",
    async () => {
      assert.equal(
        (
          await rpc("select status from public.applications where id=$1", [
            id(30),
          ])
        )[0].status,
        "RESUBMIT_REQUIRED",
      );
      assert.equal(
        (
          await rpc("select (public.submit_application($1,$2)).status", [
            id(30),
            id(10),
          ])
        )[0].status,
        "RESUBMITTED",
      );
    },
  );
  await rpc(`select public.finalize_review($1,$2,$3)`, [
    id(30),
    id(11),
    JSON.stringify(
      [firstFile, evidence, portrait].map((f) => ({
        fileId: f.id,
        action: "ACCEPT",
        note: "",
      })),
    ),
  ]);
  await t.test("all accepted files approve application", async () =>
    assert.equal(
      (
        await rpc("select status from public.applications where id=$1", [
          id(30),
        ])
      )[0].status,
      "APPROVED",
    ),
  );
  await t.test("RLS hides other faculty students and files", async () => {
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${id(12)}',false);`,
    );
    assert.equal((await rpc("select * from public.applications")).length, 0);
    assert.equal(
      (await rpc("select * from public.application_files")).length,
      0,
    );
    await db.exec("reset role");
  });
  await t.test("reporting respects faculty scope", async () => {
    const [{ summary }] = await rpc(
      "select public.application_summary($1,$2,null) summary",
      [id(20), id(12)],
    );
    assert.equal(summary.totalSubmitted, 0);
  });
  await db.exec(
    `update public.campaigns set is_active=false,start_date=now()-interval '2 days',end_date=now()-interval '1 day' where id='${id(20)}';`,
  );
  const [{ job }] = await rpc(
    "select public.queue_campaign_export($1,$2) job",
    [id(20), id(13)],
  );
  await t.test("export locks application mutation", () =>
    assert.rejects(
      rpc(`update public.applications set status='SUBMITTED' where id=$1`, [
        id(30),
      ]),
      /CAMPAIGN_LOCKED_FOR_EXPORT/,
    ),
  );
  await t.test(
    "purge requires completed export and verified email challenge",
    () =>
      assert.rejects(
        rpc("select public.purge_verified_campaign($1,$2,$3)", [
          id(20),
          id(13),
          id(99),
        ]),
        /OTP_INVALID/,
      ),
  );
  await rpc(
    `update public.campaign_exports set status='READY',manifest_r2_key='exports/manifest',archive_r2_key='exports/zip' where id=$1`,
    [job.id],
  );
  const [{ challenge }] = await rpc(
    `select public.create_security_challenge($1,'PURGE_CAMPAIGN',$2) challenge`,
    [id(13), id(20)],
  );
  await rpc(
    `update public.security_challenges set code_hash='VERIFIED' where id=$1`,
    [challenge],
  );
  await t.test(
    "purge keeps statistics and schedules storage cleanup",
    async () => {
      await rpc("select public.purge_verified_campaign($1,$2,$3)", [
        id(20),
        id(13),
        challenge,
      ]);
      assert.equal((await rpc("select * from public.applications")).length, 0);
      assert.equal(
        (await rpc("select total_approved from public.campaign_statistics"))[0]
          .total_approved,
        1,
      );
      assert.equal(
        (await rpc("select cleanup_status from public.campaign_exports"))[0]
          .cleanup_status,
        "PENDING",
      );
    },
  );
  await t.test("OTP cannot be replayed", () =>
    assert.rejects(
      rpc("select public.purge_verified_campaign($1,$2,$3)", [
        id(20),
        id(13),
        challenge,
      ]),
      /OTP_INVALID/,
    ),
  );
  await db.close();
});
