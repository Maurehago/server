// ===================================
//   WEB-Socket Server
// ===================================
// @ts-check

// ===================================
//   Typen
// --------

/** @typedef {Array<string|number|bigint|boolean|Uint8Array<ArrayBufferLike>>} DataRow */
/** @typedef {Array<DataRow>} DataRows */
/**
 * @typedef {object} DBDriver
 * @property {(username: string) => Promise<DataRows>} getUserByUsername - Liefert einen Benutzer Datensatz zurück 
 * @property {(gsid: string, username: string, passwordHash: string) => Promise<void>} createUser - Fügt einen neuen Benutzer in die Datenbank ein
 * @property {(tableName: string) => Promise<Array<string>>} getColumns - Liefert alle Spaltennamen in einer Tabelle zurück.
 * @property {(tableName: string, selector: string) => Promise<DataRows>} getRows - Liest aus einer Tabelle Alle Datensätze oder Datensätze mit angegebenen GSID's
 * @property {(tableName: string, rows: DataRows, confilctKey?: string) => Promise<number>} saveRows - Updatet einen oder Mehrere Datensätze mit einer Liste mit der ID und den geänderten Feldern.
 */

/**
 * @typedef {Object} Token
 * @property {string} gsid
 * @property {string} userId
 * @property {string} username
 * @property {number} exp
 */


/** 
 * @typedef {Object} WebSocketData 
 * @property {string} [userId]
 * @property {string} [username]
 * @property {number} [expiresAt]
 */

/**
 * @typedef {Object} ServerConfig
 * @property {number} [port] - Server Post. Default: 3000
 * @property {number} [sessionTimeout] - Session Laufzeit im ms. Default: 900000 (15 Minuten)
 * @property {string} [rpName] - System Name. Default: "Echtzeit System"
 * @property {string} [rpId] - Default: "localhost"
 * @property {string} [origin] - Default: `http://${this.rpId}:${this.port}`
 */

// userId: payload.userId, username: payload.username, expiresAt

/**
 * Gibt eine neue GlobalShortId zurück
 * @param {boolean} [large] - "true" Wenn in langer Form
 * @returns {string}
 */
export function getGSID(large) {
	if (large) {
		return new Date().getTime().toString(36) +
			crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
	} else {
		return new Date().getTime().toString(36) +
			crypto.getRandomValues(new Uint16Array(1))[0].toString(36);
	}
}



// const activeLocks = new Map();// 30 Minuten Inaktivitäts-Timeout (in Millisekunden)const SESSION_TIMEOUT = 30 * 60 * 1000; 

// WebSocket noch nicht implementieren
// import { 
//   generateRegistrationOptions, verifyRegistrationResponse,
//   generateAuthenticationOptions, verifyAuthenticationResponse 
// } from '@simplewebauthn/server';

export class RealtimeServer {
	/**
	 * Erstellt einen WebSocket Server
	 * @param {DBDriver} dbDriver - Datenbank Treiber
	 * @param {ServerConfig} [config] - Optional Konfiguration für den Server 
	 */
	constructor(dbDriver, config = {}) {
		/** @type {DBDriver} */
		this.db = dbDriver; // Das generische Interface
		this.port = config.port || 3000;
		this.sessionTimeout = config.sessionTimeout || 15 * 60 * 1000;
		this.rpName = config.rpName || 'Echtzeit System';
		this.rpId = config.rpId || 'localhost';
		this.origin = config.origin || `http://${this.rpId}:${this.port}`;

		this.activeLocks = new Map();
		this.currentChallenges = new Map();
	}

	/** @type {Map<string,Bun.ServerWebSocket<WebSocketData>>} */
	connections = new Map();

	/** @type {Map<string,string>} */
	tokens = new Map();

