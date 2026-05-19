export default function DataTable({ columns, rows, empty = 'Belum ada data', actions }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-brand-50/60">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left font-semibold text-slate-600">
                  {column.label}
                </th>
              ))}
              {actions ? <th className="px-4 py-3 text-right font-semibold text-slate-600">Aksi</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.length ? (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 text-slate-700">
                      {column.render ? column.render(row) : row[column.key] ?? '-'}
                    </td>
                  ))}
                  {actions ? <td className="px-4 py-3 text-right">{actions(row)}</td> : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-8 text-center text-slate-500">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
