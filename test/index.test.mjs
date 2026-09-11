import assert        from 'node:assert/strict'
import test          from 'node:test'
import { Index }     from '@itrocks/schema'
import { IndexKey }  from '@itrocks/schema'
import { Table }     from '@itrocks/schema'
import { TableDiff } from '../cjs/schema-diff.js'

function index(keys, init)
{
	return new Index('record_identity', keys.map(key => new IndexKey(key)), init)
}

test('TableDiff detects an index type change independently', function()
{
	const source = new Table('record', {
		indexes: [index(['tenant_id', 'code'], { type: 'key', unique: false })]
	})
	const target = new Table('record', {
		indexes: [index(['tenant_id', 'code'], { type: 'unique', unique: false })]
	})

	const diff = new TableDiff(source, target)

	assert.equal(diff.changes.length, 1)
	assert.deepEqual(diff.changes[0], { source: source.indexes[0], target: target.indexes[0] })
})

test('TableDiff detects a unique flag change independently', function()
{
	const source = new Table('record', {
		indexes: [index(['tenant_id', 'code'], { type: 'key', unique: false })]
	})
	const target = new Table('record', {
		indexes: [index(['tenant_id', 'code'], { type: 'key', unique: true })]
	})

	assert.equal(new TableDiff(source, target).changes.length, 1)
})

test('TableDiff preserves the order of composite index keys', function()
{
	const definition = { type: 'unique', unique: true }
	const source     = new Table('record', {
		indexes: [index(['code', 'tenant_id'], definition)]
	})
	const target     = new Table('record', {
		indexes: [index(['tenant_id', 'code'], definition)]
	})

	assert.equal(new TableDiff(source, target).changes.length, 1)
	assert.equal(new TableDiff(target, target).unchanged.length, 1)
})
