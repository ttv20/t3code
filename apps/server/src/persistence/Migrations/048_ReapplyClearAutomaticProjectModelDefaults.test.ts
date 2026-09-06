import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import { runMigrations } from "../Migrations.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("048_ReapplyClearAutomaticProjectModelDefaults", (it) => {
  it.effect("runs the upstream correction after a local BTW migration used ID 44", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations({ toMigrationInclusive: 43 });
      yield* sql`
        INSERT INTO effect_sql_migrations (migration_id, name)
        VALUES (44, 'BtwConversations')
      `;

      yield* runMigrations({ toMigrationInclusive: 48 });

      const migrations = yield* sql<{
        readonly migrationId: number;
        readonly name: string;
      }>`
        SELECT migration_id AS "migrationId", name
        FROM effect_sql_migrations
        WHERE migration_id IN (44, 48)
        ORDER BY migration_id
      `;
      assert.deepStrictEqual(migrations, [
        { migrationId: 44, name: "BtwConversations" },
        { migrationId: 48, name: "ReapplyClearAutomaticProjectModelDefaults" },
      ]);
    }),
  );
});
