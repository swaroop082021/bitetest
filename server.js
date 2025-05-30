const express = require('express');
const identityService = require('./identityService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());


app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Add a root endpoint
app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Bitespeed Identity Service is running' });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Bitespeed Identity Service with Supabase is running' });
});

// Main identify endpoint
app.post('/identify', async (req, res) => {
    try {
        const { email, phoneNumber } = req.body;
        
        // Validation
        if (!email && !phoneNumber) {
            return res.status(400).json({
                error: 'At least one of email or phoneNumber is required'
            });
        }

        const result = await identityService.identifyContact(email, phoneNumber);
        res.status(200).json(result);
        
    } catch (error) {
        console.error('Error in /identify endpoint:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

// 404 handler 
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Identify endpoint: http://localhost:${PORT}/identify`);
});



module.exports = app;
