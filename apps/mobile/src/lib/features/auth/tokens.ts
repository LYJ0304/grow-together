import { z } from 'zod';

export type TokenStorage = {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
};

const tokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
});

export type Tokens = z.infer<typeof tokensSchema>;

export function parseTokens(value: unknown): Tokens {
  const result = tokensSchema.safeParse(value);
  if (!result.success) {
    throw new Error('로그인 응답을 확인하지 못했어요. 다시 로그인해 주세요.');
  }
  return result.data;
}
