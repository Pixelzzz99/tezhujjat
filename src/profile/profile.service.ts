import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateProfileDto) {
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException(
        'Профиль уже создан. Используйте обновление реквизитов.',
      );
    }

    return this.prisma.profile.create({ data: { userId, ...dto } });
  }

  async getOwn(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Профиль ещё не заполнен.');
    }
    return profile;
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
    });
    if (!existing) {
      throw new NotFoundException(
        'Профиль ещё не заполнен. Сначала создайте его.',
      );
    }

    return this.prisma.profile.update({ where: { userId }, data: dto });
  }
}
