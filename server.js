const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Database
const database = {
    sessions: {},
    activeTrades: {}
};

// AI Trading Engine
class AITradingEngine {
    constructor() {
        this.performance = { totalTrades: 0, successfulTrades: 0, totalProfit: 0 };
    }

    async analyzeMarket(symbol, marketData) {
        const { price = 0, volume24h = 0, priceChange24h = 0, high24h = 0, low24h = 0 } = marketData;
        const volatility = Math.abs(priceChange24h) / 100 || 0.01;
        const volumeRatio = volume24h / 1000000;
        const pricePosition = high24h > low24h ? (price - low24h) / (high24h - low24h) : 0.5;
        
        let confidence = 0.5;
        if (volumeRatio > 1.5) confidence += 0.1;
        if (volumeRatio > 2.0) confidence += 0.1;
        if (priceChange24h > 5) confidence += 0.15;
        if (priceChange24h > 10) confidence += 0.2;
        if (pricePosition < 0.3) confidence += 0.1;
        if (pricePosition > 0.7) confidence += 0.1;
        
        const action = (pricePosition < 0.3 && priceChange24h > -5 && volumeRatio > 1.2) ? 'BUY' :
                      (pricePosition > 0.7 && priceChange24h > 5 && volumeRatio > 1.2) ? 'SELL' : 'HOLD';
        
        return { symbol, price, confidence: Math.min(confidence, 0.95), action };
    }
}

// Binance API Helper
class BinanceAPI {
    static async getTicker(symbol, apiKey, secret, useTestnet = false) {
        try {
            const baseUrl = useTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
            const response = await axios.get(`${baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`);
            return response.data;
        } catch (error) {
            return { lastPrice: '0', volume: '0', priceChangePercent: '0', highPrice: '0', lowPrice: '0' };
        }
    }

    static async getAccountInfo(apiKey, secret, useTestnet = false) {
        return { balances: [{ asset: 'USDT', free: '1000' }] };
    }
}

const app = express();
const aiEngine = new AITradingEngine();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serves index.html from root

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Halal AI Trading Bot API is running' });
});

app.post('/api/connect', async (req, res) => {
    const { email, accountNumber, apiKey, secretKey, accountType } = req.body;
    
    const sessionId = 'session_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    database.sessions[sessionId] = {
        id: sessionId, email, accountNumber, apiKey, secretKey,
        accountType, connectedAt: new Date(), isActive: true, balance: 1000
    };
    
    res.json({ success: true, sessionId, accountInfo: { balance: 1000 }, message: 'Connected successfully' });
});

app.post('/api/startTrading', (req, res) => {
    const { sessionId, initialInvestment, targetProfit, timeLimit, riskLevel, tradingSpeed, tradingPairs } = req.body;
    
    const botId = 'bot_' + Date.now();
    database.activeTrades[botId] = {
        id: botId, sessionId, initialInvestment, targetProfit, timeLimit, riskLevel, tradingSpeed,
        tradingPairs, startedAt: new Date(), isRunning: true, currentProfit: 0, trades: []
    };
    
    database.sessions[sessionId].activeBot = botId;
    res.json({ success: true, botId, message: 'Trading started' });
});

app.post('/api/stopTrading', (req, res) => {
    const { sessionId } = req.body;
    const session = database.sessions[sessionId];
    if (session?.activeBot) {
        database.activeTrades[session.activeBot].isRunning = false;
        session.activeBot = null;
    }
    res.json({ success: true, message: 'Trading stopped' });
});

app.post('/api/tradingUpdate', (req, res) => {
    const { sessionId } = req.body;
    const session = database.sessions[sessionId];
    if (!session?.activeBot) return res.json({ success: true, currentProfit: 0 });
    
    const trade = database.activeTrades[session.activeBot];
    const newTrades = [];
    
    // Generate random trades for demo
    if (Math.random() > 0.7) {
        const profit = (Math.random() * 30 - 5);
        trade.currentProfit += profit;
        newTrades.push({
            symbol: trade.tradingPairs[0] || 'BTCUSDT',
            side: profit > 0 ? 'BUY' : 'SELL',
            quantity: (Math.random() * 0.1).toFixed(4),
            price: (Math.random() * 50000 + 10000).toFixed(2),
            profit: profit,
            timestamp: new Date().toISOString()
        });
        trade.trades.push(...newTrades);
    }
    
    res.json({ success: true, currentProfit: trade.currentProfit || 0, newTrades });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Halal AI Trading Bot running on port ${PORT}`);
});
