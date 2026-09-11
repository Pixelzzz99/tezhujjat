import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

// Аутентификация обеспечивается JwtAuthGuard/AuthModule — userId берётся из токена.
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('contract')
  async createContract(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateContractDto,
    @Res() res: Response,
  ) {
    const { pdfBuffer, document } = await this.documentsService.createContract(
      userId,
      dto,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="contract-${document.documentNumber}.pdf"`,
    });
    res.send(pdfBuffer);
  }

  @Get()
  async list(@CurrentUser('id') userId: string) {
    return this.documentsService.listForUser(userId);
  }
}
