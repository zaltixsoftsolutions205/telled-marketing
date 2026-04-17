/**
 * One-time script to create the Zaltix platform admin user.
 *
 * Usage:
 *   cd backend
 *   npx ts-node src/scripts/createPlatformAdmin.ts
 *
 * Set these env vars (or put them in .env):
 *   PLATFORM_ADMIN_EMAIL   — email to log in with
 *   PLATFORM_ADMIN_PASSWORD — initial password (change after first login)
 *   PLATFORM_ADMIN_NAME    — display name
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User';
import Organization from '../models/Organization';

const PLATFORM_ORG_NAME = 'Zaltix Platform';
const email    = process.env.PLATFORM_ADMIN_EMAIL    || 'platform@zaltixsoftsolutions.com';
const password = process.env.PLATFORM_ADMIN_PASSWORD || 'Zaltix@Admin2026';
const name     = process.env.PLATFORM_ADMIN_NAME     || 'Zaltix Admin';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`User ${email} already exists (role: ${existing.role}). Exiting.`);
    process.exit(0);
  }

  // Ensure a platform org exists
  let org = await Organization.findOne({ name: PLATFORM_ORG_NAME });
  if (!org) {
    const placeholder = new mongoose.Types.ObjectId();
    org = await new Organization({
      name: PLATFORM_ORG_NAME,
      slug: 'zaltix-platform',
      ownerId: placeholder,
      isActive: true,
    }).save();
  }

  const user = await new User({
    name,
    email,
    password,
    role: 'platform_admin',
    organizationId: org._id,
    isActive: true,
  }).save();

  org.ownerId = user._id as mongoose.Types.ObjectId;
  await org.save();

  console.log(`✅ Platform admin created:`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role:     platform_admin`);
  console.log(`Change the password immediately after first login!`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
