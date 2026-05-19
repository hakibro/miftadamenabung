import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function downloadImportTemplate(type) {
  const samples = {
    users: [{ name: 'Siti Aminah', email: 'walas1@example.com', role: 'walas', class_name: '1A' }],
    classes: [{ name: '1A', grade: 1, period_name: '2026/2027', homeroom_email: 'walas1@example.com' }],
    students: [{ name: 'Ahmad Fauzan', nis: '26001', gender: 'L', grade: 1, class_name: '1A', note: 'Siswa baru' }],
  };
  const worksheet = XLSX.utils.json_to_sheet(samples[type] || samples.students);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'template');
  XLSX.writeFile(workbook, `template-import-${type}.xlsx`);
}

export function exportExcel(rows, filename = 'export.xlsx') {
  const worksheet = XLSX.utils.json_to_sheet(rows || []);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'data');
  XLSX.writeFile(workbook, filename);
}

export function validateImportRows(type, rows) {
  const errors = [];
  rows.forEach((row, index) => {
    if (!row.name && !row.nama) errors.push(`Baris ${index + 2}: nama wajib diisi`);
    if (type === 'students' && !(row.nis || row.NIS)) errors.push(`Baris ${index + 2}: NIS wajib diisi`);
    if (type === 'students' && !(row.class_name || row.kelas)) errors.push(`Baris ${index + 2}: kelas wajib diisi`);
    if (type === 'students') {
      const grade = Number(row.grade || row.tingkat);
      if (!grade || grade < 1 || grade > 6) errors.push(`Baris ${index + 2}: tingkat wajib diisi angka 1 sampai 6`);
    }
    if (type === 'users' && !row.email) errors.push(`Baris ${index + 2}: email wajib diisi`);
  });
  return errors;
}

export async function saveImportLog(payload) {
  const { data, error } = await supabase.from('import_logs').insert(payload).select().single();
  if (error) throw error;
  return data;
}

function value(row, keys) {
  const key = keys.find((item) => row[item] !== undefined && row[item] !== null && row[item] !== '');
  return key ? row[key] : '';
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function normalizeGender(gender) {
  const text = String(gender || 'L').trim().toUpperCase();
  if (['P', 'PEREMPUAN', 'WANITA'].includes(text)) return 'P';
  return 'L';
}

export async function importStudentsToActivePeriod(rows) {
  const { data: activePeriod, error: periodError } = await supabase
    .from('periods')
    .select('id,name')
    .eq('is_active', true)
    .single();
  if (periodError) throw new Error('Tahun ajaran aktif belum diset. Atur dulu di Settings > Data Awal.');

  const { data: classRows, error: classError } = await supabase
    .from('classes')
    .select('id,name,grade,period_id')
    .eq('period_id', activePeriod.id);
  if (classError) throw classError;

  const classCache = new Map(
    (classRows || []).map((item) => [`${Number(item.grade)}|${normalizeName(item.name)}`, item])
  );

  let createdClasses = 0;
  let importedStudents = 0;

  for (const row of rows) {
    const name = String(value(row, ['name', 'nama'])).trim();
    const nis = String(value(row, ['nis', 'NIS'])).trim();
    const grade = Number(value(row, ['grade', 'tingkat']));
    const className = String(value(row, ['class_name', 'kelas'])).trim();
    const note = String(value(row, ['note', 'keterangan'])).trim();
    const gender = normalizeGender(value(row, ['gender', 'jenis_kelamin', 'jk']));
    const classKey = `${grade}|${normalizeName(className)}`;

    let classRow = classCache.get(classKey);
    if (!classRow) {
      const { data: newClass, error } = await supabase
        .from('classes')
        .insert({ name: className, grade, period_id: activePeriod.id })
        .select('id,name,grade,period_id')
        .single();
      if (error) throw error;
      classRow = newClass;
      classCache.set(classKey, classRow);
      createdClasses += 1;
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .upsert({
        name,
        nis,
        gender,
        current_class_id: classRow.id,
        is_active: true,
        note: note || null,
      }, { onConflict: 'nis' })
      .select('id')
      .single();
    if (studentError) throw studentError;

    const { error: historyError } = await supabase.from('student_class_histories').insert({
      student_id: student.id,
      class_id: classRow.id,
      period_id: activePeriod.id,
      status: 'aktif',
      note: note || 'Import Excel siswa',
    });
    if (historyError) throw historyError;

    importedStudents += 1;
  }

  await saveImportLog({
    import_type: 'students',
    file_name: 'import-siswa.xlsx',
    total_rows: rows.length,
    success_rows: importedStudents,
    failed_rows: 0,
    note: `Tahun ajaran aktif: ${activePeriod.name}. Kelas dibuat otomatis: ${createdClasses}.`,
  });

  return { importedStudents, createdClasses, periodName: activePeriod.name };
}
