import { prisma } from './db';

async function main() {
  console.log('Seeding initial data...');

  await prisma.payment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.customer.deleteMany();

  const c1 = await prisma.customer.create({
    data: {
      name: 'Ramesh Kumar',
      relationshipType: 'S/O',
      relationshipName: 'Subramanian Pillai',
      village: 'Anna Nagar',
      mobile: '9840123456',
      address: 'No. 14, Main Road, Anna Nagar',
      remarks: 'Regular customer for gold pledges'
    }
  });

  const c2 = await prisma.customer.create({
    data: {
      name: 'Lakshmi Devi',
      relationshipType: 'W/O',
      relationshipName: 'Venkatesan',
      village: 'Gandhi Chowk',
      mobile: '9443567890',
      address: 'Door 8/2, North Street',
      remarks: 'Pledged silver ornaments'
    }
  });

  const c3 = await prisma.customer.create({
    data: {
      name: 'Karthik Raja',
      relationshipType: 'S/O',
      relationshipName: 'Sundaram',
      village: 'Station Road',
      mobile: '9790112233',
      address: 'Plot 45, Railway Station Road',
      remarks: 'VIP customer'
    }
  });

  // Create sample loans
  await prisma.loan.create({
    data: {
      customerId: c1.id,
      itemName: '22K Gold Bangle Set',
      itemDescription: '2 Pair heavy craft bangles with BIS hallmark stamp',
      metalType: 'GOLD',
      weight: 24.5,
      loanDate: '2024-01-15',
      principal: 120000,
      interestRate: 2.0,
      compoundFrequency: 'MONTHLY',
      loanPeriod: 12,
      calculatedInterest: 18450,
      finalAmount: 138450,
      amountPaid: 0,
      outstandingBalance: 138450,
      releaseStatus: 'ACTIVE',
      calculationDate: '2024-08-01',
      remarks: 'First pledge item'
    }
  });

  await prisma.loan.create({
    data: {
      customerId: c1.id,
      itemName: 'Gold Neck Chain 24K',
      itemDescription: 'Thin rope design neck chain',
      metalType: 'GOLD',
      weight: 12.0,
      loanDate: '2024-03-10',
      principal: 60000,
      interestRate: 2.5,
      compoundFrequency: 'THREE_MONTHS',
      loanPeriod: 6,
      calculatedInterest: 7800,
      finalAmount: 67800,
      amountPaid: 0,
      outstandingBalance: 67800,
      releaseStatus: 'ACTIVE',
      calculationDate: '2024-08-01',
      remarks: 'Emergency loan'
    }
  });

  await prisma.loan.create({
    data: {
      customerId: c2.id,
      itemName: 'Silver Anklets & Lamp',
      itemDescription: 'Traditional heavy silver anklet pair and 200g silver vilakku',
      metalType: 'SILVER',
      weight: 450.0,
      loanDate: '2024-02-01',
      releaseDate: '2024-06-01',
      principal: 30000,
      interestRate: 2.0,
      compoundFrequency: 'MONTHLY',
      loanPeriod: 6,
      calculatedInterest: 2400,
      finalAmount: 32400,
      amountPaid: 32400,
      outstandingBalance: 0,
      releaseStatus: 'RELEASED',
      calculationDate: '2024-06-01',
      remarks: 'Full payment made on June 1'
    }
  });

  await prisma.loan.create({
    data: {
      customerId: c3.id,
      itemName: 'Gold Ring 18K',
      itemDescription: 'Gents ruby ring',
      metalType: 'GOLD',
      weight: 8.5,
      loanDate: '2024-05-20',
      principal: 40000,
      interestRate: 2.5,
      compoundFrequency: 'MONTHLY',
      loanPeriod: 12,
      calculatedInterest: 2300,
      finalAmount: 42300,
      amountPaid: 10000,
      outstandingBalance: 32300,
      releaseStatus: 'ACTIVE',
      calculationDate: '2024-08-01',
      remarks: 'Partial payment received'
    }
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
