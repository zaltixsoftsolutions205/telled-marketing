/**
 * One-time migration: rename all hr_finance users to finance.
 * Run once after deploying the new role split:
 *   npx ts-node src/scripts/migrateHrFinanceRole.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const result = await mongoose.connection.collection('users').updateMany(
    { role: 'hr_finance' },
    { $set: { role: 'finance' } }
  );
  console.log(`Migrated ${result.modifiedCount} user(s) from hr_finance → finance`);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
