import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSettings } from "../services/settingsService";
import { useAuth } from "./AuthContext";

const SettingsContext = createContext(null);

const fallbackSettings = {
	app_name: "Sistem Keuangan Kelas",
	school_name: "Administrasi sekolah",
	logo_url: "",
	show_withdrawal: true,
};

export function SettingsProvider({ children }) {
	const [settings, setSettings] = useState(fallbackSettings);
	const { session } = useAuth();

	async function refreshSettings() {
		try {
			const data = await getSettings();
			setSettings(data || fallbackSettings);
		} catch {
			setSettings(fallbackSettings);
		}
	}

	useEffect(() => {
		if (session) {
			refreshSettings();
		}
	}, [session]);

	const value = useMemo(() => ({ settings, refreshSettings }), [settings]);

	return (
		<SettingsContext.Provider value={value}>
			{children}
		</SettingsContext.Provider>
	);
}

export function useSettings() {
	const context = useContext(SettingsContext);
	if (!context)
		throw new Error("useSettings must be used inside SettingsProvider");
	return context;
}
