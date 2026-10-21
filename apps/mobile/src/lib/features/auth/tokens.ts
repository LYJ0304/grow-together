export type TokenStorage = {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
};
export type Tokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};
export function parseTokens(value: unknown): Tokens {
  const tokens = value as Partial<Tokens> | null;
  if (
    !tokens ||
    typeof tokens.accessToken !== 'string' ||
    !tokens.accessToken ||
    typeof tokens.refreshToken !== 'string' ||
    !tokens.refreshToken ||
    tokens.tokenType !== 'Bearer' ||
    typeof tokens.expiresIn !== 'number' ||
    !Number.isInteger(tokens.expiresIn) ||
    tokens.expiresIn <= 0
  ) {
    throw new Error('로그인 응답을 확인하지 못했어요. 다시 로그인해 주세요.');
  }
  return tokens as Tokens;
}
