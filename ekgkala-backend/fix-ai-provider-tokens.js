/**
 * Migration: Update AI Provider maxTokens from 500 → 2048
 * 
 * This script updates ALL AI providers in the database that still have
 * maxTokens = 500 (the old default) to 2048.
 * 
 * Usage: node fix-ai-provider-tokens.js
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala';

async function migrate() {
  try {
    console.log('[Migration] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[Migration] Connected.');

    const result = await mongoose.connection.db.collection('aiproviders').updateMany(
      { maxTokens: { $lte: 500 } },
      { $set: { maxTokens: 2048 } }
    );

    console.log(`[Migration] Updated ${result.modifiedCount} provider(s) from maxTokens=500 to maxTokens=2048.`);

    // Also verify current providers
    const providers = await mongoose.connection.db.collection('aiproviders').find({}).toArray();
    for (const p of providers) {
      console.log(`[Migration] Provider "${p.name}" | model=${p.model} | maxTokens=${p.maxTokens} | isActive=${p.isActive} | isDefault=${p.isDefault}`);
    }

    await mongoose.disconnect();
    console.log('[Migration] Done.');
    process.exit(0);
  } catch (error) {
    console.error('[Migration] Error:', error);
    process.exit(1);
  }
}

migrate();