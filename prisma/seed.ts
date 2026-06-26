import { PrismaClient, LeadSource, LeadStatus } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seeds a demo broker with a couple of properties and leads so the dashboard
 * has data during local development.
 *
 * NOTE: This broker is NOT linked to a Supabase auth user, so you cannot log in
 * as them. To test the full auth flow, register through the UI instead, then
 * (optionally) copy the authUserId into a broker here.
 */
async function main() {
  const broker = await prisma.broker.upsert({
    where: { email: "demo@brokerpulse.app" },
    update: {},
    create: {
      email: "demo@brokerpulse.app",
      name: "Demo Broker",
      phone: "+919999999999",
    },
  });

  const powai = await prisma.property.create({
    data: {
      brokerId: broker.id,
      title: "2BHK in Powai",
      location: "Powai, Mumbai",
      price: "₹85L",
      bedrooms: 2,
      description: "Lake-facing 2BHK in a gated society.",
    },
  });

  await prisma.lead.create({
    data: {
      brokerId: broker.id,
      propertyId: powai.id,
      name: "Rahul Sharma",
      phone: "+919812345678",
      budget: "₹80L – 90L",
      source: LeadSource.NINETYNINEACRES,
      status: LeadStatus.NEW,
    },
  });

  console.log("Seed complete. Demo broker:", broker.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
