import { PrismaClient } from "@prisma/client";
import { repriceSeededMarkets } from "@/lib/seeded-market-repricing.service";

const prisma = new PrismaClient();

function shouldApply() {
  return process.argv.includes("--apply");
}

async function main() {
  const apply = shouldApply();
  const result = await repriceSeededMarkets(prisma, { apply, log: console.log });
  console.log(`${apply ? "Applied" : "Dry run"} complete: ${result.checked} checked, ${result.changed} changed, ${result.skipped} skipped.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