	start() {
		/** @type {Bun.Server<WebSocketData>} */
		const server = Bun.serve({
			port: this.port,
			// @ts-ignore
			fetch: async (req, server) => {
				const url = new URL(req.url);

				// 1. ROUTING: STATISCHE RECHTE / UI (Falls benötigt)
				if (url.pathname === "/" || url.pathname === "/index.html") {
					return new Response(Bun.file("./index.html"), { headers: { "Content-Type": "text/html" } });
				}

				// 2. ROUTING: AUTHENTIFIZIERUNG (Nutzt das generische db-Objekt)
				if (url.pathname === "/api/auth/register" && req.method === "POST") {
					const { username, password } = await req.json();
					if (await this.db.getUserByUsername(username)) return new Response("Existiert", { status: 400 });
					const hash = await Bun.password.hash(password);
					await this.db.createUser(getGSID(), username, hash);
					return new Response(JSON.stringify({ success: true }));
				}

				if (url.pathname === "/api/auth/login" && req.method === "POST") {
					const { username, password } = await req.json();
					const user = await this.db.getUserByUsername(username);
					const password_hash = "" + (user[1][user[0].indexOf("password_hash")] || "");
					if (!user || !password_hash || !(await Bun.password.verify(password, password_hash))) {
						return new Response("Falsche Daten", { status: 401 });
					}
					const user_gsid = user[1][user[0].indexOf("gsid")] + "";
					return new Response(JSON.stringify({ success: true, token: this._genToken(user_gsid, username), userId: user_gsid }));
				}

				// Passkey noch nicht implementieren
				// // --- PASSKEY INTERFACE IMPLEMENTIERUNG ---
				// if (url.pathname === '/api/passkey/register-options' && req.method === 'POST') {
				// 	const { username } = await req.json();
				// 	let user = await this.db.getUserByUsername(username);
				// 	const userId = user ? user.id : "usr_" + Math.random().toString(36).substring(2);
				// 	const options = await generateRegistrationOptions({ rpName: this.rpName, rpID: this.rpId, userID: userId, userName: username, attestationType: 'none', authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' } });
				// 	this.currentChallenges.set(userId, { challenge: options.challenge, username, userId });
				// 	return new Response(JSON.stringify(options));
				// }

				// if (url.pathname === '/api/passkey/register-verify' && req.method === 'POST') {
				// 	const { userId, responseBody } = await req.json();
				// 	const expected = this.currentChallenges.get(userId);
				// 	const verification = await verifyRegistrationResponse({ response: responseBody, expectedChallenge: expected.challenge, expectedOrigin: this.origin, expectedRPID: this.rpId });
				// 	if (verification.verified && verification.registrationInfo) {
				// 		const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;
				// 		await this.db.createUser(userId, expected.username, null);
				// 		await this.db.savePasskey(Buffer.from(credentialID).toString('base64url'), userId, Buffer.from(credentialPublicKey).toString('base64url'), counter);
				// 		return new Response(JSON.stringify({ success: true }));
				// 	}
				// }

				// if (url.pathname === '/api/passkey/login-options' && req.method === 'POST') {
				// 	const { username } = await req.json();
				// 	const keys = await this.db.getPasskeysByUsername(username);
				// 	const options = await generateAuthenticationOptions({ rpID: this.rpId, allowCredentials: keys.map(p => ({ id: Buffer.from(p.id, 'base64url'), type: 'public-key' })), userVerification: 'preferred' });
				// 	this.currentChallenges.set(username, options.challenge);
				// 	return new Response(JSON.stringify(options));
				// }

				// if (url.pathname === '/api/passkey/login-verify' && req.method === 'POST') {
				// 	const { username, responseBody } = await req.json();
				// 	const expectedChallenge = this.currentChallenges.get(username);
				// 	const passkey = await this.db.getPasskeyById(responseBody.id);
				// 	const verification = await verifyAuthenticationResponse({ response: responseBody, expectedChallenge, expectedOrigin: this.origin, expectedRPID: this.rpId, authenticator: { credentialID: Buffer.from(passkey.id, 'base64url'), credentialPublicKey: Buffer.from(passkey.public_key, 'base64url'), counter: passkey.counter } });
				// 	if (verification.verified) {
				// 		await this.db.updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);
				// 		return new Response(JSON.stringify({ success: true, token: this._genToken(passkey.user_id, username), userId: passkey.user_id }));
				// 	}
				// }

				// 3. ROUTING: WEBSOCKET HANDSHAKE
				if (url.pathname === "/socket") {
					const token = url.searchParams.get("token") || "";
					try {
						/** @type {Token} */
						const payload = JSON.parse(atob(token));
						if (!payload || payload.exp < Date.now()) return new Response("Expired", { status: 401 });

						// Token Prüfen ob registriert
						const serverToken = this.tokens.get(payload.gsid);
						if (!serverToken || serverToken != payload.userId) return new Response("Wrong Token", { status: 401 });

						return server.upgrade(req, { data: { userId: payload.userId, username: payload.username, expiresAt: Date.now() + this.sessionTimeout } });
					} catch (e) { return new Response("Unauthorized", { status: 401 }); }
				}

				return new Response("Not Found", { status: 404 });
			},

			/** @type {Bun.WebSocketHandler<WebSocketData>} */
			websocket: {
				open: async (ws) => {
					if (!ws.data.userId) { return; }
					this.connections.set(ws.data.userId, ws);
					ws.subscribe("app-room");
					// NEU: Daten werden jetzt vollkommen dynamisch über das DAL geladen!
					// Wir laden z.B. alle Datensätze aus der Tabelle 'records'
					const allRecords = await this.db.getRows("records", "ALL");

					ws.send(JSON.stringify({
						type: "INITIAL_STATE",
						locks: Object.fromEntries(this.activeLocks),
						records: allRecords // Schickt das gesamte Array an den Client
					}));
					this._broadcastDashboard(server);
				},
				message: async (ws, message) => {
					// Ablaufdatum vom Token erhöhen
					ws.data.expiresAt = Date.now() + this.sessionTimeout;

					// Datenstring in Objekt umwandeln
					const data = JSON.parse(message + "");

					switch (data.type) {
						case "LOCK_RECORD":
							// Datensatz Sperren
							// {type: "LOCK_RECORD", id}
							this.activeLocks.set(data.id, { gsid: ws.data.userId, username: ws.data.username, since: new Date().toLocaleTimeString() });
							server.publish("app-room", JSON.stringify({ type: "RECORD_LOCKED", recordId: data.recordId, userId: ws.data.userId, username: ws.data.username }));
							this._broadcastDashboard(server);
							break;

						case "SAVE":
							// Datensätze Speichern und entsperren
							// {tableName: "Name_der_Tabelle", rows: [[]], idCol}
							const lock = this.activeLocks.get(data.recordId);
							if (lock && lock.userId === ws.data.userId) {

								// Nutzt das neue dynamische Speicher-Interface inklusive User-ID fürs Log
								await this.db.saveRows(
									data.tableName,    // z.B. "records"
									data.rows,     // z.B. [ ["gsid", "name"], ["gadsfd", "Muster"] ]
									data.idCol || "gsid" // Name des ID-Feldes oder Spaltenname welches den Datensatz eindeutig identifiziert
								);

								this.activeLocks.delete(data.recordId);

								// Alle Clients über den neuen Zustand informieren
								server.publish("app-room", JSON.stringify({
									type: "RECORD_SAVED_AND_UNLOCKED",
									tableName: data.tableName,
									recordId: data.recordId,
									changedFields: data.changedFields
								}));
								this._broadcastDashboard(server);
							}

						case "UNLOOK":
							// Datensatz entsperren
							this.activeLocks.delete(data.id);
							server.publish("app-room", JSON.stringify({ type: "RECORD_UNLOCKED", id: data.id }));
							this._broadcastDashboard(server);

						default:
							break;
					}
				},
				close: (ws) => {
					setTimeout(() => {
						if (ws.readyState == 3) { // closed
							for (const [recordId, lock] of this.activeLocks.entries()) {
								if (lock.userId === ws.data.userId) {
									this.activeLocks.delete(recordId);
									server.publish("app-room", JSON.stringify({ type: "RECORD_UNLOCKED", recordId }));
								}
							}
							this.connections.delete(ws.data.userId + "");
							ws.unsubscribe("app-room");
							this._broadcastDashboard(server);
							
							
							// Token des User löschen
							const keys = [...this.tokens.keys()];
							for (let i = 0; i < keys.length; i++) {
								const t = this.tokens.get(keys[i]);
								if (t && t == ws.data.userId) {
									this.tokens.delete(keys[i]);
								}
							}
						}
					}, 3000); // 3 Sekunden Kulanzzeit
				}
			}
		})

		// Timeout-Wächter-Interval
		setInterval(() => {
			const jetzt = Date.now();
			const keys = [...this.connections.keys()];
			for (let i = 0; i < keys.length; i++) {
				const ws = this.connections.get(keys[i]);
				if (ws?.data && ws.data.expiresAt && ws.data.expiresAt < jetzt) {
					// Schicken das Session endet
					ws.send(JSON.stringify({ type: "SESSION_EXPIRED" }));

					// Socket verbindung schliessen
					ws.close();

					// aus Verbindungen löschen
					this.connections.delete(keys[i]);
				}
			}
		}, 60000);

		console.log(`🚀 Modularer Server läuft auf http://localhost:${this.port}`);
	}

	/**
	 * Erzeugt einen Benutzer Token für die Websocket Verbindung
	 * @param {string} userId - ID des Benutzers
	 * @param {string} username - Name des Benutzers
	 * @returns {string}
	 */
	_genToken(userId, username) {
		const gsid = getGSID();
		this.tokens.set(gsid, userId);
		return btoa(JSON.stringify({ gsid, userId, username, exp: Date.now() + this.sessionTimeout }));
	}

	/**
	 * 
	 * @param {Bun.Server<WebSocketData>} server 
	 */
	_broadcastDashboard(server) {
		server.publish("app-room", JSON.stringify({ type: "DASHBOARD_UPDATE", locks: Object.fromEntries(this.activeLocks) }));
	}
}

