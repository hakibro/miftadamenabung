import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import AdminDashboard from '../pages/admin/AdminDashboard';
import UsersPage from '../pages/admin/UsersPage';
import StudentsPage from '../pages/admin/StudentsPage';
import ImportPage from '../pages/admin/ImportPage';
import QrCodesPage from '../pages/admin/QrCodesPage';
import SettingsPage from '../pages/admin/SettingsPage';
import BendaharaDashboard from '../pages/bendahara/BendaharaDashboard';
import WalasDashboard from '../pages/walas/WalasDashboard';
import WalasStudentsPage from '../pages/walas/WalasStudentsPage';
import InputPage from '../pages/walas/InputPage';
import StudentDetailPage from '../pages/walas/StudentDetailPage';
import ScanStudentPage from '../pages/scan/ScanStudentPage';
import ReportPage from '../pages/shared/ReportPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/periods" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/admin/classes" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/admin/students" element={<StudentsPage />} />
          <Route path="/admin/import" element={<ImportPage />} />
          <Route path="/admin/promotion" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/admin/qrcodes" element={<QrCodesPage />} />
          <Route path="/admin/reports" element={<ReportPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['bendahara']} />}>
        <Route element={<AppLayout />}>
          <Route path="/bendahara/dashboard" element={<BendaharaDashboard />} />
          <Route path="/bendahara/reports" element={<ReportPage />} />
          <Route path="/bendahara/reports/classes" element={<ReportPage />} />
          <Route path="/bendahara/reports/students" element={<ReportPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['walas']} />}>
        <Route element={<AppLayout />}>
          <Route path="/walas/dashboard" element={<WalasDashboard />} />
          <Route path="/walas/students" element={<WalasStudentsPage />} />
          <Route path="/walas/input" element={<InputPage />} />
          <Route path="/walas/reports" element={<ReportPage scope="walas" />} />
          <Route path="/walas/student/:id" element={<StudentDetailPage />} />
          <Route path="/scan/siswa/:id" element={<ScanStudentPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
