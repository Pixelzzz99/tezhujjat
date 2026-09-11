import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from './pdf.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { DocumentType } from '@prisma/client';

const FREE_PLAN_MONTHLY_LIMIT = 2;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  // Проверка лимита free-плана. На MVP — простая проверка счётчика без cron-сброса;
  // сброс periodStart/documentsUsedThisMonth добавляется отдельной джобой во второй итерации.
  private async assertCanGenerate(userId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!subscription) return; // на MVP отсутствие подписки не блокирует — считаем free по умолчанию

    if (
      subscription.plan === 'FREE' &&
      subscription.documentsUsedThisMonth >= FREE_PLAN_MONTHLY_LIMIT
    ) {
      throw new ForbiddenException(
        `Достигнут лимит бесплатного плана (${FREE_PLAN_MONTHLY_LIMIT} документа/мес). Оформите подписку Pro для безлимитной генерации.`,
      );
    }
  }

  private async incrementUsage(userId: string): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { userId },
      data: { documentsUsedThisMonth: { increment: 1 } },
    });
  }

  private async nextDocumentNumber(userId: string): Promise<number> {
    const count = await this.prisma.document.count({ where: { userId } });
    return count + 1;
  }

  async createContract(userId: string, dto: CreateContractDto) {
    await this.assertCanGenerate(userId);

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(
        'Сначала заполните реквизиты профиля (ИП/самозанятый) перед созданием документа.',
      );
    }

    const template = await this.prisma.template.findFirst({
      where: { type: DocumentType.CONTRACT, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!template) {
      throw new NotFoundException('Активный шаблон договора не найден.');
    }

    const documentNumber = await this.nextDocumentNumber(userId);

    const templateData = {
      documentNumber,
      contractCity: dto.contractCity,
      contractDate: new Date().toLocaleDateString('ru-RU'),
      executorName: profile.fullName,
      executorInn: profile.inn,
      executorAddress: profile.address,
      executorBankAccount: profile.bankAccount,
      executorBankName: profile.bankName,
      executorMfo: profile.mfo,
      executorPhone: profile.phone,
      clientName: dto.clientName,
      clientInn: dto.clientInn,
      clientAddress: dto.clientAddress,
      serviceDescription: dto.serviceDescription,
      startDate: dto.startDate,
      endDate: dto.endDate,
      amount: dto.amount,
      currency: dto.currency,
      paymentTerms: dto.paymentTerms,
    };

    const pdfBuffer = await this.pdfService.generatePdf(
      'contract.html',
      templateData,
    );

    // На MVP PDF отдаём напрямую в ответе; в след. итерации — заливка в S3/облако и сохранение pdfUrl
    const document = await this.prisma.document.create({
      data: {
        userId,
        templateId: template.id,
        type: DocumentType.CONTRACT,
        data: templateData,
        documentNumber,
        status: 'ISSUED',
      },
    });

    await this.incrementUsage(userId);

    return { document, pdfBuffer };
  }

  async listForUser(userId: string) {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
