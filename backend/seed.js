require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const users = [
  { name: 'Admin User',  email: 'admin@telled.com',     password: 'Admin@123', role: 'admin',      baseSalary: 80000 },
  { name: 'Sales Rep 1', email: 'sales1@telled.com',    password: 'Sales@123', role: 'sales',      baseSalary: 45000 },
  { name: 'Sales Rep 2', email: 'sales2@telled.com',    password: 'Sales@123', role: 'sales',      baseSalary: 45000 },
  { name: 'Engineer 1',  email: 'engineer1@telled.com', password: 'Eng@123',   role: 'engineer',   baseSalary: 55000 },
  { name: 'Engineer 2',  email: 'engineer2@telled.com', password: 'Eng@123',   role: 'engineer',   baseSalary: 55000 },
  { name: 'HR Manager',  email: 'hr@telled.com',        password: 'HR@123',    role: 'hr_finance', baseSalary: 60000 },
];

const UserSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  password:     { type: String, required: true },
  role:         { type: String, required: true },
  baseSalary:   { type: Number, default: 0 },
  isActive:     { type: Boolean, default: true },
  refreshToken: { type: String },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  await User.deleteMany({});
  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 12);
    await User.create({ ...u, password: hashed });
    console.log(`Created: ${u.role} — ${u.email} / ${u.password}`);
  }

  console.log('\n=== SEED COMPLETE ===');
  console.log('Login with any of the above credentials at http://localhost:5173');
  await mongoose.disconnect();
}

run().catch(e => { console.error('Seed failed:', e); process.exit(1); });
