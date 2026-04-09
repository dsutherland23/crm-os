import { Module } from '@nestjs/common';
import { PosController } from './pos.controller.js';
import { PosService } from './pos.service.js';
import { PosRepository } from './pos.repository.js';

@Module({
  controllers: [PosController],
  providers: [PosService, PosRepository],
  exports: [PosService],
})
export class PosModule {}
