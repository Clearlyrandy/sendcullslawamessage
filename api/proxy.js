let requestQueue = [];
let processing = false;

const cooldown = new Map(); // Stores: IP → timestamp of last allowed request
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- VPN CHECK USING IPHUB OR IPAPI.CO --- //
async function isVpn(ip) {
    try {
        const resp = await fetch(`https://ipapi.co/${ip}/json/`);
        const data = await resp.json();

        if (!data || !data.asn) return true;

        const asn = parseInt(data.asn.replace("AS", ""), 10);
        if (isNaN(asn)) return true;

        // ---- MASSIVE U.S. RESIDENTIAL ISP ASN LIST ----
        const allowedResidentialASNs = [

            // Spectrum / Charter / Time Warner Cable
            20115, 11351, 7843, 11426, 11427, 11425, 20001, 10796, 18881,

            // Comcast / Xfinity
            7922, 33657, 7016,

            // Verizon FiOS
            22394, 702,

            // AT&T Internet (fiber/DSL)
            7018, 20057, 6389, 7088,

            // Cox Communications
            22773, 12008, 7843,

            // Frontier Communications
            5650, 6167, 11492,

            // CenturyLink / Lumen / Qwest
            209, 3561, 20940, 22561,

            // MediaCom
            30036, 2156,

            // WOW! Internet
            12044, 12129,

            // Cable ONE / Sparklight
            11404, 20130,

            // Optimum / Altice
            6128, 11831, 22394,

            // RCN / Astound
            6079, 31364,

            // HughesNet
            6621, 41164,

            // Starlink
            14593,

            // Google Fiber
            15169,

            // T-Mobile Home Internet
            21928, 21949, 21995, 22394, 39589,

            // Verizon Wireless
            6167, 22394, 22351,

            // AT&T Wireless
            20057, 7018,

            // US Cellular
            16617,

            // Regional Fiber ISPs
            29873, 30693, 32097, 63296, 14618, 11398,

            // Smaller Cable Co-ops
            33650, 27431, 11486, 20562, 27431, 20348
        ];

        // Allow if ASN is in allowed list
        if (allowedResidentialASNs.includes(asn)) {
            return false;
        }

        // Anything else = VPN / hosting / cloud
        return true;

    } catch (err) {
        console.log("VPN check failed:", err);
        return true;
    }
}

async function processQueue() {
    if (processing || requestQueue.length === 0) return;
    processing = true;

    while (requestQueue.length > 0) {
        const { req, res } = requestQueue.shift();

        try {
            const response = await fetch(
                "https://discord.com/api/webhooks/1343072709021667440/EPO0skSo3KwGiBuU4NX9wgED5dSmA4L_Xi2AH5rEVmnTp2GQJ49328yy3ZjsahDC1PQ1",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(req.body)
                }
            );

            if (!response.ok) throw new Error(`Error ${response.status}`);

            res.status(200).json({ success: true, message: "Message sent!" });
        } catch (error) {
            res.status(500).json({ error: "Failed to send message." });
        }

        // Spread messages so Discord rate-limits do not trip
        await delay(3000);
    }

    processing = false;
}

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // --- Detect IP --- //
    const ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        "0.0.0.0";

    // --- VPN CHECK --- //
    if (await isVpn(ip)) {
        return res.status(403).json({ error: "You're using an unsupported internet brand or IP." });
    }

    // --- RATE LIMIT (5-minute cooldown per IP) --- //
    const now = Date.now();
    const last = cooldown.get(ip) || 0;

    if (now - last < COOLDOWN_MS) {
        const wait = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
        return res.status(429).json({
            error: `Slow down! You must wait ${wait} seconds before sending another message.`
        });
    }

    cooldown.set(ip, now);

    // --- Add request to queue --- //
    requestQueue.push({ req, res });
    processQueue();
}




