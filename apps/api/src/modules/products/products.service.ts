import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsRepository } from './products.repository.js';
import { CreateProductDto } from './dto/create-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly repo: ProductsRepository) {}

  findAll(search?: string) {
    return this.repo.findAll(search);
  }

  async findById(id: string) {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  create(dto: CreateProductDto) {
    // Use null for absent optional nullable DB columns
    return this.repo.create({
      name: dto.name,
      description: dto.description ?? null,
      sku: dto.sku ?? null,
      barcode: dto.barcode ?? null,
      categoryId: dto.categoryId ?? null,
      imageUrl: dto.imageUrl ?? null,
    } as Parameters<typeof this.repo.create>[0]);
  }

  async update(id: string, dto: Partial<CreateProductDto>) {
    await this.findById(id);
    return this.repo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description ?? null }),
      ...(dto.sku !== undefined && { sku: dto.sku ?? null }),
      ...(dto.barcode !== undefined && { barcode: dto.barcode ?? null }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId ?? null }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl ?? null }),
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.repo.softDelete(id);
  }

  findVariants(productId: string) {
    return this.repo.findVariants(productId);
  }
}
