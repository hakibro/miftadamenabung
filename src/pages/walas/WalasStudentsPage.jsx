import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import { useAuth } from '../../contexts/AuthContext';
import { listStudents } from '../../services/masterDataService';

export default function WalasStudentsPage() {
  const { profile } = useAuth();
  const [students, setStudents] = useState([]);

  useEffect(() => {
    if (profile?.assigned_class_id) listStudents({ mineAsWalas: true }).then(setStudents);
  }, [profile?.assigned_class_id]);

  return (
    <DataTable
      rows={students}
      columns={[
        { key: 'name', label: 'Nama' },
        { key: 'nis', label: 'NIS' },
        { key: 'gender', label: 'JK' },
      ]}
      actions={(row) => <Link className="text-brand-700" to={`/walas/student/${row.id}`}>Detail</Link>}
    />
  );
}
