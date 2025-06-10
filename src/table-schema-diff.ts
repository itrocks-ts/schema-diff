import { Column } from '@itrocks/table-schema'
import { Table }  from '@itrocks/table-schema'

export class TableSchemaDiff
{
	additions = new Array<Column>()
	changes   = new Array<{ source: Column, target: Column }>()
	deletions = new Array<Column>()
	unchanged = new Array<Column>()

	constructor(
		public source: Table,
		public target: Table
	) {
		const keepColumns:   Record<string, true> = {}
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
			if (sourceColumn) {
				keepColumns[sourceColumn.name] = true
				if (this.columnChanges(sourceColumn, targetColumn)) {
					this.changes.push({ source: sourceColumn, target: targetColumn })
				}
				else {
					this.unchanged.push(targetColumn)
				}
				continue
			}
			this.additions.push(targetColumn)
		}

		for (const sourceColumn of source.columns) {
			if (keepColumns[sourceColumn.name]) continue
			this.deletions.push(sourceColumn)
		}
	}

	columnChanges(source: Column, target: Column): boolean
	{
		if (
			source.autoIncrement !== target.autoIncrement
			|| source.canBeNull !== target.canBeNull
			|| source.default?.toString() !== target.default?.toString()
		) {
			return true
		}
		const sourceType = source.type
		const targetType = target.type
		return sourceType.length       !== targetType.length
			|| sourceType.name           !== targetType.name
			|| sourceType.precision      !== targetType.precision
			|| sourceType.signed         !== targetType.signed
			|| sourceType.variableLength !== targetType.variableLength
			|| sourceType.zeroFill       !== targetType.zeroFill
	}

}
