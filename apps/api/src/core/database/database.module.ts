import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@crm-os/db';

export const DATABASE_TOKEN = 'DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>('DATABASE_URL');
        
        // Create postgres client with prepared statement support disabled for Supabase pooler
        const client = postgres(url, { 
          max: 20, 
          idle_timeout: 30,
          prepare: false, // Required for Supabase pooler
        });
        
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule {}
