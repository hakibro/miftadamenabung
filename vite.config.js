import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
			manifest: {
				name: "Miftada Menabung",
				short_name: "Miftada",
				description: "Sistem Keuangan Kelas - Miftada Menabung",
				theme_color: "#1e40af",
				background_color: "#f0fdf4",
				display: "standalone",
				orientation: "portrait",
				start_url: "/",
				scope: "/",
				icons: [
					{
						src: "pwa-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "any maskable",
					},
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/incaqbpyuxlcistfntqz\.supabase\.co\/.*/i,
						handler: "NetworkFirst",
						options: {
							cacheName: "supabase-api",
							expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
						},
					},
				],
			},
		}),
	],
});
