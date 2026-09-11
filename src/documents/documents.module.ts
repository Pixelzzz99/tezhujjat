import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PdfService } from './pdf.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, PdfService],
})
export class DocumentsModule {}
