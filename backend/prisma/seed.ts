import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY);
}

async function main() {
  console.log('🌱 Seeding TransitOps database...');

  // Clean slate (children first for FK safety).
  await prisma.tripSafetyReview.deleteMany();
  await prisma.fuelLog.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.maintenanceLog.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicle.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  /* ---------- Drivers ---------- */
  const alex = await prisma.driver.create({
    data: {
      name: 'Alex Morgan',
      licenseNumber: 'DL-1001',
      licenseCategory: 'HeavyGoods',
      licenseExpiryDate: daysFromNow(400),
      contactNumber: '+1-555-0101',
      email: 'alex.morgan@nayatransit.com',
      address: '12 North Ave',
      safetyScore: 96,
    },
  });
  const bella = await prisma.driver.create({
    data: {
      name: 'Bella Chen',
      licenseNumber: 'DL-1002',
      licenseCategory: 'HeavyGoods',
      licenseExpiryDate: daysFromNow(220),
      contactNumber: '+1-555-0102',
      email: 'bella.chen@nayatransit.com',
      safetyScore: 88,
    },
  });
  const carlos = await prisma.driver.create({
    data: {
      name: 'Carlos Diaz',
      licenseNumber: 'DL-1003',
      licenseCategory: 'LightCommercial',
      licenseExpiryDate: daysFromNow(18), // expiring soon (dashboard highlight)
      contactNumber: '+1-555-0103',
      email: 'carlos.diaz@nayatransit.com',
      safetyScore: 72,
    },
  });
  const dana = await prisma.driver.create({
    data: {
      name: 'Dana White',
      licenseNumber: 'DL-1004',
      licenseCategory: 'HeavyGoods',
      licenseExpiryDate: daysFromNow(-5), // already expired
      contactNumber: '+1-555-0104',
      safetyScore: 60,
      status: 'OFF_DUTY',
    },
  });
  const evan = await prisma.driver.create({
    data: {
      name: 'Evan Reed',
      licenseNumber: 'DL-1005',
      licenseCategory: 'LightCommercial',
      licenseExpiryDate: daysFromNow(90),
      contactNumber: '+1-555-0105',
      safetyScore: 45,
      status: 'SUSPENDED',
    },
  });

  /* ---------- Users (one per role) ---------- */
  await prisma.user.createMany({
    data: [
      {
        name: 'Fiona Fleet',
        email: 'manager@nayatransit.com',
        passwordHash,
        role: 'FLEET_MANAGER',
      },
      {
        name: 'Sam Safety',
        email: 'safety@nayatransit.com',
        passwordHash,
        role: 'SAFETY_OFFICER',
      },
      {
        name: 'Fred Finance',
        email: 'finance@nayatransit.com',
        passwordHash,
        role: 'FINANCIAL_ANALYST',
      },
    ],
  });
  // Driver-role account linked to Alex's profile.
  await prisma.user.create({
    data: {
      name: 'Alex Morgan',
      email: 'driver@nayatransit.com',
      passwordHash,
      role: 'DRIVER',
      driverId: alex.id,
    },
  });

  // User accounts for the other drivers to make them "registered"
  await prisma.user.create({
    data: {
      name: 'Bella Chen',
      email: 'bella.chen@nayatransit.com',
      passwordHash,
      role: 'DRIVER',
      driverId: bella.id,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Carlos Diaz',
      email: 'carlos.diaz@nayatransit.com',
      passwordHash,
      role: 'DRIVER',
      driverId: carlos.id,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Dana White',
      email: 'dana.white@nayatransit.com',
      passwordHash,
      role: 'DRIVER',
      driverId: dana.id,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Evan Reed',
      email: 'evan.reed@nayatransit.com',
      passwordHash,
      role: 'DRIVER',
      driverId: evan.id,
    },
  });

  /* ---------- Vehicles ---------- */
  const van05 = await prisma.vehicle.create({
    data: {
      registrationNo: 'VAN-05',
      name: 'Van-05',
      type: 'Van',
      region: 'North',
      maxLoadCapacity: 500,
      odometer: 42000,
      acquisitionCost: 35000,
    },
  });
  const truck12 = await prisma.vehicle.create({
    data: {
      registrationNo: 'TRK-12',
      name: 'Truck-12',
      type: 'Truck',
      region: 'South',
      maxLoadCapacity: 5000,
      odometer: 118000,
      acquisitionCost: 90000,
    },
  });
  const truck07 = await prisma.vehicle.create({
    data: {
      registrationNo: 'TRK-07',
      name: 'Truck-07',
      type: 'Truck',
      region: 'East',
      maxLoadCapacity: 4000,
      odometer: 76000,
      acquisitionCost: 82000,
    },
  });
  const van09 = await prisma.vehicle.create({
    data: {
      registrationNo: 'VAN-09',
      name: 'Van-09',
      type: 'Van',
      region: 'West',
      maxLoadCapacity: 600,
      odometer: 15000,
      acquisitionCost: 38000,
      status: 'IN_SHOP',
    },
  });
  const oldRig = await prisma.vehicle.create({
    data: {
      registrationNo: 'TRK-01',
      name: 'Truck-01 (Legacy)',
      type: 'Truck',
      region: 'North',
      maxLoadCapacity: 3000,
      odometer: 320000,
      acquisitionCost: 60000,
      status: 'RETIRED',
    },
  });

  /* ---------- Trips (mix of completed + active + draft) ---------- */
  // Completed trip for Truck-12 (feeds fuel efficiency / ROI).
  const t1 = await prisma.trip.create({
    data: {
      tripNumber: 'TRP-00001',
      source: 'Warehouse A',
      destination: 'Depot B',
      vehicleId: truck12.id,
      driverId: bella.id,
      cargoWeight: 3200,
      plannedDistance: 480,
      actualDistance: 495,
      fuelConsumed: 140,
      revenue: 12000,
      status: 'COMPLETED',
      dispatchedAt: new Date(Date.now() - 6 * DAY),
      completedAt: new Date(Date.now() - 5 * DAY),
    },
  });
  // Second completed trip for Truck-12.
  await prisma.trip.create({
    data: {
      tripNumber: 'TRP-00002',
      source: 'Depot B',
      destination: 'Port C',
      vehicleId: truck12.id,
      driverId: bella.id,
      cargoWeight: 2800,
      plannedDistance: 300,
      actualDistance: 310,
      fuelConsumed: 95,
      revenue: 8000,
      status: 'COMPLETED',
      dispatchedAt: new Date(Date.now() - 3 * DAY),
      completedAt: new Date(Date.now() - 2 * DAY),
    },
  });
  // Completed trip for Truck-07.
  const t3 = await prisma.trip.create({
    data: {
      tripNumber: 'TRP-00003',
      source: 'Hub East',
      destination: 'Retail Center',
      vehicleId: truck07.id,
      driverId: alex.id,
      cargoWeight: 3500,
      plannedDistance: 210,
      actualDistance: 205,
      fuelConsumed: 70,
      revenue: 6500,
      status: 'COMPLETED',
      dispatchedAt: new Date(Date.now() - 4 * DAY),
      completedAt: new Date(Date.now() - 3 * DAY),
    },
  });
  // Draft trip ready to dispatch (Van-05 + Alex both AVAILABLE).
  await prisma.trip.create({
    data: {
      tripNumber: 'TRP-00004',
      source: 'Warehouse A',
      destination: 'Warehouse D',
      vehicleId: van05.id,
      driverId: alex.id,
      cargoWeight: 450,
      plannedDistance: 120,
      revenue: 5000,
      status: 'DRAFT',
    },
  });

  /* ---------- Maintenance ---------- */
  // Open log keeping Van-09 IN_SHOP.
  await prisma.maintenanceLog.create({
    data: {
      vehicleId: van09.id,
      description: 'Brake pad replacement',
      cost: 650,
      isActive: true,
    },
  });
  // Closed historical log on Truck-12.
  await prisma.maintenanceLog.create({
    data: {
      vehicleId: truck12.id,
      description: 'Oil change & filter',
      cost: 800,
      isActive: false,
      openedAt: new Date(Date.now() - 10 * DAY),
      closedAt: new Date(Date.now() - 9 * DAY),
    },
  });

  /* ---------- Fuel logs ---------- */
  await prisma.fuelLog.createMany({
    data: [
      { vehicleId: truck12.id, tripId: t1.id, liters: 140, cost: 210 },
      { vehicleId: truck07.id, tripId: t3.id, liters: 70, cost: 105 },
      { vehicleId: van05.id, liters: 20, cost: 32 },
    ],
  });

  /* ---------- Expenses (some dated today for the dashboard widget) ---------- */
  const today = new Date();
  await prisma.expense.createMany({
    data: [
      { vehicleId: truck12.id, type: 'TOLL', amount: 45, date: today, notes: 'Highway toll' },
      { vehicleId: truck07.id, type: 'TOLL', amount: 30, date: today },
      { vehicleId: van05.id, type: 'OTHER', amount: 60, date: today, notes: 'Parking' },
      {
        vehicleId: truck12.id,
        type: 'MAINTENANCE',
        amount: 120,
        date: new Date(Date.now() - 8 * DAY),
        notes: 'Wiper blades',
      },
    ],
  });

  console.log('✅ Seed complete.');
  console.log('\nLogin accounts (password: password123):');
  console.log('  Fleet Manager     → manager@nayatransit.com');
  console.log('  Safety Officer    → safety@nayatransit.com');
  console.log('  Financial Analyst → finance@nayatransit.com');
  console.log('  Driver            → driver@nayatransit.com');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
