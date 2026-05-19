import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import { listClassOptions, listStudents } from '../../services/masterDataService';

export default function QrCodesPage() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [classId, setClassId] = useState('');
  const baseUrl = useMemo(() => window.location.origin, []);

  useEffect(() => {
    Promise.all([listClassOptions(), listStudents({ activeOnly: true })]).then(([classRows, studentRows]) => {
      setClasses(classRows);
      setStudents(studentRows);
      setClassId(classRows[0]?.id || '');
    });
  }, []);

  const filtered = students.filter((student) => !classId || student.current_class_id === classId);

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <select className="rounded-md border px-3 py-2" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Semua kelas</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 font-semibold text-white" onClick={() => window.print()}>
          <Printer size={16} /> Cetak QR
        </button>
      </div>
      <div className="print-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((student) => {
          const url = `${baseUrl}/scan/siswa/${student.id}`;
          return (
            <div key={student.id} className="break-inside-avoid rounded-lg border border-slate-300 bg-white p-4 text-center">
              <p className="font-semibold text-slate-900">{student.name}</p>
              <p className="mb-3 text-sm text-slate-500">{student.current_class?.name} | {student.nis}</p>
              <div className="inline-flex rounded-md bg-white p-2">
                <QRCodeSVG value={url} size={156} level="H" includeMargin />
              </div>
              <p className="mt-2 text-[10px] text-slate-400">{url}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
