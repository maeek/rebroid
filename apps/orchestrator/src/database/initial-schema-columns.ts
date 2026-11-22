export const idColumn = { name: 'id', type: 'varchar', isPrimary: true };
export const createdAtColumn = {
  name: 'createdAt',
  type: 'datetime',
  default: "datetime('now')",
};
export const timestampColumns = [
  createdAtColumn,
  { ...createdAtColumn, name: 'updatedAt' },
];
