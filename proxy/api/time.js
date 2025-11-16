export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end(); // Handle preflight request
    }

    try {
        const response = await fetch("https://worldtimeapi.org/api/timezone/America/Chicago");
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("Error fetching time:", error);
        res.status(500).json({ error: "Failed to fetch time" });
    }
}