import { Glob, serve, ServerWebSocket } from "bun";
import { cpSync, watch } from "fs";
import { join, resolve } from "path";

const PORT = 3000;
const DIST_DIR = "./dist";
const SRC_DIR = "./src";

// Build
let isBuilding = false;
async function buildProject() {
	if (isBuilding)
		return;
	isBuilding = true;

	let buildStamp;
	{
		const d = new Date();

		const Y = d.getFullYear();
		const M = String(d.getMonth() + 1).padStart(2, '0');
		const D = String(d.getDate()).padStart(2, '0');
		const h = String(d.getHours()).padStart(2, '0');
		const m = String(d.getMinutes()).padStart(2, '0');
		const s = String(d.getSeconds()).padStart(2, '0');

		// Custom layout: YYYY-MM-DD HH:mm
		buildStamp = `"v${Y}${M}${D}_${h}${m}${s}"`;
	}

	// Extract colors
	await extractColorTypings();

	const result = await Bun.build({
		entrypoints: [`${SRC_DIR}/index.html`],
		outdir: DIST_DIR,
		minify: false,
		sourcemap: "inline",
		naming: {
			entry: "[name].[ext]",
			chunk: "[name].[ext]",
			asset: "[dir]/[name].[ext]",
		},
		define: {
			__BUILD_TIMESTAMP__: buildStamp,
		}
	});

	if (!result.success) {
		console.error("❌ Build failed:");
		for (const msg of result.logs) console.error(msg);
		return;
	}

	// Copy Assets
	cpSync(`${SRC_DIR}/data`, `${DIST_DIR}/data`, { recursive: true });
	console.log(`✨ Recompiled into ${DIST_DIR} at ${new Date().toLocaleTimeString()}`);
	isBuilding = false;
}

async function extractColorTypings() {
	const srcColors = `${SRC_DIR}/styles/_colors.json`;

	const tsOutput = `${SRC_DIR}/styles/colors.ts`;
	const cssOutput = `${SRC_DIR}/styles/colors.css`;

	const colors = await Bun.file(srcColors).json();

	let ts = `// Auto-generated. Edit 'styles/_colors.json' instead

import * as THREE from 'three';

export const Colors = {
`;
	for (const [key, value] of Object.entries(colors))
		ts += `\t${key}: 0x${(value as string).replace('#', '')},\n`;
	ts += `} as const;`

	ts += `

export const Colors3 = {
`
	for (const [key, value] of Object.entries(colors))
		ts += `\t${key}: new THREE.Color(Colors.${key}),\n`;
	ts += `} as const;`

	await Bun.write(tsOutput, ts);

	let css = `
/* Auto-generated. Edit 'styles/_colors.json' instead */

:root {\n`;
	for (const [key, value] of Object.entries(colors))
		css += `\t--col-${key}: ${value};\n`;
	css += `}`;
	await Bun.write(cssOutput, css);
}

// Run initial build
await buildProject();

// Hot Reload
let reloadClients: Set<ServerWebSocket> = new Set();
watch(SRC_DIR, { recursive: true }, async (e, filename) => {
	await buildProject();
	// Notify all connected browser clients to refresh
	for (const client of reloadClients) {
		client.send("reload");
	}
});

// Serve
const server = serve({
	port: PORT,
	async fetch(req, server) {
		const url = new URL(req.url);

		// Handle live-reload websocket handshake
		if (url.pathname === "/__live_reload") {
			const upgraded = server.upgrade(req);
			if (upgraded) return;
		}

		// Serve data files directly
		if (url.pathname.startsWith("/data/")) {
			const filePath = join(DIST_DIR, url.pathname);
			const file = Bun.file(filePath);

			if (await file.exists()) {
				return new Response(file);
			}
		}

		let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
		let file = Bun.file(join(DIST_DIR, filePath));

		if (!(await file.exists()))
			return new Response("Not Found", { status: 404 });

		let content = await file.text();

		// If it's an HTML file, inject the auto-reload script automatically
		if (file.type.includes("html") || url.pathname.endsWith(".html") || url.pathname === "/") {
			const injection = `
					<script>
						const ws = new WebSocket("ws://" + location.host + "/__live_reload");
						ws.onmessage = (event) => {
							if (event.data === "reload") location.reload();
						};
					</script>
				`;
			content = content.replace("</body>", injection + "</body>");
		}

		return new Response(content, {
			headers: { "Content-Type": file.type || "text/html" }
		});
	},
	websocket: {
		open(ws) { reloadClients.add(ws); },
		close(ws) { reloadClients.delete(ws); },
		message() { },
	}
});

console.log(`\n🚀 App running at http://localhost:${PORT}`);
console.log(`💡 Open this link in VS Code's Simple Browser panel!\n`);
