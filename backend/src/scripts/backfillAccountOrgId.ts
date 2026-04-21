/**
 * One-time migration: backfill organizationId on all Account documents.
 *
 * Strategy:
 *   Account.assignedSales → User.organizationId
 *   Fallback: Account.leadId → Lead.assignedTo → User.organizationId
 *
 * Usage:
 *   cd backend
 *   npx ts-node src/scripts/backfillAccountOrgId.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Account from '../models/Account';
import User from '../models/User';
import Lead from '../models/Lead';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || '';

async function run() {
  if (!MONGO_URI) {
    console.error('MONGO_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const accounts = await Account.find({ organizationId: { $exists: false } }).lean();
  console.log(`Found ${accounts.length} accounts without organizationId`);

  let updated = 0;
  let skipped = 0;

  for (const account of accounts) {
    let orgId: mongoose.Types.ObjectId | null = null;

    // Try assignedSales → User.organizationId
    if (account.assignedSales) {
      const salesUser = await User.findById(account.assignedSales).select('organizationId').lean();
      if (salesUser?.organizationId) {
        orgId = salesUser.organizationId as mongoose.Types.ObjectId;
      }
    }

    // Fallback: leadId → Lead.assignedTo → User.organizationId
    if (!orgId && account.leadId) {
      const lead = await Lead.findById(account.leadId).select('assignedTo').lean();
      if (lead?.assignedTo) {
        const leadUser = await User.findById(lead.assignedTo).select('organizationId').lean();
        if (leadUser?.organizationId) {
          orgId = leadUser.organizationId as mongoose.Types.ObjectId;
        }
      }
    }

    if (orgId) {
      await Account.updateOne({ _id: account._id }, { $set: { organizationId: orgId } });
      updated++;
      console.log(`  ✓ ${account.companyName} → org ${orgId}`);
    } else {
      skipped++;
      console.warn(`  ✗ Could not determine org for account ${account._id} (${account.companyName})`);
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
