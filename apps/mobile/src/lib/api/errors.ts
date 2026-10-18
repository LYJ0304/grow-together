export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const messages: Record<string, string> = {
  EMAIL_ALREADY_EXISTS: '이미 가입된 이메일이에요.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호를 확인해 주세요.',
  INVALID_REQUEST: '입력 내용을 확인해 주세요.',
  UNAUTHORIZED: '다시 로그인해 주세요.',
  INVALID_REFRESH_TOKEN: '로그인이 만료되었어요. 다시 로그인해 주세요.',
  FORBIDDEN: '접근 권한이 없어요.',
  NOT_FOUND: '요청한 정보를 찾지 못했어요.',
  CONFLICT: '이미 처리되었거나 다른 기록에 연결된 정보예요.',
};