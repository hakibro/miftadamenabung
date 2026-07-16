import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { SettingsProvider } from "./contexts/SettingsContext.jsx";
import { registerSW } from "virtual:pwa-register";
import "./index.css";

// Auto-update service worker
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<BrowserRouter
			future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
			<AuthProvider>
				<SettingsProvider>
					<AppRoutes />
				</SettingsProvider>
			</AuthProvider>
		</BrowserRouter>
	</React.StrictMode>,
);
