const fs = require('fs'); // Import standard fs for createReadStream
const fsPromises = require('fs').promises; // Import fs.promises for async file operations
const path = require('path');
const axios = require('axios');
const csv = require('csv-parser');

const DATA_URL = 'https://files.zillowstatic.com/research/public_csvs/zhvi/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv';
const OUTPUT_FILE = path.join(__dirname, './data/summary.json');
const LOCAL_CSV = path.join(__dirname, './data/zillow_county.csv');

async function downloadCSVtoFile() {
    try {
        console.log('⬇️ Downloading CSV...');
        const response = await axios.get(DATA_URL, { responseType: 'stream' });
        const writer = fs.createWriteStream(LOCAL_CSV);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log('✅ CSV downloaded.');
                resolve();
            });
            writer.on('error', reject);
        });
    } catch (err) {
        throw new Error(`Failed to download CSV: ${err.message}`);
    }
}

function parseCSVFile() {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(LOCAL_CSV)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                console.log(`✅ Parsed ${results.length} rows from CSV.`);
                resolve(results);
            })
            .on('error', (err) => reject(new Error(`Failed to parse CSV: ${err.message}`)));
    });
}

const getSummary = ({ county, state, latestValue, latestDate, percentChange }) => {
    const roundedValue = latestValue.toLocaleString(undefined, { maximumFractionDigits: 0 });
    const change = parseFloat(percentChange);

    let trendSentence = '';
    if (change > 2) {
        trendSentence = `a strong upward trend with property values increasing`;
    } else if (change > 0) {
        trendSentence = `modest growth in property values`;
    } else if (change < -2) {
        trendSentence = `a noticeable decline in property values`;
    } else {
        trendSentence = `a stable market with slight changes in property values`;
    }

    const direction = change >= 0 ? 'increase' : 'decrease';
    const summary = `${county}, ${state} has seen ${trendSentence}. The average home value is $${roundedValue} as of ${latestDate}, reflecting a ${Math.abs(change)}% ${direction} over the past year. The market continues to show signs of ${change >= 0 ? 'resilience' : 'adjustment'} amid evolving real estate dynamics.`;

    return summary;
};


function generateBasicSummary(entry) {
    const county = entry['RegionName'];
    const state = entry['State'];
    const latestDate = Object.keys(entry)
        .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
        .sort()
        .pop();
    const latestValue = parseFloat(entry[latestDate]);

    const oneYearAgo = new Date(latestDate);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearKey = oneYearAgo.toISOString().split('T')[0];
    const pastValue = parseFloat(entry[oneYearKey]) || latestValue;
    const percentChange = (((latestValue - pastValue) / pastValue) * 100).toFixed(1);

    // const summary = `${county}, ${state} shows a strong housing market trend. The average home value is $${latestValue.toLocaleString()} as of ${latestDate}, reflecting a ${percentChange}% change over the past year. This data suggests evolving property tax impacts and a dynamic real estate landscape.`;
    // const summary = getSummary({ county, state, latestValue, latestDate, percentChange });
    const summary = `${county}, ${state} shows a ${percentChange >= 0 ? "resilient" : "shifting"
        } housing market trend. The average home value is $${latestValue.toLocaleString()} as of ${latestDate}, reflecting a ${percentChange}% change over the past year. ${percentChange >= 0
            ? "This upward trend suggests increasing buyer confidence and sustained demand for properties in the area."
            : "The slight decline may indicate a cooling market or short-term correction following prior growth."
        } Homeowners and investors should stay informed about evolving property tax impacts and local development patterns. Overall, the real estate landscape in ${county} remains ${percentChange >= 0 ? "competitive and attractive" : "dynamic and full of opportunities"
        } for both buyers and sellers.`;

    return { county, state, latestValue, latestDate, percentChange, summary };
}

async function generateSummary(entry) {
    const { county, state, summary, latestValue, latestDate, percentChange } = generateBasicSummary(entry);
    const output = {
        county, state, latestValue, latestDate, percentChange, summary
    }
    console.log(output);
    return output;
}

async function updateSummary() {
    try {
        const csvExists = await fsPromises.access(LOCAL_CSV).then(() => true).catch(() => false);
        if (!csvExists) {
            await downloadCSVtoFile();
        } else {
            console.log('📂 Using existing CSV.');
        }

        const rows = await parseCSVFile();
        const summaryByCounty = {};

        // Process rows sequentially to avoid overwhelming the summarizer
        for (const row of rows) {
            const key = `${row['RegionName']}, ${row['State']}`;
            console.log(`Processing ${key}...`);
            summaryByCounty[key] = await generateSummary(row);
        }

        await fsPromises.writeFile(OUTPUT_FILE, JSON.stringify(summaryByCounty, null, 2));
        console.log('✅ County summaries updated.');
    } catch (err) {
        console.error('❌ Failed to update:', err.message);
    }
}

module.exports = { updateSummary };