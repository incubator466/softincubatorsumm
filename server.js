const express = require("express");
const cors = require("cors"); // <-- Add this line
const summaries = require("./data/summary.json");
const updater = require("./updater.js");

const app = express();
const PORT = 3000;
app.use(cors());

app.get("/api/realestate", (req, res) => {
    const { county, state } = req.query;

    if (!county || !state) {
        return res.status(400).json({ error: "Missing county or state" });
    }

    const key = `${county}, ${state}`;
    console.log(summaries[key]);
    if (summaries[key]) {
        return res.json({ ...summaries[key], cached: true });
    } else {
        return res.status(404).json({ error: "Data not found for this county/state" });
    }
});

app.get("/api/update", async (req, res) => {
    try {
        await updater.updateSummary();
        res.json({ message: "Summary updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});
