import { Column }   from '@itrocks/schema'
import { Index }    from '@itrocks/schema'
import { Table }    from '@itrocks/schema'

type SchemaElement = Column | Index
type SchemaElementPair = { source: Column, target: Column } | { source: Index, target: Index }
type TableChange = { collation: boolean, engine: boolean, name: boolean }

export class TableDiff
{
	additions = new Array<SchemaElement>()
	changes   = new Array<SchemaElementPair>()
	deletions = new Array<SchemaElement>()
	unchanged = new Array<SchemaElement>()

	constructor(
		public source: Table,
		public target: Table
	) {
		const keepColumns:   Record<string, true>   = {}
		const sourceColumns: Record<string, Column> = {}

		for (const sourceColumn of source.columns) {
			sourceColumns[sourceColumn.name] = sourceColumn
		}

		for (const targetColumn of target.columns) {
			let sourceColumn: Column | undefined = sourceColumns[targetColumn.name]
			if (!sourceColumn) {
				for (const formerName of targetColumn.formerNames) {
					if (sourceColumn ||= sourceColumns[formerName]) break
				}
			}
			if (!sourceColumn) {
				this.additions.push(targetColumn)
				continue
			}
			keepColumns[sourceColumn.name] = true
			if (this.columnChanges(sourceColumn, targetColumn)) {
				this.changes.push({ source: sourceColumn, target: targetColumn })
			}
			else {
				this.unchanged.push(targetColumn)
			}
		}

		for (const sourceColumn of source.columns) {
			if (keepColumns[sourceColumn.name]) continue
			this.deletions.push(sourceColumn)
		}

		const keepIndexes:   Record<string, true>   = {}
		const sourceIndexes: Record<string, Index>  = {}

		for (const sourceIndex of source.indexes) {
			sourceIndexes[sourceIndex.name] = sourceIndex
		}

		for (const targetIndex of target.indexes) {
			let sourceIndex: Index | undefined = sourceIndexes[targetIndex.name]
			if (sourceIndex) {
				keepIndexes[sourceIndex.name] = true
				if (this.indexChanges(sourceIndex, targetIndex)) {
					this.changes.push({ source: sourceIndex, target: targetIndex })
				}
				else {
					this.unchanged.push(targetIndex)
				}
				continue
			}
			this.additions.push(targetIndex)
		}

		for (const sourceIndex of source.indexes) {
			if (keepIndexes[sourceIndex.name]) continue
			this.deletions.push(sourceIndex)
		}
	}

	columnChanges(source: Column, target: Column): boolean
	{
		if (
			source.name                   !== target.name
			|| source.autoIncrement       !== target.autoIncrement
			|| source.canBeNull           !== target.canBeNull
			|| source.default?.toString() !== target.default?.toString()
		) {
			return true
		}
		const sourceType = source.type
		const targetType = target.type
		return sourceType.collate      !== targetType.collate
			|| sourceType.length         !== targetType.length
			|| sourceType.name           !== targetType.name
			|| sourceType.precision      !== targetType.precision
			|| sourceType.signed         !== targetType.signed
			|| sourceType.variableLength !== targetType.variableLength
			|| sourceType.zeroFill       !== targetType.zeroFill
	}

	indexChanges(source: Index, target: Index): boolean
	{
		if (
			source.keys.length !== target.keys.length
			|| source.name     !== target.name
			|| source.type     !== target.type
			|| source.unique   !== target.unique
		) {
			return true
		}
		for (let position = 0; position < source.keys.length; position++) {
			const sourceKey = source.keys[position]
			const targetKey = target.keys[position]
			if (
				sourceKey.columnName !== targetKey.columnName
				|| sourceKey.length !== targetKey.length
			) {
				return true
			}
		}
		return false
	}

	tableChanges(): TableChange | false
	{
		const source = this.source
		const target = this.target
		const change: TableChange = {
			collation: source.collation !== target.collation,
			engine:    source.engine    !== target.engine,
			name:      source.name      !== target.name
		}
		return (change.collation || change.engine || change.name) ? change : false
	}

}
