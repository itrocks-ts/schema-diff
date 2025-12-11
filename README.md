[![npm version](https://img.shields.io/npm/v/@itrocks/schema-diff?logo=npm)](https://www.npmjs.org/package/@itrocks/schema-diff)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/schema-diff)](https://www.npmjs.org/package/@itrocks/schema-diff)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/schema-diff?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/schema-diff)
[![issues](https://img.shields.io/github/issues/itrocks-ts/schema-diff)](https://github.com/itrocks-ts/schema-diff/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# schema-diff

Compares two table schemas and returns their differences as a structured object.

*This documentation was written by an artificial intelligence and may contain errors or approximations.
It has not yet been fully reviewed by a human. If anything seems unclear or incomplete,
please feel free to contact the author of this package.*

## Installation

```bash
npm i @itrocks/schema-diff
```

## Usage

`@itrocks/schema-diff` focuses on a single job: comparing two table
schemas represented as `Table` instances from `@itrocks/schema`.

The main entry point is the `TableDiff` class. You construct it with a
source schema (usually the current database table) and a target schema
(usually the desired model), then inspect its properties to know which
columns and indexes must be added, changed, or removed.

### Minimal example

```ts
import type { Table }   from '@itrocks/schema'
import { TableDiff }    from '@itrocks/schema-diff'

function logTableChanges(source: Table, target: Table) {
  const diff = new TableDiff(source, target)

  console.log('Additions:',  diff.additions)
  console.log('Changes:',    diff.changes)
  console.log('Deletions:',  diff.deletions)
  console.log('Unchanged:',  diff.unchanged)
  console.log('Table props:', diff.tableChanges())
}
```

In practice, you will often build the `Table` instances using other
`@itrocks/*` utilities such as `@itrocks/mysql-to-schema` (to read an
existing database) and `@itrocks/reflect-to-schema` (to derive the
schema from your TypeScript model).

### Complete example: comparing database schema to application model

The snippet below shows how `TableDiff` can be combined with a higher
level utility (here `@itrocks/schema-diff-mysql`) to generate SQL that
updates a MariaDB/MySQL table so it matches your application model.

```ts
import mariadb                              from 'mariadb'
import type { Connection }                  from 'mariadb'
import { MysqlToTable }                     from '@itrocks/mysql-to-schema'
import { ReflectToTable }                   from '@itrocks/reflect-to-schema'
import { TableDiff }                        from '@itrocks/schema-diff'
import { SchemaDiffMysql }                  from '@itrocks/schema-diff-mysql'

class User {
  id!: number
  email!: string
}

async function synchronizeUserTable(connection: Connection) {
  const tableName = 'user'

  // Schema from the database
  const mysqlToTable   = new MysqlToTable(connection)
  const existingSchema = await mysqlToTable.convert(tableName)
  mysqlToTable.normalize(existingSchema)

  // Schema from the TypeScript model
  const reflectToTable = new ReflectToTable()
  const targetSchema   = reflectToTable.convert(User)

  // Compute the diff and translate it to SQL
  const diff        = new TableDiff(existingSchema, targetSchema)
  const diffToMysql = new SchemaDiffMysql()
  const sql         = diffToMysql.sql(diff, /* allowDeletions */ false)

  if (sql.trim()) {
    await connection.query(sql)
  }
}

async function main() {
  const pool = mariadb.createPool({
    host:     'localhost',
    user:     'root',
    password: 'secret',
    database: 'my_app',
  })

  const connection = await pool.getConnection()
  try {
    await synchronizeUserTable(connection)
  }
  finally {
    connection.release()
    await pool.end()
  }
}

main().catch(console.error)
```

`TableDiff` itself is independent from any specific database engine. It
only works on `Table`, `Column`, and `Index` objects from
`@itrocks/schema`. Other packages, such as `@itrocks/schema-diff-mysql`,
are responsible for turning a `TableDiff` into SQL or another
representation.

## API

### `class TableDiff`

Core class of the package. Compares two table schemas and exposes their
differences as structured properties.

`TableDiff` works with the `Table`, `Column`, and `Index` types provided
by `@itrocks/schema`.

#### Constructor

```ts
new TableDiff(source: Table, target: Table)
```

Creates a diff between a `source` table (current state) and a `target`
table (desired state).

##### Parameters

- `source: Table` – original table definition.
- `target: Table` – target table definition you want to reach.

The constructor immediately computes the diff and fills the public
properties described below.

#### Properties

All properties are public and can be read directly.

- `source: Table` – the source table passed to the constructor.
- `target: Table` – the target table passed to the constructor.
- `additions: (Column | Index)[]` – elements **present only in the
  target** table. These typically correspond to columns or indexes to
  create.
- `changes: { source: Column; target: Column } | { source: Index;
  target: Index }[]` – pairs of elements that exist in both tables but
  differ in at least one significant property (type, length, nullability,
  index keys, etc.).
- `deletions: (Column | Index)[]` – elements **present only in the
  source** table. These usually represent columns or indexes that should
  be dropped if you allow deletions.
- `unchanged: (Column | Index)[]` – elements that are identical in both
  `source` and `target`.

#### Methods

##### `columnChanges(source: Column, target: Column): boolean`

Low-level helper used internally by the constructor.

Returns `true` if the two column definitions differ on one of the
following aspects, `false` otherwise:

- column name;
- `autoIncrement` flag;
- nullability;
- default value (compared as strings);
- type properties such as `name`, `length`, `precision`, `collate`,
  `signed`, `variableLength`, `zeroFill`.

Although it is primarily intended for internal use, you can call this
method yourself if you need to check whether two `Column` instances are
considered different by `TableDiff`.

##### `indexChanges(source: Index, target: Index): boolean`

Returns `true` if two `Index` definitions are considered different. The
comparison takes into account:

- index name;
- number of keys;
- set of key column names;
- key lengths (per column).

Again, this is mainly an internal helper, but it can be useful if you
need a standalone index comparison function.

##### `tableChanges(): TableChange | false`

Summarizes table-level differences (as opposed to column or index
changes).

Returns either:

- a `TableChange` object of shape
  `{ collation: boolean; engine: boolean; name: boolean }` where each
  flag indicates whether the corresponding property differs between
  `source` and `target`;
- or `false` if the table name, collation, and engine are all
  identical.

You can use this to decide whether you need to generate statements such
as `ALTER TABLE ... RENAME`, `ALTER TABLE ... ENGINE=...` or
`ALTER TABLE ... COLLATE=...`.

## Typical use cases

- **Schema migration preview** – compute a diff between the current
  database table (read using `@itrocks/mysql-to-schema`) and the desired
  model table (generated with `@itrocks/reflect-to-schema`) to preview
  which columns and indexes would be added, changed, or removed.
- **Automatic migration SQL generation** – pass a `TableDiff` instance
  to `@itrocks/schema-diff-mysql` (or a similar adapter) to generate
  `ALTER TABLE` statements that keep your database schema in sync with
  your application model.
- **Custom migration tools** – build your own schema migration or
  synchronization scripts by inspecting `additions`, `changes`, and
  `deletions` and turning them into SQL for your database.
- **Validation and reporting** – use `TableDiff` in tooling that checks
  for unintended schema drift between environments (for example,
  comparing production and staging schemas and reporting differences).
