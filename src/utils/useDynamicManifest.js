import { useEffect } from "react";
import { useSettings } from "../contexts/SettingsContext";

export function useDynamicManifest() {
	const { settings } = useSettings();
	const logoUrl = settings?.logo_url;
	const appName = settings?.app_name || "Miftada Menabung";

	useEffect(() => {
		const icons = [];

		if (logoUrl) {
			icons.push(
				{ src: logoUrl, sizes: "192x192", type: "image/png" },
				{ src: logoUrl, sizes: "512x512", type: "image/png" },
				{
					src: logoUrl,
					sizes: "512x512",
					type: "image/png",
					purpose: "any maskable",
				},
			);
		} else {
			icons.push(
				{ src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
				{ src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
				{
					src: "/pwa-512x512.png",
					sizes: "512x512",
					type: "image/png",
					purpose: "any maskable",
				},
			);
		}

		const manifest = {
			name: appName,
			short_name: "Miftada",
			description: "Sistem Keuangan Kelas - Miftada Menabung",
			theme_color: "#1e40af",
			background_color: "#f0fdf4",
			display: "standalone",
			orientation: "portrait",
			start_url: "/",
			scope: "/",
			icons,
		};

		const blob = new Blob([JSON.stringify(manifest)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);

		let link = document.querySelector('link[rel="manifest"]');
		if (!link) {
			link = document.createElement("link");
			link.rel = "manifest";
			document.head.appendChild(link);
		}
		link.href = url;

		// Also update apple-touch-icon
		let appleLink = document.querySelector('link[rel="apple-touch-icon"]');
		if (logoUrl) {
			if (!appleLink) {
				appleLink = document.createElement("link");
				appleLink.rel = "apple-touch-icon";
				document.head.appendChild(appleLink);
			}
			appleLink.href = logoUrl;
		}

		return () => {
			URL.revokeObjectURL(url);
		};
	}, [logoUrl, appName]);
}
