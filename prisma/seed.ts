import { PrismaClient, DocumentType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const contractHtml = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'documents', 'templates', 'contract.html'),
    'utf-8',
  );

  await prisma.template.upsert({
    where: { id: 'seed-contract-v1' },
    update: { htmlTemplate: contractHtml },
    create: {
      id: 'seed-contract-v1',
      type: DocumentType.CONTRACT,
      name: 'Договор оказания услуг (базовый, РУз)',
      htmlTemplate: contractHtml,
      version: 1,
      isActive: true,
    },
  });

  console.log('Seed завершён: шаблон договора загружен.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
