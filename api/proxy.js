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

        if (!data || !data.asn) return false;

        const asn = data.asn.toUpperCase();
        const org = (data.org || "").toUpperCase();

        // These keywords indicate datacenter hosting (NOT a home ISP)
        const hostingKeywords = [
            "HOSTING",
            "VPN",
            "DATACENTER",
            "DATA CENTER",
            "CLOUD",
            "LLC",
            "SERVICES",
            "DIGITALOCEAN",
            "AMAZON",
            "AWS",
            "GOOGLE",
            "AZURE",
            "MICROSOFT",
            "OVH",
            "M247",
            "CHOOPA",
            "LEASEWEB",
            "FASTLY",
            "LINODE",
            "HETZNER"
        ];

        // If the ASN org contains these keywords → VPN/proxy/datacenter
        for (const word of hostingKeywords) {
            if (org.includes(word)) {
                return true;
            }
        }

        // ProtonVPN specifically uses "M247 Ltd", "Datacamp Limited", "Acronis", "Steadfast", etc.
        const protonProviders = [
            "M247", 
            "ACRONIS",
            "DATACAMP",
            "STEADFAST",
            "ANEXIA",
            "PRIVACY",  // used by some VPN operators
            "PRIVATELAYER"
        ];

        for (const word of protonProviders) {
            if (org.includes(word)) {
                return true;
            }
        }

        return false;
    } catch (err) {
        console.log("VPN check failed:", err);
        return false;
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
        return res.status(403).json({ error: "Are you using a VPN or Proxy?" });
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


