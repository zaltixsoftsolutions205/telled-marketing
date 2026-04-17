import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from '../models/User';
import Lead from '../models/Lead';
import logger from './logger';

const users = [
  { name: 'Admin User', email: 'admin@telled.com', password: 'Admin@123', role: 'admin', baseSalary: 80000 },
  { name: 'Sales Rep 1', email: 'sales1@telled.com', password: 'Sales@123', role: 'sales', baseSalary: 45000 },
  { name: 'Sales Rep 2', email: 'sales2@telled.com', password: 'Sales@123', role: 'sales', baseSalary: 45000 },
  { name: 'Engineer 1', email: 'engineer1@telled.com', password: 'Eng@123', role: 'engineer', baseSalary: 55000 },
  { name: 'Engineer 2', email: 'engineer2@telled.com', password: 'Eng@123', role: 'engineer', baseSalary: 55000 },
  { name: 'HR Manager', email: 'hr@telled.com', password: 'HR@123', role: 'hr_finance', baseSalary: 60000 },
];

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    await User.deleteMany({});
    const created = await Promise.all(users.map(u => new User(u).save()));
    const sales = created.filter(u => u.role === 'sales');

    await Lead.deleteMany({});
    await Lead.insertMany([
      { companyName: 'TechCorp Solutions', contactName: 'Rajesh Kumar', contactEmail: 'rajesh@techcorp.com', phone: '9876543210', source: 'Website', oemName: 'Cisco', assignedSales: sales[0]._id, stage: 'New' },
      { companyName: 'Global Industries', contactName: 'Priya Sharma', contactEmail: 'priya@global.com', phone: '9876543211', source: 'Referral', oemName: 'Honeywell', assignedSales: sales[0]._id, stage: 'OEM Pending' },
      { companyName: 'Smart Manufacturing', contactName: 'Amit Patel', contactEmail: 'amit@smart.com', phone: '9876543212', source: 'Exhibition', oemName: 'ABB', assignedSales: sales[1]._id, stage: 'Technical Discussion' },
      { companyName: 'Future Systems', contactName: 'Sunita Rao', contactEmail: 'sunita@future.com', phone: '9876543213', source: 'LinkedIn', oemName: 'Siemens', assignedSales: sales[1]._id, stage: 'OEM Approved' },
    ]);

    logger.info('\n=== SEED COMPLETE ===');
    users.forEach(u => logger.info(`  ${u.role}: ${u.email} / ${u.password}`));
  } catch (e) {
    logger.error('Seed failed:', e);
  } finally {
    await mongoose.disconnect();
  }
};

run();
