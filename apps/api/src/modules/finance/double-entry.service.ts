import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@crm-os/db';
import { DATABASE_TOKEN } from '../../core/database/database.module.js';
import { getTenantContext } from '../../core/tenant/tenant.context.js';
import { randomUUID } from 'crypto';

export interface JournalLine {
  accountId: string;
  debitCents: number;
  creditCents: number;
  description?: string;
}

export interface JournalEntryInput {
  description: string;
  referenceType?: string;
  referenceId?: string;
  lines: JournalLine[];
}

@Injectable()
export class DoubleEntryService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Create a balanced journal entry.
   * First validates SUM(debit) === SUM(credit) at service layer.
   * DB trigger is the second line of defense.
   */
  async createEntry(input: JournalEntryInput, postedById: string) {
    const ctx = getTenantContext();

    const totalDebit = input.lines.reduce((s, l) => s + l.debitCents, 0);
    const totalCredit = input.lines.reduce((s, l) => s + l.creditCents, 0);

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Double-entry violation: debit (${totalDebit}¢) ≠ credit (${totalCredit}¢)`,
      );
    }

    return this.db.transaction(async (tx) => {
      const [entry] = await tx
        .insert(schema.journalEntries)
        .values({
          tenantId: ctx.tenantId,
          entryNumber: `JE-${Date.now()}`,
          description: input.description,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          postedById,
        })
        .returning();

      if (!entry) throw new Error('Failed to create journal entry');

      await tx.insert(schema.journalLines).values(
        input.lines.map((line) => ({
          tenantId: ctx.tenantId,
          journalEntryId: entry.id,
          accountId: line.accountId,
          debitCents: line.debitCents,
          creditCents: line.creditCents,
          description: line.description ?? null,
        })),
      );

      return entry;
    });
  }
}
