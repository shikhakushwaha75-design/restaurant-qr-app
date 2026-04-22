const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

let customers = [];

// File path for data storage
const DATA_FILE = path.join(__dirname, 'data.json');

// Load customers
async function loadCustomers() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        customers = JSON.parse(data);
    } catch (error) {
        customers = [];
    }
}

// Save customers
async function saveCustomers() {
    await fs.writeFile(DATA_FILE, JSON.stringify(customers, null, 2));
}

// Generate CSV
function generateCSV() {
    const headers = ['ID', 'Name', 'Mobile', 'Email', 'DOB', 'DOA', 'PAX', 'Current Date', 'Timestamp'];
    const csvContent = [
        headers.join(','),
        ...customers.map(customer => [
            customer.id,
            `"${customer.name.replace(/"/g, '""')}"`,
            customer.mobile,
            `"${(customer.email || '').replace(/"/g, '""')}"`,
            customer.dob || '',
            customer.doa,
            customer.pax,
            customer.current_date,
            customer.timestamp
        ].join(','))
    ].join('\n');
    return csvContent;
}

// Serve main QR page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.post('/api/register', async (req, res) => {
    try {
        const customer = {
            id: uuidv4(),
            ...req.body,
            timestamp: new Date().toISOString()
        };
        
        customers.unshift(customer);
        await saveCustomers();
        
        res.json({ 
            success: true, 
            message: '✅ Registration successful!',
            customerId: customer.id 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

app.get('/api/customers', async (req, res) => {
    res.json({ customers, total: customers.length });
});

app.get('/api/export/csv', async (req, res) => {
    const csv = generateCSV();
    res.header('Content-Type', 'text/csv');
    res.attachment('restaurant-customers.csv');
    res.send(csv);
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', customers: customers.length });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

const server = app.listen(PORT, async () => {
    await loadCustomers();
    console.log(`🚀 Restaurant QR App running on port ${PORT}`);
    console.log(`🌐 Live: http://localhost:${PORT}`);
    console.log(`📊 Admin: http://localhost:${PORT}/admin`);
    console.log(`📥 CSV: http://localhost:${PORT}/api/export/csv`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, saving data...');
    await saveCustomers();
    server.close(() => {
        console.log('Process terminated');
    });
});