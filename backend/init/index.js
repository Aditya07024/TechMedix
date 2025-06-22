const mongoose = require('mongoose');
const data = require('./data.js');
const Medicine = require('../models/medicine.js');

const MONGO_URL="mongodb://127.0.0.1:27017/techmedix"

async function main(){
    await mongoose.connect(MONGO_URL)
}

main().then(() => {
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.log("Error connecting to MongoDB:", err);
});

const initDB = async () => {
    try {
        // Clear existing data
        await Medicine.deleteMany({});

        // Insert new data
        const medicines = await Medicine.insertMany(data.data);

        console.log("Database initialized with medicines:", medicines);
    } catch (error) {
        console.error("Error initializing database:", error);
    } 
}

initDB();

