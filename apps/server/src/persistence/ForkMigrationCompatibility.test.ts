import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import { runMigrations } from "./Migrations.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layer({ filename: ":memory:" })));

layer("fork migration compatibility", (it) => {
  it.effect("reconciles reused migration 48 before later upstream migrations run", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations({ toMigrationInclusive: 47 });
      yield* sql`
        INSERT INTO effect_sql_migrations (migration_id, name)
        VALUES (48, 'ReapplyClearAutomaticProjectModelDefaults')
      `;

      yield* runMigrations();

      const migrations = yield* sql<{ readonly name: string }>`
        SELECT name
        FROM effect_sql_migrations
        WHERE migration_id = 48
      `;
      const columns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_threads)
      `;
      assert.deepStrictEqual(migrations, [{ name: "ProjectionThreadBranchPullRequest" }]);
      assert.isTrue(columns.some((column) => column.name === "branch_pull_request_json"));
    }),
  );
});
