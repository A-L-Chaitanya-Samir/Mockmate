// Verify an upgrade of populated accounts, independently of the API test database.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = await PGlite.create();
try {
  await db.exec(await readFile("backend/tests/bootstrap.sql", "utf8"));
  const migrations = (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort();
  await db.exec(await readFile(`supabase/migrations/${migrations[0]}`, "utf8"));
  for (const [index, plan] of ["free", "pro"].entries()) {
    const user = `11111111-1111-4111-8111-11111111111${index}`;
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [user]);
    await db.query("INSERT INTO profiles(id,user_id,data) VALUES($1,$1,$2)", [
      user,
      { name: `Existing ${index}`, reminders: false },
    ]);
    await db.query("INSERT INTO entitlements(user_id,plan) VALUES($1,$2)", [
      user,
      plan,
    ]);
    await db.query(
      "INSERT INTO resumes(id,user_id,filename,storage_path,sha256,status) VALUES($1,$1,'saved.pdf',$2,'hash','ready')",
      [user, `${user}/${user}.pdf`],
    );
    await db.query(
      "INSERT INTO resume_analyses(user_id,resume_id,version,result,model) VALUES($1,$1,1,$2,'saved-model')",
      [user, { score: 81 }],
    );
    await db.query(
      "INSERT INTO interview_sessions(id,user_id,config,status) VALUES($1,$1,$2,'completed')",
      [user, { mode: "Text", role: "Engineer" }],
    );
    await db.query(
      "INSERT INTO questions(id,user_id,session_id,position,prompt,topic) VALUES($1,$1,$1,0,'Saved question','Design')",
      [user],
    );
    await db.query(
      "INSERT INTO answers(user_id,session_id,question_id,text,idempotency_key) VALUES($1,$1,$1,'Saved private answer','answer')",
      [user],
    );
    await db.query(
      "INSERT INTO interview_reports(user_id,session_id,result,model) VALUES($1,$1,$2,'saved-model')",
      [user, { overall: 87 }],
    );
    await db.query(
      "INSERT INTO usage_reservations(user_id,kind,idempotency_key,resource_id,state) VALUES($1,'interview','existing',$1,'consumed')",
      [user],
    );
    await db.query(
      "INSERT INTO jobs(user_id,resource_id,kind,idempotency_key,status) VALUES($1,$1,'evaluate','saved-job','succeeded')",
      [user],
    );
    await db.query(
      "INSERT INTO api_rate_limits(user_id,minute,count) VALUES($1,date_trunc('minute',now()),10)",
      [user],
    );
  }
  const tables = [
    "profiles",
    "resumes",
    "resume_analyses",
    "interview_sessions",
    "questions",
    "answers",
    "interview_reports",
    "usage_reservations",
    "jobs",
    "api_rate_limits",
    "auth.users",
    "storage.buckets",
  ];
  const snapshot = async () =>
    Object.fromEntries(
      await Promise.all(
        tables.map(async (table) => [
          table,
          (await db.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
        ]),
      ),
    );
  const before = await snapshot();
  for (const name of migrations.slice(1))
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  const after = await snapshot();
  assert.equal((await db.query("SELECT count(*)::int n FROM usage_windows")).rows[0].n, 0,
    "Lifetime history must not start a daily window");
  assert.equal((await db.query("SELECT count(*)::int n FROM usage_attempts")).rows[0].n, 0,
    "Lifetime history must not consume daily capacity");
  for (const table of ["usage_windows", "usage_attempts"]) {
    assert.equal((await db.query(`SELECT has_table_privilege('anon','public.${table}','SELECT') OR has_table_privilege('authenticated','public.${table}','SELECT') exposed`)).rows[0].exposed, false);
  }
  const retained = Object.fromEntries(Object.entries(before).map(([table, rows]) => [table,
    after[table].map((row, index) => Object.fromEntries(Object.keys(rows[index]).map(key => [key, row[key]]))),
  ]));
  assert.deepEqual(
    retained,
    before,
    "Every retained row must survive the upgrade unchanged",
  );
  assert.equal((await db.query("SELECT bool_and(modality='text' AND transcription_id IS NULL) preserved FROM answers")).rows[0].preserved, true);
  assert.equal(
    (await db.query("SELECT to_regclass('public.entitlements') AS retired"))
      .rows[0].retired,
    null,
  );
  assert.equal(
    (await db.query("SELECT public FROM storage.buckets WHERE id='resumes'"))
      .rows[0].public,
    false,
  );
  assert.equal(
    (
      await db.query(
        "SELECT bool_and(relrowsecurity) AS enabled FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'",
      )
    ).rows[0].enabled,
    true,
  );
  console.log(
    "Migration upgrade passed: legacy accounts, private storage, RLS and all retained rows preserved.",
  );
} finally {
  await db.close();
}
