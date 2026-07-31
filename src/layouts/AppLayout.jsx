import {
	Link,
	NavLink,
	Outlet,
	useLocation,
	useNavigate,
} from "react-router-dom";
import {
	ArrowLeft,
	BarChart3,
	BookOpen,
	GraduationCap,
	Home,
	Import,
	LogOut,
	QrCode,
	Receipt,
	Settings,
	Users,
	WalletCards,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";

const navByRole = {
	admin: [
		{ to: "/admin/dashboard", label: "Dashboard", icon: Home, mobile: true },
		{
			to: "/admin/students",
			label: "Siswa",
			icon: GraduationCap,
			mobile: true,
		},
		{ to: "/admin/users", label: "User", icon: Users, mobile: true },
		{ to: "/admin/reports", label: "Laporan", icon: BarChart3, mobile: true },
		{ to: "/admin/settings", label: "Settings", icon: Settings, mobile: true },
		{ to: "/admin/import", label: "Import", icon: Import },
		{ to: "/admin/qrcodes", label: "QR Siswa", icon: QrCode },
	],
	bendahara: [
		{
			to: "/bendahara/dashboard",
			label: "Dashboard",
			icon: Home,
			mobile: true,
		},
		{
			to: "/bendahara/reports",
			label: "Laporan",
			icon: BarChart3,
			mobile: true,
		},
		{
			to: "/bendahara/reports/classes",
			label: "Kelas",
			icon: BookOpen,
			mobile: true,
		},
		{
			to: "/bendahara/reports/students",
			label: "Siswa",
			icon: GraduationCap,
			mobile: true,
		},
	],
	walas: [
		{ to: "/walas/dashboard", label: "Dashboard", icon: Home, mobile: true },
		{
			to: "/walas/students",
			label: "Siswa",
			icon: GraduationCap,
			mobile: true,
		},
		{ to: "/walas/input", label: "Input", icon: Receipt, mobile: true },
		{
			to: "/walas/savings-withdrawals",
			label: "Pengambilan",
			icon: WalletCards,
			mobile: true,
		},
		{ to: "/walas/reports", label: "Laporan", icon: BarChart3 },
	],
};

function LogoMark({ logoUrl, appName }) {
	if (logoUrl) {
		return (
			<img
				src={logoUrl}
				alt={appName}
				className="h-10 w-10 rounded-lg border border-slate-200 object-contain"
			/>
		);
	}

	return (
		<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
			SK
		</div>
	);
}

export default function AppLayout() {
	const { profile, signOut } = useAuth();
	const { settings } = useSettings();
	const location = useLocation();
	const navigate = useNavigate();
	const nav = (navByRole[profile?.role] ?? []).filter(
		(item) =>
			item.to !== "/walas/savings-withdrawals" ||
			settings.show_withdrawal !== false,
	);
	const mobileNav = nav;
	const isAdmin = profile?.role === "admin";
	const pageTitle =
		nav.find((item) => location.pathname.startsWith(item.to))?.label ||
		"Dashboard";
	const isDashboard = location.pathname.endsWith("/dashboard");
	const userName = profile?.full_name || "Pengguna";
	const className = profile?.assigned_class?.name || "";

	// Determine the role-based dashboard path for the back button
	const dashboardPath = profile?.role ? `/${profile.role}/dashboard` : "/";
	const appName = settings?.app_name || "Sistem Keuangan Kelas";
	const schoolName = settings?.school_name || "Administrasi sekolah";

	// Mobile dashboard subtext: prefer class name for walas, fallback to schoolName
	const dashboardSubtitle =
		profile?.role === "walas" && className
			? `Wali Kelas ${className}`
			: schoolName;

	return (
		<div className="app-shell min-h-screen bg-[#f7f1ff] text-slate-900 lg:flex">
			<aside className="no-print hidden border-r border-white/70 bg-white/90 shadow-soft backdrop-blur lg:fixed lg:inset-y-0 lg:block lg:w-72">
				<div className="flex h-20 items-center gap-3 px-5">
					<LogoMark logoUrl={settings?.logo_url} appName={appName} />
					<Link to="/" className="min-w-0">
						<p className="truncate text-base font-semibold text-slate-950">
							{appName}
						</p>
						<p className="truncate text-xs text-slate-500">{schoolName}</p>
					</Link>
				</div>
				<nav className="space-y-1 px-3 pb-4">
					{nav.map((item) => {
						const Icon = item.icon;
						return (
							<NavLink
								key={item.to}
								to={item.to}
								className={({ isActive }) =>
									`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
										isActive
											? "bg-brand-600 text-white shadow-glow"
											: "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
									}`
								}>
								<Icon size={18} />
								<span className="truncate">{item.label}</span>
							</NavLink>
						);
					})}
				</nav>
			</aside>

			<div className="min-w-0 flex-1 lg:pl-72">
				<header className="no-print sticky top-0 z-20 bg-[#f7f1ff]/90 backdrop-blur lg:bg-white/85">
					<div className="flex h-16 items-center justify-between gap-3 px-4 sm:h-20 lg:px-6">
						<div className="flex min-w-0 items-center gap-3 lg:hidden">
							{isDashboard ? (
								<>
									<LogoMark logoUrl={settings?.logo_url} appName={appName} />
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold text-slate-950">
											{userName}
										</p>
										<p className="truncate text-xs text-slate-500">
											{dashboardSubtitle}
										</p>
									</div>
								</>
							) : (
								<button
									onClick={() => navigate(-1)}
									className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-white/80 bg-white px-3 text-sm font-medium text-slate-700 shadow-soft transition hover:bg-brand-50 hover:text-brand-700"
									title="Kembali">
									<ArrowLeft size={18} />
									<span>Kembali</span>
								</button>
							)}
						</div>
						<div className="hidden min-w-0 lg:block">
							{isDashboard ? (
								<>
									<p className="truncate text-sm text-slate-500">Dashboard</p>
									<h1 className="truncate text-xl font-semibold text-slate-950">
										Halo, {userName}
									</h1>
								</>
							) : (
								<div className="flex items-center gap-3">
									<button
										onClick={() => navigate(dashboardPath)}
										className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-white/80 bg-white px-3 text-sm font-medium text-slate-700 shadow-soft transition hover:bg-brand-50 hover:text-brand-700"
										title="Kembali ke Dashboard">
										<ArrowLeft size={18} />
										<span>Kembali</span>
									</button>
									<div className="min-w-0">
										<p className="truncate text-sm text-slate-500">
											{pageTitle}
										</p>
										<h1 className="truncate text-xl font-semibold text-slate-950">
											{schoolName}
										</h1>
									</div>
								</div>
							)}
						</div>
						<button
							onClick={signOut}
							className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/80 bg-white px-3 text-sm font-medium text-slate-700 shadow-soft transition hover:bg-brand-50 hover:text-brand-700"
							title="Keluar">
							<LogOut size={16} />
							<span className="hidden sm:inline">Keluar</span>
						</button>
					</div>
				</header>

				<main className="mx-auto w-full max-w-md px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] sm:max-w-none sm:px-5 lg:max-w-none lg:px-6 lg:pb-8">
					<Outlet />
				</main>
			</div>

			<nav className="no-print fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] lg:hidden">
				<div
					className={`mx-auto flex max-w-md rounded-[26px] border border-white/80 bg-white/95 p-1.5 shadow-soft backdrop-blur ${
						isAdmin ? "gap-1 overflow-x-auto" : "justify-around px-2"
					}`}>
					{mobileNav.map((item) => {
						const Icon = item.icon;
						return (
							<NavLink
								key={item.to}
								to={item.to}
								title={item.label}
								className={({ isActive }) =>
									`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition ${
										isActive
											? "bg-brand-600 text-white shadow-glow"
											: "text-slate-500 hover:bg-brand-50 hover:text-brand-700"
									}`
								}>
								<Icon size={22} />
							</NavLink>
						);
					})}
				</div>
			</nav>
		</div>
	);
}
