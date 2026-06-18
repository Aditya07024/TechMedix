import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const sql = postgres(connectionString, {
  ssl: "require",
  prepare: false,
});

async function run() {
  console.log("Checking active database sessions and locks...");
  try {
    const activity = await sql`
      SELECT pid, query, state, age(clock_timestamp(), query_start) AS age, wait_event_type, wait_event
      FROM pg_stat_activity
      WHERE state != 'idle' AND pid != pg_backend_pid();
    `;
    console.log("--- Active Activities ---");
    console.log(JSON.stringify(activity, null, 2));

    const locks = await sql`
      SELECT 
        coalesce(blockingl.relation::regclass::text,blockingl.locktype) as locked_item,
        blockeda.pid as blocked_pid,
        blockeda.query as blocked_query,
        blockedl.mode as blocked_mode,
        blockinga.pid as blocking_pid,
        blockinga.query as blocking_query,
        blockingl.mode as blocking_mode
      FROM pg_catalog.pg_locks blockedl
      JOIN pg_catalog.pg_stat_activity blockeda ON blockeda.pid = blockedl.pid
      JOIN pg_catalog.pg_locks blockingl 
        ON blockingl.pid != blockedl.pid
        AND (
          (blockingl.locktype = 'relation' AND blockingl.relation = blockedl.relation)
          OR (blockingl.locktype = 'transactionid' AND blockingl.transactionid = blockedl.transactionid)
        )
      JOIN pg_catalog.pg_stat_activity blockinga ON blockinga.pid = blockingl.pid
      WHERE NOT blockedl.granted;
    `;
    console.log("--- Active Locks/Blocking Queries ---");
    console.log(JSON.stringify(locks, null, 2));
    
  } catch (err) {
    console.error("Failed to check locks:", err.message);
  } finally {
    await sql.end();
  }
}

run();
