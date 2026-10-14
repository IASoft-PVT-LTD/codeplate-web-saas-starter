// drizzle-kit reads this to generate migrations from src/db/schema.ts:
//   npm run db:generate
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
